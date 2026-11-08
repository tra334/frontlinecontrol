/* Custom missions added by staff in the admin dashboard.
   They are appended to the built-in mission list T. Saved incidents store a mission as an index into T,
   so the order is fixed: custom missions are appended in "seq" order (assigned by the server at first publish),
   are never removed, and a retired one stays in T with t.off = true so it just stops spawning.
   The last good list is cached on this device so the game still has them when the server is unreachable. */
(function () {
  const API = window.FC_API || "https://api.frontlinecontrol.co.uk";
  const KEY = "fc_custom_missions";
  const BASE = T.length;
  const PLACES = new Set(["pub","restaurant","hotel","supermarket","shop","services","home","care_home","high","school","college","civic","attraction","stadium","major_stadium","rec","leisure","hospital","church","station","road","car_park","petrol","office","airport","industrial","farm","water","lake","harbour","coast","woods","cemetery","bridge","prison"]);
  const str = (s, a, b) => typeof s === "string" && s.trim().length >= a && s.trim().length <= b;
  const num = (n, a, b) => Number.isInteger(n) && n >= a && n <= b;

  /* caller questions: [{q, a, veh?}] up to 12. veh = extra vehicles the answer reveals ({type: 1..5}, up to 4 types). Returns a clean copy or null */
  function cleanQA(list) {
    if (!Array.isArray(list) || list.length > 12) return null;
    const out = [], seen = new Set();
    for (const p of list) {
      if (!p || !str(p.q, 3, 80) || !str(p.a, 2, 240)) return null;
      const key = p.q.trim().toLowerCase().replace(/'/g, "\u2019");
      if (seen.has(key) || /address of the emergency/.test(key)) return null;
      seen.add(key);
      const e = { q: p.q.trim(), a: p.a.trim() };
      if (p.veh != null) {
        if (typeof p.veh !== "object") return null;
        const vk = Object.keys(p.veh);
        if (vk.length > 4) return null;
        for (const k of vk) if (!Object.prototype.hasOwnProperty.call(U, k) || !num(p.veh[k], 1, 5)) return null;
        if (vk.length) e.veh = Object.assign({}, p.veh);
      }
      out.push(e);
    }
    return out;
  }

  /* returns a mission tuple [service, name, caller, needs, seconds, payout, places] or null if it is not safe to use */
  function build(m) {
    try {
      if (!m || !["f", "p", "a"].includes(m.svc)) return null;
      if (!str(m.name, 3, 60) || !str(m.caller, 5, 160)) return null;
      if (T.some(t => t[1] === m.name.trim())) return null;
      if (!m.needs || typeof m.needs !== "object") return null;
      const ks = Object.keys(m.needs);
      if (!ks.length || ks.length > 8) return null;
      for (const k of ks) if (!Object.prototype.hasOwnProperty.call(U, k) || !num(m.needs[k], 1, 10)) return null;
      if (!num(m.secs, 20, 1200) || !num(m.pay, 50, 20000)) return null;
      if (!Array.isArray(m.places) || !m.places.length || m.places.length > 6 || !m.places.every(p => PLACES.has(p))) return null;
      const t = [m.svc, m.name.trim(), m.caller.trim(), Object.assign({}, m.needs), m.secs, m.pay, m.places.slice()];
      if (m.g != null && m.g !== 0) { if (!num(m.g, 1, 4)) return null; t.g = m.g; } /* call grade; absent = worked out from the payout */
      if (m.qa != null) { const qa = cleanQA(m.qa); if (!qa) return null; if (qa.length) t.qa = qa; }
      return t;
    } catch (e) { return null; }
  }

  function apply(list) {
    if (!Array.isArray(list)) return;
    list = list.filter(m => m && Number.isInteger(m.seq) && m.seq >= 1).sort((a, b) => a.seq - b.seq);
    for (const m of list) {
      const next = T.length - BASE + 1;
      if (m.seq < next) { const t = T[BASE + m.seq - 1]; if (t) t.off = !!m.retired; continue; }
      if (m.seq > next) break; /* a gap: wait for a full list rather than shift every later index */
      const t = build(m) || ["f", "(unavailable) " + m.seq, "", { pump: 1 }, 60, 0, ["road"]];
      if (t[1].indexOf("(unavailable)") === 0) t.off = true; else t.off = !!m.retired;
      T.push(t);
    }
    if (typeof cqSync === "function") cqSync(); /* scenarios.js: turn the new missions' caller questions into buttons */
  }

  async function load() {
    try {
      const r = await fetch(API + "/api/missions", { cache: "no-store" });
      const j = await r.json();
      if (!j || !j.ok || !Array.isArray(j.missions)) return;
      apply(j.missions);
      try { localStorage.setItem(KEY, JSON.stringify({ missions: j.missions })); } catch (e) { /* storage full */ }
    } catch (e) { /* offline: keep what we have */ }
  }
  /* the game server sets FC_NO_FETCH and calls CustomMissions.apply() itself with the list from its own database */
  if (!window.FC_NO_FETCH) {
    try { const c = JSON.parse(localStorage.getItem(KEY)); if (c && Array.isArray(c.missions)) apply(c.missions); } catch (e) { /* no cache yet */ }
    load();
  }
  window.CustomMissions = { base: BASE, count: () => T.length - BASE, apply };
})();
