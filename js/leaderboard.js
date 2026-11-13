/* ===== Ranks tab: player leaderboard (signed-in players only) =====
   Data comes from the game server (GET /api/leaderboard?sort=earn|jobs&period=today|week|month|all).
   Two tabs (Earnings, Jobs done) and four periods (Today, Week, Month, All time). */
(function () {
  "use strict";
  const API = window.FC_API || "https://api.frontlinecontrol.co.uk";
  const TTL_MS = 30000;      // treat the list as fresh for 30 s
  const POLL_MS = 60000;     // refresh while the Ranks tab is open
  const METRICS = [["earn", "Earnings"], ["jobs", "Jobs done"]];
  const PERIODS = [["today", "Today"], ["week", "Week"], ["month", "Month"], ["all", "All time"]];
  let sort = "earn", period = "all";
  let rows = [], me = null, loadedAt = 0, loadedKey = "", busy = false, failed = false;

  const signedIn = () => typeof AU !== "undefined" && !!(AU && AU.user && AU.user.id);
  const key = () => sort + ":" + period;

  async function refresh() {
    if (busy || !signedIn()) return;
    busy = true;
    const want = key();
    try {
      await sb("/auth/v1/user", { auth: 1 });            // refreshes the login if it is about to expire
      const r = await fetch(API + "/api/leaderboard?limit=50&sort=" + sort + "&period=" + period, {
        headers: { Authorization: "Bearer " + AU.access_token }
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error(j.reason || "HTTP " + r.status);
      rows = Array.isArray(j.rows) ? j.rows : [];
      me = j.me || null;
      failed = false;
    } catch (e) {
      failed = true;
      console.error("Leaderboard load failed", e);
    }
    busy = false;
    loadedKey = want;
    loadedAt = Date.now();
    try { paint(); } catch (e) {}                        // paint() only touches the DOM if the HTML changed
  }

  // called by the tab buttons: pass null to keep the current value
  window.lbSet = function (s, p) {
    if (s) sort = s;
    if (p) period = p;
    try { paint(); } catch (e) {}
    refresh();
  };

  const initial = n => esc(String(n || "?").trim().charAt(0).toUpperCase() || "?");
  const posCell = r => r.pos == null ? "—" : esc(r.pos);

  function rowHtml(r) {
    const isMe = signedIn() && r.user_id === AU.user.id;
    return '<div class="lb-row' + (isMe ? " lb-me" : "") + '">' +
      '<span class="lb-pos">' + posCell(r) + "</span>" +
      '<span class="lb-av">' + initial(r.name) + (window.fcAvatar ? fcAvatar.img(r.user_id) : "") + "</span>" +
      '<span class="lb-name"><b>' + esc(r.name) + "</b><small>" + esc(r.rank) + "</small></span>" +
      '<span class="lb-rank">' + esc(r.rank) + "</span>" +
      '<span class="lb-cr">£' + fmt(r.earned) + "</span>" +
      '<span class="lb-jobs">' + fmt(r.jobs) + "</span>" +
      "</div>";
  }

  const chips = (items, cur, arg) => '<div class="lb-chips">' + items.map(([v, label]) =>
    '<button type="button" class="lb-chip' + (cur === v ? " on" : "") + '" onclick="lbSet(' +
    (arg === "sort" ? "'" + v + "',null" : "null,'" + v + "'") + ')">' + label + "</button>").join("") + "</div>";

  function lbHtml() {
    if (!signedIn()) return "";                          // guests and offline players don't see the board
    if (Date.now() - loadedAt > TTL_MS || loadedKey !== key()) refresh();

    const head = '<div class="lb-row lb-head"><span class="lb-pos">#</span><span></span>' +
      '<span class="lb-name">Player</span><span class="lb-rank">Rank</span>' +
      '<span class="lb-cr">Earned</span><span class="lb-jobs">Jobs</span></div>';

    let body;
    if (loadedKey !== key()) body = '<div class="lb-msg">Loading…</div>';
    else if (!rows.length && failed) body = '<div class="lb-msg">Couldn\'t load the leaderboard. It will retry shortly.</div>';
    else if (!rows.length) body = '<div class="lb-msg">Nobody has ' + (sort === "jobs" ? "done jobs" : "earned anything") + ' in this period yet.</div>';
    else body = rows.map(rowHtml).join("");

    // the player's own row, if they are outside the top 50
    const inTop = me && rows.some(r => r.user_id === me.user_id);
    const meRow = me && !inTop && loadedKey === key() ? '<div class="lb-gap">…</div>' + rowHtml(me) : "";

    return '<div class="card lb" style="border-left-color:var(--p)">' +
      '<div class="row"><span class="t">' + lci("trophy") + ' Leaderboard</span><span class="mu">Top 50</span></div>' +
      chips(METRICS, sort, "sort") + chips(PERIODS, period, "period") +
      '<div class="lb-tbl">' + head + body + meRow + "</div></div>";
  }

  /* put the leaderboard at the top of the Ranks tab (wraps the rewards card that bonus.js added) */
  const origRk = window.rkH;
  window.rkH = function () { return lbHtml() + origRk.apply(this, arguments); };

  setInterval(() => { if (typeof tab !== "undefined" && tab === "r") refresh(); }, POLL_MS);
})();
