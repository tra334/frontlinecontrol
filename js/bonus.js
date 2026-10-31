(function () {
  "use strict";
  const POLL_MS = 60000;      // re-check for new bonuses every minute
  let offers = [];            // unclaimed, active bonuses
  let busy = false;
  let dbg = true;

  const ready = () => typeof AU !== "undefined" && AU && AU.user && AU.user.id && gameOn && S;

  async function refresh() {
    if (busy || !ready()) return;
    busy = true;
    try {
      const iso = encodeURIComponent(new Date().toISOString());
      const [bs, cs] = await Promise.all([
        sb("/rest/v1/global_bonuses?select=id,title,amount,ends_at&starts_at=lte." + iso + "&ends_at=gt." + iso + "&order=ends_at.asc", { auth: 1 }),
        sb("/rest/v1/global_bonus_claims?select=bonus_id&user_id=eq." + AU.user.id, { auth: 1 })
      ]);
      const got = new Set((cs || []).map(c => c.bonus_id));
      const prev = new Set(offers.map(o => o.id));
      offers = (bs || []).filter(b => !got.has(b.id));
      if (dbg) { dbg = false; try { toast("Bonus check: " + (bs || []).length + " active, " + got.size + " claimed, " + offers.length + " to claim"); } catch (e) {} }
      if (offers.some(o => !prev.has(o.id))) {
        try { toast("A bonus is waiting for you – open Ranks to claim it"); } catch (e) {}
      }
    } catch (e) {
      console.error("Bonus check failed", e);
      if (dbg) { dbg = false; try { toast("Bonus check failed: " + ((e && (e.status ? e.status + " " : "") + e.message) || "unknown")); } catch (x) {} }
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
    try {
      /* claim row first: the (bonus_id,user_id) primary key stops double claims */
      await sb("/rest/v1/global_bonus_claims", {
        method: "POST", auth: 1,
        headers: { Prefer: "return=minimal" },
        body: { bonus_id: id, user_id: AU.user.id }
      });
    } catch (e) {
      if (e && (e.status === 409 || /duplicate|unique/i.test(String(e.message || "")))) {
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
