/* ===== Delete account: a three-step flow opened from Menu > Account > Delete account =====
   Step 1  Read what will be deleted (tick to confirm, optional backup download)
   Step 2  Enter your password
   Step 3  Type DELETE, then delete
   The delete-account Edge Function re-checks the password and the typed word itself, so these steps can't be skipped by calling it directly.
   Uses globals from cloud.js / boot.js: AU, sb, sesClear, friendly, esc, KEY, gameOn, _soon */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const WORD = "DELETE";
  let ov = null, busy = false;

  const inputCss = "width:100%;box-sizing:border-box;padding:10px;margin-top:10px;border:1px solid var(--bd);border-radius:8px;background:var(--bg);color:var(--tx);font:inherit";
  const redBtn = "width:100%;margin-top:14px;background:#b42318;color:#fff";

  function stepBar(n) {
    const seg = i => `<i style="flex:1;height:4px;border-radius:2px;background:${i <= n ? "#dc2626" : "var(--bd)"}"></i>`;
    return `<div style="display:flex;gap:6px;margin-bottom:6px">${seg(1)}${seg(2)}${seg(3)}</div>` +
      `<div style="font-size:12px;color:var(--mu);margin-bottom:12px">Step ${n} of 3</div>`;
  }

  function shell(n, title, body) {
    return `<div role="dialog" aria-modal="true" aria-labelledby="del_t" style="width:100%;max-width:400px;max-height:92vh;max-height:92dvh;overflow:auto;background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:14px;padding:18px">` +
      stepBar(n) + `<div id="del_t" style="font-size:18px;font-weight:700;margin-bottom:8px">${title}</div>${body}</div>`;
  }

  function mount(html) {
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "delacct";
      ov.style.cssText = "position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px";
      document.body.appendChild(ov);
    }
    ov.innerHTML = html;
  }

  function close() {
    if (busy) return;
    if (ov) { ov.remove(); ov = null; }
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  const msgBox = () => `<div id="del_m" role="alert" style="min-height:18px;margin-top:10px;font-size:13px;color:#f0594b"></div>`;
  const setMsg = t => { const m = $("#del_m"); if (m) m.textContent = t || ""; };

  /* ---------- Step 1: what will be deleted ---------- */
  function step1() {
    mount(shell(1, "Delete your account?",
      `<div style="color:var(--mu);line-height:1.5;font-size:14px">This permanently deletes:</div>` +
      `<ul style="margin:8px 0 0;padding-left:20px;line-height:1.6;font-size:14px">` +
      `<li>your account, email address and sign-in</li>` +
      `<li>your cloud save and the account data held in our database</li></ul>` +
      `<div style="margin-top:10px;color:var(--mu);line-height:1.5;font-size:14px"><b style="color:var(--tx)">This can't be undone.</b> We can't recover a deleted account.</div>` +
      `<button type="button" id="del_bk" class="g" style="width:100%;margin-top:12px">Download a backup of my save first</button>` +
      `<label style="display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:14px;line-height:1.4;cursor:pointer"><input type="checkbox" id="del_ck" style="margin-top:2px;flex:none"><span>I understand my account and progress will be deleted permanently.</span></label>` +
      `<button type="button" id="del_next" style="${redBtn}" disabled>Continue</button>` +
      `<button type="button" id="del_x" class="g" style="width:100%;margin-top:8px">Cancel</button>`));
    const next = $("#del_next"), ck = $("#del_ck");
    const sync = () => { next.disabled = !ck.checked; next.style.opacity = ck.checked ? 1 : .5; };
    sync();
    ck.onchange = sync;
    next.onclick = () => { if (ck.checked) step2(); };
    $("#del_x").onclick = close;
    $("#del_bk").onclick = () => { try { exportSave(); } catch (e) { console.error(e); setMsg("Couldn't create the backup."); } };
  }

  /* ---------- Step 2: password ---------- */
  function step2() {
    mount(shell(2, "Confirm it's you",
      `<div style="color:var(--mu);line-height:1.5;font-size:14px">Enter the password for <b style="color:var(--tx)">${esc((AU && AU.user && AU.user.email) || "your account")}</b>.</div>` +
      `<input id="del_pw" type="password" autocomplete="current-password" placeholder="Password" style="${inputCss}">` + msgBox() +
      `<button type="button" id="del_next" style="${redBtn.replace("margin-top:14px", "margin-top:4px")}">Continue</button>` +
      `<button type="button" id="del_back" class="g" style="width:100%;margin-top:8px">Back</button>`));
    const pw = $("#del_pw"), next = $("#del_next");
    pw.focus();
    const go = async () => {
      if (busy) return;
      if (!pw.value) return setMsg("Enter your password.");
      busy = true; next.disabled = true; next.style.opacity = .6; setMsg("");
      try {
        // Same check as signing in. The reply (a new session) is thrown away; this only proves the password is right.
        await sb("/auth/v1/token?grant_type=password", { method: "POST", body: { email: AU.user.email, password: pw.value } });
        const p = pw.value;
        busy = false;
        step3(p);
      } catch (e) {
        busy = false; next.disabled = false; next.style.opacity = 1;
        setMsg(/Invalid login/i.test((e && e.message) || "") ? "That password is not correct." : friendly(e));
        pw.select();
      }
    };
    next.onclick = go;
    pw.onkeydown = e => { if (e.key === "Enter") go(); };
    $("#del_back").onclick = () => { if (!busy) step1(); };
  }

  /* ---------- Step 3: type DELETE, then delete ---------- */
  function step3(password) {
    mount(shell(3, "Last step: delete forever",
      `<div style="color:var(--mu);line-height:1.5;font-size:14px">Type <b style="color:var(--tx);letter-spacing:.08em">${WORD}</b> to permanently delete your account.</div>` +
      `<input id="del_ty" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${WORD}" style="${inputCss}">` + msgBox() +
      `<button type="button" id="del_go" style="${redBtn.replace("margin-top:14px", "margin-top:4px")}" disabled>Permanently delete my account</button>` +
      `<button type="button" id="del_back" class="g" style="width:100%;margin-top:8px">Cancel</button>`));
    const ty = $("#del_ty"), go = $("#del_go");
    ty.focus();
    const ready = () => ty.value.trim() === WORD;
    const sync = () => { go.disabled = busy || !ready(); go.style.opacity = go.disabled ? .5 : 1; };
    sync();
    ty.oninput = sync;
    const run = () => { if (ready() && !busy) doDelete(password, go, sync); };
    go.onclick = run;
    ty.onkeydown = e => { if (e.key === "Enter") run(); };
    $("#del_back").onclick = () => { if (!busy) close(); };
  }

  async function doDelete(password, go, sync) {
    busy = true; go.disabled = true; go.textContent = "Deleting…"; setMsg("");
    const uid = AU.user.id;
    // Stop autosaves first, otherwise a save landing after the wipe would recreate the player's row.
    const wasOn = gameOn;
    gameOn = false; cloudDirty = false; clearTimeout(_soon);
    try {
      const j = await sb("/functions/v1/delete-account", { method: "POST", auth: 1, body: { password, confirm: WORD } });
      if (!j || j.ok !== true) throw { message: (j && j.message) || "Unexpected reply from the server." };
    } catch (e) {
      gameOn = wasOn; busy = false; go.textContent = "Permanently delete my account"; sync();
      let m = friendly(e);
      if (e && e.status === 404) m = "Account deletion isn't set up on the server yet.";
      else if (/Failed to fetch|Load failed|NetworkError/i.test((e && e.message) || "")) m = "Can't reach the server. Nothing was deleted.";
      setMsg(m);
      return;
    }
    // Deleted. Remove everything about this user from the device too, then return to the sign-in screen.
    sesClear();
    try {
      const pre = KEY + "_" + uid;
      Object.keys(localStorage).forEach(k => { if (k === pre || k.indexOf(pre + "_") === 0) localStorage.removeItem(k); });
    } catch (e) { /* storage blocked */ }
    busy = false;
    mount(`<div role="dialog" aria-modal="true" style="width:100%;max-width:400px;background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:14px;padding:18px">` +
      `<div style="font-size:18px;font-weight:700;margin-bottom:8px">Account deleted</div>` +
      `<div style="color:var(--mu);line-height:1.5;font-size:14px">Your account and cloud data have been permanently deleted. Thanks for playing.</div>` +
      `<button type="button" id="del_done" style="width:100%;margin-top:14px">Done</button></div>`);
    document.removeEventListener("keydown", onKey);
    $("#del_done").onclick = () => location.reload();
  }

  window.fcDeleteAccount = function () {
    if (!(AU && AU.user && AU.user.id)) return;
    if (ov) return;
    busy = false;
    step1();
    document.addEventListener("keydown", onKey);
  };
})();
