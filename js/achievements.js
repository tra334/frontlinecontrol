/* Achievements: 10 badges earned by playing. Progress is worked out from the game state (the rules live in
   js/achievements-defs.js, shared with the forum server), so nothing new is saved in the game itself.
   The forum server awards the matching badge on the Frontline Control forum (see server/forum-badges.js).

   This file: remembers what the player has unlocked on this device (so a badge never "un-unlocks" if, for example,
   the daily bonus cycle restarts), pops up a message when one is earned, and draws the progress cards
   used by the Ranks tab (Ach.bodyHtml) and the mobile menu (Ach.flatHtml). */
(function () {
  "use strict";
  const D = window.ACH;
  if (!D) return;

  /* Set this to your forum address (for example "https://forum.frontlinecontrol.co.uk") to show a "See badges on the forum" link. */
  const FORUM_URL = window.FC_FORUM_URL || "";

  const TIER = { 1: "Gold", 2: "Silver", 3: "Bronze" };
  const ready = () => typeof S !== "undefined" && S && typeof gameOn !== "undefined" && gameOn;
  const uid = () => (typeof AU !== "undefined" && AU && AU.user && AU.user.id) || "guest";
  const KEY = () => "fc_ach_" + uid();

  let mem = null, memKey = "", fresh = false;       // fresh: nothing was stored for this player yet
  function memory() {
    if (mem && memKey === KEY()) return mem;
    memKey = KEY(); mem = new Set(); fresh = true;
    try {
      const raw = localStorage.getItem(memKey);
      if (raw) { JSON.parse(raw).forEach(id => mem.add(id)); fresh = false; }
    } catch (e) { /* storage blocked: fall back to what the state shows */ }
    return mem;
  }
  function remember() { try { localStorage.setItem(memKey, JSON.stringify([...mem])); } catch (e) { /* ignore */ } }

  /* every badge with its progress and whether it is unlocked */
  function list() {
    if (!ready()) return D.DEFS.map(d => ({ d, v: 0, t: 1, pct: 0, done: false }));
    const m = memory(), ev = D.evaluate(S);
    return D.DEFS.map((d, i) => {
      const e = ev[i], done = e.done || m.has(d.id);
      return { d, v: done ? e.t : e.v, t: e.t, pct: done ? 100 : e.pct, done };
    });
  }
  const summary = () => { const l = list(); return l.filter(x => x.done).length + " / " + l.length; };

  /* called every few seconds: notices newly earned badges */
  function check() {
    if (!ready()) return;
    const m = memory(), now = D.earned(S).filter(id => !m.has(id));
    if (!now.length) { if (fresh) { fresh = false; remember(); } return; }
    now.forEach(id => m.add(id));
    const wasFresh = fresh; fresh = false; remember();
    try { if (window.paint) paint(); } catch (e) { /* ignore */ }
    if (wasFresh && now.length > 1) {                 // first time this feature runs for an existing player
      toast("You've already unlocked " + now.length + " achievements. Open Ranks to see them.");
    } else {
      now.forEach((id, i) => setTimeout(() => {
        const d = D.byId(id);
        if (d) toast("Achievement unlocked: " + d.name);
      }, i * 6500));
    }
  }

  const medal = d => `<div class="ach-ic t${d.tier}" aria-hidden="true">${lci(d.lucide, 22)}</div>`;

  function item(x) {
    const d = x.d;
    const right = x.done ? `<span class="ach-ok">${lci("circle-check", 14)} ${TIER[d.tier]}</span>`
      : `<span class="mu">${fmt(x.v)} / ${fmt(x.t)}</span>`;
    const bar = x.done ? "" : `<div class="bar"><i style="width:${x.pct}%"></i></div>`;
    return `<div class="ach-item${x.done ? " done" : " locked"}">${medal(d)}<div class="ach-tx"><div class="ach-line"><b>${esc(d.name)}</b>${right}</div><div class="mu">${esc(x.done ? d.desc : d.hint)}</div>${bar}</div></div>`;
  }

  const note = () => `<div class="ach-note mu">Each achievement also earns a badge on the Frontline Control forum. Sign up there with the same email you use in the game.${FORUM_URL ? ` <a href="${esc(FORUM_URL)}/badges" target="_blank" rel="noopener">See badges on the forum</a>` : ""}</div>`;

  /* body of the Ranks tab section */
  function bodyHtml() {
    const l = list(), todo = l.filter(x => !x.done).sort((a, b) => b.pct - a.pct), got = l.filter(x => x.done);
    return `<div class="ach-list">${todo.map(item).join("")}${got.map(item).join("")}</div>${note()}`;
  }

  /* page inside the mobile hamburger menu */
  function flatHtml() {
    const l = list(), n = l.filter(x => x.done).length, pct = Math.round(n / l.length * 100);
    return `<div class="hb_hero"><div class="hb_hero_t"><small>Achievements</small><b>${n} of ${l.length} unlocked</b><span>Earn badges on the forum by playing</span></div></div><div class="hb_panel"><div class="bar"><i style="width:${pct}%"></i></div></div><div class="hb_panel ach-flat">${bodyHtml()}</div>`;
  }

  window.Ach = { list, summary, check, bodyHtml, flatHtml, count: () => list().filter(x => x.done).length };

  setInterval(() => { try { check(); } catch (e) { console.error("Achievement check failed", e); } }, 4000);
})();
