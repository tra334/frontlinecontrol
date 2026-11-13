/* ===== Ranks tab: player leaderboard (signed-in players only) =====
   Data comes from the game server (GET /api/leaderboard), which is where credits and jobs live.
   Shows: #, photo, display name, rank, credits, jobs. The signed-in player's row is highlighted,
   and it is added at the bottom with its real position if they are outside the top 50. */
(function () {
  "use strict";
  const API = window.FC_API || "https://api.frontlinecontrol.co.uk";
  const TTL_MS = 30000;      // treat the list as fresh for 30 s
  const POLL_MS = 60000;     // refresh while the Ranks tab is open
  let rows = [], me = null, loadedAt = 0, busy = false, failed = false;

  const signedIn = () => typeof AU !== "undefined" && !!(AU && AU.user && AU.user.id);

  async function refresh() {
    if (busy || !signedIn()) return;
    busy = true;
    try {
      await sb("/auth/v1/user", { auth: 1 });            // refreshes the login if it is about to expire
      const r = await fetch(API + "/api/leaderboard?limit=50", {
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
    loadedAt = Date.now();
    try { paint(); } catch (e) {}                        // paint() only touches the DOM if the HTML changed
  }

  const initial = n => esc(String(n || "?").trim().charAt(0).toUpperCase() || "?");

  function rowHtml(r) {
    const isMe = signedIn() && r.user_id === AU.user.id;
    return '<div class="lb-row' + (isMe ? " lb-me" : "") + '">' +
      '<span class="lb-pos">' + esc(r.pos) + "</span>" +
      '<span class="lb-av">' + initial(r.name) + (window.fcAvatar ? fcAvatar.img(r.user_id) : "") + "</span>" +
      '<span class="lb-name"><b>' + esc(r.name) + "</b><small>" + esc(r.rank) + "</small></span>" +
      '<span class="lb-rank">' + esc(r.rank) + "</span>" +
      '<span class="lb-cr">£' + fmt(r.credits) + "</span>" +
      '<span class="lb-jobs">' + fmt(r.jobs) + "</span>" +
      "</div>";
  }

  function lbHtml() {
    if (!signedIn()) return "";                          // guests and offline players don't see the board
    if (Date.now() - loadedAt > TTL_MS) refresh();       // stale or never loaded: fetch, then repaint itself

    const head = '<div class="lb-row lb-head"><span class="lb-pos">#</span><span class="lb-av"></span>' +
      '<span class="lb-name">Player</span><span class="lb-rank">Rank</span><span class="lb-cr">Credits</span><span class="lb-jobs">Jobs</span></div>';

    let body;
    if (!rows.length && failed) body = '<div class="lb-msg">Couldn\'t load the leaderboard. It will retry shortly.</div>';
    else if (!rows.length) body = '<div class="lb-msg">Loading…</div>';
    else body = rows.map(rowHtml).join("");

    // the player's own row, if they are outside the top 50
    const inTop = me && rows.some(r => r.user_id === me.user_id);
    const meRow = me && !inTop ? '<div class="lb-gap">…</div>' + rowHtml(me) : "";

    return '<div class="card lb" style="border-left-color:var(--p)">' +
      '<div class="row"><span class="t">Leaderboard</span><span class="mu">Top 50 · all time</span></div>' +
      '<div class="lb-tbl" style="margin-top:8px">' + head + body + meRow + "</div></div>";
  }

  /* put the leaderboard at the top of the Ranks tab (wraps the rewards card that bonus.js added) */
  const origRk = window.rkH;
  window.rkH = function () { return lbHtml() + origRk.apply(this, arguments); };

  setInterval(() => { if (typeof tab !== "undefined" && tab === "r") refresh(); }, POLL_MS);
})();
