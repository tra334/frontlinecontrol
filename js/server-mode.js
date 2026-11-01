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
    const r = await fetch(API + path, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + AU.access_token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({ ok: false, reason: "bad reply from server" })); j.http = r.status; return j;
  }
  const clock = j => { if (j && j.now) SIMOFF = j.now - Date.now(); };    // run the game clock on server time

  /* ---- Road routes in server mode ----
     The server sends units with a straight 2-point route (or none), so vehicles cut across the map.
     Here the browser fetches the real road route from OSRM (same request sim.js uses) for each moving
     unit, caches it per leg, and re-applies it every time a fresh server state arrives. The server's own
     route length is kept, so arrival timing still matches the server exactly. */
  const RC = {}, RQ = {};
  const rkey = u => u.id + "|" + u.st + "|" + JSON.stringify(u.a) + "|" + JSON.stringify(u.b);
  function fixRoads(list) {
    try {
      (list || []).forEach(u => {
        if (!(u.st === "out" || u.st === "back" || u.st === "hosp") || !u.a || !u.b) return;
        if (typeof SP !== "undefined" && SP[u.ty] >= 150) return;            // aircraft fly straight
        if (u.rt && u.rt.p && u.rt.p.length > 2) return;                      // already a real road route
        const k = rkey(u), c = RC[k];
        if (c) {
          u.rt = { p: c.p, d: c.d, len: (u.rt && u.rt.len) || c.len };
          if (!u.t0) u.t0 = c.t0;
          return;
        }
        if (RQ[k] && Date.now() - RQ[k] < 30000) return;                      // already asking (retry after 30s)
        RQ[k] = Date.now();
        const a = u.a, b = u.b, d0 = km(a, b);
        J("https://router.project-osrm.org/route/v1/driving/" + a[1] + "," + a[0] + ";" + b[1] + "," + b[0] +
          "?overview=" + (d0 > 40 ? "simplified" : "full") + "&geometries=geojson", 12000).then(j => {
          const q = j && j.routes && j.routes[0]; if (!q) return;
          const p = q.geometry.coordinates.map(x => [+x[1].toFixed(5), +x[0].toFixed(5)]);
          if (p.length < 2) return;
          const d = [0]; for (let i = 1; i < p.length; i++) d.push(+(d[i - 1] + km(p[i - 1], p[i])).toFixed(3));
          RC[k] = { p, d, len: d[d.length - 1], t0: now() };
          const ks = Object.keys(RC); if (ks.length > 300) delete RC[ks[0]];
          if (SRV.on) { fixRoads(S.un); try { paint(); } catch (e) {} }
        });
      });
    } catch (e) { console.error("road routes", e); }
  }

  // Called from pickState(): fetch the first state. Returns the save, or null (then the normal game runs).
  SRV.first = async function () {
    try {
      const j = await call("/api/state");
      if (!j.ok) throw new Error(j.reason || ("HTTP " + j.http));
      clock(j); activate(); fixRoads(j.state && j.state.un); return j.state;
    } catch (e) { console.error("Game server unavailable", e); try { alert("Game server unavailable (" + String(e.message || e).slice(0, 80) + "). Playing the normal way this time."); } catch (x) {} return null; }
  };

  function activate() {
    if (SRV.on) return; SRV.on = true;
    let busy = Promise.resolve();
    const refresh = () => { try { $("#v").dataset.n = ""; paint(); if (si && !$("#modal").hidden) drawS(); } catch (e) {} };
    function apply(j) { if (j && j.state) { clock(j); fixRoads(j.state.un); S = j.state; try { sbStatus("☁ Server game"); } catch (e) {} refresh(); } }
    const act = body => busy = busy.then(async () => {            // actions go one at a time, in order
      try { const j = await call("/api/action", body); if (!j.ok && j.reason) { try { toast(j.reason); } catch (e) {} } apply(j); }
      catch (e) { try { toast("Can't reach the game server"); } catch (x) {} }
    });

    // 1) the browser no longer simulates or uploads its own save
    const uiTick = () => { try { if (si && !$("#modal").hidden && $("#sheet").dataset.k !== sk()) drawS(); const sh = $("#sheet"), qm = mm(curM); if (!$("#modal").hidden && sh.dataset.qk && qm && sh.dataset.qk !== qk(qm)) drawQ(); const re = document.getElementById("qrem"); if (re && qm && !$("#modal").hidden) re.innerHTML = remT(qm); paint(); } catch (e) {} };
    tick = uiTick;                       // (startGame schedules tick after this, so it picks up this version)
    catchUp = function () {};            // the server already caught the game up
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

    // 3) pick up what the server is doing (calls arriving, units moving, jobs paid)
    setInterval(() => { busy = busy.then(async () => { try { const j = await call("/api/state"); if (j.ok) apply(j); } catch (e) {} }); }, 2000);
  }
})();
