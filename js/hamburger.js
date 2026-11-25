/* Menu: the one place for everything that used to be on the Account page. Opens from the hamburger beside the avatar in the header.
   Rows open inside this panel (a page with a back arrow); the Daily bonus row instead expands as a dropdown under itself. Nothing opens as a separate floating window. */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const P = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
    ranks: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    rooms: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    shop: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 9 6 3h4l2 4 2-4h4l-2.5 6"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    down: '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    up: '<path d="M12 15V3m0 0L8 7m4-4 4 4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    log: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    signin: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    signout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="16" cy="16" r="1.2"/>',
    bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M5 10h3M16 10h3M5 16h3M16 16h3M9 3l1.5 3M15 3l-1.5 3"/>',
    speed: '<path d="M3.3 17A9 9 0 1 1 20.7 17"/><path d="M12 14l4-4"/>',
    warn: '<path d="M12 3 22 21H2z"/><path d="M12 10v5M12 18h.01"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 4h3v2a3 3 0 0 1-3 3M7 4H4v2a3 3 0 0 0 3 3"/>',
    chev: '<path d="m9 18 6-6-6-6"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'
  };
  const svg = (k, s) => `<svg width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k]}</svg>`;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const money = n => "£" + (typeof fmt === "function" ? fmt(n) : n);
  const initials = n => { const w = String(n || "?").trim().split(/[\s._-]+/).filter(Boolean); return ((w[0] || "?")[0] + (w.length > 1 ? w[1][0] : "")).toUpperCase(); };
  const signedIn = () => { try { return !!(AU && AU.user && AU.user.id); } catch (e) { return false; } };

  let btn, menu, list, sub, pages, lastHtml = "", rolesCache = null, tab = "ov", devOpen = false, dailyOpen = false;

  const row = (id, ic, title, sub, right, o) => {
    o = o || {};
    return `<button type="button" class="hb_row${o.off ? " off" : ""}${o.danger ? " danger" : ""}" data-id="${id}"${o.off ? ' aria-disabled="true" tabindex="-1"' : ""}><span class="hb_ic${o.y ? " y" : ""}">${svg(ic)}</span><span class="hb_t"><b>${esc(title)}</b><small>${esc(sub)}</small></span>${right || ""}${o.off || o.noChev ? "" : `<span class="hb_chev">${svg("chev", 18)}</span>`}</button>`;
  };
  const tile = (label, value, cls, extra) => `<div class="hb_tile${cls ? " " + cls : ""}"><small>${esc(label)}</small><b>${value}</b>${extra || ""}</div>`;
  const sec = t => `<div class="hb_sec">${t}</div>`;

  function dayState() {
    let can = false, amt = 0, day = 0;
    try { const d = drState(); can = !!d.can; day = d.day; amt = drAmt(d.day); } catch (e) {}
    return { can, amt, day };
  }

  function html() {
    const u = AU && AU.user, si = signedIn();
    const dev = !!(u && u.app_metadata && u.app_metadata.role === "developer");
    let name = "Guest", rkName = "", r = 0, pend = 0, pct = 0, toNext = "", rankHtml = "";
    try { name = uname(); } catch (e) {}
    try {
      const RK = RKX(); r = rank(); rkName = RK[r][0];
      const nx = RK[r + 1];
      pct = nx ? Math.max(0, Math.min(100, Math.round((S.done - RK[r][1]) / (nx[1] - RK[r][1]) * 100))) : 100;
      toNext = nx ? (nx[1] - S.done) + " more jobs to " + nx[0] : "Top rank reached";
      pend = r - (S.rcl || 0);
      rankHtml = rankBadge(r, false, 6);
    } catch (e) {}
    let cloud = si ? "Cloud save on" : "This device only";
    if (si) { try { cloud = (cloudMsg || "Cloud save on").replace(/^[^A-Za-z]+/, ""); } catch (e) {} }
    const d = dayState();
    const sv = k => S.st.filter(x => x.sv === k).length;
    const dep = S.un.filter(x => x.st !== "idle").length;
    const rn = $("#nav_rm .rmn"), rmCount = rn && !rn.hidden ? rn.textContent : "";
    const inRm = !!($("#nav_rm") && $("#nav_rm").classList.contains("in"));
    const rmSub = !si ? "Sign up to use Rooms" : inRm ? "You're in a room" : rmCount ? rmCount + " invite" + (rmCount === "1" ? "" : "s") + " waiting" : "Create or join a room";
    let av = esc(initials(name));
    if (si && window.fcAvatar) { try { av = fcAvatar.mine(68); } catch (e) {} }
    const since = u && u.created_at ? new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–";
    let roles = "";
    if (si) { try { roles = fcRoles.html(rolesCache || { owner: false, roles: [] }, dev); } catch (e) {} }
    const dbgOn = !!(getSet() && getSet().dbgInd);
    const dbgN = window.DebugLog && DebugLog.list ? DebugLog.list().length : 0;

    const speedCard = (typeof spdOK === "function" && spdOK()) ? (() => {
      const c = spd();
      const chip = (n, l) => `<button type="button" data-id="spd" data-n="${n}" class="hb_chip${c === n ? " on" : ""}">${l}</button>`;
      return `<div class="hb_card hb_pad"><div class="hb_t"><b>Vehicle speed</b><small>Speeds vehicles up for testing.</small></div><div class="hb_chips">${chip(1, "1×")}${chip(2, "2×")}${chip(5, "5×")}${chip(10, "10×")}</div></div>`;
    })() : "";

    const gbo = window.gbOffers ? gbOffers() : [];   // custom bonuses created in the admin panel
    const pl = [];
    if (d.can) pl.push(["claimdaily", "Daily bonus", money(d.amt)]);
    if (pend > 0) { let t = 0; try { t = rbSum(S.rcl || 0, r); } catch (e) {} pl.push(["claimrank", "Rank-up bonus", money(t)]); }
    gbo.forEach(o => pl.push(["claimgb:" + o.id, o.title, money(o.amount)]));
    const pendHtml = pl.length ? `<div class="hb_pend">${pl.map(x => `<button type="button" class="hb_claim" data-id="${x[0]}"><span><b>${x[1]}</b> ready · ${x[2]}</span><em>Claim now</em></button>`).join("")}</div>` : "";

    const overview = `<div class="hb_card hb_prof">
  <button type="button" class="hb_av" data-id="avatar" aria-label="${si ? "Change or remove profile picture" : "Profile picture"}">${av}${si ? `<span class="hb_avb" aria-hidden="true">${svg("pencil", 13)}</span>` : ""}</button>
  <div class="hb_pn"><b>${esc(name)}<span class="hb_ed" data-id="edit" role="button" aria-label="Change display name">${svg("pencil", 14)}</span></b><small>${esc(si && u.email ? u.email : "Playing offline – not signed in")}</small><small>Member since ${esc(since)}</small>${roles ? `<div class="hb_roles">${roles}</div>` : ""}</div>
</div>
<div class="hb_card hb_rankcard" data-id="ranks">
  <div class="hb_rank_top">${rankHtml}<div class="hb_rank_t"><small>Rank</small><b>${esc(rkName)}</b></div>${pend > 0 || d.can ? '<span class="hb_pill g">Claim</span>' : ""}</div>
  <div class="hb_bar2"><i style="width:${pct}%"></i></div>
  <div class="hb_sub2"><span>${esc(toNext)}</span><span>View ranks ${svg("chev", 14)}</span></div>
</div>
${pendHtml}<div class="hb_grid">
  ${tile("Jobs completed", fmt(S.done))}
  ${tile("Open incidents", S.ms.length)}
  ${tile("Units", S.un.length + " · " + dep + " deployed")}
  ${tile("Stations", "🚒 " + sv("f") + " · 🚓 " + sv("p") + " · 🚑 " + sv("a"))}
  ${tile("New 999 calls", S.pz ? "Paused" : "Running", "", `<button type="button" class="hb_mini" data-id="pause">${svg("pause", 14)} ${S.pz ? "Resume calls" : "Pause calls"}</button>`)}
  ${tile("Save", esc(cloud))}
</div>`;

    const play = `${sec("Bonuses")}
<div class="hb_card">
${row("dailydrop", "gift", "Daily bonus", d.can ? "Claim " + money(d.amt) : "Claimed today", (d.can ? '<span class="hb_pill g">Claim</span>' : "") + `<span class="hb_chev${dailyOpen ? " open" : ""}">${svg("chev", 18)}</span>`, { noChev: true })}
${dailyOpen && window.rkDailyH ? `<div class="hb_drop">${rkDailyH()}</div>` : ""}
${gbo.map(o => row("claimgb:" + o.id, "gift", o.title, "Claim " + money(o.amount) + " · ends " + new Date(o.ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), '<span class="hb_pill g">Claim</span>')).join("")}
${pend > 0 ? row("rankup", "medal", "Rank-up bonus", pend + " to claim", '<span class="hb_pill g">Claim</span>') : ""}
${S.dv || !devBonusOK() ? "" : row("dev", "wrench", "Dev bonus", money(typeof DEVBONUS === "number" ? DEVBONUS : 1000000) + " · one-time", "", { y: true })}
</div>
${sec("Game")}
<div class="hb_card">
${row("rooms", "rooms", "Rooms", rmSub, !si ? "" : rmCount ? `<span class="hb_pill">${esc(rmCount)}</span>` : "", si ? {} : { off: true })}
${window.Ach ? row("ach", "trophy", "Achievements", Ach.summary() + " unlocked") : ""}
${row("lb", "trophy", "Leaderboard", si ? "Top 50 players" : "Sign in to see rankings", "", si ? {} : { off: true })}
${row("shop", "shop", "Shop", "Upgrades")}
${row("forum", "msg", "Forum", si ? "Join the community · signs you in" : "Join the community", "", { noChev: true })}
${row("logs", "log", "Logs", "Past calls and earnings")}
</div>`;

    const showDev = typeof spdOK === "function" && spdOK();
    const devTools = devOpen && showDev ? `<div class="hb_card">
  <button type="button" class="hb_row" data-id="dbgtimer"><span class="hb_ic">${svg("clock")}</span><span class="hb_t"><b>Show debug call timer</b><small>Countdown next to the build button</small></span><span class="hb_sw${dbgOn ? " on" : ""}"></span></button>
  ${row("mspawn", "phone", "Manual spawn", "Pick any call at your rank and spawn it near your stations")}
  ${row("ukseed", "cog", "Create UK emergency stations", "Free stations and vehicles for every UK fire, police and ambulance station (online play, once)")}
  ${row("rspawn", "dice", "Spawn random call now", "Doesn't reset the new-call timer")}
  ${row("dbglog", "bug", "Debug log", dbgN ? dbgN + " entries" : "Errors and failed requests")}
</div>${speedCard ? `<div style="height:12px"></div>${speedCard}` : ""}` : "";

    const account = `<button type="button" class="hb_signout${si ? " out" : ""}" data-id="auth">${svg(si ? "signout" : "signin", 20)}<span>${si ? "Sign out" : "Sign in"}</span></button>
<div class="hb_card">
${row("set", "cog", "Settings", "Sound, display and more")}
${row("exp", "down", "Export save", "Download your progress")}
${si ? "" : row("imp", "up", "Import save", "Restore from a save file")}
${si ? row("chgemail", "mail", "Change email", "The email you sign in with") : ""}
</div>
${showDev ? `<div class="hb_card">
${row("devtools", "bug", "Developer tools", "For testing and troubleshooting", `<span class="hb_chev${devOpen ? " open" : ""}">${svg("chev", 18)}</span>`, { noChev: true })}
</div>
${devTools}` : ""}
<div class="hb_card hb_dzcard">
<div class="hb_dz_head">${svg("warn", 14)} Danger zone</div>
${row("reset", "warn", "Reset game", "Wipes all progress. This cannot be undone.", "", { danger: true })}
${si ? row("delacct", "trash", "Delete account", "Cannot be undone. Removes your account and cloud data. To only wipe progress, use Reset game instead.", "", { danger: true }) : ""}
</div>
<div class="hb_ver">A 2.0.23</div>`;

    const tabs = [["ov", "Overview", false], ["pl", "Play", pend > 0 || d.can || !!rmCount || gbo.length > 0], ["ac", "Account", false]];
    const bar = `<div class="hb_tabs" role="tablist">${tabs.map(t => `<button type="button" role="tab" aria-selected="${tab === t[0]}" class="hb_tab${tab === t[0] ? " on" : ""}" data-id="tab" data-tab="${t[0]}">${t[1]}${t[2] ? '<i class="hb_tdot"></i>' : ""}</button>`).join("")}</div>`;
    const dtop = `<div class="hb_dtop"><span class="hb_dt">${svg("menu", 20)}<b>Menu</b></span><span class="hb_esc">Esc to close</span><button type="button" class="hb_x" data-id="close" aria-label="Close menu">${svg("x", 18)}</button></div>`;
    return dtop + bar + `<div class="hb_panes" data-tab="${tab}"><section class="hb_pane" data-p="ov"><div class="hb_ph">Profile</div>${overview}</section><section class="hb_pane" data-p="pl"><div class="hb_ph">Play</div>${play}</section><section class="hb_pane" data-p="ac"><div class="hb_ph">Account</div>${account}</section></div>`;
  }

  function render() {
    if (!list) return;
    const h = html();
    if (h !== lastHtml) { list.innerHTML = h; lastHtml = h; }
  }

  /* Pages that open inside the panel. Static pages rebuild from live game state; mount pages are the existing
     Settings, Logs, Manual spawn and Debug log screens, which mount themselves into the panel through window.fcPanelMount. */
  const PAGES = {
    ranks: { t: "Ranks", html: () => window.rkFlatH ? rkFlatH() : "" },
    ach: { t: "Achievements", html: () => window.Ach ? Ach.flatHtml() : "" },
    rankup: { t: "Rank-up bonus", html: () => window.rkRankUpH ? rkRankUpH() : "" },
    lb: { t: "Leaderboard", html: () => `<div class="hb_lb">${window.lbHtml && signedIn() ? lbHtml() : '<div class="hb_panel">Sign in to see the leaderboard.</div>'}</div>` },
    shop: { t: "Shop", html: () => `<div class="hb_shop">${typeof atpH === "function" ? atpH() : ""}</div>` },
    dev: { t: "Dev bonus", html: () => window.rkDevH && devBonusOK() ? rkDevH() : "" },
    set: { t: "Settings", mount: () => openSettings() },
    logs: { t: "Logs", mount: () => openJobLogs() },
    mspawn: { t: "Manual spawn", mount: () => { close(); openMissionSpawn(); } },
    dbglog: { t: "Debug log", mount: () => { if (window.DebugLog) DebugLog.open(); else toast("Debug log not loaded"); } }
  };

  /* Developer tool: asks the game server to create every UK fire, police and ambulance station (from js/data/uk-stations.json),
     with two of each vehicle type per station, all free. Online play only; the server checks the developer role too. */
  function devSeedUK() {
    if (!window.SRV || !SRV.on) { toast("Turn on online play first. This tool runs on the game server."); return; }
    confirmDlg("Create UK stations?",
      "This adds every UK fire, police and ambulance station, plus two vehicles of each type at each one, all <b>free</b>. It can take a while and it cannot be undone from the game.",
      "Create stations",
      () => {
        toast("Creating UK stations on the server...");
        SRV.act({ type: "devseed_uk" }).then(j => {
          toast(j && j.ok ? (j.msg || "UK stations created.") : ("Failed: " + ((j && j.msg) || "server error")));
          lastHtml = ""; update();
        }).catch(() => toast("Can't reach the game server"));
      }, "#1d4ed8");
  }

  async function spawnRandom() {
    close();
    if (!S.st.length) { toast("Build a station first."); return; }
    const ok = await spawn();
    if (!ok) toast("No mission can spawn with your current stations and rank.");
    persist(); paint(); update();
  }

  function openForum() { window.open((window.FC_FORUM_URL || "https://forum.frontlinecontrol.co.uk").replace(/\/$/, "") + "/login", "_blank", "noopener"); }

  const actions = {
    close: () => close(),
    claimdaily: () => { try { claimDaily(); } catch (e) { console.error(e); } lastHtml = ""; update(); },
    claimrank: () => { try { claimRank(); } catch (e) { console.error(e); } lastHtml = ""; update(); },
    tab: el => { tab = el.dataset.tab; lastHtml = ""; render(); },
    devtools: () => { devOpen = !devOpen; lastHtml = ""; render(); },
    /* Daily bonus expands in place under its row (a dropdown) instead of opening a full page. */
    dailydrop: () => { dailyOpen = !dailyOpen; lastHtml = ""; render(); },
    edit: () => changeName(),
    avatar: el => { if (signedIn() && window.fcAvatar) avMenu(el); },
    rooms: () => { if (!signedIn()) return; close(); const b = $("#nav_rm"); if (b) b.click(); },
    /* Opens the forum's login page. The forum uses "Sign in with Frontline Control" (Supabase OAuth), which lands on oauth-consent.html;
       that page reuses this game's saved session and approves automatically, so a signed-in player ends up logged in (account created on first visit). */
    forum: () => openForum(),
    exp: () => { close(); exportSave(); },
    imp: () => { close(); importSave(); },
    auth: () => {
      if (signedIn()) { close(); signOut(); return; }
      try { localStorage.removeItem(GUEST_KEY); } catch (x) {}
      if (gameOn) persist();
      location.reload();
    },
    pause: () => { togglePause(); update(); },
    dbgtimer: () => { setSet("dbgInd", !getSet().dbgInd); dbgUp(); update(); },
    spd: el => { const p = setSpd(+el.dataset.n); if (p && p.then) p.then(update); update(); },
    rspawn: () => spawnRandom(),
    ukseed: () => { close(); devSeedUK(); },
    reset: () => { close(); resetG(); },
    chgemail: () => { close(); if (window.fcChangeEmail) fcChangeEmail(); },
    delacct: () => { close(); if (window.fcDeleteAccount) fcDeleteAccount(); }
  };

  /* Called by the overlays (Settings, Logs, Manual spawn, Debug log) instead of appending to the body while the panel is open. */
  window.fcPanelMount = function (ov, title) {
    if (!sub || sub.hidden || !pages) return false;
    ov.dataset.host = "1";
    ov.dataset.t = title || "";
    ov.classList.add("hb_ov");
    ov.onclick = null;
    pages.appendChild(ov);
    return true;
  };

  function showList() {
    if (!sub) return;
    pages.innerHTML = "";
    sub.hidden = true;
    list.hidden = false;
    lastHtml = "";
    render();
  }

  /* Only the top page is visible, the bar title follows it, and an empty stack returns to the list. */
  function sync() {
    if (!pages || !sub) return;
    const kids = [...pages.children];
    if (!kids.length) { if (!sub.hidden) showList(); return; }
    kids.forEach((k, i) => { k.hidden = i !== kids.length - 1; });
    const bt = sub.querySelector(".hb_bt");
    if (bt) bt.textContent = kids[kids.length - 1].dataset.t || "";
  }

  function showSub(key) {
    const def = PAGES[key];
    if (!def || !sub) return;
    pages.innerHTML = "";
    list.hidden = true;
    sub.hidden = false;
    lastHtml = "";
    if (def.mount) {
      try { def.mount(); } catch (e) { console.error(e); }
    } else {
      const d = document.createElement("div");
      d.className = "hb_page";
      d.dataset.t = def.t;
      d._rf = def.html;
      d._h = def.html();
      d.innerHTML = d._h;
      pages.appendChild(d);
    }
    sync();
  }

  function back() {
    const top = pages.lastElementChild;
    if (top) top.remove(); else showList();
  }

  function build() {
    const hd = $("header");
    if (!hd || $("#hb_btn")) return;
    btn = document.createElement("button");
    btn.id = "hb_btn"; btn.type = "button";
    btn.setAttribute("aria-label", "Menu"); btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = svg("menu") + '<i class="hb_dot" hidden></i>';
    const rk = $("#rk");
    (rk ? rk.parentNode : hd).appendChild(btn);
    /* Forum shortcut in the header (same sign-in route as the Forum row in the menu). */
    if (!$("#hd_forum")) {
      const fb = document.createElement("button");
      fb.id = "hd_forum"; fb.type = "button";
      fb.setAttribute("aria-label", "Forum"); fb.title = "Open the forum";
      fb.innerHTML = svg("msg", 20) + "<span>Forum</span>";
      fb.onclick = openForum;
      /* Left side of the header, beside the logo, so it never squeezes the balance or avatar on the right. */
      const lf = hd.firstElementChild;
      if (lf) lf.appendChild(fb); else btn.parentNode.insertBefore(fb, btn);
    }

    menu = document.createElement("div");
    menu.id = "hb_menu"; menu.hidden = true;
    list = document.createElement("div");
    list.className = "hb_list_wrap";
    sub = document.createElement("div");
    sub.id = "hb_sub"; sub.hidden = true;
    sub.innerHTML = '<div class="hb_bar"><button type="button" class="hb_back" aria-label="Back">' + svg("back", 20) + '</button><b class="hb_bt"></b></div><div class="hb_pages"></div>';
    menu.append(list, sub);
    document.body.appendChild(menu);
    pages = sub.querySelector(".hb_pages");
    sub.querySelector(".hb_back").onclick = back;
    new MutationObserver(sync).observe(pages, { childList: true });

    btn.onclick = () => (menu.hidden ? open() : close());
    if (rk) rk.addEventListener("click", () => open());
    list.addEventListener("click", e => {
      const el = e.target.closest("[data-id]");
      if (!el || el.classList.contains("off")) return;
      const id = el.dataset.id;
      if (id.indexOf("claimgb:") === 0) { try { gbClaim(id.slice(8)); } catch (err) { console.error(err); } lastHtml = ""; update(); return; }
      if (PAGES[id]) { showSub(id); return; }
      const a = actions[id];
      if (a) { try { a(el); } catch (err) { console.error(err); } }
    });
    document.querySelectorAll("nav button").forEach(b => b.addEventListener("click", () => close()));
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !menu.hidden) close(); });
  }

  function setIcon(k) { const d = btn.querySelector(".hb_dot"); btn.innerHTML = svg(k) + (d ? d.outerHTML : '<i class="hb_dot" hidden></i>'); }

  function open() {
    if (!menu || !menu.hidden) return;
    sub.hidden = true; list.hidden = false; pages.innerHTML = "";
    lastHtml = ""; tab = "ov"; devOpen = false; dailyOpen = false;
    render(); menu.hidden = false; btn.classList.add("on"); btn.setAttribute("aria-expanded", "true"); setIcon("x"); update();
    /* Roles decide who sees the dev tools and speed control; load them whenever the menu opens. */
    try {
      const u = AU && AU.user, dev = !!(u && u.app_metadata && u.app_metadata.role === "developer");
      fcRoles.get().then(v => { rolesCache = v; try { spdSet(v, dev); } catch (e) {} lastHtml = ""; update(); }).catch(() => {});
    } catch (e) {}
  }

  function close() {
    if (!menu || menu.hidden) return;
    menu.hidden = true; btn.classList.remove("on"); btn.setAttribute("aria-expanded", "false"); setIcon("menu");
    if (pages && pages.children.length) pages.innerHTML = "";
    if (sub) sub.hidden = true;
    if (list) list.hidden = false;
    lastHtml = "";
    update();
  }
  window.fcPanelOpen = open;
  window.fcPanelClose = close;
  window.fcPanelRefresh = () => update();

  function update() {
    if (!btn) return;
    let claim = false;
    try { claim = rank() > (S.rcl || 0) || drState().can || (window.gbOffers && gbOffers().length > 0); } catch (e) {}
    const rn = $("#nav_rm .rmn");
    const dot = btn.querySelector(".hb_dot"); if (dot) dot.hidden = !(claim || (rn && !rn.hidden));
    if (menu.hidden) return;
    if (sub.hidden) { render(); return; }
    const top = pages.lastElementChild;
    if (top && top._rf) { const h = top._rf(); if (h !== top._h) { top._h = h; top.innerHTML = h; } }
  }

  function init() { build(); update(); setInterval(update, 1000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
