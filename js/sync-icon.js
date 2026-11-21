/* Header status: show only the icon. The full text is kept and shown in a small box under the icon when tapped. */
(function () {
  function el() { return document.getElementById("sync"); }
  let box = null;
  function hide() { if (box) box.hidden = true; }
  function show(e) {
    if (!box) {
      box = document.createElement("div");
      box.id = "sync-box"; box.hidden = true; box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    if (!box.hidden) { hide(); return; }
    box.textContent = e.dataset.msg;
    const r = e.getBoundingClientRect();
    box.style.top = (r.bottom + 8) + "px";
    box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 268)) + "px";
    box.hidden = false;
  }
  function wrap() {
    const e = el(); if (!e) return;
    let txt = "";
    Array.from(e.childNodes).forEach(function (n) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        txt += n.textContent.trim();
        const s = document.createElement("span"); s.className = "sync-txt"; s.textContent = n.textContent;
        e.replaceChild(s, n);
      } else if (n.nodeType === 1 && n.classList.contains("sync-txt")) {
        txt += n.textContent.trim();
      }
    });
    if (!e.querySelector("svg") && !e.querySelector(".sync-dot")) {
      const d = document.createElement("span"); d.className = "sync-dot"; e.insertBefore(d, e.firstChild);
    }
    e.dataset.msg = txt || "Status";
    e.setAttribute("role", "button"); e.tabIndex = 0; e.setAttribute("aria-label", e.dataset.msg);
    if (!e._tap) {
      e._tap = true;
      e.addEventListener("click", function (ev) { ev.stopPropagation(); show(e); });
      e.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); show(e); } });
      document.addEventListener("click", function (ev) { if (box && !box.hidden && ev.target !== e) hide(); });
      document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") hide(); });
    }
  }
  const orig = window.sbStatus;
  if (typeof orig === "function") {
    window.sbStatus = function () { const r = orig.apply(this, arguments); wrap(); return r; };
  }
  wrap();
})();
