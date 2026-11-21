/* Achievement definitions: the ONE place that says what each badge is and how it is earned.
   Used by the game (js/achievements.js, in the browser) and by the forum server (server/forum-badges.js, in Node),
   so the rules can never drift apart.

   Everything is worked out from the saved game state alone (S), nothing extra is stored.
   progress(S) returns [value, target]; the badge is earned when value >= target.

   tier: Discourse badge type. 1 = gold, 2 = silver, 3 = bronze.
   icon: Font Awesome icon name used on the forum.   lucide: icon name used in the game (see js/icons.js).
   name and desc are public: they become the badge name and description on the forum. Don't rename a badge
   after it has been created on the forum, or a second copy will be made. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ACH = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const num = x => (Number.isFinite(+x) ? +x : 0);
  const arr = x => (Array.isArray(x) ? x : []);

  /* jobs needed for the top rank (Chief Controller). New games use the second table, older saves the first. */
  const topJobs = S => (S.ev === 2 ? 600 : 120);
  const services = S => {
    const have = new Set();
    arr(S.st).forEach(s => { if (s && (s.sv === "f" || s.sv === "p" || s.sv === "a")) have.add(s.sv); });
    return have.size;
  };
  const hasAircraft = S => arr(S.un).some(u => u && (u.ty === "hel" || u.ty === "air"));

  const DEFS = [
    { id: "first_call", name: "First Call", tier: 3, icon: "fa-phone", lucide: "phone",
      desc: "Complete your first job in Frontline Control.",
      hint: "Complete 1 job", p: S => [num(S.done), 1] },

    { id: "getting_busy", name: "Getting Busy", tier: 3, icon: "fa-headset", lucide: "radio",
      desc: "Complete 25 jobs in Frontline Control.",
      hint: "Complete 25 jobs", p: S => [num(S.done), 25] },

    { id: "station_builder", name: "Station Builder", tier: 3, icon: "fa-building", lucide: "building-2",
      desc: "Build your first emergency station.",
      hint: "Build a station", p: S => [arr(S.st).length, 1] },

    { id: "dedicated", name: "Dedicated Controller", tier: 3, icon: "fa-calendar-check", lucide: "gift",
      desc: "Claim the daily bonus seven days in a row.",
      hint: "Reach day 7 of the daily bonus", p: S => [num(S.dr && S.dr.day), 7] },

    { id: "seasoned", name: "Seasoned Controller", tier: 2, icon: "fa-medal", lucide: "medal",
      desc: "Complete 100 jobs in Frontline Control.",
      hint: "Complete 100 jobs", p: S => [num(S.done), 100] },

    { id: "blue_light", name: "Blue Light Network", tier: 2, icon: "fa-shield-alt", lucide: "shield",
      desc: "Run a fire, police and ambulance station at the same time.",
      hint: "Own a fire, police and ambulance station", p: S => [services(S), 3] },

    { id: "fleet_commander", name: "Fleet Commander", tier: 2, icon: "fa-truck", lucide: "truck",
      desc: "Own a fleet of 15 emergency vehicles.",
      hint: "Own 15 vehicles", p: S => [arr(S.un).length, 15] },

    { id: "eyes_in_the_sky", name: "Eyes in the Sky", tier: 1, icon: "fa-helicopter", lucide: "helicopter",
      desc: "Add a police helicopter or air ambulance to your fleet.",
      hint: "Own a helicopter or air ambulance", p: S => [hasAircraft(S) ? 1 : 0, 1] },

    { id: "chief_controller", name: "Chief Controller", tier: 1, icon: "fa-crown", lucide: "star",
      desc: "Reach the top rank of Chief Controller.",
      hint: "Reach the top rank", p: S => [num(S.done), topJobs(S)] },

    { id: "thousand_calls", name: "Thousand Calls", tier: 1, icon: "fa-trophy", lucide: "trophy",
      desc: "Complete 1,000 jobs in Frontline Control.",
      hint: "Complete 1,000 jobs", p: S => [num(S.done), 1000] }
  ];

  /* progress for every badge: [{id, v, t, done, pct}] */
  function evaluate(S) {
    S = S || {};
    return DEFS.map(d => {
      let v = 0, t = 1;
      try { const r = d.p(S); v = Math.max(0, num(r[0])); t = Math.max(1, num(r[1])); } catch (e) { /* bad state: counts as no progress */ }
      const vv = Math.min(v, t);
      return { id: d.id, v: vv, t, done: v >= t, pct: Math.round(vv / t * 100) };
    });
  }

  /* ids of the badges this state has earned */
  const earned = S => evaluate(S).filter(x => x.done).map(x => x.id);

  return { DEFS, evaluate, earned, byId: id => DEFS.find(d => d.id === id) || null };
});
