/* ===== Server mode (OFF by default) =====
   Open the site with ?server=1 to play on the game server; ?server=0 turns it off again.
   In server mode the browser only sends actions (answer / dispatch / buy / build) and draws what the server returns.
   If the server can't be reached at start-up, nothing here activates and the normal game runs. */
(function () {
  const API = window.FC_API || "https://api.frontlinecontrol.co.uk";
  try { const q = new URLSearchParams(location.search).get("server"); if (q === "1") localStorage.setItem("fc_server", "1"); if (q === "0") localStorage.removeItem("fc_server"); } catch (e) {}
  let want = false; try { want = localStorage.getItem("fc_server") === "1"; } catch (e) {}
  const SRV = window.SRV = { on: false, want };
  if (!want) return;

  async function call(path, body) {
    await sb("/auth/v1/user", { auth: 1 });                       // refreshes the login token if it is about to expire
    const t0 = Date.now();
    const r = await fetch(API + path, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + AU.access_token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({ ok: false, reason: "bad reply from server" })); j.http = r.status; j.t0 = t0; j.t1 = Date.now(); return j;
  }
  /* Game clock = server time. Each reply says what the server's clock read when it answered; the reply took
     about half the round trip to reach us, so the server clock "now" is j.now + rtt/2. Replies that came back
     fast are the most trustworthy, so we keep the best of the last few and ease towards it instead of jumping. */
  const CS = [];
  const clock = j => {
    if (!j || !j.now || !j.t0 || !j.t1) { if (j && j.now && !CS.length) SIMOFF = j.now - Date.now(); return; }
    const rtt = Math.max(0, j.t1 - j.t0), off = j.now + rtt / 2 - j.t1;
    CS.push({ rtt, off, at: j.t1 }); while (CS.length > 8) CS.shift();
    const best = CS.reduce((a, b) => (b.rtt < a.rtt ? b : a)), first = CS.length === 1;
    if (first || Math.abs(best.off - SIMOFF) > 5000) SIMOFF = best.off;         // first sample, or the clock was far out: snap
    else SIMOFF += (best.off - SIMOFF) * 0.25;                                   // otherwise glide, so markers never jump
  };

  /* Routes: the server alone decides each vehicle's route and when it set off (u.rt, u.t0). The browser never fetches
     or times routes of its own any more, so every device draws the same vehicle at the same place from the same clock. */

  // Called from pickState(): fetch the first state. Returns the save, or null (then the normal game runs).
  SRV.first = async function () {
    try {
      const j = await call("/api/state");
      if (!j.ok) throw new Error(j.reason || ("HTTP " + j.http));
      clock(j); activate(); return j.state;
    } catch (e) { console.error("Game server unavailable", e); try { alert("Game server unavailable (" + String(e.message || e).slice(0, 80) + "). Playing the normal way this time."); } catch (x) {} return null; }
  };

  function activate() {
    if (SRV.on) return; SRV.on = true;
    let busy = Promise.resolve();
    const refresh = () => { try { $("#v").dataset.n = ""; paint(); try { pzUp(); } catch (e) {} if (si && !$("#modal").hidden) drawS(); } catch (e) {} };
    function apply(j) { if (j && j.state) { clock(j); S = j.state; try { sbStatus("☁ Server game"); } catch (e) {} refresh(); } }
    const act = body => busy = busy.then(async () => {            // actions go one at a time, in order
      try { const j = await call("/api/action", body); if (!j.ok && j.reason) { try { toast(j.reason); } catch (e) {} } else if (j.ok && j.msg) { try { toast(j.msg); } catch (e) {} } apply(j); }
      catch (e) { try { toast("Can't reach the game server"); } catch (x) {} }
    });

    // 1) the browser no longer simulates or uploads its own save
    const uiTick = () => { try { if (si && !$("#modal").hidden && $("#sheet").dataset.k !== sk()) drawS(); const sh = $("#sheet"), qm = mm(curM); if (!$("#modal").hidden && sh.dataset.qk && qm && sh.dataset.qk !== qk(qm)) drawQ(); const re = document.getElementById("qrem"); if (re && qm && !$("#modal").hidden) re.innerHTML = remT(qm); paint(); } catch (e) {} };
    tick = uiTick;                       // (startGame schedules tick after this, so it picks up this version)
    catchUp = function () {};            // the server already caught the game up
    spd = function () { return 1; };     // the server always runs at normal speed; a local speed setting would put markers in the wrong place
    pushCloud = async function () {};    // never upload a browser save over the server's
    cloudSoon = function () {};

    // 2) player actions go to the server
    const openQ0 = openQ;
    openQ = function (id) { openQ0(id); act({ type: "answer", id }); };
    send = function (u, m) { act({ type: "dispatch", mid: m.id, units: [u.id] }); };
    buy = function (sid, ty) { act({ type: "buy", sid, ty }); };
    place = async function (la, lo, cn) {
      if (!bm) return; const sv = bm; bm = null;
      let name = cn; if (!name) { const loc = await nearPlace(la, lo); name = loc + " " + (HN[sv] || SN[sv]); }
      act({ type: "build", sv, lat: la, lon: lo, name });
    };

    // call handling that used to change only the browser's copy (and was wiped by the next refresh) now goes to the server
    ask = function (i) { const m = mm(curM); if (!m) return; act({ type: "ask", mid: m.id, i }).then(() => { try { drawQ(); } catch (e) {} }); };
    setTD = function (id, v) { if (!mm(id) || !v) return; act({ type: "settd", mid: id, v: String(v) }); if (curM === id && !$("#modal").hidden) closeM(); else paint(); };
    declineQ = function (id) { const m = mm(id); if (!m || m.ans) return; const e = $("#toast"); if (e && !e.hidden) { clearTimeout(tt); e.hidden = true; } act({ type: "decline", mid: id }); };
    skipM = function (id) { const m = mm(id); if (!m || !m.ans) return;
      confirmDlg("Skip this call?", "Are you sure you want to skip <b>" + T[m.k][1] + "</b>? It will be dropped with no reward (free, £0).", "Skip call", () => { act({ type: "skip", mid: id }); }, "#92400e"); };
    cancelU = function (id, all, st) { const m = mm(curM); if (!m) return;
      const us = S.un.filter(u => u.mid === m.id && canC(u) && (!st || u.st === st) && (all || u.id === id)); if (!us.length) return;
      if (all && !confirm("Cancel all " + us.length + " unit" + (us.length > 1 ? "s" : "") + " on this call?")) return;
      act({ type: "cancelu", mid: m.id, units: us.map(u => u.id) }).then(() => { try { drawQ(); } catch (e) {} }); };

    // buildings, vehicles, staff and rewards: the browser asks (and shows its own "are you sure?" box), the server does it
    const fn = (name, args, extra) => act(Object.assign({ type: "fn", name, args }, extra || {}));
    upgrade = id => fn("upgrade", [id]);
    train = (id, k) => fn("train", [id, k]);
    buyT = (sid, ty) => fn("buyT", [sid, ty]);
    buyCells = id => fn("buyCells", [id]);
    setOOS = (id, v) => fn("setOOS", [id, v ? 1 : 0]);
    mvUGo = (id, sid) => { fn("mvUGo", [id, sid]); try { closeUI(); } catch (e) {} };
    delU = id => { fn("delU", [id]); try { closeUI(); } catch (e) {} };
    delS = id => {
      const s = stn(id); if (!s) return; const us = S.un.filter(u => u.sid === id), away = us.filter(u => u.st !== "idle");
      if (hlock(s)) { toast("Can't delete " + s.name + " while prisoners are being held or transferred there."); return; }
      if (away.length) { toast("Can't delete " + s.name + ": " + away.length + " vehicle" + (away.length > 1 ? "s are" : " is") + " still out (" + away.map(u => u.cs).join(", ") + "). All vehicles must be back in the station."); return; }
      if (!confirm("Delete " + s.name + "?\n\n" + (us.length ? "All " + us.length + " vehicle" + (us.length > 1 ? "s" : "") + " based here will also be removed.\n" : "") + "You will be refunded £" + fmt(REFUND) + " only (no refund for vehicles or upgrades).\n\nThis cannot be undone.")) return;
      fn("delS", [id]);
    };
    delH = id => {
      const h = S.hs.find(x => x.id === id); if (!h) return;
      if (hlock(h)) { toast("Can't delete " + h.name + " while units are on the way or at the facility, or patients/prisoners are still inside. Wait until they have finished."); return; }
      if (!confirm("Delete " + h.name + "?\n\nThere is NO refund for hospitals or prisons.\n\nThis cannot be undone.")) return;
      fn("delH", [id]);
    };
    renS = id => { const s = stn(id); if (!s) return; const n = prompt("New name for this station (max 30 characters):", s.name); if (n === null) return; fn("renS", [id], { prompt: n }); };
    renH = id => { const h = S.hs.find(x => x.id === id); if (!h) return; const n = prompt("New name for this building (max 30 characters):", h.name); if (n === null) return; fn("renH", [id], { prompt: n }); };
    ren = id => { const u = S.un.find(x => x.id === id); if (!u) return; const n = prompt("New callsign for " + u.cs + " (max 12 characters):", u.cs); if (n === null) return; fn("ren", [id], { prompt: n }); };
    claimDaily = () => { const d = drState(); if (!d.can) return; fn("claimDaily", []).then(() => { try { dailyPop(d.day); } catch (e) {} }); };
    claimRank = () => fn("claimRank", []);
    claimStaff = () => fn("claimStaff", []);
    claimDev = () => { try { toast("The dev bonus isn't available in server mode."); } catch (e) {} };
    togglePause = () => fn("togglePause", []).then(() => { try { pzUp(); } catch (e) {} });
    sfAsg = (xid, uid) => fn("sfAsg", [xid, uid || 0]).then(() => { try { sfRef(); } catch (e) {} });
    sfAuto = sid => fn("sfAuto", [sid]).then(() => { try { sfRef(); } catch (e) {} });
    sfAutoV = uid => fn("sfAutoV", [uid]).then(() => { try { sfRef(); } catch (e) {} });
    sfFire = xid => {
      const x = S.sf.find(v => v.id === xid); if (!x || x.uid || x.tq) return;
      confirmDlg("Release staff member?", "Release <b>" + esc(x.n) + "</b>? They leave the service (no refund) and free up staff capacity.", "Release", () => { fn("sfFire", [xid]).then(() => { try { sfRef(); } catch (e) {} }); });
    };
    sfTrain = (xid, k, free) => {
      const x = S.sf.find(v => v.id === xid); if (!x || x.tq || x.tr.includes(k) || !TR[k] || TR[k][2] > rank()) return; const f = TR[k][1];
      const done = () => { try { if (sfv) sfv = sfv.back || sfv; sfRef(); } catch (e) {} };
      if (free) { fn("sfTrain", [xid, k, 1]).then(done); return; }
      if (S.cr < f) return;
      confirmDlg("Confirm purchase", "Pay <b>£" + fmt(f) + "</b> for <b>" + esc(x.n) + "</b> to qualify in <b>" + TR[k][0] + "</b> immediately?<br><span style=\"font-size:13px\">Balance after purchase: £" + fmt(S.cr - f) + "</span>", "Purchase", () => { fn("sfTrain", [xid, k, 0]).then(done); }, "#16a34a");
    };
    sfBuy = sid => {
      const s = stn(sid), i = $("#sfq"); if (!s || !i) return;
      const room = Math.max(0, stCap(s) - sfAt(sid).length); let n = Math.floor(+i.value || 0); n = Math.max(0, Math.min(room, n));
      if (!n) { toast("Enter how many staff to recruit."); return; }
      const c = n * STC; if (S.cr < c) { toast("Not enough credits."); return; }
      confirmDlg("Recruit staff", "Recruit <b>" + n + "</b> staff member" + (n > 1 ? "s" : "") + " at <b>" + esc(s.name) + "</b> for <b>£" + fmt(c) + "</b>?<br><span style=\"font-size:13px\">Balance after: £" + fmt(S.cr - c) + "</span>", "Recruit", () => { act({ type: "recruit", sid, n }).then(() => { try { sfRef(); } catch (e) {} }); }, "#16a34a");
    };
    spareGo = (sid, k, ids) => { const s = stn(sid); if (!s) return; fn("spareGo", [sid, k, (ids || []).map(Number)]); };

    SRV.act = act;                       // rooms.js uses this to ask the server to share a call

    // 3) pick up what the server is doing (calls arriving, units moving, jobs paid)
    const poll = () => { busy = busy.then(async () => { try { const j = await call("/api/state"); if (j.ok) apply(j); } catch (e) {} }); };
    setInterval(poll, 2000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") poll(); });   // refresh straight away on return
  }
})();
