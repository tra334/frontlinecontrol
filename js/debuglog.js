/* ===== Debug log =====
   Loaded FIRST so it sees everything. Quietly records problems (JS errors, failed network calls,
   console errors/warnings, failed script/image loads) and adds a "Debug log" button at the bottom of
   Settings to view, copy, download or clear them.
   Privacy: only the method, URL path (no query string), HTTP status and a short error text are kept.
   Request headers, tokens and request bodies are never recorded. */
(function () {
  if (window.DebugLog) return;
  const KEY = "fc_debuglog", MAX = 300, MAXLEN = 400;
  let list = [];
  try { const j = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(j)) list = j.slice(-MAX); } catch (e) {}
  let saveT = 0;
  const save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-150))); } catch (e) {} }, 800);
  };
  const clip = s => { s = String(s == null ? "" : s); return s.length > MAXLEN ? s.slice(0, MAXLEN) + "…" : s; };
  const str = a => {
    if (a instanceof Error) return a.name + ": " + a.message + (a.stack ? " @ " + String(a.stack).split("\n")[1] : "");
    if (a && typeof a === "object") { try { return JSON.stringify(a); } catch (e) { return String(a); } }
    return String(a);
  };
  let _last = "", _lastAt = 0;
  function add(type, msg) {
    msg = clip(msg);
    const t = Date.now();
    if (msg === _last && t - _lastAt < 3000) { const l = list[list.length - 1]; if (l) { l.n = (l.n || 1) + 1; _lastAt = t; save(); return; } }
    _last = msg; _lastAt = t;
    list.push({ t, type, msg });
    if (list.length > MAX) list.shift();
    save();
  }
  const cleanUrl = u => { try { const x = new URL(u, location.href); return x.origin === location.origin ? x.pathname : x.origin + x.pathname; } catch (e) { return clip(u); } };

  // ---- JS errors ----
  window.addEventListener("error", e => {
    if (e && e.target && e.target !== window && (e.target.src || e.target.href)) { // failed <script>/<img>/<link>
      add("load", "Failed to load " + (e.target.tagName || "resource").toLowerCase() + ": " + cleanUrl(e.target.src || e.target.href));
      return;
    }
    add("error", (e.message || "Script error") + (e.filename ? " (" + cleanUrl(e.filename) + ":" + e.lineno + ")" : ""));
  }, true);
  window.addEventListener("unhandledrejection", e => {
    const r = e && e.reason;
    add("error", "Unhandled promise: " + (r && (r.message || r.status) ? str(r.status ? { status: r.status, message: r.message } : r) : str(r)));
  });

  // ---- console.error / console.warn ----
  ["error", "warn"].forEach(k => {
    const o = console[k];
    console[k] = function () {
      try { add(k === "error" ? "console" : "warn", Array.prototype.map.call(arguments, str).join(" ")); } catch (e) {}
      return o.apply(this, arguments);
    };
  });

  // ---- network (fetch) ----
  if (window.fetch) {
    const of = window.fetch;
    window.fetch = function (input, init) {
      const url = cleanUrl(typeof input === "string" ? input : (input && input.url) || "");
      const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      const t0 = Date.now();
      return of.apply(this, arguments).then(r => {
        if (!r.ok) {
          const ms = Date.now() - t0;
          try {
            r.clone().text().then(tx => add("net", method + " " + url + " -> " + r.status + " (" + ms + "ms) " + clip(tx).replace(/\s+/g, " ").slice(0, 200))).catch(() => add("net", method + " " + url + " -> " + r.status));
          } catch (e) { add("net", method + " " + url + " -> " + r.status); }
        } else if (Date.now() - t0 > 8000) {
          add("slow", method + " " + url + " took " + Math.round((Date.now() - t0) / 1000) + "s");
        }
        return r;
      }, err => {
        if (!(err && err.name === "AbortError")) add("net", method + " " + url + " FAILED: " + (err && err.message || err));
        throw err;
      });
    };
  }
  window.addEventListener("offline", () => add("net", "Browser went offline"));
  window.addEventListener("online", () => add("info", "Browser back online"));

  // ---- report ----
  const pad = n => String(n).padStart(2, "0");
  const ts = t => { const d = new Date(t); return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); };
  function info() {
    const o = [];
    try { o.push("Time: " + new Date().toString()); } catch (e) {}
    try { o.push("Page: " + location.origin + location.pathname + " (version " + ((document.querySelector('script[src*="debuglog"]') || {}).src || "").split("?v=")[1] + ")"); } catch (e) {}
    try { o.push("Server mode: " + (window.SRV ? (SRV.on ? "ON (connected)" : (SRV.want ? "wanted but NOT connected" : "off")) : "n/a")); } catch (e) {}
    try { o.push("Signed in: " + (typeof AU !== "undefined" && AU ? "yes" : "no")); } catch (e) {}
    try { o.push("In room: " + (window.Rooms && Rooms.inRoom ? (Rooms.inRoom() ? "yes (" + (Rooms.code && Rooms.code()) + ")" : "no") : "n/a")); } catch (e) {}
    try { o.push("Online: " + navigator.onLine + " | Visible: " + document.visibilityState); } catch (e) {}
    try { if (typeof S !== "undefined" && S) o.push("Game: stations " + (S.st || []).length + ", units " + (S.un || []).length + ", open calls " + (S.ms || []).length + ", paused " + (S.pz ? "yes" : "no")); } catch (e) {}
    try { o.push("Screen: " + innerWidth + "x" + innerHeight + " | " + navigator.userAgent); } catch (e) {}
    return o.join("\n");
  }
  function report() {
    const lines = list.map(l => ts(l.t) + " [" + l.type + "]" + (l.n > 1 ? " x" + l.n : "") + " " + l.msg);
    return "FrontlineControl debug log\n" + info() + "\n\n" + (lines.length ? lines.join("\n") : "(no problems logged)") + "\n";
  }
  function clear() { list = []; _last = ""; try { localStorage.removeItem(KEY); } catch (e) {} }

  // ---- UI ----
  const COL = { error: "#ef4444", console: "#f97316", net: "#eab308", warn: "#a3a3a3", load: "#ef4444", slow: "#a3a3a3", info: "#60a5fa" };
  function openUI() {
    let ov = document.getElementById("dbgov"); if (ov) ov.remove();
    ov = document.createElement("div"); ov.id = "dbgov";
    ov.style.cssText = "position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:12px";
    const box = document.createElement("div");
    box.style.cssText = "width:100%;max-width:640px;max-height:90vh;display:flex;flex-direction:column;background:var(--card,#111827);color:var(--tx,#e5e7eb);border:1px solid var(--bd,#374151);border-radius:14px;padding:14px";
    const head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:800;font-size:16px";
    head.textContent = "Debug log";
    const x = document.createElement("button"); x.textContent = "✕"; x.setAttribute("aria-label", "Close");
    x.style.cssText = "background:none;border:0;color:inherit;font-size:18px;cursor:pointer";
    x.onclick = () => ov.remove(); head.appendChild(x);
    const sub = document.createElement("div"); sub.style.cssText = "font-size:12px;opacity:.7;margin:4px 0 8px";
    const pre = document.createElement("div");
    pre.style.cssText = "flex:1;min-height:120px;overflow:auto;background:rgba(0,0,0,.25);border-radius:8px;padding:8px;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word";
    const btns = document.createElement("div"); btns.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-top:10px";
    const mk = (label, fn, bg) => { const b = document.createElement("button"); b.textContent = label; b.style.cssText = "flex:1;min-width:90px;padding:9px 10px;border:0;border-radius:8px;font:700 13px system-ui;cursor:pointer;background:" + (bg || "var(--bd,#374151)") + ";color:" + (bg ? "#fff" : "var(--tx,#e5e7eb)"); b.onclick = fn; btns.appendChild(b); return b; };
    function draw() {
      sub.textContent = list.length ? list.length + " problem" + (list.length === 1 ? "" : "s") + " logged (newest first). Tokens and request bodies are never recorded." : "Nothing has gone wrong so far.";
      pre.textContent = "";
      list.slice().reverse().forEach(l => {
        const row = document.createElement("div"); row.style.cssText = "padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)";
        const tag = document.createElement("span"); tag.textContent = ts(l.t) + " " + l.type + (l.n > 1 ? " ×" + l.n : "") + "  "; tag.style.cssText = "font-weight:700;color:" + (COL[l.type] || "#a3a3a3");
        const m = document.createElement("span"); m.textContent = l.msg;
        row.append(tag, m); pre.appendChild(row);
      });
      if (!list.length) pre.textContent = "(empty)";
    }
    mk("Copy", async () => {
      const tx = report();
      try { await navigator.clipboard.writeText(tx); if (typeof toast === "function") toast("Debug log copied"); }
      catch (e) { const ta = document.createElement("textarea"); ta.value = tx; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); if (typeof toast === "function") toast("Debug log copied"); } catch (e2) {} ta.remove(); }
    }, "#2c5fc7");
    mk("Download", () => {
      const b = new Blob([report()], { type: "text/plain" }), a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = "frontlinecontrol-debug-" + Date.now() + ".txt"; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    mk("Refresh", draw);
    mk("Clear", () => { clear(); draw(); }, "#dc2626");
    box.append(head, sub, pre, btns); ov.appendChild(box);
    ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov); draw();
  }

  // add the button at the bottom of the Settings panel (the panel is rebuilt on every change, so re-add as needed)
  let raf = 0;
  function inject() {
    raf = 0;
    const body = document.getElementById("set_body");
    if (!body || body.querySelector("#dbg_btn")) return;
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin:16px 0 8px";
    const b = document.createElement("button"); b.id = "dbg_btn"; b.type = "button";
    const n = list.length;
    b.textContent = "🐞 Debug log" + (n ? " (" + n + ")" : "");
    b.style.cssText = "width:100%;padding:10px;border:0;border-radius:8px;font:700 14px system-ui;cursor:pointer;background:var(--bd,#374151);color:var(--tx,#e5e7eb)";
    b.onclick = openUI;
    const d = document.createElement("div"); d.style.cssText = "font-size:12px;opacity:.65;margin-top:4px;line-height:1.4";
    d.textContent = "Shows errors and failed requests. Handy to copy and send when something doesn't work.";
    wrap.append(b, d); body.appendChild(wrap);
  }
  const start = () => {
    new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(inject); }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);

  window.DebugLog = { add: (m, t) => add(t || "info", m), report, open: openUI, clear, list: () => list.slice() };
})();
