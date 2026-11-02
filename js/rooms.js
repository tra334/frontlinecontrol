/* ===== Multiplayer Rooms (invite codes, ally map, shared missions) =====
   Requires: signed-in user (Supabase), tables from supabase_rooms.sql
   Design:
   - Create / join room with 6-char code
   - Publish stations + unit positions as presence
   - Stations persist server-side (last known) so allies still show if offline
   - Vehicles only update while the other player is online recently
   - Share a mission to the room; others can send units to it
   - Anyone who sent a unit to a shared mission when it completes
     receives 100% of the reward in their own game (claim once)
*/
(function () {
  const ROOM_KEY = "fc_room";
  const POLL_MS = 5000;
  let _leaving = false;     // true while leaveRoom() is deleting our rows (blocks late presence publishes)
  const PRESENCE_MS = 2500;
  const STALE_UNIT_MS = 45000;  // vehicles vanish if ally offline
  const STALE_MEMBER_MS = 90000; // member list 'online' dot

  let room = null;          // { id, code, name, host_id }
  let members = [];         // [{ user_id, display_name, last_seen }]
  let presence = {};        // user_id -> { display_name, stations, units, updated_at }
  let roomMissions = [];    // shared missions from server
  let roomChat = [];        // chat messages from server, oldest first
  let chatSeenAt = 0;       // ms epoch of the newest message the player has viewed
  let chatUnread = 0;       // messages received since chatSeenAt
  let chatOpen = false;     // true while the Rooms panel is on screen (any tab)
  let rmTab = "ov";         // active tab in the mobile Rooms panel: "ov" (Overview) | "chat" | "map"
  let chatInitDone = false; // false until the first fetchChat() after joining/reconnecting
  let pollTimer = 0;
  let presenceTimer = 0;
  let allyLayers = { s: {}, u: {}, m: {}, r: {} }; // leaflet markers by group ("r" = ally route lines)
  let showAllyBuildings = true;
  let showAllyVehicles = true;
  let showAllyMissions = true;
  let publicRooms = null;   // open rooms for the browse list (null = not loaded yet)
  let joinRequests = [];    // host only: pending join requests for the current room
  let doneAtById = {};  // shared call id -> ms epoch it finished (so offline vehicles can be shown standing down then)
  let claimedLocal = new Set(); // mission ids already paid locally this session
  let lastUi = "";
  let roomLoaded = false;  // true once the room (ally units, finished calls) has been fetched and settled since this page loaded
  let bootAt = 0;          // when the game became ready (0 = not yet)

  const myId = () => (AU && AU.user && AU.user.id) || null;
  const myName = () => {
    try {
      if (typeof uname === "function") return uname();
    } catch (e) {}
    return (AU && AU.user && AU.user.user_metadata && AU.user.user_metadata.username) || "Controller";
  };
  const inRoom = () => !!(room && room.id && myId());

  function loadRoomLocal() {
    try {
      const j = JSON.parse(localStorage.getItem(ROOM_KEY));
      if (j && j.id && j.code) room = j;
    } catch (e) {}
  }
  function saveRoomLocal() {
    try {
      if (room) localStorage.setItem(ROOM_KEY, JSON.stringify({ id: room.id, code: room.code, name: room.name, host_id: room.host_id }));
      else localStorage.removeItem(ROOM_KEY);
    } catch (e) {}
  }

  /* ---------- REST helpers (reuse sb from cloud.js) ---------- */
  async function rest(path, o) {
    return sb("/rest/v1/" + path, Object.assign({ auth: 1 }, o || {}));
  }
  async function rpc(fn, body) {
    return sb("/rest/v1/rpc/" + fn, { method: "POST", auth: 1, body: body || {} });
  }

  /* ---------- Room lifecycle ---------- */
  async function createRoom(name, isPublic) {
    if (!myId()) throw { message: "Sign in to create a room." };
    if (inRoom()) throw { message: "You're already in a room. Leave it before joining or creating another." };
    const r = await rpc("create_room", { p_name: (name || "Room").slice(0, 40), p_public: !!isPublic });
    room = Array.isArray(r) ? r[0] : r;
    if (!room || !room.id) throw { message: "Could not create room." };
    saveRoomLocal();
    await refreshAll();
    startLoops();
    toast("Room created – code " + room.code);
    return room;
  }

  async function joinRoom(code) {
    if (!myId()) throw { message: "Sign in to join a room." };
    if (inRoom()) throw { message: "You're already in a room. Leave it before joining or creating another." };
    const c = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (c.length < 4) throw { message: "Enter a valid room code." };
    const rows = await rest("rooms?code=eq." + encodeURIComponent(c) + "&deleted_at=is.null&select=id,code,name,host_id");
    const r = rows && rows[0];
    if (!r) throw { message: "No room found with that code." };
    await rest("room_members?on_conflict=room_id,user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: { room_id: r.id, user_id: myId(), display_name: myName(), last_seen: new Date().toISOString() }
    });
    room = r;
    saveRoomLocal();
    await refreshAll();
    startLoops();
    toast("Joined room " + room.code);
    return room;
  }

  /* ---------- Open rooms: browse + request to join ---------- */
  async function loadPublicRooms() {
    if (!myId() || inRoom()) return;
    try {
      const rows = await rpc("list_open_rooms");
      publicRooms = Array.isArray(rows) ? rows : [];
    } catch (e) {
      publicRooms = publicRooms || [];
    }
    renderOpenList();
  }

  function openListHtml() {
    if (publicRooms === null) return `<div class="rm-empty"><span>Loading open rooms…</span></div>`;
    if (!publicRooms.length) return `<div class="rm-empty"><b>No open rooms right now</b><span>Create one and tick “List as open room” so others can request to join.</span></div>`;
    return `<div class="rm-card">${publicRooms.map(r => {
      const n = r.member_count || 0;
      const meta = `${n} member${n === 1 ? "" : "s"} · Host: ${esc(r.host_name || "Controller")}`;
      let btn;
      if (r.my_status === "member") btn = `<button type="button" class="rm-btn blue" data-rm-enter="${esc(r.id)}">Enter</button>`;
      else if (r.my_status === "pending") btn = `<button type="button" class="rm-btn rm-btn-off" disabled>Requested</button>`;
      else btn = `<button type="button" class="rm-btn indigo" data-rm-req="${esc(r.id)}">${r.my_status === "declined" ? "Request again" : "Request to join"}</button>`;
      return `<div class="rm-per rm-room"><span class="rm-nm"><b>${esc(r.name || "Room")}</b><small>${meta}</small></span>${btn}</div>`;
    }).join("")}</div>`;
  }

  function renderOpenList() {
    const el = document.getElementById("rm_open_list");
    if (el) el.innerHTML = openListHtml();
  }

  async function requestJoin(roomId) {
    if (!myId()) throw { message: "Sign in to request to join." };
    if (inRoom()) throw { message: "You're already in a room. Leave it before joining or creating another." };
    await rpc("request_join_room", { p_room_id: roomId, p_display_name: myName() });
    toast("Request sent to the room host");
    await loadPublicRooms();
  }

  // Used once the host has accepted a request: the caller is now a member, so the code can be read.
  async function enterRoom(roomId) {
    if (inRoom() && room.id !== roomId) throw { message: "You're already in a room. Leave it before joining or creating another." };
    const rows = await rest("rooms?id=eq." + encodeURIComponent(roomId) + "&select=id,code,name,host_id");
    const r = rows && rows[0];
    if (!r) throw { message: "Your request hasn't been accepted yet." };
    room = r;
    saveRoomLocal();
    await refreshAll();
    startLoops();
    toast("Joined room " + room.code);
  }

  async function fetchJoinRequests() {
    if (!inRoom() || room.host_id !== myId()) { joinRequests = []; return; }
    try {
      const rows = await rpc("list_join_requests", { p_room_id: room.id });
      joinRequests = Array.isArray(rows) ? rows : [];
    } catch (e) {
      joinRequests = [];
    }
  }

  async function respondRequest(requestId, accept) {
    await rpc("respond_join_request", { p_request_id: requestId, p_accept: !!accept });
    toast(accept ? "Request accepted" : "Request declined");
    await fetchJoinRequests();
    await fetchMembers();
  }

  // One delegated handler for the whole panel body, so re-rendered buttons keep working.
  async function onPanelClick(e) {
    const t = e.target.closest && e.target.closest("[data-rm-req],[data-rm-enter],[data-rm-accept],[data-rm-decline]");
    if (!t) return;
    t.disabled = true;
    try {
      if (t.hasAttribute("data-rm-req")) await requestJoin(t.getAttribute("data-rm-req"));
      else if (t.hasAttribute("data-rm-enter")) await enterRoom(t.getAttribute("data-rm-enter"));
      else if (t.hasAttribute("data-rm-accept")) await respondRequest(t.getAttribute("data-rm-accept"), true);
      else await respondRequest(t.getAttribute("data-rm-decline"), false);
    } catch (err) {
      toast((err && err.message) || "Something went wrong");
    }
    rerenderPanel();
  }

  function rerenderPanel() {
    const el = document.getElementById("room_panel_body");
    if (el) { el.innerHTML = roomPanelInner(); bindRoomPanel(); }
  }

  async function leaveRoom() {
    if (!room || !myId()) { room = null; saveRoomLocal(); stopLoops(); clearAllyMarkers(); return; }
    const rid = room.id;
    // Stop publishing FIRST: a periodic/final presence upsert landing after the delete below
    // would re-create our row and leave our station markers on everyone else's map.
    stopLoops();
    _leaving = true;
    // Leaving on purpose removes our membership and our presence row (stations included).
    try {
      await rest("room_members?room_id=eq." + rid + "&user_id=eq." + myId(), { method: "DELETE" });
    } catch (e) {}
    try {
      const gone = await rest("room_presence?room_id=eq." + rid + "&user_id=eq." + myId() + "&select=user_id", {
        method: "DELETE",
        headers: { Prefer: "return=representation" }
      });
      // If Supabase has no DELETE policy this succeeds but removes 0 rows. Readers ignore
      // non-members anyway (see fetchPresence), so this is only a warning for the console.
      if (Array.isArray(gone) && !gone.length) console.warn("room_presence delete removed 0 rows - check the DELETE policy / member_left trigger");
    } catch (e) { console.error("Presence delete failed", e); }
    _leaving = false;
    // If host leaves and no members, room can stay; host transfer is out of scope for v1
    room = null;
    members = [];
    presence = {};
    roomMissions = [];
    roomChat = [];
    chatUnread = 0;
    chatSeenAt = 0;
    chatInitDone = false;
    saveRoomLocal();
    stopLoops();
    clearAllyMarkers();
    try { paint(); } catch (e) {}
    toast("Left room");
  }

  async function rejoinIfNeeded() {
    loadRoomLocal();
    if (!myId()) return;
    if (!room) {
      // New browser / cleared storage: the room is remembered per browser, but membership lives on the
      // server, so look up the room this account is still a member of.
      try {
        const mm = await rest("room_members?user_id=eq." + myId() + "&select=room_id&order=last_seen.desc&limit=1");
        if (mm && mm[0] && mm[0].room_id) {
          const rr = await rest("rooms?id=eq." + mm[0].room_id + "&deleted_at=is.null&select=id,code,name,host_id");
          if (rr && rr[0]) { room = rr[0]; saveRoomLocal(); }
        }
      } catch (e) {}
    }
    if (!room) return;
    try {
      const rows = await rest("room_members?room_id=eq." + room.id + "&user_id=eq." + myId() + "&select=room_id");
      if (!rows || !rows.length) {
        // Not a member any more (left, kicked, or room deleted): forget the saved room.
        // Never re-add membership automatically, or a stale browser can re-join a room.
        room = null;
        saveRoomLocal();
        return;
      }
      await refreshAll();
      startLoops();
    } catch (e) {
      console.error("Room rejoin failed", e);
      room = null;
      saveRoomLocal();
    }
  }

  /* ---------- Polling ---------- */
  function startLoops() {
    stopLoops();
    if (!inRoom()) return;
    pollTimer = setInterval(() => { refreshAll().catch(() => {}); }, POLL_MS);
    startPresenceLoop();
    refreshAll().catch(() => {});
  }
  function startPresenceLoop() {
    clearInterval(presenceTimer);
    if (!inRoom()) return;
    presenceTimer = setInterval(() => { publishPresence().catch(() => {}); }, PRESENCE_MS);
    publishPresence().catch(() => {});
  }
  function stopPresenceLoop() { clearInterval(presenceTimer); presenceTimer = 0; }
  function stopLoops() {
    clearInterval(pollTimer); pollTimer = 0;
    stopPresenceLoop();
  }

  async function refreshAll() {
    if (!inRoom()) return;
    const membersP = fetchMembers();
    await Promise.all([membersP, fetchPresence(membersP), fetchMissions(), fetchChat(), fetchJoinRequests()]);
    applySharedMissions();
    syncAllyMarkers();
    tickAllyUnits();
    try { await tryClaimRewards(); } catch (e) {}
    if (gameReady()) roomLoaded = true;
    bumpRoomUi();
    maybeWarnNoAllyStations();
    try {
      if (typeof paint === "function") paint();
      if (typeof sync === "function") sync();
    } catch (e) {}
  }

  async function fetchMembers() {
    const rows = await rest("room_members?room_id=eq." + room.id + "&select=user_id,display_name,last_seen,joined_at&order=joined_at.asc");
    members = rows || [];
    // touch own last_seen
    try {
      await rest("room_members?room_id=eq." + room.id + "&user_id=eq." + myId(), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: { last_seen: new Date().toISOString(), display_name: myName() }
      });
    } catch (e) {}
  }

  /* Stations = last-known (kept while the player is a member, even if offline).
     Units (the big route data) are only downloaded when a player's row has changed since we last
     saw it, so offline players cost nothing after the first fetch.
     Only CURRENT MEMBERS are shown: someone who left (or was removed) disappears from the map even if
     their presence row could not be deleted on the server. */
  async function fetchPresence(membersP) {
    const rid = room.id;
    const rows = await rest("room_presence?room_id=eq." + rid + "&select=user_id,display_name,stations,updated_at");
    if (membersP) { try { await membersP; } catch (e) {} }
    if (!room || room.id !== rid) return; // left / switched room while loading
    const memberIds = new Set((members || []).map(m => m.user_id));
    const useMembers = memberIds.size > 0; // if the member list failed to load, don't hide everyone
    const list = (rows || []).filter(r => r.user_id !== myId() && (!useMembers || memberIds.has(r.user_id)));

    // which players' units do we need to (re)download?
    const need = list.filter(r => {
      const prev = presence[r.user_id];
      return !(prev && prev.updated_at === r.updated_at && prev._uOk);
    }).map(r => r.user_id).filter(id => /^[0-9a-f-]{36}$/i.test(String(id)));
    const fresh = {};
    if (need.length) {
      try {
        const ur = await rest("room_presence?room_id=eq." + rid + "&user_id=in.(" + need.join(",") + ")&select=user_id,units,updated_at");
        (ur || []).forEach(u => { fresh[u.user_id] = u; });
      } catch (e) { console.error("Presence units fetch failed", e); }
      if (!room || room.id !== rid) return;
    }

    const map = {};
    const unitCut = Date.now() - STALE_UNIT_MS;
    list.forEach(r => {
      const prev = presence[r.user_id];
      const f = fresh[r.user_id];
      let units, uOk;
      if (f) { units = f.units; uOk = true; }
      else if (prev && prev._uOk) { units = prev.units; uOk = true; }
      else { units = []; uOk = false; }
      let stations = r.stations;
      if (typeof stations === "string") {
        try { stations = JSON.parse(stations); } catch (e) { stations = []; }
      }
      if (typeof units === "string") {
        try { units = JSON.parse(units); } catch (e) { units = []; }
      }
      if (!Array.isArray(stations)) stations = [];
      if (!Array.isArray(units)) units = [];
      // use the newest updated_at we saw, so a units row fetched a moment later is not re-fetched forever
      const upd = (f && f.updated_at && f.updated_at > r.updated_at) ? f.updated_at : r.updated_at;
      const ts = upd ? Date.parse(upd) : 0;
      const online = ts && ts >= unitCut;
      map[r.user_id] = {
        user_id: r.user_id,
        display_name: r.display_name || "Ally",
        stations: stations,
        units: units, // keep last units payload; live layer decides online vs extrapolate
        online: !!online,
        updated_at: upd,
        _uOk: uOk
      };
    });
    presence = map;
    tickAllyUnits();
  }

  async function fetchMissions() {
    const rows = await rest(
      "room_missions?room_id=eq." + room.id +
      "&status=in.(open,working)&select=id,owner_id,owner_name,local_mid,k,la,lo,loc,cad,xb,hid,xn,status,end_at,reward,contributors,created_at&order=created_at.desc&limit=40"
    );
    roomMissions = rows || [];
  }

  /* ---------- Chat ---------- */
  const CHAT_COLS = "id,user_id,display_name,body,created_at";
  const CHAT_PAGE = 60;   // rows to pull on the first load after joining
  const CHAT_CATCHUP = 200; // cap on a single delta fetch (e.g. after the tab was backgrounded a while)
  const CHAT_KEEP = 200;  // how much history to keep in memory/DOM client-side

  async function fetchChat() {
    const lastId = roomChat.length ? roomChat[roomChat.length - 1].id : 0;
    let rows;
    if (!lastId) {
      // First load after joining/reconnecting: grab the most recent page as a baseline.
      rows = await rest(
        "room_chat?room_id=eq." + room.id +
        "&select=" + CHAT_COLS + "&order=id.desc&limit=" + CHAT_PAGE
      );
      rows = (rows || []).slice().reverse();
    } else {
      // Every poll after that: only ask for what's actually new, instead of
      // re-downloading the whole window every 4 seconds.
      rows = await rest(
        "room_chat?room_id=eq." + room.id +
        "&id=gt." + lastId + "&select=" + CHAT_COLS + "&order=id.asc&limit=" + CHAT_CATCHUP
      );
      rows = rows || [];
    }
    if (!rows.length) {
      if (!chatInitDone) chatInitDone = true;
      return; // nothing changed — cheap poll, no re-render needed
    }
    roomChat = lastId ? roomChat.concat(rows) : rows;
    if (roomChat.length > CHAT_KEEP) roomChat = roomChat.slice(roomChat.length - CHAT_KEEP);
    if (!chatInitDone) {
      // Existing history on first load counts as already seen, not unread.
      chatInitDone = true;
    } else {
      const fromOthers = rows.filter(m => m.user_id !== myId());
      if (fromOthers.length) {
        if (chatOpen) {
          chatSeenAt = Date.now();
        } else {
          chatUnread += fromOthers.length;
          if (typeof toast === "function" && fromOthers.length === 1) {
            toast((fromOthers[0].display_name || "Ally") + ": " + String(fromOthers[0].body).slice(0, 60));
          }
        }
      }
    }
    renderChat();
  }

  async function sendChat(text) {
    const body = String(text || "").trim().replace(/\s+/g, " ").slice(0, 240);
    if (!body || !inRoom()) return false;
    const row = { room_id: room.id, user_id: myId(), display_name: myName(), body };
    await rest("room_chat", { method: "POST", headers: { Prefer: "return=minimal" }, body: row });
    await fetchChat();
    bumpRoomUi();
    return true;
  }

  function renderChat() {
    const box = document.getElementById("rm_chat_list");
    if (!box) return;
    box.innerHTML = roomChat.length
      ? roomChat.map(m => {
          const mine = m.user_id === myId();
          const nm = m.display_name || "Controller";
          const t = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
          return `<div class="rm-row${mine ? " me" : ""}">
            <span class="rm-ra">${esc(nm.trim().charAt(0).toUpperCase() || "C")}</span>
            <div class="rm-rb"><div class="rm-rn"><b>${esc(nm)}</b>${mine ? '<em>you</em>' : ""}<small>${t}</small></div><div class="rm-rt">${esc(m.body)}</div></div>
          </div>`;
        }).join("")
      : `<div class="rm-empty" style="margin:16px"><b>No messages yet</b><span>Say hello.</span></div>`;
    box.scrollTop = box.scrollHeight;
  }

  /* ---------- Presence publish ---------- */

  /* Offline vehicle extrapolation: re-request the real road route from OSRM
     (same call sim.js's leg() makes for your own units) and advance along
     that polyline at the vehicle's road speed, instead of cutting a straight
     line across the map. Falls back to a straight line only if the route
     request fails or the vehicle is an air/fast asset that flies direct. */
  // Same distance-along-polyline math as sim.js's along(); kept local so
  // rooms.js doesn't reach into sim.js internals.
  function allyAlong(rt, dk) {
    const L = rt.p.length;
    if (L < 2) return rt.p[0] || [0, 0];
    const g = Math.min(1, rt.len ? dk / rt.len : 1) * rt.d[L - 1];
    let i = 1;
    while (i < L - 1 && rt.d[i] < g) i++;
    const a = rt.p[i - 1], b = rt.p[i];
    const f = Math.min(1, Math.max(0, (g - rt.d[i - 1]) / ((rt.d[i] - rt.d[i - 1]) || 1)));
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  const FINAL_BODY_MAX = 16000; // keepalive requests share a ~64KB quota with the game's own save, so keep the exit snapshot modest
  const HAND_MS = 30000;        // sim.js hands a patient over for 20-40s; use the middle when the owner's game hadn't chosen yet

  /* ---------- Offline ally estimate ----------
     A pure function of (what the ally last published, the clock). It holds NO state of
     its own, so reloading / re-logging in on this side always gives the same answer
     instead of restarting the vehicle from the last saved dot. It mirrors sim.js:
       - the current leg follows the owner's own route from the owner's own leg start
         time (position = along(route, (now - t0) * speed)), exactly like upos()
       - out -> scene (stays until the mission's end time) -> back to station -> idle
       - hosp -> hand over -> back to station -> idle
       - legs started while the owner was away are straight lines at length x1.3
         (x1 for aircraft), the same thing the owner's catch-up simulation does. */
  function straightRt(a, b, ty) {
    const k = (typeof km === "function") ? km(a, b) : 0;
    const f = (typeof SP !== "undefined" && SP[ty] >= 150) ? 1 : 1.3;
    return { p: [a, b], d: [0, +k.toFixed(3)], len: Math.max(0.001, k * f) };
  }
  /* Road route for a leg the owner never published (e.g. the trip home after a call finished while
     they were offline). Fetched exactly like the game's own legs (same OSRM request), so every
     client, and the owner on return, gets the same road path. Until it arrives (or if the lookup
     fails) the straight-line estimate is used. */
  const roadCache = {};
  function roadRt(a, b, ty) {
    try {
      if (typeof SP !== "undefined" && SP[ty] >= 150) return null; // aircraft fly straight
      if (typeof J !== "function" || typeof km !== "function") return null;
      const key = a[0] + "," + a[1] + ">" + b[0] + "," + b[1];
      const c = roadCache[key];
      if (c) return c === "x" || c === "p" ? null : c;
      if (Object.keys(roadCache).length > 300) Object.keys(roadCache).forEach(k => delete roadCache[k]);
      roadCache[key] = "p";
      const url = "https://router.project-osrm.org/route/v1/driving/" + a[1] + "," + a[0] + ";" + b[1] + "," + b[0] +
        "?overview=" + (km(a, b) > 40 ? "simplified" : "full") + "&geometries=geojson";
      J(url, 12000).then(j => {
        const q = j && j.routes && j.routes[0];
        if (!q) { roadCache[key] = "x"; return; }
        const p = q.geometry.coordinates.map(c2 => [+c2[1].toFixed(5), +c2[0].toFixed(5)]);
        if (p.length < 2) { roadCache[key] = "x"; return; }
        const d = [0];
        for (let i = 1; i < p.length; i++) d.push(+(d[i - 1] + km(p[i - 1], p[i])).toFixed(3));
        roadCache[key] = { p, d, len: d[d.length - 1] };
      }).catch(() => { roadCache[key] = "x"; });
    } catch (e) {}
    return null;
  }
  function expandRt(r) {
    if (!r || !Array.isArray(r.p) || r.p.length < 2 || !Array.isArray(r.d) || r.d.length !== r.p.length) return null;
    return { p: r.p.map(q => [+q[0], +q[1]]), d: r.d.map(Number), len: +r.len || r.d[r.d.length - 1] || 0.001 };
  }
  function estimateAllyUnit(u, stations, t) {
    const speed = Math.max(1, ((typeof SP !== "undefined" && SP[u.ty]) || 60) * (+u.sm || 1)); // km/h
    const stn = (stations || []).find(s => s && s.id === u.sid);
    const home = stn ? [+stn.lat, +stn.lon] : null;
    const base = { id: u.id, ty: u.ty, cs: u.cs, mid: u.mid, oos: !!u.oos, online: false };
    let st = u.st;
    let a = (u.a && u.a.length === 2) ? [+u.a[0], +u.a[1]] : [+u.la, +u.lo];
    let b = (u.b && u.b.length === 2) ? [+u.b[0], +u.b[1]] : (u.dla != null && u.dlo != null ? [+u.dla, +u.dlo] : null);
    if (st === "scene" || st === "hand") a = [+u.la, +u.lo]; // parked: la/lo is the scene / hospital, a is the old leg's start
    let t0 = +u.t0 || +u.ts || t;
    let rt = expandRt(u.rt);
    let handEnd = (st === "hand") ? (+u.ht || (t0 + HAND_MS)) : 0;
    const me = +u.me || 0;

    for (let guard = 0; guard < 8; guard++) {
      if (st === "out" || st === "hosp" || st === "back") {
        if (!b) return Object.assign(base, { st, la: +u.la, lo: +u.lo }); // nothing to follow: hold
        if (!rt) rt = roadRt(a, b, u.ty) || straightRt(a, b, u.ty);
        // the call finished while this vehicle was still driving there: it turns round where it was
        const dAt = u.rm && doneAtById[u.rm];
        if (st === "out" && dAt && home && dAt > t0 && dAt < t) {
          const dkd = (dAt - t0) / 3.6e6 * speed;
          if (dkd < rt.len) { a = allyAlong(rt, dkd); b = home; rt = null; st = "back"; t0 = dAt; continue; }
        }
        const dk = Math.max(0, t - t0) / 3.6e6 * speed;
        if (dk < rt.len) {
          const pos = allyAlong(rt, dk);
          return Object.assign(base, { st, la: pos[0], lo: pos[1], rt, t0, dla: b[0], dlo: b[1], etaMs: (rt.len - dk) / speed * 3.6e6 });
        }
        const tArr = t0 + rt.len / speed * 3.6e6;
        if (st === "back") return null; // home again: shown by the station marker, not as a vehicle
        a = b; rt = null;
        if (st === "out") { st = "scene"; t0 = tArr; continue; }
        st = "hand"; handEnd = tArr + HAND_MS; t0 = tArr; continue; // st === "hosp"
      }
      if (st === "hand") {
        if (t < handEnd || !home) return Object.assign(base, { st, la: a[0], lo: a[1] });
        st = "back"; t0 = handEnd; b = home; rt = null; continue;
      }
      if (st === "scene") {
        const dAt2 = u.rm && doneAtById[u.rm];
        const leaveAt = dAt2 ? Math.max(dAt2, t0) : (me ? Math.max(me, t0) : 0); // t0 here = arrival time when we walked in from "out"
        if (!leaveAt || t < leaveAt || !home) return Object.assign(base, { st, la: a[0], lo: a[1] });
        st = "back"; t0 = leaveAt; b = home; rt = null; continue;
      }
      return Object.assign(base, { st, la: +u.la, lo: +u.lo }); // anything else: hold the last known spot
    }
    return Object.assign(base, { st, la: a[0], lo: a[1] });
  }

  /* Rebuild what the map shows for every ally from the raw presence rows. Stateless:
     live units come straight from the published snapshot and the current time. */
  function tickAllyUnits() {
    const t = Date.now();
    const out = {};
    Object.keys(presence).forEach(uid => {
      const p = presence[uid];
      const m = out[uid] = {};
      (p.units || []).forEach(u => {
        if (u == null || u.id == null || u.la == null || u.lo == null) return;
        if (u.st === "idle") return;
        if (p.online) {
          // Ally is online: their own client is the source of truth.
          m[u.id] = {
            id: u.id, ty: u.ty, cs: u.cs, st: u.st, mid: u.mid, oos: !!u.oos,
            la: +u.la, lo: +u.lo,
            dla: u.dla != null ? +u.dla : null, dlo: u.dlo != null ? +u.dlo : null,
            rm: u.rm || null, sm: +u.sm || 1, sid: u.sid,
            tr: Array.isArray(u.tr) ? u.tr : [],
            online: true
          };
        } else {
          let e = null;
          try { e = estimateAllyUnit(u, p.stations, t); } catch (err) { console.error("Ally estimate", err); }
          if (e) { e.rm = u.rm || null; e.sid = u.sid; e.tr = Array.isArray(u.tr) ? u.tr : []; m[u.id] = e; }
        }
      });
    });
    allyUnitLive = out;
  }
  let allyUnitLive = {}; // user_id -> { unitId -> unit to draw }   (derived; rebuilt by tickAllyUnits)

  function snapshotStations() {
    return (S.st || []).map(s => ({
      id: s.id, name: s.name, sv: s.sv, lat: s.lat, lon: s.lon, lv: s.lv || 0,
      pv: 1 // this client also publishes parked vehicles (older clients don't)
    }));
  }
  /* Route compaction. Allies replay this polyline to place an offline vehicle, so
     keep the real vertices (and their cumulative distances) – only thin them out
     when the payload budget needs it. */
  /* Pick the K most significant vertices of a polyline (Douglas-Peucker order: always the point that
     bends the line most). Thinning a long road route by "every Nth point" cuts corners and, when the
     budget is small, turns the route into a near-straight line for allies. This keeps the real turns. */
  function pickKeep(p, K) {
    const n = p.length;
    const all = []; for (let i = 0; i < n; i++) all.push(i);
    if (K >= n) return all;
    const cl = Math.cos((+p[0][0]) * Math.PI / 180);
    const X = i => (+p[i][1]) * cl, Y = i => +p[i][0];
    const dist = (i, a, b) => {
      const ax = X(a), ay = Y(a), bx = X(b), by = Y(b), px = X(i), py = Y(i), dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
      let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    };
    const mk = (a, b) => {
      if (b - a < 2) return null;
      let bi = -1, bd = -1;
      for (let i = a + 1; i < b; i++) { const d = dist(i, a, b); if (d > bd) { bd = d; bi = i; } }
      return { a, b, i: bi, d: bd };
    };
    const keep = new Set([0, n - 1]);
    const list = []; const first = mk(0, n - 1); if (first) list.push(first);
    while (keep.size < K && list.length) {
      let mi = 0; for (let j = 1; j < list.length; j++) if (list[j].d > list[mi].d) mi = j;
      const seg = list.splice(mi, 1)[0];
      keep.add(seg.i);
      const l = mk(seg.a, seg.i), r = mk(seg.i, seg.b);
      if (l) list.push(l); if (r) list.push(r);
    }
    return Array.from(keep).sort((x, y) => x - y);
  }
  /* Route compaction. Allies replay this polyline to place an offline vehicle, so
     keep the real vertices (and their cumulative distances) – only thin them out
     when the payload budget needs it, and then keep the vertices that matter most. */
  function compactRt(rt, maxPts) {
    if (!rt || !rt.p || rt.p.length < 2 || !rt.d) return null;
    const n = rt.p.length;
    const idx = (!maxPts || n <= maxPts) ? Array.from({ length: n }, (_, i) => i) : pickKeep(rt.p, Math.max(2, maxPts));
    return {
      p: idx.map(i => [+(+rt.p[i][0]).toFixed(5), +(+rt.p[i][1]).toFixed(5)]),
      d: idx.map(i => +(+rt.d[i]).toFixed(3)),
      len: +(+rt.len).toFixed(3)
    };
  }

  /* routePts: max route vertices per moving unit (0/undefined = send them all) */
  function snapshotUnits(routePts, noIdle) {
    const sm = (typeof spd === "function") ? (spd() || 1) : 1;
    return (S.un || []).filter(u => u.st && (u.st !== "idle" || !noIdle)).map(u => {
      // Parked at base: just enough for allies' read-only station view (no position/route needed)
      if (u.st === "idle") {
        let nc = false;
        try { nc = typeof crewed === "function" ? !crewed(u) : false; } catch (e) {}
        return { id: u.id, ty: u.ty, cs: u.cs || "", st: "idle", sid: u.sid, oos: !!u.oos, nc: nc, la: null, lo: null };
      }
      let p = [0, 0];
      try { p = typeof upos === "function" ? upos(u) : (u.b || u.a || [0, 0]); } catch (e) {}
      const moving = u.st === "out" || u.st === "back" || u.st === "hosp";
      // Destination (kept for older clients)
      let dla = null, dlo = null;
      if (u.b && moving) { dla = +u.b[0]; dlo = +u.b[1]; }
      // When the mission this unit is on will finish (0 = unknown / paused)
      let me = 0, rmid = null;
      try {
        const m = u.mid && (typeof mm === "function" ? mm(u.mid) : (S.ms || []).find(x => x.id === u.mid));
        if (m && m.end && m.pz == null) me = +m.end || 0;
        if (m && m.roomId) rmid = m.roomId; // lets everyone in the room see who is on this shared call
      } catch (e) {}
      const o = {
        id: u.id, ty: u.ty, cs: u.cs || "", st: u.st, mid: u.mid || 0, sid: u.sid,
        la: +p[0] || 0, lo: +p[1] || 0, oos: !!u.oos,
        dla: dla, dlo: dlo,
        a: u.a || null, b: u.b || null,       // start / end of the current leg
        // when the current leg started (owner clock, ms). While the road route is still being
        // fetched the leg hasn't really started, so don't hand out the previous leg's start time.
        t0: (moving && !u.rt) ? Date.now() : (+u.t0 || 0),
        sm: sm,                               // owner's game-speed multiplier
        me: me,
        rm: rmid,
        tr: Array.isArray(u.tr) ? u.tr.slice() : [], // training, so allies can fill "tr:" requirements
        ts: Date.now()
      };
      if (u.st === "hand") o.ht = +u.ht || 0; // hand-over finishes at
      if (moving && u.rt) o.rt = compactRt(u.rt, routePts);
      return o;
    }).filter(u => (u.st === "idle" || (u.la && u.lo)) && (u.st === "idle" || u.rm));
  }

  let _presErrAt = 0;
  // The game's own state must be loaded (cloud save picked, offline catch-up run) before
  // we publish anything – otherwise a re-login would briefly publish an empty/stale state
  // and put every ally's view of this player back to an old position.
  const gameReady = () => (typeof gameOn !== "undefined" && gameOn) && typeof S !== "undefined" && !!S;

  async function publishPresence() {
    if (_leaving || !inRoom() || !gameReady()) return;
    const body = {
      room_id: room.id,
      user_id: myId(),
      display_name: myName(),
      stations: snapshotStations(),
      units: snapshotUnits(40),
      updated_at: new Date().toISOString()
    };
    try {
      await rest("room_presence?on_conflict=room_id,user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body
      });
    } catch (e) {
      console.error("Presence publish failed", e);
      if (Date.now() - _presErrAt > 30000) {
        _presErrAt = Date.now();
        const msg = (e && e.message) || "presence error";
        if (typeof toast === "function") toast("Room map sync failed: " + String(msg).slice(0, 80));
      }
    }
  }

  /* Final snapshot: the player is leaving (tab closed / app backgrounded / signing out).
     Send exactly where each vehicle is right now, with its full route and timing, and mark
     the row as already stale so allies switch to estimating straight away instead of
     showing a frozen vehicle for the next 45 seconds. Only the columns that change are
     sent, so the stations list is left alone. */
  let _finalAt = 0;
  async function publishFinal(opts) {
    if (_leaving || !inRoom() || !gameReady()) return;
    const ka = !!(opts && opts.keepalive);
    stopPresenceLoop(); // a periodic publish must not land after this and mark us online again
    _finalAt = Date.now();
    const stale = new Date(Date.now() - STALE_UNIT_MS - 1000).toISOString();
    let units = snapshotUnits(0);
    let body = { room_id: room.id, user_id: myId(), units, updated_at: stale };
    if (ka) { // keepalive requests are size-limited: thin the routes until it fits
      for (const pts of [160, 100, 70, 48, 32, 20, 12, 6]) {
        if (JSON.stringify(body).length <= FINAL_BODY_MAX) break;
        units = snapshotUnits(pts);
        body = { room_id: room.id, user_id: myId(), units, updated_at: stale };
      }
      if (JSON.stringify(body).length > FINAL_BODY_MAX) { // last resort: drop parked vehicles, keep the moving ones
        units = snapshotUnits(12, true);
        body = { room_id: room.id, user_id: myId(), units, updated_at: stale };
      }
    }
    const hdr = { Prefer: "resolution=merge-duplicates,return=minimal" };
    const p1 = rest("room_presence?on_conflict=room_id,user_id", { method: "POST", headers: hdr, body, keepalive: ka });
    // Member list "online" dot goes grey immediately too
    const p2 = rest("room_members?room_id=eq." + room.id + "&user_id=eq." + myId(), {
      method: "PATCH", headers: { Prefer: "return=minimal" }, keepalive: ka,
      body: { last_seen: new Date(Date.now() - STALE_MEMBER_MS - 1000).toISOString() }
    });
    try { await Promise.all([p1, p2]); } catch (e) { console.error("Final presence failed", e); }
  }

  /* ---------- Shared missions ---------- */
  async function shareMission(localMid) {
    if (!inRoom()) { toast("Join a room first to share missions."); return; }
    const m = typeof mm === "function" ? mm(localMid) : (S.ms || []).find(x => x.id === localMid);
    if (!m || !m.ans) { toast("Only answered incidents can be shared."); return; }
    if (m.roomId) { toast("This incident is already linked to the room."); return; }
    if (window.SRV && SRV.on) { await SRV.act({ type: "rmshare", mid: m.id }); try { await fetchMissions(); bumpRoomUi(); } catch (e) {} return; } // server mode: the server shares it
    const tp = T[m.k];
    if (!tp) return;
    // Avoid double-share of same local mission
    const existing = roomMissions.find(x => x.owner_id === myId() && x.local_mid === m.id && x.status !== "done" && x.status !== "cancelled");
    if (existing) { toast("Already shared."); return; }
    const row = {
      room_id: room.id,
      owner_id: myId(),
      owner_name: myName(),
      local_mid: m.id,
      k: m.k,
      la: m.la,
      lo: m.lo,
      loc: m.loc || "",
      cad: (typeof cadOf === "function" ? cadOf(m) : m.cad) || "",
      xb: m.xb || 0,
      hid: m.hid || null,
      xn: m.xn || null,
      status: "open",
      reward: roomPay(m.k, typeof rank === "function" ? rank() : 0, m.xb),
      contributors: []
    };
    const ins = await rest("room_missions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: row
    });
    const created = Array.isArray(ins) ? ins[0] : ins;
    if (created && created.id) {
      m.roomId = created.id;
      m.shared = 1;
      dirty = true;
      toast("Mission shared with room");
      await fetchMissions();
      applySharedMissions();
      bumpRoomUi();
    }
  }

  /* Inject remote shared missions into local S.ms so player can dispatch */
  function applySharedMissions() {
    if (!S || !inRoom()) return;
    if (window.SRV && SRV.on) return; // server mode: the game server adds shared calls itself
    const mine = myId();
    const liveIds = new Set();
    roomMissions.forEach(rm => {
      if (rm.owner_id === mine) {
        // link local
        const local = (S.ms || []).find(x => x.id === rm.local_mid);
        if (local) local.roomId = rm.id;
        return;
      }
      liveIds.add(rm.id);
      let m = (S.ms || []).find(x => x.roomId === rm.id);
      if (!m) {
        // Full mission shape required by drawQ / openD (qa, adr, adc, etc.)
        m = {
          id: S.nid++,
          k: rm.k,
          la: rm.la,
          lo: rm.lo,
          loc: rm.loc || "Shared incident",
          ph: "Shared",
          born: now(),
          ans: 1,
          adc: 1,
          adr: { s: rm.loc || "Shared incident", t: rm.loc || "", pc: "" },
          cad: rm.cad || "",
          xb: rm.xb || 0,
          hid: rm.hid || null,
          xn: rm.xn || null,
          qa: [],
          hw: 0,
          end: 0,
          rev: 0,
          roomId: rm.id,
          shared: 1,
          roomOwner: rm.owner_name || "Ally"
        };
        if (rm.end_at) m.end = Date.parse(rm.end_at);
        S.ms.push(m);
        dirty = true;
        log("🤝 Shared mission from " + (rm.owner_name || "ally") + ": " + (T[rm.k] ? T[rm.k][1] : "Incident"), 1, m.id);
        try { if (typeof paint === "function") paint(); if (typeof sync === "function") sync(); } catch (e) {}
      } else {
        // Ensure required fields exist (older injected missions)
        if (!Array.isArray(m.qa)) m.qa = [];
        if (m.adc == null) m.adc = 1;
        if (!m.adr) m.adr = { s: m.loc || "", t: "", pc: "" };
        if (m.ph == null || m.ph === "") m.ph = "Shared";
        if (rm.end_at) m.end = Date.parse(rm.end_at);
        if (rm.status === "working" && !m.end) m.end = now() + ((T[rm.k] && T[rm.k][4]) || 60) * 1000;
      }
    });
    // Remove shared missions that are gone / done remotely (if we have no units on them)
    S.ms = S.ms.filter(m => {
      if (!m.roomId || m.roomOwner == null && !roomMissions.some(r => r.id === m.roomId)) {
        if (m.shared && m.roomId && !liveIds.has(m.roomId) && m.roomOwner) {
          const onIt = (S.un || []).some(u => u.mid === m.id);
          if (!onIt) return false;
        }
      }
      if (m.shared && m.roomId && m.roomOwner && !liveIds.has(m.roomId)) {
        const onIt = (S.un || []).some(u => u.mid === m.id);
        if (!onIt) return false;
      }
      return true;
    });
  }

  /* Did this player send any unit to this shared call? (en route or on scene) */
  const sentUnits = m => (S.un || []).filter(u => u.mid === m.id && (u.st === "out" || u.st === "scene"));

  /* Pay on a room call follows the rank of whoever worked it: the rank this player had when
     they first sent a unit (saved in S.rcs), otherwise their current rank. */
  const rankFor = id => (S.rcs && S.rcs[id] && S.rcs[id].r != null) ? S.rcs[id].r : (typeof rank === "function" ? rank() : 0);
  const roomPay = (k, r, xb) => (typeof payOf === "function" ? payOf(k, r) : ((T[k] && T[k][5]) || 0)) + (xb || 0);

  /* Remember (in the save) that we sent units to a shared call someone else owns, so the
     reward can still be claimed after the local copy of the call is gone. */
  function markSent(m) {
    if (!m || !m.roomId || !m.roomOwner || !S) return;
    if (!sentUnits(m).length) return;
    S.rcs = S.rcs || {};
    if (!S.rcs[m.roomId]) {
      S.rcs[m.roomId] = { k: m.k, t: now(), r: typeof rank === "function" ? rank() : 0 };
      dirty = true;
    }
  }

  /* When a local shared mission completes, notify the room. `snap` was taken BEFORE the
     call was recalled (recall sends the units home), so it reflects who really was there. */
  async function onLocalSharedComplete(m, amount, snap) {
    if (!m || !m.roomId || !inRoom()) return;
    try {
      const isProxy = !!m.roomOwner;           // someone else's call that we worked on
      const selfSent = !!(snap && snap.sent);
      const selfOn = !!(snap && snap.scene);
      // Contributors already reported to the server + anyone currently shown on this call
      let list = [];
      try {
        const rows = await rest("room_missions?id=eq." + m.roomId + "&select=contributors");
        if (rows && rows[0] && Array.isArray(rows[0].contributors)) list = rows[0].contributors.slice();
      } catch (e) {}
      const add = (uid, name, on) => {
        const i = list.findIndex(c => c.user_id === uid);
        if (i >= 0) { if (on) list[i].on_scene = true; }
        else list.push({ user_id: uid, name: name, on_scene: !!on });
      };
      if (selfSent) add(myId(), myName(), selfOn);
      Object.keys(allyUnitLive).forEach(uid => {
        Object.values(allyUnitLive[uid] || {}).forEach(u => {
          if (u.rm === m.roomId && (u.st === "out" || u.st === "scene")) {
            add(uid, (presence[uid] && presence[uid].display_name) || "Ally", u.st === "scene");
          }
        });
      });
      await rest("room_missions?id=eq." + m.roomId, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: {
          status: "done",
          reward: amount,
          contributors: list,
          updated_at: new Date().toISOString()
        }
      });
      // The owner was already paid by the normal completion; an ally who worked the call
      // locally is paid here (the normal completion skips paying shared copies).
      if (selfSent) await claimReward(m.roomId, amount, m.k, isProxy);
    } catch (e) {
      console.error("Shared complete sync failed", e);
    }
  }

  /* Pay (once) the full reward of a shared room call. The unique claim row is written first,
     so a second attempt (poll, reload, other device) can never pay twice.
     pay=false only records the claim (the call's owner is paid by the normal completion). */
  async function claimReward(missionId, amount, kind, pay) {
    if (!myId() || !missionId) return false;
    if (claimedLocal.has(missionId)) return false;
    try {
      await rest("room_reward_claims", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: { mission_id: missionId, user_id: myId(), amount: amount || 0 }
      });
    } catch (e) {
      // unique violation = already claimed (here or on another device)
      if (e && e.status === 409) claimedLocal.add(missionId);
      else if (e && /duplicate|unique/i.test(String(e.message || ""))) claimedLocal.add(missionId);
      else console.error("Claim failed", e);
      return false;
    }
    claimedLocal.add(missionId);
    if (S.rcs) { delete S.rcs[missionId]; }
    if (!pay || !(amount > 0)) return true;
    const tp = T[kind];
    const nm = (tp ? tp[1] : "Incident") + " (shared room call)";
    const r0 = typeof rank === "function" ? rank() : 0;
    S.cr += amount;
    S.done++;
    S.jl = (S.jl || []).filter(x => x.t > now() - 6048e5).slice(-499);
    S.jl.push({ t: now(), k: "j", n: nm, e: amount, b: S.cr });
    log("✅ " + nm + " resolved. +£" + fmt(amount));
    toast("Room reward +£" + fmt(amount));
    try {
      if (typeof rank === "function" && rank() > r0) {
        log("🎖 Promoted to " + RK[rank()][0] + "! New vehicles unlocked. Claim your £50,000 bonus in the Ranks tab.", 1);
        toast("Promoted to " + RK[rank()][0] + " – claim your £50,000 bonus in Ranks");
      }
    } catch (e) {}
    dirty = true;
    try { persist(); } catch (e) {}
    try { paint(); } catch (e) {}
    return true;
  }

  /* Settle shared calls that finished while we were away (or between polls).
     For every shared call we still hold locally, every call we are marked as having sent units to,
     and the room's most recent finished calls, ask the server what became of it:
       done      -> stand the call down on our screen (units return to base as normal) and,
                    if we owned the call or sent units to it, pay the full reward once
       cancelled / gone -> just stand down our copy, no reward                                    */
  let _settling = false;
  async function tryClaimRewards() {
    if (window.SRV && SRV.on) return; // server mode: the game server settles and pays room rewards
    if (!inRoom() || !S || !gameReady() || _settling) return;
    _settling = true;
    try {
      // forget stale "I sent units" markers (older than a week)
      if (S.rcs) Object.keys(S.rcs).forEach(id => { if (S.rcs[id].t < now() - 6048e5) delete S.rcs[id]; });
      const ids = new Set(Object.keys(S.rcs || {}));
      (S.ms || []).forEach(m => { if (m.roomId) ids.add(m.roomId); });
      const SEL = "&select=id,k,status,reward,xb,contributors,owner_id,updated_at,local_mid,la,lo";
      const rows = new Map();
      const recent = await rest("room_missions?room_id=eq." + room.id + "&status=eq.done" + SEL + "&order=updated_at.desc&limit=20");
      (recent || []).forEach(r => { rows.set(r.id, r); const d = Date.parse(r.updated_at); if (d) doneAtById[r.id] = d; });
      /* my own shared calls that lost their link to the room row (e.g. an older save was loaded): look the
         finished ones up by owner so they can be re-linked and settled below */
      if ((S.ms || []).some(m => !m.roomId && !m.roomOwner && m.ans)) {
        const mine = await rest("room_missions?room_id=eq." + room.id + "&owner_id=eq." + myId() + "&status=in.(done,cancelled)" + SEL + "&order=updated_at.desc&limit=20");
        (mine || []).forEach(r => { rows.set(r.id, r); if (r.status === "done") { const d = Date.parse(r.updated_at); if (d) doneAtById[r.id] = d; } });
      }
      const ask = Array.from(ids).filter(id => /^[0-9a-f-]{36}$/i.test(String(id)));
      if (ask.length) {
        const got = await rest("room_missions?id=in.(" + ask.join(",") + ")" + SEL);
        if (Array.isArray(got)) {
          got.forEach(r => { rows.set(r.id, r); if (r.status === "done") { const d = Date.parse(r.updated_at); if (d) doneAtById[r.id] = d; } });
          // proxies whose room call no longer exists: stand them down, no reward
          ask.forEach(id => {
            if (rows.has(id)) return;
            const local = (S.ms || []).find(x => x.roomId === id && x.roomOwner);
            if (local && typeof recall === "function") { try { recall(local, 1); } catch (e) {} }
            if (S.rcs) delete S.rcs[id];
          });
        }
      }
      for (const rm of rows.values()) {
        const isOwner = rm.owner_id === myId();
        let local = (S.ms || []).find(x => x.roomId === rm.id);
        if (!local && isOwner && rm.local_mid != null && (rm.status === "done" || rm.status === "cancelled")) {
          // re-link my own call whose roomId was lost (same id, type and place)
          local = (S.ms || []).find(x => !x.roomId && !x.roomOwner && x.id === rm.local_mid && x.k === rm.k &&
            Math.abs((+x.la) - (+rm.la)) < 1e-5 && Math.abs((+x.lo) - (+rm.lo)) < 1e-5);
          if (local) { local.roomId = rm.id; local.shared = 1; dirty = true; }
        }
        if (rm.status === "cancelled") {
          if (local && local.roomOwner && typeof recall === "function") { try { recall(local, 1); } catch (e) {} }
          if (S.rcs) delete S.rcs[rm.id];
          continue;
        }
        if (rm.status !== "done") continue;
        // Decide eligibility BEFORE standing the call down (recall sends the units home)
        const sentNow = !!(local && sentUnits(local).length);
        const listed = (rm.contributors || []).some(c => c.user_id === myId());
        const marked = !!(S.rcs && S.rcs[rm.id]);
        // Owner: if their own copy is already gone they were paid by the normal completion.
        const eligible = isOwner ? !!local : (sentNow || listed || marked);
        if (local && typeof recall === "function") {
          // finish it on our screen as a normal completed call: units stand down and return to base
          // (the flag stops the recall hook from reporting this completion back to the room)
          local._rmDone = 1;
          // our units have been sitting there since it finished: start their way home from then,
          // so they are shown (to the room too) as returning, or already back, not leaving now
          const dAt = doneAtById[rm.id];
          if (dAt) {
            const bu = (S.un || []).filter(u => u.mid === local.id && (u.st === "scene" || u.st === "out"));
            bu.forEach(u => { u.bk0 = dAt; });
            // the route fetch consumes it within ~12s; clear any leftover so it can't skew a later trip
            setTimeout(() => bu.forEach(u => { u.bk0 = 0; }), 30000);
          }
          try { recall(local); } catch (e) {}
        }
        if (!eligible || claimedLocal.has(rm.id)) continue;
        const kk = rm.k != null ? rm.k : (S.rcs && S.rcs[rm.id] && S.rcs[rm.id].k);
        const myAmt = (kk != null && T[kk]) ? roomPay(kk, isOwner ? (typeof rank === "function" ? rank() : 0) : rankFor(rm.id), rm.xb) : (rm.reward || 0);
        await claimReward(rm.id, myAmt, kk, true);
      }
    } catch (e) {
    } finally {
      _settling = false;
    }
  }

  /* Report contribution while working on a shared mission */
  async function reportContribution(m) {
    if (!m || !m.roomId || !inRoom()) return;
    const sent = sentUnits(m);
    if (!sent.length) return;
    const onScene = sent.filter(u => u.st === "scene");
    try {
      const rows = await rest("room_missions?id=eq." + m.roomId + "&select=contributors,status");
      const rm = rows && rows[0];
      if (!rm || rm.status === "done" || rm.status === "cancelled") return;
      const list = Array.isArray(rm.contributors) ? rm.contributors.slice() : [];
      const idx = list.findIndex(c => c.user_id === myId());
      const entry = { user_id: myId(), name: myName(), on_scene: onScene.length > 0 || !!(idx >= 0 && list[idx].on_scene) };
      if (idx >= 0) list[idx] = entry; else list.push(entry);
      const body = { contributors: list, updated_at: new Date().toISOString() };
      if (rm.status === "open" && onScene.length) body.status = "working";
      await rest("room_missions?id=eq." + m.roomId, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body
      });
    } catch (e) {}
  }

  /* ---------- Map markers for allies ---------- */
  function clearAllyMarkers() {
    ["s", "u", "m", "r"].forEach(g => {
      Object.keys(allyLayers[g]).forEach(id => {
        try { map.removeLayer(allyLayers[g][id]); } catch (e) {}
      });
      allyLayers[g] = {};
    });
  }

  /* Match native map markers: class "mk", iconSize [0,0], content centered via CSS */
  function allyIcon(html) {
    if (typeof ic === "function") return ic(html);
    return L.divIcon({ className: "mk", html: html, iconSize: [0, 0] });
  }

  function syncAllyMarkers() {
    if (typeof map === "undefined" || !map) return;
    if (!inRoom()) { clearAllyMarkers(); return; }
    const seenS = {}, seenU = {}, seenM = {};
    const hideB = !showAllyBuildings;
    const hideV = !showAllyVehicles;
    const hideM = !showAllyMissions;

    // Ally stations – same .sm style as own stations, dashed ring via ally class
    if (!hideB) {
      Object.keys(presence).forEach(uid => {
        const p = presence[uid];
        (p.stations || []).forEach(s => {
          try {
            if (s == null || s.lat == null || s.lon == null) return;
            const key = uid + "_s_" + (s.id != null ? s.id : (s.lat + "_" + s.lon));
            seenS[key] = 1;
            const bg = "#6b7280"; /* allied stations are always grey */
            let inner = (s.sv || "?").toUpperCase().slice(0, 1);
            try {
              if (typeof bIco === "function") inner = bIco("s", { id: s.id, sv: s.sv, name: s.name });
            } catch (e) {}
            const offline = p.online === false;
            const ring = offline ? "#9ca3af" : "#d1d5db";
            const op = offline ? "0.75" : "0.95";
            const html = `<div class="sm ally${typeof pinOn === "function" && pinOn() ? " pin" : ""}" data-f="ally" style="background:${bg};opacity:${op};--ring:${ring};box-shadow:0 0 0 3px ${ring},0 3px 10px rgba(0,0,0,.4)">${typeof pw === "function" ? pw(inner) : inner}</div>`;
            let mk = allyLayers.s[key];
            const tip = (p.display_name || "Ally") + " · " + (s.name || "Station") + (offline ? " (offline)" : "");
            if (!mk) {
              mk = allyLayers.s[key] = L.marker([+s.lat, +s.lon], { icon: allyIcon(html), zIndexOffset: 50 }).addTo(map);
              mk.bindTooltip(tip, { direction: "top", opacity: 0.95 });
              mk.on("click", () => { try { openAllyStations(uid, s.id); } catch (e) { console.error(e); } });
            } else {
              mk.setLatLng([+s.lat, +s.lon]);
              if (mk._h !== html) { mk._h = html; mk.setIcon(allyIcon(html)); mk.bindTooltip(tip, { direction: "top", opacity: 0.95 }); }
            }
            mk._h = html;
          } catch (e) { console.error("Ally station marker", e); }
        });
      });
    }
    Object.keys(allyLayers.s).forEach(k => {
      if (!seenS[k]) { try { map.removeLayer(allyLayers.s[k]); } catch (e) {} delete allyLayers.s[k]; }
    });

    // Ally vehicles – live positions (online) or road-estimated (offline)
    const seenR = {};
    if (!hideV) {
      const showRoutes = typeof getSet === "function" ? getSet().routeLines !== false : true;
      Object.keys(presence).forEach(uid => {
        const p = presence[uid];
        const list = Object.values(allyUnitLive[uid] || {});
        list.forEach(u => { try {
          if (u.la == null || u.lo == null) return;
          if (u.st === "idle" || u.st === "scene") return; // on scene: they're at the incident pin, no separate vehicle marker
          if (!u.rm) return; // only ally vehicles on a shared room mission
          const key = uid + "_u_" + u.id;
          seenU[key] = 1;
          // Grey line showing the road route an offline ally's vehicle is estimated to be following
          if (showRoutes && u.online === false && u.rt && u.rt.p && u.rt.p.length > 1) {
            const rkey = uid + "_r_" + u.id;
            seenR[rkey] = 1;
            let rl = allyLayers.r[rkey];
            if (!rl || rl._k !== u.t0) {
              if (rl) { try { map.removeLayer(rl); } catch (e) {} }
              rl = allyLayers.r[rkey] = L.polyline(u.rt.p, { color: "#94a3b8", weight: 3, opacity: 0.5, dashArray: "6,6", interactive: false }).addTo(map);
              rl._k = u.t0;
            }
          }
          const svc = (typeof U !== "undefined" && U[u.ty] && U[u.ty][0]) ? U[u.ty][0] : null;
          const col = (svc && typeof SC !== "undefined" && SC[svc]) ? SC[svc] : "#6366f1";
          const label = esc((u.cs || u.ty || "?").slice(0, 8));
          const atScene = u.st === "scene" || u.st === "hand";
          const offline = u.online === false;
          const border = offline ? "#94a3b8" : "#a5b4fc";
          const html = `<div class="vi ally${atScene ? " sc" : ""}" data-f="allyv" style="background:${col};border-color:${border};opacity:${offline ? 0.8 : 1};box-shadow:0 0 0 2px ${border},0 2px 8px rgba(0,0,0,.45)">${label}</div>`;
          let mk = allyLayers.u[key];
          const tip = (p.display_name || "Ally") + " · " + (u.cs || u.ty) + (u.st ? " (" + u.st + ")" : "") + (offline ? " · estimated" : "");
          if (!mk) {
            mk = allyLayers.u[key] = L.marker([u.la, u.lo], { icon: allyIcon(html), zIndexOffset: 220 }).addTo(map);
            mk.bindTooltip(tip, { direction: "top", opacity: 0.95 });
          } else {
            mk.setLatLng([u.la, u.lo]);
            if (mk._h !== html) { mk._h = html; mk.setIcon(allyIcon(html)); mk.bindTooltip(tip, { direction: "top", opacity: 0.95 }); }
          }
          mk._h = html;
        } catch (e) { console.error("Ally vehicle marker", e); } });
      });
    }
    Object.keys(allyLayers.u).forEach(k => {
      if (!seenU[k]) { try { map.removeLayer(allyLayers.u[k]); } catch (e) {} delete allyLayers.u[k]; }
    });
    Object.keys(allyLayers.r).forEach(k => {
      if (!seenR[k]) { try { map.removeLayer(allyLayers.r[k]); } catch (e) {} delete allyLayers.r[k]; }
    });

    // Shared mission pins – same .im grade circle style as own incidents
    if (!hideM) {
      roomMissions.forEach(rm => { try {
        if (rm.owner_id === myId()) return;
        const key = "rm_" + rm.id;
        seenM[key] = 1;
        const g = (typeof gr === "function") ? gr(rm.k) : 2;
        const gc = (typeof GC !== "undefined" && GC[g]) ? GC[g] : "#4f46e5";
        const svc = (typeof T !== "undefined" && T[rm.k]) ? T[rm.k][0] : "p";
        const border = (typeof SC !== "undefined" && SC[svc]) ? SC[svc] : "#a5b4fc";
        const html = `<div class="cw"><div class="im ally" data-f="allym" style="background:${gc};border-color:${border};color:${g === 3 ? "#000" : "#fff"};box-shadow:0 0 0 3px rgba(99,102,241,.45),0 3px 10px rgba(0,0,0,.45)">${g}</div></div>`;
        let mk = allyLayers.m[key];
        const title = ((typeof T !== "undefined" && T[rm.k]) ? T[rm.k][1] : "Shared") + " · " + (rm.owner_name || "Ally");
        if (!mk) {
          mk = allyLayers.m[key] = L.marker([rm.la, rm.lo], { icon: allyIcon(html), zIndexOffset: 320 }).addTo(map);
          mk.bindTooltip(title, { direction: "top", opacity: 0.95 });
          mk.on("click", () => {
            try {
              applySharedMissions();
              const local = (S.ms || []).find(x => x.roomId === rm.id);
              if (local && typeof openQ === "function") {
                openQ(local.id);
              } else if (typeof toast === "function") {
                toast(title + " – open it from the Calls list");
              }
            } catch (e) {
              console.error(e);
              if (typeof toast === "function") toast("Could not open shared mission");
            }
          });
        } else {
          mk.setLatLng([rm.la, rm.lo]);
          if (mk._h !== html) { mk._h = html; mk.setIcon(allyIcon(html)); }
        }
        mk._h = html;
      } catch (e) { console.error("Ally mission marker", e); } });
    }
    Object.keys(allyLayers.m).forEach(k => {
      if (!seenM[k]) { try { map.removeLayer(allyLayers.m[k]); } catch (e) {} delete allyLayers.m[k]; }
    });
  }

  /* ---------- UI ---------- */
  function bumpRoomUi() {
    try { refreshAllyPanel(); } catch (e) {}
    const el = document.getElementById("room_panel_body");
    if (el) {
      // A background poll can land mid-keystroke — keep whatever the player
      // has half-typed into the chat box instead of wiping it out.
      const ci0 = document.getElementById("rm_chat_in");
      const draft = ci0 ? ci0.value : "";
      const hadFocus = !!ci0 && document.activeElement === ci0;
      const sl0 = el.querySelector(".rmg-l");
      const st0 = sl0 ? sl0.scrollTop : 0;
      el.innerHTML = roomPanelInner();
      bindRoomPanel();
      const sl1 = el.querySelector(".rmg-l");
      if (sl1 && st0) sl1.scrollTop = st0; // a background poll shouldn't throw the player back to the top
      if (draft) {
        const ci1 = document.getElementById("rm_chat_in");
        if (ci1) {
          ci1.value = draft;
          if (hadFocus) { ci1.focus(); try { ci1.setSelectionRange(draft.length, draft.length); } catch (e) {} }
        }
      }
    }
    // Rooms buttons (bottom nav on mobile, header on desktop): highlight when in a room, show unread chat count
    ["nav_rm", "hd_rm"].forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      b.classList.toggle("in", inRoom());
      const n = b.querySelector(".rmn");
      if (n) { n.hidden = !(inRoom() && chatUnread > 0 && !chatOpen); n.textContent = chatUnread > 99 ? "99+" : chatUnread; }
    });
    const badge = document.getElementById("room_badge");
    if (badge) {
      badge.style.display = inRoom() ? "inline-flex" : "none";
      badge.textContent = inRoom() ? ("ROOM " + room.code + (chatUnread ? " · 💬" + chatUnread : "")) : "";
    }
  }

  /* Wide two-column layout (desktop) only applies once the player is in a room */
  function syncRoomPanelMode() {
    const ov = document.getElementById("room_ov");
    if (ov) ov.classList.toggle("rm-in", !!(AU && inRoom()));
  }

  function roomPanelInner() {
    syncRoomPanelMode();
    if (!AU) {
      return `<div class="mu" style="padding:12px">Sign in to use Rooms. Cloud account required.</div>`;
    }
    if (!inRoom()) {
      return `<div style="padding:12px 4px">
        <div style="font-size:13px;opacity:.85;margin-bottom:12px;line-height:1.45">Create a room and share the code so friends can join. You'll see each other's stations and vehicles on the map, and can share missions to work together. Everyone who has a unit on scene when a shared mission completes gets <b>100% of the reward</b>.</div>
        <label style="font:600 12px system-ui;opacity:.7">Room name</label>
        <input id="rm_name" maxlength="40" placeholder="My control room" style="width:100%;margin:4px 0 8px;padding:10px;border-radius:8px;border:1px solid var(--bd);background:var(--card);color:var(--tx);font:600 14px system-ui;box-sizing:border-box">
        <button id="rm_create" class="s" style="width:100%;padding:11px;background:#4f46e5">Create room</button>
        <div class="rm-hd" style="margin:20px 0 8px"><span>OPEN ROOMS</span><span><button type="button" id="rm_refresh_open" class="rm-link">Refresh</button></span></div>
        <div id="rm_open_list">${openListHtml()}</div>
        <div style="margin:16px 0 8px;text-align:center;opacity:.5;font:600 12px system-ui">or join with a code</div>
        <input id="rm_code" maxlength="8" placeholder="CODE" style="width:100%;margin:4px 0 10px;padding:10px;border-radius:8px;border:1px solid var(--bd);background:var(--card);color:var(--tx);font:700 16px system-ui;letter-spacing:.12em;text-transform:uppercase;text-align:center;box-sizing:border-box">
        <button id="rm_join" class="s" style="width:100%;padding:11px">Join room</button>
      </div>`;
    }
    const online = members.filter(m => {
      const t = m.last_seen ? Date.parse(m.last_seen) : 0;
      return t > Date.now() - STALE_MEMBER_MS;
    });
    const memH = members.map(m => {
      const on = m.last_seen && Date.parse(m.last_seen) > Date.now() - STALE_MEMBER_MS;
      const host = room.host_id === m.user_id;
      const nm = m.display_name || "Controller";
      return `<div class="rm-per">
        <span class="rm-av${on ? " on" : ""}">${esc(nm.trim().charAt(0).toUpperCase() || "C")}<i></i></span>
        <span class="rm-nm">${esc(nm)}${host ? ' <b class="rm-tag h">HOST</b>' : ""}${m.user_id === myId() ? ' <b class="rm-tag">YOU</b>' : ""}</span>
        <span class="rm-ps${on ? " on" : ""}">${on ? "Online" : "Offline"}</span>
      </div>`;
    }).join("");
    const smH = roomMissions.length
      ? roomMissions.map(rm => {
          const tp = T[rm.k];
          const title = tp ? tp[1] : "Incident";
          return `<div class="rm-mis">
            <div class="rm-mis-t">${esc(title)}</div>
            <div class="rm-mis-d">${esc(rm.owner_name || "Ally")} · ${esc(rm.loc || "")} · £${fmt(rm.k != null && T[rm.k] ? roomPay(rm.k, rm.owner_id === myId() ? (typeof rank === "function" ? rank() : 0) : rankFor(rm.id), rm.xb) : (rm.reward || 0))}</div>
            <button type="button" class="rm-btn blue" data-rm-disp="${esc(String(rm.id))}">${typeof lci === "function" ? lci("phone", 16) : ""} Dispatch units</button>
          </div>`;
        }).join("")
      : `<div class="rm-empty"><b>No shared missions yet</b><span>Open an incident and tap Share to room. Everyone in the room can then dispatch units to it from the Calls panel.</span></div>`;

    const reqH = room.host_id !== myId() ? "" : joinRequests.length
      ? `<div class="rm-hd"><span>JOIN REQUESTS</span><span>${joinRequests.length} pending</span></div>
         <div class="rm-card">${joinRequests.map(q => `<div class="rm-per rm-req">
           <span class="rm-av">${esc((q.display_name || "C").trim().charAt(0).toUpperCase() || "C")}</span>
           <span class="rm-nm">${esc(q.display_name || "Controller")}</span>
           <span class="rm-req-b"><button type="button" class="rm-btn indigo" data-rm-accept="${esc(q.id)}">Accept</button><button type="button" class="rm-btn rm-btn-dim" data-rm-decline="${esc(q.id)}">Decline</button></span>
         </div>`).join("")}</div>`
      : "";
    const ICO = d => `<svg class="li" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const I_LEAVE = '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>';
    const I_COPY = '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>';
    const I_SPARK = '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>';
    const mkTab = (id, label) => `<button type="button" role="tab" data-rm-tab="${id}" aria-selected="${rmTab === id}">${label}</button>`;
    const sw = (id, label, on) => `<label class="rm-sw" for="${id}"><span>${label}</span><input type="checkbox" id="${id}" ${on ? "checked" : ""}></label>`;
    return `<div class="rmg rm-t-${rmTab}">
      <div class="rm-tabs" role="tablist">${mkTab("ov", "Overview")}${mkTab("chat", "Chat")}${mkTab("map", "Map")}</div>
      <div class="rmg-l">
        <section class="rm-sec" data-sec="ov">
          <div class="rm-wel">
            <span class="rm-wel-i">${ICO(I_SPARK)}</span>
            <div><b>Welcome to the room</b><span>Work together, share missions, earn more!</span></div>
          </div>
          <div class="rm-code">
            <div>
              <small>${esc(room.name || "Room")}</small>
              <div class="rm-cd">${esc(room.code)}</div>
            </div>
            <button type="button" id="rm_copy" class="rm-btn indigo">${ICO(I_COPY)} Copy code</button>
          </div>
          ${reqH}
          <div class="rm-hd"><span>PEOPLE</span><span><i class="rm-dot"></i>${online.length} online · ${members.length} member${members.length === 1 ? "" : "s"}</span></div>
          <div class="rm-card">${memH}</div>
          <div class="rm-hd"><span>SHARED MISSIONS</span><span>${roomMissions.length} shared</span></div>
          ${smH}
          ${room.host_id === myId() ? '<button type="button" id="rm_delete" class="rm-btn red wide">Delete room</button>' : ""}
          <button type="button" id="rm_calls" class="rm-btn blue wide">${typeof lci === "function" ? lci("phone", 18) : ""} Open Calls panel</button>
        </section>
        <section class="rm-sec" data-sec="map">
          <div class="rm-hd"><span>MAP OVERLAYS</span></div>
          <div class="rm-card">
            ${sw("rm_fb", "Ally stations", showAllyBuildings)}
            ${sw("rm_fv", "Ally vehicles", showAllyVehicles)}
            ${sw("rm_fm", "Shared mission pins", showAllyMissions)}
          </div>
        </section>
      </div><div class="rmg-r">
        <div class="rm-hd rm-hd-chat"><span>ROOM CHAT</span></div>
        <div id="rm_chat_list" class="rm-chatlist"></div>
        <div class="rm-comp">
          <input id="rm_chat_in" maxlength="240" placeholder="Message the room…" aria-label="Message the room" enterkeyhint="send">
          <button type="button" id="rm_chat_send">Send</button>
        </div>
      </div><div class="rmg-f">
        <button type="button" id="rm_leave" class="rm-btn red wide">${ICO(I_LEAVE)} Leave room</button>
      </div>
    </div>`;
  }

  function closeRoomPanel() {
    const ov = document.getElementById("room_ov");
    if (ov) ov.remove();
    chatOpen = false;
  }

  /* Wires up every control inside the Rooms panel. This is called both when
     the panel is first built and after any later innerHTML replace (poll
     refresh, create/join/leave), since replacing innerHTML drops listeners —
     previously only the very first render was bound, so buttons and the
     chat box would go dead after the next 4s poll. */
  function bindRoomPanel() {
    const pb = document.getElementById("room_panel_body");
    if (pb) pb.onclick = onPanelClick;
    const rf = document.getElementById("rm_refresh_open");
    if (rf) rf.onclick = () => { publicRooms = null; renderOpenList(); loadPublicRooms(); };
    if (!inRoom() && AU) loadPublicRooms();
    const x = document.getElementById("rm_x");
    if (x) x.onclick = closeRoomPanel;
    const cr = document.getElementById("rm_create");
    if (cr) cr.onclick = async () => {
      cr.disabled = true;
      try {
        const n = (document.getElementById("rm_name") || {}).value || "Room";
        await createRoom(n);
        const el = document.getElementById("room_panel_body");
        if (el) el.innerHTML = roomPanelInner();
        bindRoomPanel();
      } catch (e) {
        toast((e && e.message) || "Could not create room");
        cr.disabled = false;
      }
    };
    const jn = document.getElementById("rm_join");
    if (jn) jn.onclick = async () => {
      jn.disabled = true;
      try {
        const c = (document.getElementById("rm_code") || {}).value || "";
        await joinRoom(c);
        const el = document.getElementById("room_panel_body");
        if (el) el.innerHTML = roomPanelInner();
        bindRoomPanel();
      } catch (e) {
        toast((e && e.message) || "Could not join");
        jn.disabled = false;
      }
    };
    const doLeave = async () => {
      if (!confirm("Leave this room?")) return;
      await leaveRoom();
      rmTab = "ov";
      const el = document.getElementById("room_panel_body");
      if (el) el.innerHTML = roomPanelInner();
      bindRoomPanel();
    };
    const dl = document.getElementById("rm_delete");
    if (dl) dl.onclick = async () => {
      if (!confirm("Delete this room for everyone? Members will be removed. Rewards already earned are kept.")) return;
      dl.disabled = true;
      try {
        await rpc("delete_room", { p_room_id: room.id });
        await leaveRoom();
        toast("Room deleted");
      } catch (e) {
        toast((e && e.message) || "Could not delete room");
        dl.disabled = false;
        return;
      }
      rmTab = "ov";
      rerenderPanel();
    };
    const lv = document.getElementById("rm_leave");
    if (lv) lv.onclick = doLeave;
    const hl = document.getElementById("rm_hd_leave");
    if (hl) hl.onclick = doLeave;

    // Tabs (Overview / Chat / Map) – mobile layout; switching only toggles classes, no re-render
    document.querySelectorAll("#room_ov [data-rm-tab]").forEach(b => {
      b.onclick = () => {
        rmTab = b.dataset.rmTab;
        const g = document.querySelector("#room_ov .rmg");
        if (g) g.className = "rmg rm-t-" + rmTab;
        document.querySelectorAll("#room_ov [data-rm-tab]").forEach(x => x.setAttribute("aria-selected", String(x === b)));
        if (rmTab === "chat") {
          chatUnread = 0; chatSeenAt = Date.now();
          renderChat();
        }
      };
    });

    // Shared missions -> Calls panel
    const toCalls = id => {
      closeRoomPanel();
      try { if (typeof desk === "function" ? !desk() : true) setTab("c"); } catch (e) {}
      if (id != null) {
        const m = (S.ms || []).find(x => String(x.roomId) === String(id));
        if (m) { try { openD(m.id); } catch (e) {} }
      }
    };
    const cc = document.getElementById("rm_calls");
    if (cc) cc.onclick = () => toCalls(null);
    document.querySelectorAll("#room_ov [data-rm-disp]").forEach(b => {
      b.onclick = () => toCalls(b.dataset.rmDisp);
    });
    const cp = document.getElementById("rm_copy");
    if (cp) cp.onclick = () => {
      if (!room) return;
      const t = room.code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(() => toast("Code copied")).catch(() => prompt("Copy code:", t));
      } else prompt("Copy code:", t);
    };
    const fb = document.getElementById("rm_fb");
    if (fb) fb.onchange = () => { showAllyBuildings = fb.checked; syncAllyMarkers(); };
    const fv = document.getElementById("rm_fv");
    if (fv) fv.onchange = () => { showAllyVehicles = fv.checked; syncAllyMarkers(); };
    const fm = document.getElementById("rm_fm");
    if (fm) fm.onchange = () => { showAllyMissions = fm.checked; syncAllyMarkers(); };

    const ci = document.getElementById("rm_chat_in");
    const cs = document.getElementById("rm_chat_send");
    const doSend = async () => {
      if (!ci) return;
      const v = ci.value;
      if (!v.trim()) return;
      ci.value = ""; // clear right away so the re-render sendChat triggers doesn't restore stale text
      ci.disabled = true; if (cs) cs.disabled = true;
      try {
        await sendChat(v);
      } catch (e) {
        toast((e && e.message) || "Could not send message");
        const back = document.getElementById("rm_chat_in"); // sendChat re-renders the panel
        if (back) back.value = v; // don't lose what they typed if the send failed
      } finally {
        const ci3 = document.getElementById("rm_chat_in");
        if (ci3) { ci3.disabled = false; ci3.focus(); }
        const cs3 = document.getElementById("rm_chat_send");
        if (cs3) cs3.disabled = false;
      }
    };
    if (cs) cs.onclick = doSend;
    if (ci) ci.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); doSend(); } };
    renderChat();
  }

  /* ---------- Ally stations (read-only) ----------
     Built purely from what the ally published: stations + every vehicle (parked ones included).
     Live status for an online ally; for an offline one the same road-route estimate the map uses
     (a vehicle that has estimated its way home shows as Available). No controls, view only. */
  let allyPanel = null; // { uid, sid }  (the ally station currently shown in the sheet)
  function agoTxt(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    const h = Math.floor(m / 60);
    return h < 24 ? h + " h ago" : Math.floor(h / 24) + " d ago";
  }
  function allyVehicleRows(uid) {
    const p = presence[uid];
    if (!p) return [];
    const live = allyUnitLive[uid] || {};
    const rows = [];
    (p.units || []).forEach(u => {
      if (!u || u.id == null || !U[u.ty]) return;
      if (u.st !== "idle" && !u.rm) return; // hide ally vehicles not on a shared room mission
      let st = "idle", label = "", cls = "idle", mins = 0;
      if (u.st === "idle") {
        label = u.oos ? "Out of service" : u.nc ? "Needs crew" : ((typeof SL !== "undefined" && SL.idle) || "Available");
        cls = u.oos ? "oos" : "idle";
      } else {
        const l = live[u.id];
        if (!l) { label = (typeof SL !== "undefined" && SL.idle) || "Available"; cls = "idle"; } // estimated back at base
        else {
          st = l.st; cls = l.st; label = (typeof SL !== "undefined" && SL[l.st]) || l.st;
          if (l.st === "out") { try { mins = etaMins(l); } catch (e) {} }
        }
      }
      rows.push({ id: u.id, ty: u.ty, cs: u.cs || "", sid: u.sid, st, cls, label, mins, est: p.online === false && u.st !== "idle" });
    });
    return rows;
  }
  /* Opens in the game's own bottom sheet (#modal/#sheet), laid out like your own station sheet, but
     view only: no rename / move / delete / buy / upgrade controls. */
  const allySheetKey = () => allyPanel ? "ally:" + allyPanel.uid + ":" + allyPanel.sid : "";
  function drawAllySheet() {
    const sh = document.getElementById("sheet");
    const ap = allyPanel;
    const p = ap && presence[ap.uid];
    const st = p && (p.stations || []).find(x => x && x.id === ap.sid);
    if (!sh || !st) { if (typeof closeM === "function") closeM(); allyPanel = null; return; }
    const rows = allyVehicleRows(ap.uid).filter(r => r.sid === st.id);
    const availL = (typeof SL !== "undefined" && SL.idle) || "Available";
    const avail = rows.filter(r => r.cls === "idle" && r.label === availL).length;
    const dep = rows.filter(r => r.cls !== "idle" && r.cls !== "oos").length;
    const oo = rows.filter(r => r.cls === "oos").length;
    const nc = rows.filter(r => r.label === "Needs crew").length;
    const fresh = p.updated_at ? agoTxt(Date.now() - Date.parse(p.updated_at)) : "";
    const col = "#6b7280"; /* allied stations are always grey */
    let badge = `<span style="width:30px;height:30px;border-radius:50%;background:${col};flex:none"></span>`;
    try { if (typeof bIco === "function") badge = `<span class="sm" style="position:static;filter:grayscale(1);background:${col};width:30px;height:30px;flex:none;display:inline-flex;align-items:center;justify-content:center">${bIco("s", { id: st.id, sv: st.sv, name: st.name })}</span>`; } catch (e) {}
    const sr = (a, b2) => `<div class="sr"><span>${a}</span><b>${b2}</b></div>`;
    const top = sh.scrollTop;
    sh.dataset.k = allySheetKey();
    sh.dataset.qk = "";
    sh.innerHTML = `<div class="ph2"><div class="pt">${badge}<span class="pn">${esc(st.name || "Station")}</span></div></div>
      <div class="mu" style="margin:0 0 6px">${esc(p.display_name || "Ally")}'s ${esc((typeof SN !== "undefined" && SN[st.sv]) || "station")} · view only · ${p.online
        ? '<span style="color:#22c55e">● Live</span>'
        : '<span style="color:#94a3b8">● Offline, updated ' + esc(fresh) + " (positions estimated)</span>"}</div>
      <div class="stt">${sr("Owner", esc(p.display_name || "Ally"))}${sr("Level", (+st.lv || 0) + 1)}${st.pv ? sr("Vehicles", rows.length) + sr("Available / deployed", avail + " / " + dep) : sr("Deployed", dep)}${oo ? sr("Out of service", oo) : ""}${nc ? sr("Needs crew", nc) : ""}</div>
      ${st.pv ? "" : `<div class="mu" style="margin:8px 0;padding:8px 10px;border:1px solid var(--bd);border-radius:8px">This player hasn't updated yet, so only vehicles currently deployed are shown. Parked vehicles will appear once they load the latest version.</div>`}
      <div class="vl">${st.pv ? "Vehicles" : "Deployed vehicles"}</div>${rows.length
        ? rows.map(r => `<div class="u"><span><b>${esc(r.cs || "?")}</b> ${esc(U[r.ty][1])}</span><span class="st ${esc(r.cls)}">${esc(r.label)}${r.mins ? " · ~" + r.mins + " min" : ""}</span></div>`).join("")
        : '<div class="mu">' + (st.pv ? "No vehicles at this station." : "No vehicles deployed right now.") + '</div>'}`;
    sh.scrollTop = top;
  }
  function refreshAllyPanel() {
    if (!allyPanel) return;
    const sh = document.getElementById("sheet"), md = document.getElementById("modal");
    // Stop if the sheet was closed, or the game has put something else in it
    if (!sh || !md || md.hidden || sh.dataset.k !== allySheetKey()) { allyPanel = null; return; }
    drawAllySheet();
  }
  function openAllyStations(uid, sid) {
    if (!presence[uid]) { if (typeof toast === "function") toast("No station data from this player yet."); return; }
    if (typeof closeM === "function") { try { closeM(); } catch (e) {} }
    allyPanel = { uid: uid, sid: sid };
    const md = document.getElementById("modal");
    if (!md) return;
    md.hidden = false;
    const sh = document.getElementById("sheet");
    if (sh) sh.scrollTop = 0;
    drawAllySheet();
  }

  function openRooms() {
    let ov = document.getElementById("room_ov");
    if (ov) ov.remove();
    ov = document.createElement("div");
    ov.id = "room_ov";
    ov.style.cssText = "position:fixed;inset:0;z-index:100050;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px";
    ov.innerHTML = `<div class="rm-pn" style="width:100%;max-width:400px;max-height:calc(100dvh - 32px);display:flex;flex-direction:column;background:var(--card,#0b1220);color:var(--tx,#eef1f8);border:1px solid var(--bd,#1e293b);border-radius:14px;overflow:hidden">
      <div class="rm-hdr">
        <div class="rm-ttl">${typeof lci === "function" ? lci("user-group") : ""} Rooms</div>
        <div class="rm-hbtns">
          <button type="button" id="rm_hd_leave" class="rm-hl" aria-label="Leave room"><svg class="li" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>Leave</button>
          <button id="rm_x" class="cx" aria-label="Close">${typeof lci === "function" ? lci("x", 18) : "×"}</button>
        </div>
      </div>
      <div id="room_panel_body" style="flex:1;min-height:0;overflow-y:auto;padding:0 14px 8px">${roomPanelInner()}</div>
    </div>`;
    document.body.appendChild(ov);
    syncRoomPanelMode();
    chatOpen = true;
    chatUnread = 0;
    chatSeenAt = Date.now();
    bindRoomPanel();
    ov.addEventListener("click", e => { if (e.target === ov) closeRoomPanel(); });
    bumpRoomUi(); // clears the unread count on the Rooms buttons
  }

  /* Badge in header */
  function ensureBadge() {
    if (document.getElementById("room_badge")) return;
    const cr = document.querySelector("header .cr") || document.querySelector("header");
    if (!cr) return;
    const b = document.createElement("span");
    b.id = "room_badge";
    b.style.cssText = "display:none;align-items:center;margin-left:8px;padding:2px 8px;border-radius:4px;background:#312e81;color:#c7d2fe;font:700 10px system-ui;letter-spacing:.06em;cursor:pointer";
    b.title = "Open Rooms";
    b.onclick = openRooms;
    cr.appendChild(b);
  }

  /* Hook mission complete from sim */
  const _origRecall = typeof recall === "function" ? null : null;
  // We patch via wrapper after load – see installHooks


  let _allyWarnAt = 0;
  function maybeWarnNoAllyStations() {
    if (!inRoom() || !members || members.length < 2) return;
    const others = members.filter(m => m.user_id !== myId());
    if (!others.length) return;
    let n = 0;
    Object.keys(presence).forEach(uid => { n += ((presence[uid].stations) || []).length; });
    if (n > 0) return;
    if (Date.now() - _allyWarnAt < 60000) return;
    _allyWarnAt = Date.now();
    if (typeof toast === "function") {
      toast("No ally stations yet – other player needs to open the game in this room once (stations stay visible after they go offline)");
    }
  }

  function installHooks() {
    // Wrap mission completion path: when credits are awarded in tick for a shared mission
    // Easiest reliable hook: monkey-patch after sim defines recall and the complete block uses S.cr+=
    // Instead, poll contribution each presence tick for missions we're on scene for
    const prevPub = publishPresence;
    // contribution report inside presence cycle
    const oldStart = startLoops;
  }

  // Periodic contribution + local complete detection
  let _repAt = 0;
  setInterval(() => {
    if (!inRoom() || !S || (window.SRV && SRV.on)) return; // server mode: the game server reports who is working which call
    const doReport = Date.now() - _repAt >= 5000;
    if (doReport) _repAt = Date.now();
    (S.ms || []).forEach(m => {
      if (!m.roomId) return;
      markSent(m);
      if (doReport && sentUnits(m).length) reportContribution(m).catch(() => {});
    });
  }, 2000);

  // Hook into local reward: intercept after S.cr increases on shared mission by wrapping in tick is hard;
  // Use a Mutation on S.ms removal — patch recall
  function patchRecall() {
    if (window.SRV && SRV.on) return; // server mode: the server reports finished calls
    if (typeof recall !== "function" || recall._roomPatched) return;
    const orig = recall;
    window.recall = function (m, ab) {
      if (m && m.roomId && !ab && !m._rmDone) {
        const tp = T[m.k];
        const amount = (tp ? roomPay(m.k, m.roomOwner ? rankFor(m.roomId) : (typeof rank === "function" ? rank() : 0), m.xb) : 0) + (m.roomOwner ? 0 : (S.hbp || 0));
        // snapshot who was on the call NOW: recall() sends the units home straight away
        const sent = sentUnits(m);
        const snap = { sent: sent.length > 0 || !!(S.rcs && S.rcs[m.roomId]), scene: sent.some(u => u.st === "scene") };
        setTimeout(() => onLocalSharedComplete(m, amount, snap).catch(() => {}), 0);
      }
      return orig.apply(this, arguments);
    };
    window.recall._roomPatched = true;
  }

  // Share button injected into dispatch sheet when possible
  function shareBtnHtml(m) {
    if (!m || !inRoom() || !m.ans) return "";
    if (m.roomId) return `<span class="mu" style="font-size:12px;color:#a5b4fc">${typeof lci === "function" ? lci("users", 14) : ""} Shared with room</span>`;
    if (m.shared && m.roomOwner) return `<span class="mu" style="font-size:12px;color:#a5b4fc">From ${esc(m.roomOwner)}</span>`;
    return `<button class="s" style="padding:6px 10px;background:#4f46e5;font-size:12px" onclick="event.stopPropagation();window.Rooms.share(${m.id})">${typeof lci === "function" ? lci("users", 14) : ""} Share to room</button>`;
  }

  /* Room (ally) vehicles on a shared call that are responding or on scene.
     sim.js counts these towards the call's requirements, and the call details panel lists them. */
  function etaMins(u) {
    let eta = u.etaMs;
    if (eta == null && u.dla != null && u.dlo != null && typeof km === "function" && typeof SP !== "undefined") {
      const f = SP[u.ty] >= 150 ? 1 : 1.3;
      eta = km([u.la, u.lo], [u.dla, u.dlo]) * f / Math.max(1, SP[u.ty] * (u.sm || 1)) * 3.6e6;
    }
    return eta != null && isFinite(eta) ? Math.max(1, Math.ceil(eta / 60000)) : 0;
  }
  function roomUnits(m) {
    const out = [];
    try {
      if (!m || !m.roomId || !inRoom()) return out;
      Object.keys(allyUnitLive).forEach(uid => {
        const p = presence[uid] || {};
        Object.values(allyUnitLive[uid] || {}).forEach(u => {
          if (u.rm !== m.roomId || (u.st !== "out" && u.st !== "scene") || !U[u.ty]) return;
          const stn = (p.stations || []).find(x => x && x.id === u.sid);
          out.push(Object.assign({}, u, { uid, who: p.display_name || "Ally", stName: stn ? stn.name : "" }));
        });
      });
    } catch (e) {}
    return out;
  }
  const tagOf = u => `<b>${esc(u.cs || "?")}</b> (${esc(u.who)}) ${esc(U[u.ty][1])}`;
  /* Same markup as the player's own "On scene" rows in the call details panel (no Cancel button) */
  function sceneRows(m) {
    const us = roomUnits(m).filter(u => u.st === "scene");
    return {
      n: us.length,
      h: us.map(u => `<div class="ucl"><div class="ui">${tagOf(u)}<div class="us"><span class="st scene">${lci("map-pin")} On scene</span><span>${esc(u.stName)}</span></div></div></div>`).join("")
    };
  }
  /* Same markup as the player's own "Responding units" rows */
  function respRows(m) {
    const us = roomUnits(m).filter(u => u.st === "out");
    return {
      n: us.length,
      h: us.map(u => { const mins = etaMins(u); return `<div class="u"><span>${tagOf(u)}<br><span class="mu">${esc(u.stName)}</span></span><span class="st out">${(typeof SL !== "undefined" && SL.out) || "Responding"}${mins ? " · ~" + mins + " min" : ""}</span></div>`; }).join("")
    };
  }
  /* Changes whenever the room rows would change, so the open panel redraws */
  function allyKey(m) {
    try {
      const k = roomUnits(m).map(u => u.cs + u.st + (u.st === "out" ? etaMins(u) : "")).join();
      return k;
    } catch (e) { return ""; }
  }

  // Public API
  window.Rooms = {
    open: openRooms,
    viewAlly: openAllyStations,
    create: createRoom,
    join: joinRoom,
    leave: leaveRoom,
    share: shareMission,
    // Awaited by signOut(): sends the final position before the session is destroyed
    flush: async () => { try { await publishFinal({ keepalive: false }); } finally { stopLoops(); } },
    inRoom: () => inRoom(),
    /* true while a saved room is still loading after a (re)login: sim.js leaves shared calls alone until then,
       so it can't "pause" or judge them without knowing who is really on scene */
    pending: () => {
      if (roomLoaded) return false;
      if (bootAt && Date.now() - bootAt > 60000) return false;
      try { return !!localStorage.getItem(ROOM_KEY); } catch (e) { return false; }
    },
    code: () => (room && room.code) || null,
    listOpen: loadPublicRooms,
    shareBtnHtml,
    roomUnits,
    sceneRows,
    respRows,
    allyKey,
    syncMarkers: syncAllyMarkers,
    getShow: () => ({ buildings: showAllyBuildings, vehicles: showAllyVehicles, missions: showAllyMissions }),
    setShow: (o) => {
      if (o && "buildings" in o) showAllyBuildings = !!o.buildings;
      if (o && "vehicles" in o) showAllyVehicles = !!o.vehicles;
      if (o && "missions" in o) showAllyMissions = !!o.missions;
      syncAllyMarkers();
    }
  };

  // Boot after game starts
  function onGameReady() {
    if (!bootAt) bootAt = Date.now();
    ensureBadge();
    ["nav_rm", "hd_rm"].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.onclick = openRooms;
    });
    patchRecall();
    if (AU && myId()) rejoinIfNeeded();
    bumpRoomUi();
    if (_lifecycleBound) return;
    _lifecycleBound = true;
    // Leaving (tab closed, app backgrounded): send the exact position + route right now.
    document.addEventListener("visibilitychange", () => {
      if (!inRoom()) return;
      if (document.visibilityState === "hidden") publishFinal({ keepalive: true }).catch(() => {});
      else startPresenceLoop(); // back again: publish live position immediately and resume
    });
    window.addEventListener("pagehide", () => {
      if (inRoom()) publishFinal({ keepalive: true }).catch(() => {});
    });
    window.addEventListener("pageshow", e => { if (e.persisted && inRoom()) startPresenceLoop(); });
  }
  let _lifecycleBound = false;

  // Try immediately and after startGame
  if (document.readyState === "complete") setTimeout(onGameReady, 500);
  else addEventListener("load", () => setTimeout(onGameReady, 800));

  // Also re-run when cloud auth finishes
  const _bootWatch = setInterval(() => {
    if (typeof gameOn !== "undefined" && gameOn) {
      clearInterval(_bootWatch);
      onGameReady();
    }
  }, 1000);

  // Extrapolate offline ally vehicles + refresh markers every second
  setInterval(() => {
    if (!inRoom()) return;
    tickAllyUnits();
    syncAllyMarkers();
  }, 1000);
})();
