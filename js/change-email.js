/* ===== Change email: opened from Menu > Account > Change email =====
   Asks for the new address and the current password, then asks Supabase Auth to send a confirmation link to the new address.
   The email only changes once that link is clicked. The account's user id never changes, so saves, rank, leaderboard
   place and everything else keyed by that id are untouched.
   Uses globals from cloud.js / boot.js: AU, sb, sesSave, friendly, esc, redir */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  let ov = null, busy = false;

  const inputCss = "width:100%;box-sizing:border-box;padding:10px;margin-top:10px;border:1px solid var(--bd);border-radius:8px;background:var(--bg);color:var(--tx);font:inherit";
  const noteCss = "margin-top:12px;padding:10px 12px;border:1px solid var(--bd);border-radius:8px;font-size:13px;line-height:1.5;color:var(--mu)";
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const current = () => (AU && AU.user && AU.user.email) || "";

  function shell(title, body) {
    return `<div role="dialog" aria-modal="true" aria-labelledby="ce_t" style="width:100%;max-width:400px;max-height:92vh;max-height:92dvh;overflow:auto;background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:14px;padding:18px">` +
      `<div id="ce_t" style="font-size:18px;font-weight:700;margin-bottom:8px">${title}</div>${body}</div>`;
  }

  function mount(html) {
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "chgemail";
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

  const setMsg = (t, ok) => { const m = $("#ce_m"); if (m) { m.textContent = t || ""; m.style.color = ok ? "#34c26a" : "#f0594b"; } };

  /* Turn the raw error into something a player can act on. */
  function explain(e) {
    const m = (e && e.message) || "";
    if (/Invalid login/i.test(m)) return "That password is not correct.";
    if (/already (been )?registered|already exists|email_exists/i.test(m)) return "That email is already used by another account.";
    if (/rate limit|too many|over_email_send_rate_limit/i.test(m) || (e && e.status === 429)) return "Too many emails have been sent. Wait a few minutes and try again.";
    if (/same|identical|unchanged/i.test(m)) return "That is already your email.";
    return friendly(e);
  }

  /* ---------- the form ---------- */
  function form(pending) {
    const pend = pending
      ? `<div style="${noteCss};border-color:#b8860b;color:var(--tx)">A change to <b>${esc(pending)}</b> is waiting for you to click its confirmation link. Sending again replaces it.</div>`
      : "";
    mount(shell("Change your email",
      `<div style="color:var(--mu);line-height:1.5;font-size:14px">Your email is currently <b style="color:var(--tx)">${esc(current() || "not set")}</b>.</div>` + pend +
      `<div style="${noteCss}">` +
        `<b style="color:var(--tx)">You will get an email from Supabase Auth.</b> That is the service that handles sign-in for Frontline Control. It is sent to your <b>new</b> address with a link to click. Check your spam folder if it does not arrive. Your email stays the same until you click the link.` +
        `<div style="margin-top:8px">Your progress is not affected. Your saves, rank and leaderboard place belong to your account, not your email.</div>` +
        `<div style="margin-top:8px">Forum badges are matched by email, so use the same email on the forum.</div>` +
      `</div>` +
      `<input id="ce_new" type="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="New email" style="${inputCss}">` +
      `<input id="ce_pw" type="password" autocomplete="current-password" placeholder="Your current password" style="${inputCss}">` +
      `<div id="ce_m" role="alert" style="min-height:18px;margin-top:10px;font-size:13px;color:#f0594b"></div>` +
      `<button type="button" id="ce_go" style="width:100%;margin-top:4px">Send confirmation link</button>` +
      `<button type="button" id="ce_x" class="g" style="width:100%;margin-top:8px">Cancel</button>`));
    const em = $("#ce_new"), pw = $("#ce_pw"), go = $("#ce_go");
    em.focus();
    const run = async () => {
      if (busy) return;
      const next = em.value.trim().toLowerCase();
      if (!EMAIL_RE.test(next)) return setMsg("Enter a valid email address.");
      if (next === current().toLowerCase()) return setMsg("That is already your email.");
      if (!pw.value) return setMsg("Enter your current password.");
      busy = true; go.disabled = true; go.style.opacity = .6; go.textContent = "Sending…"; setMsg("");
      try {
        // Same check as signing in. The reply (a new session) is thrown away; this only proves the password is right.
        await sb("/auth/v1/token?grant_type=password", { method: "POST", body: { email: current(), password: pw.value } });
        await sb("/auth/v1/user" + (redir() ? "?redirect_to=" + encodeURIComponent(redir()) : ""), { method: "PUT", auth: 1, body: { email: next } });
        busy = false;
        sent(next);
      } catch (e) {
        busy = false; go.disabled = false; go.style.opacity = 1; go.textContent = "Send confirmation link";
        setMsg(explain(e));
        if (/Invalid login/i.test((e && e.message) || "")) pw.select();
      }
    };
    go.onclick = run;
    em.onkeydown = pw.onkeydown = e => { if (e.key === "Enter") run(); };
    $("#ce_x").onclick = close;
  }

  /* ---------- sent ---------- */
  function sent(next) {
    mount(shell("Check your inbox",
      `<div style="color:var(--mu);line-height:1.5;font-size:14px">We asked Supabase Auth to send a confirmation link to <b style="color:var(--tx)">${esc(next)}</b>.</div>` +
      `<ul style="margin:10px 0 0;padding-left:20px;line-height:1.6;font-size:14px">` +
      `<li>Open the email from Supabase Auth and click the link.</li>` +
      `<li>Until then you keep signing in with <b>${esc(current())}</b>.</li>` +
      `<li>Nothing about your game changes.</li></ul>` +
      `<div style="margin-top:10px;color:var(--mu);line-height:1.5;font-size:13px">Not there after a few minutes? Check spam, then try again.</div>` +
      `<button type="button" id="ce_done" style="width:100%;margin-top:14px">Done</button>`));
    $("#ce_done").onclick = close;
  }

  /* Opens straight away, then quietly asks Supabase whether a change is already waiting for confirmation. */
  window.fcChangeEmail = async function () {
    if (!(AU && AU.user && AU.user.id)) return;
    if (ov) return;
    busy = false;
    form("");
    document.addEventListener("keydown", onKey);
    try {
      const u = await sb("/auth/v1/user", { auth: 1 });
      if (u && u.id) {
        sesSave({ access_token: AU.access_token, refresh_token: AU.refresh_token, expires_at: AU.expires_at, user: u });
        // only redraw if the person hasn't started typing
        if (ov && u.new_email && !($("#ce_new") || {}).value && !($("#ce_pw") || {}).value) form(u.new_email);
        else if (ov) { const c = ov.querySelector("b"); if (c) c.textContent = current() || "not set"; }
      }
    } catch (e) { /* offline or session problem: the form still works and reports its own errors */ }
  };
})();
