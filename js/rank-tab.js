/* Ranks tab layout.
   Top: the current rank, with a "View all ranks" dropdown.
   Then dropdowns in order: Leaderboard, Daily bonus, Rank-up bonus (only when one is waiting), Dev bonus (hidden once claimed), Shop. */
(function () {
  "use strict";
  const money = n => "£" + fmt(n);
  const rkRanks = () => RKX().map((x, i) => ({
    i, name: x[0], jobs: x[1], mult: RMUL[i],
    veh: Object.values(U).filter(v => v[3] === i).map(v => v[1]),
    tr: Object.values(TR).filter(v => v[2] === i).map(v => v[0])
  }));
  const rkState = i => (i < rank() ? "done" : i === rank() ? "cur" : "locked");
  const rkPct = () => {
    const r = rank(), nx = RKX()[r + 1];
    if (!nx) return 100;
    const a = RKX()[r][1];
    return Math.max(0, Math.min(100, Math.round((S.done - a) / (nx[1] - a) * 100)));
  };
  const rkUnlock = R => [R.veh.length ? "Vehicles: " + R.veh.join(", ") : "", R.tr.length ? "Training: " + R.tr.join(", ") : ""].filter(Boolean).join(" · ") || "No new unlocks";
  const rkPend = () => rank() - (S.rcl || 0);
  const SUM = 'style="cursor:pointer;font-weight:700;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px"';

  // Open/closed state of each dropdown is remembered, so the tab can be rebuilt without closing what the player opened
  const rkOpen = {};
  document.addEventListener("toggle", e => { const d = e.target; if (d && d.dataset && d.dataset.rk) rkOpen[d.dataset.rk] = d.open; }, true);
  const rkDet = (key, defOpen, attrs, inner) =>
    `<details data-rk="${key}" ${(key in rkOpen ? rkOpen[key] : defOpen) ? "open" : ""} ${attrs}>${inner}</details>`;

  function rkDays() {
    const d = drState();
    return `<div class="rk-days">${[1, 2, 3, 4, 5, 6, 7].map(n => {
      const done = d.can ? n < d.day : n <= d.day, cur = d.can && n === d.day;
      return `<div class="rk-day ${done ? "done" : ""} ${cur ? "cur" : ""}">Day ${n}<b>£${drAmt(n) / 1000}k</b></div>`;
    }).join("")}</div>`;
  }
  const rkDailyBtn = () => {
    const d = drState();
    return d.can ? `<button class="s" onclick="claimDaily()">Claim ${money(drAmt(d.day))}</button>`
      : `<span class="mu">Next: ${money(drAmt(d.day % 7 + 1))} tomorrow</span>`;
  };
  const rkBonusBtn = () => {
    const p = rkPend();
    return p > 0 ? `<button class="s" onclick="claimRank()">Claim ${p} bonus${p > 1 ? "es" : ""} · ${money(rbSum(S.rcl || 0, rank()))}</button>`
      : `<span class="mu">No rank bonus waiting</span>`;
  };

  function rkCurrent() {
    const r = rank(), R = rkRanks()[r], nx = rkRanks()[r + 1];
    const head = `<div class="rk-head">${rankBadge(r, false)}<div class="rk-txt"><div class="mu">Current rank</div><div class="rk-name">${esc(R.name)}</div></div><span class="mu rk-mult">×${R.mult.toFixed(2)} on all calls</span></div>`;
    const prog = nx
      ? `<div class="bar"><i style="width:${rkPct()}%"></i></div><div class="row"><span class="mu">${S.done} of ${nx.jobs} jobs</span><span class="mu">Next: ${esc(nx.name)}</span></div>`
      : `<div class="mu">Top rank reached</div>`;
    const items = rkRanks().map(X => {
      const locked = rkState(X.i) === "locked";
      return `<div class="rk-item${locked ? " locked" : ""}"><div class="rk-row">${rankBadge(X.i, locked)}<div style="flex:1;min-width:0"><div class="rk-line"><b>${esc(X.name)}</b><span class="mu">${X.jobs} jobs · ×${X.mult.toFixed(2)}</span></div><div class="mu">${esc(rkUnlock(X))}</div></div></div></div>`;
    }).join("");
    const all = rkDet("all", false, 'class="rk-all"', `<summary>View all ranks ›</summary><div class="rk-all-body">${items}</div>`);
    return `<div class="rk-top">${head}${prog}${all}</div>`;
  }

  window.rkH = function () {
    const lb = (window.lbHtml ? window.lbHtml() : "").replace(/<div class="row"><span class="t">[\s\S]*?Top 50<\/span><\/div>/, "");
    const offers = window.gbCardHtml ? window.gbCardHtml() : "";
    const staffClaim = typeof claimH === "function" ? claimH() : "";
    const d = drState(), p = rkPend();

    const lbSec = lb ? rkDet("lb", true, 'class="card rk-sec"', `<summary ${SUM}><span class="t">${lci("trophy")} Leaderboard</span><span class="mu">Top 50</span></summary><div style="margin-top:10px">${lb}</div>`) : "";
    const dailySec = rkDet("daily", false, 'class="card rk-sec" style="border-left:4px solid var(--a)"', `<summary ${SUM}><span class="t">${lci("gift")} Daily bonus</span><span class="mu">${d.can ? "Claim " + money(drAmt(d.day)) : "Claimed today"}</span></summary><div style="margin-top:10px">${rkDays()}<div style="margin-top:8px">${rkDailyBtn()}</div></div>`);
    const bonusSec = p > 0 ? rkDet("rankup", false, 'class="card rk-sec" style="border-left:4px solid var(--ac)"', `<summary ${SUM}><span class="t">${lci("medal")} Rank-up bonus</span><span class="mu">${p} to claim</span></summary><div style="margin-top:10px">${rkBonusBtn()}</div>`) : "";
    const devSec = S.dv ? "" : rkDet("dev", false, 'class="card rk-sec" style="border-left:4px solid #eab308"', `<summary ${SUM}><span class="t">${lci("wrench")} Dev bonus</span><span class="mu">${money(DEVBONUS)} · one-time</span></summary><div style="margin-top:10px"><button class="s" onclick="claimDev()">Claim ${money(DEVBONUS)}</button></div>`);
    const shopSec = rkDet("shop", false, 'class="card rk-sec"', `<summary ${SUM}><span class="t">${lci("car-front")} Shop</span><span class="mu">Upgrades</span></summary><div style="margin-top:10px">${atpH()}</div>`);

    return `<div class="rk-tab">${staffClaim}${offers}${rkCurrent()}${lbSec}${dailySec}${bonusSec}${devSec}${shopSec}</div>`;
  };
})();
