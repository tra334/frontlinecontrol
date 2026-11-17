/* ===== Desktop keyboard shortcuts + cheat sheet (press ? to open) =====
   Desktop layout only: everything is gated on the game's own desk() check, so nothing is bound on mobile.
   Safe by design:
   - while you type in a box (names, callsigns, search, chat, login) only Esc is handled, and the first Esc just leaves the box
   - Ctrl / Cmd / Alt combos and held keys are ignored (browser shortcuts keep working)
   - nothing here spends credits; Decline, Leave room, move and upgrade stay mouse-only
   - the only key that sends units is Enter in the dispatch window, and only with units ticked
   - off completely while the login screen or the 2D/3D picker is open (they use their own keys)
   Everything works by clicking the same buttons you would click, so existing game logic is untouched.
   Load after controlroom.js. */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const isDesk = () => { try { return typeof desk === "function" ? desk() : matchMedia("(min-width:1000px)").matches; } catch (e) { return false; } };
  const shown = el => !!el && !el.hidden && el.getClientRects().length > 0;
  const note = m => { try { if (typeof toast === "function") toast(m); } catch (e) {} };

  const NON_TEXT = /^(checkbox|radio|button|submit|reset|range|color|file|image)$/i;
  const isTyping = el => !!el && (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && !NON_TEXT.test(el.type)));
  const isBtn = el => !!el && (el.tagName === "BUTTON" || el.tagName === "A" || (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type)) || el.getAttribute("role") === "button");

  /* ---------- cheat sheet ---------- */
  const SHEET = [
    ["Navigation", [
      [["F"], "Fleet tab"], [["S"], "Stations tab"],
      [["M"], "Focus radio panel"], [["/"], "Address search (while placing)"],
      [["Shift+R"], "Rooms"], [["Shift+S"], "Settings"]]],
    ["Calls and incidents", [
      [["Space"], "Answer next ringing call"], [["N", "P"], "Next / previous incident"],
      [["G"], "Centre map on incident"], [["D"], "Dispatch selected incident"]]],
    ["Dispatch window", [
      [["A"], "Auto-select nearest units"], [["1–9"], "Toggle unit"],
      [["Enter"], "Send selected units"], [["Esc"], "Back / close"]]],
    ["Map and building", [
      [["B"], "Build menu"], [["Esc"], "Cancel placement"]]],
    ["General", [
      [["Esc"], "Close topmost window"], [["?"], "Show / hide this sheet"]]]
  ];

  function injectCss() {
    if ($("#kbcss")) return;
    const st = document.createElement("style");
    st.id = "kbcss";
    st.textContent =
      "#kbov{position:fixed;inset:0;z-index:100100;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px}" +
      "#kbov .kbc{width:100%;max-width:820px;max-height:calc(100vh - 32px);overflow:auto;background:var(--card,#111823);color:var(--tx,#d7dee9);border:1px solid var(--bd,#222d3b);border-radius:14px;padding:20px 24px}" +
      "#kbov .kbh{display:flex;align-items:center;justify-content:space-between;gap:12px}" +
      "#kbov .kbt{font-size:18px;font-weight:700}" +
      "#kbov .kbs2{color:var(--mu,#7f8da3);font-size:12px;margin:2px 0 14px}" +
      "#kbov .kbg{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px 32px}" +
      "#kbov .kbk{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mu,#7f8da3);padding-bottom:5px;margin-bottom:2px;border-bottom:1px solid var(--bd,#222d3b)}" +
      "#kbov .kbr{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:6px 0;font-size:14px}" +
      "#kbov .kbr>span:last-child{text-align:right;color:var(--tx,#d7dee9)}" +
      "#kbov .kbw{display:flex;align-items:center;gap:4px;flex:none;color:var(--mu,#7f8da3);font-size:12px}" +
      "#kbov kbd{display:inline-block;min-width:22px;text-align:center;padding:2px 8px;border-radius:6px;border:1px solid var(--bd,#222d3b);border-bottom-width:2px;background:var(--bg,#0a0e13);color:var(--tx,#d7dee9);font:600 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}" +
      "#kbov .kbf{margin-top:16px;padding-top:12px;border-top:1px solid var(--bd,#222d3b);color:var(--mu,#7f8da3);font-size:12px;line-height:1.5}";
    document.head.appendChild(st);
  }

  const keysHtml = alts => alts.map(a => a.split("+").map(k => "<kbd>" + k + "</kbd>").join('<span style="margin:0 1px">+</span>')).join('<span style="margin:0 3px">/</span>');

  function closeSheet() { const s = $("#kbov"); if (s) s.remove(); }
  function openSheet() {
    injectCss();
    closeSheet();
    const ov = document.createElement("div");
    ov.id = "kbov";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-label", "Keyboard shortcuts");
    ov.innerHTML =
      '<div class="kbc"><div class="kbh"><div><div class="kbt">Keyboard shortcuts</div><div class="kbs2">Desktop only</div></div>' +
      '<button class="cx" type="button" aria-label="Close" style="border:1px solid var(--bd,#222d3b);background:transparent;color:inherit;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:18px;line-height:1">×</button></div>' +
      '<div class="kbg">' + SHEET.map(g => "<div><div class=\"kbk\">" + g[0] + "</div>" +
        g[1].map(r => '<div class="kbr"><span class="kbw">' + keysHtml(r[0]) + "</span><span>" + r[1] + "</span></div>").join("") + "</div>").join("") + "</div>" +
      '<div class="kbf">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close. Shortcuts pause while you type in a box, so names, callsigns, search and chat are never affected. ' +
      "Nothing here spends credits, and Decline, Leave room, move and upgrade stay mouse-only.</div></div>";
    ov.onclick = e => { if (e.target === ov || e.target.closest(".cx")) closeSheet(); };
    document.body.appendChild(ov);
  }

  /* ---------- overlays (Esc closes the topmost one) ---------- */
  const OVERLAYS = ["room_ov", "dbgov", "nameov", "msov", "buildov", "setov", "joblogs", "sfov", "tov", "uiov", "acct"];

  function topOverlay() {
    let best = null, bz = -1;
    OVERLAYS.forEach(id => {
      const el = document.getElementById(id);
      if (!el || !shown(el)) return;
      const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
      if (z > bz || (z === bz && best && (best.compareDocumentPosition(el) & 4))) { bz = z; best = el; }
    });
    return best;
  }

  function closeOverlay(el) {
    const id = el.id;
    try {
      if (id === "uiov" && typeof closeUI === "function") closeUI();
      else if (id === "tov" && typeof closeT === "function") closeT();
      else if (id === "sfov" && typeof sfClose === "function") sfClose();
      else {
        const b = el.querySelector('#rm_x,#set_x,#ms_x,#jl_x,[aria-label="Close"],.cx');
        if (b) b.click(); else el.click();
      }
    } catch (e) {}
    if (id !== "room_ov" && document.body.contains(el)) el.remove();
  }

  function onEscape(e, typing) {
    if (typing) { try { e.target.blur(); } catch (x) {} e.preventDefault(); return; }   // first Esc only leaves the box
    if (shown($("#mfp"))) return;                                                        // map filter panel has its own Esc
    if ($("#kbov")) { closeSheet(); e.preventDefault(); return; }
    const ov = topOverlay();
    if (ov) { closeOverlay(ov); e.preventDefault(); return; }
    if (shown($("#modal")) && typeof closeM === "function") { closeM(); e.preventDefault(); return; }
    const fm = $("#fabm");
    if (shown(fm)) { fm.hidden = true; e.preventDefault(); return; }
    const fab = $("#fab");
    if (fab && fab.dataset.i === "x") { fab.click(); e.preventDefault(); }              // cancel build / move / POI placement
  }

  /* ---------- actions ---------- */
  const nav = t => { const b = $('nav button[data-t="' + t + '"]'); if (b) b.click(); };

  function nextCall() {
    const b = document.querySelector("#plb .ir .s.ans");
    if (b) b.click(); else note("No calls ringing");
  }
  function stepIncident(d) {
    const rows = Array.from(document.querySelectorAll("#plb .ir"));
    if (!rows.length) return;
    const i = rows.findIndex(r => r.classList.contains("sel"));
    const n = i < 0 ? (d > 0 ? 0 : rows.length - 1) : (i + d + rows.length) % rows.length;
    rows[n].click();
  }
  function centreIncident() {
    try { if (selI && mm(selI)) selM(selI); else note("Select an incident first"); } catch (e) {}
  }
  function dispatchSelected() {
    const b = document.querySelector("#plb .ir.sel button.s:not(.dec)");
    if (b) b.click(); else note("Select an incident first");
  }
  function openBuildMenu() {
    const fab = $("#fab");
    if (fab && fab.dataset.i !== "x") fab.click();
  }
  function focusSearch() {
    const r = $("#bsr"), i = $("#bsi");
    if (shown(r) && i) { i.focus(); try { i.select(); } catch (e) {} }
    else note("Address search shows while placing a building");
  }
  function focusRadio() {
    const r = $("#rlb");
    if (!r) return;
    r.setAttribute("tabindex", "-1");
    r.style.outline = "none";
    r.focus({ preventScroll: true });
  }

  /* dispatch window: works by clicking the same controls you would click */
  function dispatchKeys(e, k) {
    const sh = $("#sheet");
    if (!sh) return false;
    if (k === "a") {
      const b = sh.querySelector('button[onclick^="auto()"]');
      if (b) { b.click(); return true; }
      return false;
    }
    if (/^[1-9]$/.test(k)) {
      const boxes = sh.querySelectorAll("label.ur input[type=checkbox]");
      const c = boxes[+k - 1];
      if (c) { c.click(); return true; }
      return false;
    }
    if (k === "Enter") {
      const b = Array.from(sh.querySelectorAll('button[onclick^="go()"]')).find(x => !x.disabled);
      if (b) { b.click(); return true; }
      return false;
    }
    return false;
  }

  /* ---------- main handler ---------- */
  document.addEventListener("keydown", e => {
    if (e.defaultPrevented || e.isComposing || e.repeat) return;
    if (!isDesk()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ($("#authov") || $("#w3ov")) return;                       // login and 2D/3D picker use their own keys

    const typing = isTyping(e.target);
    const raw = e.key;
    if (raw === "Escape") { onEscape(e, typing); return; }
    if (typing) return;

    if (raw === "?") { if ($("#kbov")) closeSheet(); else openSheet(); e.preventDefault(); return; }
    if ($("#kbov")) return;                                       // sheet open: only ? and Esc do anything

    const k = raw.length === 1 ? raw.toLowerCase() : raw;
    if ((k === "Enter" || k === " ") && isBtn(e.target)) return;  // keep native button activation

    if (e.shiftKey) {
      if (topOverlay() || shown($("#modal"))) return;
      if (k === "r") { const b = $("#hd_rm"); if (b) { b.click(); e.preventDefault(); } }
      else if (k === "s") { if (typeof openSettings === "function") { openSettings(); e.preventDefault(); } }
      return;
    }

    if (topOverlay()) return;                                     // a menu is open: leave the keys alone

    if (shown($("#modal"))) {                                     // call / dispatch window
      if (dispatchKeys(e, k)) e.preventDefault();
      return;
    }

    switch (k) {
      case "f": nav("m"); break;
      case "s": nav("s"); break;
      case " ": nextCall(); break;
      case "n": stepIncident(1); break;
      case "p": stepIncident(-1); break;
      case "g": centreIncident(); break;
      case "d": dispatchSelected(); break;
      case "b": openBuildMenu(); break;
      case "/": focusSearch(); break;
      case "m": focusRadio(); break;
      default: return;
    }
    e.preventDefault();
  });

  /* after a mouse click, drop focus from the button so Space / Enter shortcuts keep working
     (keyboard-activated clicks have detail 0 and are left alone) */
  document.addEventListener("click", e => {
    if (!isDesk() || e.detail === 0) return;
    const b = e.target.closest && e.target.closest("button");
    if (b && b.blur) { try { b.blur(); } catch (x) {} }
  }, true);
})();
