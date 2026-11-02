/* Server status pill on the sign-in screen. Green = working, amber = some problems, red = down or unreachable.
   Tapping it opens the status page. Hidden while playing. */
(function () {
  const API = window.FC_API || "https://api.frontlinecontrol.co.uk";
  const COL = { operational: "#16a34a", partial: "#d97706", major: "#dc2626", down: "#dc2626", checking: "#64748b" };
  const TXT = { operational: "Server working", partial: "Some issues", major: "Server problems", down: "Server unreachable", checking: "Checking server" };
  const pill = document.createElement("a");
  pill.href = "status.html"; pill.target = "_blank"; pill.rel = "noopener";
  pill.setAttribute("aria-label", "Server status: open the status page");
  pill.style.cssText = "position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:100000;display:none;align-items:center;gap:7px;padding:6px 11px;border-radius:999px;background:rgba(15,23,42,.88);color:#e2e8f0;font:600 12px/1 system-ui,-apple-system,sans-serif;text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.35)";
  const dot = document.createElement("span");
  dot.style.cssText = "width:9px;height:9px;border-radius:50%;background:#64748b;flex:none";
  const label = document.createElement("span");
  pill.append(dot, label);
  function set(state) { dot.style.background = COL[state] || COL.checking; label.textContent = (TXT[state] || TXT.checking) + " · Status"; }
  async function check() {
    try {
      const r = await fetch(API + "/api/status", { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      set(j.overall || "operational");
    } catch (e) { set("down"); }
  }
  // shown only on the sign-in screen: AU (login) is empty and no game is running
  function visible() {
    const signedOut = typeof AU !== "undefined" && !AU;
    const playing = typeof gameOn !== "undefined" && gameOn;
    pill.style.display = signedOut && !playing ? "inline-flex" : "none";
  }
  function start() {
    document.body.appendChild(pill);
    set("checking"); check(); setInterval(check, 60000);
    visible(); setInterval(visible, 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
