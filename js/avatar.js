/* ===== Profile pictures: stored on the game server (data/avatars/<user-id>.webp) ===== */
(function () {
  const API = window.FC_API || "https://api.frontlinecontrol.co.uk";
  const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let ver = 0; // set after we change our own picture so the new one shows straight away
  const myId = () => (typeof AU !== "undefined" && AU && AU.user && AU.user.id) || null;
  const say = m => { try { toast(m); } catch (e) { alert(m); } };

  // URL of a player's picture
  const url = id => API + "/api/avatar/" + encodeURIComponent(id) + (id === myId() && ver ? "?v=" + ver : "");
  // An <img> to place on top of a letter/icon. If the player has no picture it removes itself, and the game then stops
  // asking for that player's picture for 10 minutes (otherwise every refresh of a list asks again and logs another error).
  const none = new Map(); // player id -> when the server said "no picture"
  const NONE_MS = 10 * 60 * 1000;
  const has404 = id => { const t = none.get(String(id).toLowerCase()); return !!t && Date.now() - t < NONE_MS; };
  const gone = el => { try { none.set(String(el.dataset.id || "").toLowerCase(), Date.now()); el.remove(); } catch (e) { /* ignore */ } };
  const img = id => ID.test(String(id || "")) && !has404(id) ? '<img class="fcav" data-id="' + id + '" alt="" loading="lazy" decoding="async" src="' + url(id) + '" onerror="fcAvatar.gone(this)">' : "";
  // Round avatar for the signed-in player (icon underneath, picture on top)
  const mine = n => '<i class="fcav-w" style="width:' + n + "px;height:" + n + 'px">' + AVSVG(n) + img(myId()) + "</i>"; // an <i>, not a <span>: the phone layout hides every span inside the account button

  async function toBlob(file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) {
      bmp = await new Promise((ok, no) => {
        const i = new Image(), u = URL.createObjectURL(file);
        i.onload = () => { URL.revokeObjectURL(u); ok(i); };
        i.onerror = () => no(new Error("That file isn't an image"));
        i.src = u;
      });
    }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, s = Math.min(w, h);
    if (!s) throw new Error("That file isn't an image");
    const c = document.createElement("canvas"), x = c.getContext("2d");
    c.width = c.height = 256;
    x.fillStyle = "#fff"; x.fillRect(0, 0, 256, 256);
    x.drawImage(bmp, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 256, 256); // centre square crop
    return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error("Couldn't process that image")), "image/jpeg", 0.88));
  }

  async function call(path, body, type) {
    try { await sb("/auth/v1/user", { auth: 1 }); } catch (e) { /* refreshes the login if it is about to expire */ }
    if (!(AU && AU.access_token)) throw new Error("Sign in to set a profile picture");
    const h = { Authorization: "Bearer " + AU.access_token };
    if (type) h["Content-Type"] = type;
    const r = await fetch(API + path, { method: "POST", headers: h, body });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.reason || "Upload failed (" + r.status + ")");
    return j;
  }

  function refresh() {
    ver = Date.now();
    if (myId()) none.delete(String(myId()).toLowerCase()); // my own picture just changed: ask for it again
    try { const e = document.querySelector("#rk"); if (e) { e.dataset.k = ""; acctLabel(); } } catch (x) { /* ignore */ }
    try { if (document.querySelector("#acct") && document.querySelector("#ac_av")) openAcct(); } catch (x) { /* ignore */ }
  }

  function pick() {
    if (!myId()) return say("Sign in to set a profile picture");
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > 15e6) return say("That image is too big (15 MB max)");
      try { say("Uploading…"); await call("/api/avatar", await toBlob(f), "image/jpeg"); say("Profile picture updated"); refresh(); }
      catch (e) { say((e && e.message) || "Couldn't upload that picture"); }
    };
    inp.click();
  }

  async function remove() {
    if (!myId()) return;
    try { await call("/api/avatar/remove"); say("Profile picture removed"); refresh(); }
    catch (e) { say((e && e.message) || "Couldn't remove it"); }
  }

  window.fcAvatar = { url, img, mine, pick, remove, gone };
})();
