(function () {
  "use strict";
  const POLL_MS = 60000;      // re-check for new bonuses every minute
  let offers = [];            // unclaimed, active bonuses
  let busy = false;

  /* Bonuses live on the game server (GET /api/bonuses, POST /api/bonuses/claim); sign-in is the only thing that still uses Supabase */
  async function gb(path, body) {
    if (AU.expires_at - 30 < Date.now() / 1000) await sb("/auth/v1/user", { auth: 1 }); // refreshes the login token only when it is about to expire
    const base = window.FC_API || "https://api.frontlinecontrol.co.uk";
    let r;
    try {
      r = await fetch(base + "/api/bonuses" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: "Bearer " + AU.access_token, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (e) { throw { status: 0, message: "Can't reach the game server" }; }
    const j = await r.json().catch(() => ({ ok: false, reason: "bad reply from server" }));
    if (!r.ok || !j.ok) throw { status: r.status, message: j.reason || ("Server error " + r.status) };
    return j;
  }

  const ready = () => typeof AU !== "undefined" && AU && AU.user && AU.user.id && gameOn && S;

  async function refresh() {
    if (busy || !ready()) return;
    busy = true;
    try {
      const j = await gb("");
      const prev = new Set(offers.map(o => o.id));
      offers = j.bonuses || [];
      if (offers.some(o => !prev.has(o.id))) {
        try { toast("A bonus is waiting for you – open Ranks to claim it"); } catch (e) {}
      }
    } catch (e) {
      console.error("Bonus check failed", e);
    }
    busy = false;
    try { paint(); } catch (e) {}
  }

  /* card shown at the top of the Ranks tab */
  function cardHtml() {
    if (!offers.length || !ready()) return "";
    return offers.map(o =>
      '<div class="card" style="border-left-color:#f97316"><div class="row"><span class="t">' + lci("gift") + " " + esc(o.title) +
      '</span><span class="mu">Ends ' + esc(new Date(o.ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })) + '</span></div>' +
      '<div style="margin-top:8px"><button onclick="gbClaim(\'' + esc(o.id) + '\')">Claim £' + fmt(o.amount) + '</button></div></div>'
    ).join("");
  }

  window.gbClaim = async function (id) {
    const o = offers.find(x => x.id === id);
    if (!o || !ready()) return;
    offers = offers.filter(x => x.id !== id);   /* hide at once so it can't be double-tapped */
    try { paint(); } catch (e) {}
    /* server mode: the game server records the claim and adds the credits (a browser-only credit is overwritten by the server's save) */
    if (window.SRV && SRV.on) {
      try { await SRV.act({ type: "claimbonus", id }); } catch (e) {}
      refresh();
      return;
    }
    try {
      /* the server records the claim first: one claim per player, so a second try is refused */
      const r = await gb("/claim", { id });
      if (r.bonus && Number.isFinite(+r.bonus.amount)) o.amount = +r.bonus.amount;
    } catch (e) {
      if (e && /already claimed/i.test(String(e.message || ""))) {
        toast("You've already claimed that bonus.");
      } else {
        console.error("Bonus claim failed", e);
        toast("Couldn't claim bonus. Try again.");
        refresh();
      }
      return;
    }
    S.cr += o.amount;
    try { ldg("bn", o.title, o.amount); } catch (e) {}
    try { log("🎁 " + o.title + ": +£" + fmt(o.amount)); } catch (e) {}
    persist();
    try { paint(); } catch (e) {}
    try { toast(o.title + " claimed: +£" + fmt(o.amount)); } catch (e) {}
    try { pushCloud(); } catch (e) {}
  };

  /* put the card at the top of the Ranks & rewards tab */
  const origRk = window.rkH;
  window.rkH = function () { return cardHtml() + origRk.apply(this, arguments); };

  setInterval(refresh, POLL_MS);
  const first = setInterval(() => { if (ready()) { clearInterval(first); refresh(); } }, 1500);
  addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
})();
