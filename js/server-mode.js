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
    const refresh = () => { try { $("#v").dataset.n = ""; paint(); if (si && !$("#modal").hidden) drawS(); } catch (e) {} };
    function apply(j) { if (j && j.state) { clock(j); S = j.state; try { sbStatus("☁ Server game"); } catch (e) {} refresh(); } }
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

    // 3) pick up what the server is doing (calls arriving, units moving, jobs paid)
    setInterval(() => { busy = busy.then(async () => { try { const j = await call("/api/state"); if (j.ok) apply(j); } catch (e) {} }); }, 2000);
  }
})();
