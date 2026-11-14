/* Rank insignia: one shape per rank, growing in size, with a 3D gradient, drop shadow and gloss.
   The top rank (Chief Controller) gets a gold finish. Locked ranks are greyed out. */
(function () {
  "use strict";
  const TIER = ["#64748b", "#0ea5e9", "#22c55e", "#a855f7", "#f59e0b", "#ef4444"];
  const SH = "M20 2 L36 7 V20 C36 30 29 36 20 39 C11 36 4 30 4 20 V7 Z";
  const CHEV = y => `<path d="M12 ${y + 6} L20 ${y} L28 ${y + 6}" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const starPts = (cx, cy, R, r, n) => { const p = []; for (let k = 0; k < n * 2; k++) { const a = Math.PI / n * k - Math.PI / 2, rad = k % 2 ? r : R; p.push((cx + rad * Math.cos(a)).toFixed(2) + "," + (cy + rad * Math.sin(a)).toFixed(2)); } return p.join(" "); };
  const HEX = (() => { const p = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 2; p.push((20 + 18 * Math.cos(a)).toFixed(2) + "," + (20 + 18 * Math.sin(a)).toFixed(2)); } return p.join(" "); })();
  const SHAPES = [
    c => `<path d="${SH}" fill="${c}"/>${CHEV(15)}`,
    c => `<path d="${SH}" fill="${c}"/>${CHEV(11)}${CHEV(19)}`,
    c => `<path d="${SH}" fill="${c}"/>${CHEV(7)}${CHEV(14)}${CHEV(21)}`,
    c => `<circle cx="20" cy="20" r="18" fill="${c}"/><circle cx="20" cy="20" r="14" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/><polygon points="${starPts(20, 20, 9, 4, 5)}" fill="#fff"/>`,
    c => `<polygon points="${HEX}" fill="${c}" stroke="#f5c542" stroke-width="2.5"/><polygon points="${starPts(20, 20, 8, 3.4, 6)}" fill="#fff"/>`,
    c => `<polygon points="${starPts(20, 20, 19, 15, 12)}" fill="${c}"/><circle cx="20" cy="20" r="11" fill="#fff" fill-opacity=".92"/><polygon points="${starPts(20, 20, 7, 3, 5)}" fill="${c}"/>`
  ];
  const mix = (hex, to, t) => {
    const a = [1, 3, 5].map(k => parseInt(hex.substr(k, 2), 16)), b = [1, 3, 5].map(k => parseInt(to.substr(k, 2), 16));
    return "#" + a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, "0")).join("");
  };
  function rankBadge(i, locked, gap) {
    const sz = 26 + i * 4, col = locked ? "#94a3b8" : TIER[i], id = "rb" + i + (locked ? "l" : "");
    const gold = i === 5 && !locked;
    const stops = gold
      ? '<stop offset="0" stop-color="#fff6c9"/><stop offset="0.3" stop-color="#f5d46b"/><stop offset="0.6" stop-color="#c8951f"/><stop offset="1" stop-color="#5c3d07"/>'
      : `<stop offset="0" stop-color="${mix(col, "#ffffff", 0.45)}"/><stop offset="0.55" stop-color="${col}"/><stop offset="1" stop-color="${mix(col, "#000000", 0.35)}"/>`;
    const glow = gold ? '<feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#f5c542" flood-opacity=".55"/>' : "";
    const defs = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient><filter id="${id}f" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="1.3" flood-color="#000" flood-opacity=".35"/>${glow}</filter></defs>`;
    const rim = gold ? '<circle cx="20" cy="20" r="19" fill="none" stroke="#8a6512" stroke-width="1"/>' : "";
    return `<svg class="rkbadge" width="${sz}" height="${sz}" viewBox="0 0 40 40" style="flex:none;vertical-align:middle;margin-right:${gap == null ? 8 : gap}px;overflow:visible;opacity:${locked ? 0.5 : 1}" aria-hidden="true">${defs}<g filter="url(#${id}f)">${SHAPES[i](`url(#${id}g)`)}</g>${rim}<ellipse cx="20" cy="10" rx="10" ry="4.5" fill="#fff" opacity="${gold ? 0.45 : 0.28}"/></svg>`;
  }
  window.rankBadge = rankBadge;
})();
