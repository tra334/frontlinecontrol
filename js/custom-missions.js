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
      if (/address of the emergency|name and phone number|nearest landmark or junction/.test(key)) continue; /* fixed questions: their answers can't be set, so an old pair is ignored rather than breaking the call */
      if (seen.has(key)) return null;
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

  /* per-rank pay for a custom call: 6 payouts (Trainee..Chief). Ranks below the call's lowest unlock rank (highest unlock rank of its base vehicles) are never used, so they take the first usable rank's pay. */
  const kRank = k => k.startsWith("tr:") ? ((TR[k.slice(3)] || [])[2] || 0) : ((U[k] || [])[3] || 0);
  function payRank(list, needs) {
    if (!Array.isArray(list) || list.length !== 6 || !list.every(n => num(n, 50, 20000))) return null;
    const mr = Math.max(0, ...Object.keys(needs).map(kRank)), out = list.slice();
    for (let i = 0; i < mr; i++) out[i] = list[mr];
    return out;
  }

  /* returns a mission tuple [service, name, caller, needs, seconds, payout, places] or null if it is not safe to use */
  function build(m, selfIdx, bi) { /* bi = index of a built-in call being overridden: its name is fixed, training needs (tr:x) are allowed and it may spawn at any place type */
    try {
      if (!m || !["f", "p", "a"].includes(m.svc)) return null;
      if (!str(m.name, 3, 60) || !str(m.caller, 5, 160)) return null;
      if (bi == null && T.some((t, i) => i !== selfIdx && t[1] === m.name.trim())) return null;
      if (!m.needs || typeof m.needs !== "object") return null;
      const ks = Object.keys(m.needs);
      if (!ks.length || ks.length > 8) return null;
      for (const k of ks) if ((!Object.prototype.hasOwnProperty.call(U, k) && !(bi != null && k.startsWith("tr:") && Object.prototype.hasOwnProperty.call(TR, k.slice(3)))) || !num(m.needs[k], 1, 10)) return null;
      if (!num(m.secs, 20, 1200) || !num(m.pay, 50, 20000)) return null;
      if (!Array.isArray(m.places) || !m.places.length || m.places.length > (bi != null ? PLACES.size : 6) || !m.places.every(p => PLACES.has(p))) return null;
      const t = [m.svc, m.name.trim(), m.caller.trim(), Object.assign({}, m.needs), m.secs, m.pay, m.places.slice()];
      if (m.g != null && m.g !== 0) { if (!num(m.g, 1, 4)) return null; t.g = m.g; } /* call grade; absent = worked out from the payout */
      if (m.chat != null) { /* on-scene radio chatter: up to 6 short lines the first unit says when it arrives */
        if (!Array.isArray(m.chat) || m.chat.length > 6 || !m.chat.every(x => str(x, 3, 160))) return null;
        if (m.chat.length) t.chat = m.chat.map(x => x.trim());
      }
      if (m.qa != null) { const qa = cleanQA(m.qa); if (!qa) return null; if (qa.length) t.qa = qa; }
      if (m.payR != null) { const pr = payRank(m.payR, m.needs); if (!pr) return null; t.payR = pr; }
      return t;
    } catch (e) { return null; }
  }

  function apply(list) {
    if (!Array.isArray(list)) return;
    list = list.filter(m => m && Number.isInteger(m.seq) && m.seq >= 1).sort((a, b) => a.seq - b.seq);
    for (const m of list) {
      const next = T.length - BASE + 1;
      if (m.seq < next) { /* already loaded: refresh its content in place (same slot, so saved incidents still point at it) and its retired flag */
        const idx = BASE + m.seq - 1, t = T[idx]; if (!t) continue;
        const nt = build(m, idx);
        if (nt) { t.length = 0; nt.forEach(x => t.push(x)); t.g = nt.g; t.qa = nt.qa; t.chat = nt.chat; t.payR = nt.payR; }
        t.off = !!m.retired || t[1].indexOf("(unavailable)") === 0; continue;
      }
      if (m.seq > next) break; /* a gap: wait for a full list rather than shift every later index */
      const t = build(m) || ["f", "(unavailable) " + m.seq, "", { pump: 1 }, 60, 0, ["road"]];
      if (t[1].indexOf("(unavailable)") === 0) t.off = true; else t.off = !!m.retired;
      T.push(t);
    }
    if (typeof cqSync === "function") cqSync(); /* scenarios.js: turn the new missions' caller questions into buttons */
  }

  /* ===== overrides of the built-in calls (edited in the admin dashboard, "Built-in calls") =====
     The built-ins stay in data.js (slots 0..BASE-1, so saved incidents keep pointing at the right call). An override {base, ...fields}
     patches T[base] in place; name and service can't change (pay, grade and caller answers in data.js / state.js / scenarios.js are keyed by name).
     {base, retired:true} with no fields just stops that call spawning. When an override disappears from the list the call goes back to its code version. */
  const ORIG = {}, TOUCHED = new Set();
  const snap = t => ({ tuple: t.slice(), g: t.g, qa: t.qa, chat: t.chat, payR: t.payR });
  function patch(t, nt) { t.length = 0; nt.forEach(x => t.push(x)); t.g = nt.g; t.qa = nt.qa; t.chat = nt.chat; t.payR = nt.payR; }
  function restore(idx) { const s = ORIG[idx], t = T[idx]; if (!s || !t) return; t.length = 0; s.tuple.forEach(x => t.push(x)); t.g = s.g; t.qa = s.qa; t.chat = s.chat; t.payR = s.payR; t.ov = 0; delete ORIG[idx]; }
  function applyOverrides(list) {
    if (!Array.isArray(list)) return;
    const live = new Set();
    for (const o of list) {
      if (!o || !Number.isInteger(o.base) || o.base < 0 || o.base >= BASE || !T[o.base]) continue;
      const idx = o.base, t = T[idx]; live.add(idx); TOUCHED.add(idx);
      if (o.needs) { /* has content: patch the call */
        if (!ORIG[idx]) ORIG[idx] = snap(t);
        const s = ORIG[idx].tuple, nt = build(Object.assign({}, o, { name: s[1], svc: s[0] }), idx, idx);
        if (nt) {
          if (!nt.payR) nt.payR = RMUL.map(x => Math.max(50, Math.min(20000, Math.round(nt[5] * x / 10) * 10))); /* no per-rank pay sent: scale the payout */
          patch(t, nt); t.ov = 1;
        } else restore(idx); /* invalid override: keep the code version rather than break the call */
      } else restore(idx);
      t.off = !!o.retired;
    }
    for (const idx of Array.from(TOUCHED)) if (!live.has(idx)) { restore(idx); T[idx].off = false; TOUCHED.delete(idx); }
    if (typeof cqSync === "function") cqSync();
  }

  async function load() {
    try {
      const r = await fetch(API + "/api/missions", { cache: "no-store" });
      const j = await r.json();
      if (!j || !j.ok || !Array.isArray(j.missions)) return;
      apply(j.missions); applyOverrides(j.overrides || []);
      try { localStorage.setItem(KEY, JSON.stringify({ missions: j.missions, overrides: j.overrides || [] })); } catch (e) { /* storage full */ }
    } catch (e) { /* offline: keep what we have */ }
  }
  /* the game server sets FC_NO_FETCH and calls CustomMissions.apply(missions) and CustomMissions.applyOverrides(overrides) itself with the lists from its own database */
  if (!window.FC_NO_FETCH) {
    try { const c = JSON.parse(localStorage.getItem(KEY)); if (c && Array.isArray(c.missions)) { apply(c.missions); applyOverrides(c.overrides || []); } } catch (e) { /* no cache yet */ }
    load();
  }
  window.CustomMissions = { base: BASE, count: () => T.length - BASE, apply, applyOverrides, overridden: () => Object.keys(ORIG).length };
})();
