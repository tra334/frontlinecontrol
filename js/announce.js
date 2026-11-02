/* Announcement banner. Shows the newest live announcement from the game server.
   Players close it with the x; a closed one stays closed on this device. */
(function () {
  const API = window.FC_API || "https://api.frontlinecontrol.co.uk";
  const KEY = "fc_seen_announcements";
  function seen() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function remember(id) { try { const s = seen(); if (!s.includes(id)) { s.push(id); localStorage.setItem(KEY, JSON.stringify(s.slice(-50))); } } catch (e) { /* ignore */ } }
  function show(a) {
    const bar = document.createElement("div");
    bar.setAttribute("role", "status");
    bar.style.cssText = "position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:99998;background:#1d4ed8;color:#fff;border-radius:10px;padding:10px 40px 10px 12px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35)";
    const t = document.createElement("b"); t.textContent = a.title; t.style.display = "block";
    const m = document.createElement("span"); m.textContent = a.body;
    const x = document.createElement("button"); x.textContent = "×"; x.setAttribute("aria-label", "Close");
    x.style.cssText = "position:absolute;right:6px;top:4px;background:none;border:0;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px";
    x.onclick = () => { remember(a.id); bar.remove(); };
    bar.append(t, m, x); document.body.appendChild(bar);
  }
  async function load() {
    try {
      const r = await fetch(API + "/api/announcements", { cache: "no-store" });
      const j = await r.json();
      if (!j || !j.ok) return;
      const done = seen();
      const next = (j.announcements || []).find(a => !done.includes(a.id));
      if (next) show(next);
    } catch (e) { /* no server, no banner */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(load, 1500));
  else setTimeout(load, 1500);
})();
