/* ===== SOUND: 999 ring, missed-call tone, Sepura-style radio tones, and unit radio chatter =====
   Hooks into log(), so no other file needs to know about it. Load after state.js.

   Chatter uses the BROWSER'S OWN text-to-speech voices (speechSynthesis). The player picks one voice for Control and a
   different one for the units in Settings. Browsers do not let a page run speech through audio filters, so the voice
   itself is left clean; the radio feel comes only from the Sepura-style tones before and after each message.
   Default voices are chosen by quality (natural / enhanced / Google / Siri first, novelty and robot voices never).

   Settings: sound (effects), tones (radio tones), chatter (voice), vol (0-1), ctlVoice / unitVoice (voiceURI). */
(function () {
  "use strict";
  let ac = null, bus = null, lastSq = 0;
  const eff = () => getSet().sound !== false;
  const tns = () => getSet().tones !== false;
  const cht = () => getSet().chatter !== false;
  const vol = () => { const v = getSet().vol; return typeof v === "number" ? v : 0.6; };
  const hasTTS = () => typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";

  /* browsers block audio until the user has interacted with the page */
  function ctx() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ac = new C();
      /* every effect goes through one "handset speaker" band-pass */
      const hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), out = ac.createGain();
      hp.type = "highpass"; hp.frequency.value = 350; lp.type = "lowpass"; lp.frequency.value = 3600;
      out.gain.value = 1; hp.connect(lp); lp.connect(out); out.connect(ac.destination); bus = hp;
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  /* iOS/Safari only allow speech after a gesture: say nothing, silently, on the first tap */
  function unlockTTS() { if (!hasTTS()) return; try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
  ["pointerdown", "keydown", "touchend"].forEach(e => addEventListener(e, () => { ctx(); unlockTTS(); }, { once: true, passive: true }));

  /* ---------- tone building blocks ---------- */
  function tone(freqs, t0, dur, g, type, glideTo) {
    const a = ctx(); if (!a) return;
    const o = a.createGain(), v = g * vol();
    o.gain.setValueAtTime(0, t0);
    o.gain.linearRampToValueAtTime(v, t0 + 0.006);
    o.gain.setValueAtTime(v, Math.max(t0 + 0.007, t0 + dur - 0.012));
    o.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(bus);
    freqs.forEach(f => {
      const s = a.createOscillator(); s.type = type || "sine"; s.frequency.setValueAtTime(f, t0);
      if (glideTo) s.frequency.linearRampToValueAtTime(glideTo, t0 + dur);
      s.connect(o); s.start(t0); s.stop(t0 + dur + 0.02);
    });
  }

  /* ---------- 999 incoming call: an electronic ring / bleep trill, repeated ---------- */
  function ring() {
    const a = ctx(); if (!a || !eff()) return;
    const t = a.currentTime + 0.02;
    /* two bursts of a fast 1.4k/1.9k warble, like a digital desk-phone / Sepura call alert */
    [0, 0.5].forEach(off => {
      for (let i = 0; i < 6; i++) tone([i % 2 ? 1900 : 1400], t + off + i * 0.045, 0.045, 0.22, "square");
    });
  }
  function missed() {   // falling two-note "bu-boop"
    const a = ctx(); if (!a || !eff()) return;
    const t = a.currentTime + 0.02;
    tone([880], t, 0.12, 0.16, "triangle"); tone([587], t + 0.14, 0.2, 0.16, "triangle");
  }
  function squelch() {   // tiny soft click (volume-slider check / unit keys up with tones off). No noise.
    const a = ctx(); if (!a) return;
    tone([1300], a.currentTime + 0.01, 0.035, 0.12, "sine");
  }

  /* ---------- Sepura / TETRA-style radio tones ----------
     Real handset tones are plain, short, clean beeps (not tunes): a single bip when you get the floor, a double bip
     when a call ends. No official frequencies are published, so these are tuned by ear. To adjust one, change the
     numbers in the lists below: [Hz, seconds]. */
  function seq(notes, g) {                   // notes: [[Hz, seconds], ...]; returns total seconds
    const a = ctx(); if (!a || !tns()) return 0;
    let t = a.currentTime + 0.01, tot = 0.01;
    notes.forEach(n => { tone([n[0]], t, n[1], g, "sine"); t += n[1] + 0.06; tot += n[1] + 0.06; });
    return tot;
  }
  const tonePermit = () => seq([[1100, 0.1]], 0.3);                                   // a unit keys up: one short bip
  const toneIncoming = () => seq([[1500, 0.07], [1500, 0.07]], 0.3);                  // message from Control: double bip
  const toneUrgent = () => seq([[1800, 0.09], [1800, 0.09], [1800, 0.09]], 0.32);    // Grade 1/2 dispatch: triple bip
  const toneGroup = () => seq([[900, 0.12]], 0.3);                                    // all-units broadcast: one lower bip
  const toneEnd = () => seq([[1000, 0.05], [750, 0.07]], 0.26);                       // end of transmission: falling pair
  const keyTone = k => k === "urgent" ? toneUrgent() : k === "all" ? toneGroup() : k === "ctl" ? toneIncoming() : tonePermit();

  /* ---------- voices ---------- */
  const BAD = /novelty|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|espeak|compact/i;
  const GOOD = /natural|neural|premium|enhanced|online|google|siri|microsoft .* online/i;
  function score(v) {
    let n = 0;
    if (/^en[-_]GB/i.test(v.lang)) n += 30; else if (/^en/i.test(v.lang)) n += 10;
    if (GOOD.test(v.name)) n += 40;
    if (v.localService === false) n += 15;      // network voices (Google, Microsoft online) are usually much better
    return n;
  }
  function voices() {
    if (!hasTTS()) return [];
    const all = speechSynthesis.getVoices() || [];
    let list = all.filter(v => /^en/i.test(v.lang) && !BAD.test(v.name));
    if (!list.length) list = all.filter(v => /^en/i.test(v.lang));
    if (!list.length) list = all;
    return list.slice().sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  }
  const findVoice = uri => uri ? voices().find(v => v.voiceURI === uri || v.name === uri) : null;
  /* defaults: the two best voices, different for Control and units (prefers one male and one female name if it can tell) */
  function pickVoice(role) {
    const set = getSet(), want = findVoice(role === "ctl" ? set.ctlVoice : set.unitVoice);
    if (want) return want;
    const vs = voices(); if (!vs.length) return null;
    const other = findVoice(role === "ctl" ? set.unitVoice : set.ctlVoice);
    if (other) return vs.find(v => v !== other) || vs[0];
    return role === "ctl" ? vs[0] : (vs.find(v => v !== vs[0]) || vs[0]);
  }
  const escA = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  function voiceOptions(role) {   // <option> list for the Settings dropdowns
    const vs = voices(), cur = pickVoice(role);
    if (!vs.length) return '<option value="">No browser voices found</option>';
    return vs.map(v => '<option value="' + escA(v.voiceURI) + '"' + (cur && cur.voiceURI === v.voiceURI ? " selected" : "") + ">" + escA(v.name) + " (" + escA(v.lang) + ")</option>").join("");
  }
  if (hasTTS()) {
    speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", () => {
      try { const o = document.getElementById("setov"); if (o && o._draw) o._draw(); } catch (e) {}
    });
    try { speechSynthesis.getVoices(); } catch (e) {}
  }

  /* ---------- turning a radio log line into something to say ---------- */
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const spell = cs => String(cs).split("").filter(c => /[A-Za-z0-9]/.test(c)).join(" ");

  function clean(text, cs) {
    let t = String(text);
    if (cs) t = t.replace(new RegExp("\\b" + rx(cs) + "\\b", "g"), spell(cs));
    return t
      .replace(/\bETA\b/g, "E T A").replace(/\bMDT\b/g, "M D T")
      .replace(/\bmins\b/g, "minutes").replace(/\bmin\b/g, "minute")
      .replace(/\bA&E\b/g, "A and E").replace(/&/g, " and ")
      .replace(/→/g, " to ").replace(/[“”"]/g, "")
      .replace(/\s+/g, " ").trim();
  }

  /* returns {voice, kind, text, cs} or null if the line should not be spoken */
  function plan(m) {
    const s = String(m).replace(/^📻\s*/, "").trim(); let x;
    if ((x = /^Control → all units on (.+?): (.*)$/.exec(s)))
      return { voice: "ctl", kind: "all", text: clean("All units on " + x[1] + ". " + x[2]) };
    if ((x = /^Control → (.+?): “([\s\S]*?)”?$/.exec(s))) {
      const urgent = /, Grade [12], at /.test(x[2]) || /blue lights/.test(x[2]);
      return { voice: "ctl", kind: urgent ? "urgent" : "ctl", text: clean(x[2], x[1]) };
    }
    if ((x = /^(.+?): “([\s\S]*?)”?$/.exec(s))) {
      if (!/[A-Za-z0-9]/.test(x[1])) return null;
      return { voice: "unit", kind: "unit", text: clean(x[2], x[1]), cs: x[1] };
    }
    return null;
  }

  /* ---------- playback ---------- */
  function speak(p) {
    return new Promise(res => {
      const v = pickVoice(p.voice);
      let u; try { u = new SpeechSynthesisUtterance(p.text); } catch (e) { return res(); }
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-GB";
      const h = hash(p.cs || ""), set = getSet();
      /* units: each crew a touch different in speed */
      u.rate = p.voice === "unit" ? 1 + (h % 4) * 0.03 : 1.05;
      u.pitch = 1;   // pitch shifting makes many phone voices sound worse, so it is left alone
      u.volume = Math.min(1, Math.max(0.05, (typeof set.vol === "number" ? set.vol : 0.6) * 1.4));
      let fin = false; const done = () => { if (fin) return; fin = true; res(); };
      u.onend = done; u.onerror = done;
      try { speechSynthesis.speak(u); } catch (e) { return done(); }
      /* never get stuck (some browsers drop onend): give up after a time based on the line length, and cancel it */
      setTimeout(() => { if (!fin) { try { speechSynthesis.cancel(); } catch (e) {} done(); } }, 6000 + p.text.length * 90);
    });
  }

  const queue = []; let speaking = false;
  const MAXQ = 10;        // hard cap on waiting lines
  const STALE = 25000;    // a line older than this (ms) is no longer "live" and is skipped if others are waiting
  function next() {
    if (speaking || !queue.length) return;
    /* catching up: skip stale lines, but never the newest one */
    while (queue.length > 1 && Date.now() - queue[0].at > STALE) queue.shift();
    const q = queue.shift(); speaking = true;
    const behind = queue.length >= 3;   // behind: skip the key-up / end bips so the backlog clears faster
    let ended = false;
    const done = () => {
      if (ended) return; ended = true;
      speaking = false;
      if (!behind) toneEnd();
      setTimeout(next, behind ? 60 : 250);
    };
    const lead = behind ? 0.05 : (keyTone(q.p.kind) || 0.05);
    setTimeout(() => speak(q.p).then(done, done), lead * 1000 + 60);
    setTimeout(done, 20000);   // last-resort safety net
  }
  function say(entry) {
    if (!cht() || !hasTTS()) return;
    let p; try { p = plan(entry.m); } catch (e) { return; }
    if (!p || !p.text) return;
    queue.push({ p, at: Date.now() }); while (queue.length > MAXQ) queue.shift();
    next();
  }
  function stopChatter() { queue.length = 0; try { speechSynthesis.cancel(); } catch (e) {} speaking = false; }

  /* Settings: hear each voice */
  function testVoice(role) {
    if (!hasTTS()) { try { toast("This browser has no text-to-speech voices."); } catch (e) {} return; }
    stopChatter();
    queue.push({ p: role === "ctl"
      ? { voice: "ctl", kind: "ctl", text: "FP1, Control. Radio check. How do you read?" }
      : { voice: "unit", kind: "unit", cs: "FP1", text: "Control, F P 1, received. Mobile from station, E T A 4 minutes." } });
    next();
  }
  function demoVoice() {
    if (!hasTTS()) { try { toast("This browser has no text-to-speech voices."); } catch (e) {} return; }
    stopChatter();
    queue.push({ p: { voice: "ctl", kind: "all", text: "All units. Radio check." } });
    queue.push({ p: { voice: "unit", kind: "unit", cs: "FP1", text: "Control, F P 1, received. Mobile from station, E T A 4 minutes." } });
    next();
  }

  /* ---------- server games: lines arrive inside the state, not through log() ----------
     In server mode (server-mode.js) the SERVER runs the sim and the browser just replaces S with each reply, so radio
     lines made there never pass through log() and the hook below never sees them. This scanner watches S.lg for new
     radio lines instead, so chatter plays no matter where the line was created. Lines already handled by the hook are
     remembered, and lines older than 45 s (e.g. after the tab was in the background) are not replayed. */
  const seen = new Set(), keyOf = e => e.t + "|" + e.m;
  let primed = false;
  function scan() {
    try {
      if (!S || !Array.isArray(S.lg)) return;
      const cur = S.lg;
      if (!primed) { cur.forEach(e => seen.add(keyOf(e))); primed = true; return; }
      const fresh = [];
      for (let i = 0; i < cur.length; i++) {
        const e = cur[i], k = keyOf(e);
        if (seen.has(k)) continue;
        seen.add(k);
        if (String(e.m).startsWith("\u{1F4FB}")) fresh.push(e);
      }
      if (seen.size > 600) { const keep = cur.map(keyOf); seen.clear(); keep.forEach(k => seen.add(k)); }
      fresh.reverse().forEach(e => {
        if (now() - e.t > 45000) return;
        if (cht() && hasTTS()) say(e);
        else if (eff() && Date.now() - lastSq > 150) { lastSq = Date.now(); squelch(); }
      });
    } catch (err) {}
  }
  setInterval(scan, 400);

  /* ---------- hook log() ---------- */
  const _log = window.log;
  window.log = function (m) {
    const ret = _log.apply(this, arguments);
    try {
      const s = String(m);
      if (s.startsWith("📞")) ring();
      else if (s.startsWith("❌ Missed")) missed();
      else if (s.startsWith("📻")) {
        const e = S && S.lg && S.lg[0];
        if (e && e.m === m) {
          seen.add(keyOf(e));
          if (cht() && hasTTS()) say(e);
          else if (eff() && Date.now() - lastSq > 150) { lastSq = Date.now(); squelch(); }
        }
      }
    } catch (err) {}
    return ret;
  };

  /* Chrome can silently pause long speech; nudge it while a line is being spoken */
  setInterval(() => { try { if (speaking && speechSynthesis.paused) speechSynthesis.resume(); } catch (e) {} }, 4000);

  /* keep ringing every 3 s while a 999 call is unanswered */
  setInterval(() => { try { if (S && S.ms.some(m => !m.ans)) ring(); } catch (e) {} }, 3000);

  window.GameSound = {
    ring, missed, squelch, say, stopChatter, demoVoice, testVoice, plan, voices, voiceOptions,
    demoTones: () => { const d = toneUrgent(); setTimeout(() => { const e = tonePermit(); setTimeout(toneEnd, e * 1000 + 500); }, d * 1000 + 300); }
  };
})();
