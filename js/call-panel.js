/* Call panel redesign: header (grade, title, CAD, status, reward) + three cards columns.
   Col 1: incident + call transcript (+ questions). Col 2: vehicle requirements + dispatch units.
   Col 3: responding / on scene + call radio. Replaces drawQ from panels.js (loaded after it).
   On phones the columns stack and the dispatch picker stays on its own Dispatch screen. */
(function () {
  window.rdPick = function () { if (document.querySelector("#sheet .qdisp")) drawQ(); else drawD(); };
  const card = (ico, title, badge, body, cls, extra, attrs) =>
    `<section class="qcard ${cls || ""}" ${attrs || ""}><h4 class="qct">${lci(ico, 13)}<span>${title}</span>${badge != null && badge !== "" ? `<i class="qcn">${badge}</i>` : ""}${extra || ""}</h4>${body}</section>`;
  /* transcript can be collapsed with the arrow in its header (remembered on this device) */
  let trOff = false;
  try { trOff = localStorage.getItem("fc_qtr_c") === "1"; } catch (e) {}
  window.qtrToggle = function qtrToggle() {
    trOff = !trOff;
    try { localStorage.setItem("fc_qtr_c", trOff ? "1" : "0"); } catch (e) {}
    drawQ();
  };
  const row = (ico, k, v) => `<div class="qrow"><span class="qk">${lci(ico, 13)} ${k}</span><span class="qv">${v}</span></div>`;

  /* units finishing another call that are queued to come straight here (their u.mid is still the earlier call, so they are not in the normal responding list) */
  const queuedFor = (m) => S.un.filter((u) => u.nx === m.id && u.mid !== m.id && nxM(u));

  function statusPill(m) {
    const us = S.un.filter((u) => u.mid === m.id);
    const rr = window.Rooms && Rooms.respRows ? Rooms.respRows(m).n : 0;
    if (us.some((u) => u.st === "scene")) return `<span class="qpill ok"><i></i>On scene</span>`;
    if (us.some((u) => u.st === "out") || rr) return `<span class="qpill rsp"><i></i>Units en route</span>`;
    if (queuedFor(m).length) return `<span class="qpill rsp"><i></i>Units queued</span>`;
    return `<span class="qpill wait"><i></i>Awaiting dispatch</span>`;
  }

  function reqCard(m) {
    const nd = shown(m);
    let rows = Object.entries(nd)
      .map(([k, n]) => {
        const g = onS(m, k), a = asg(m, k), rs = a - g, left = Math.max(0, n - a);
        let st, c;
        if (g >= n) { st = "on scene"; c = "ok"; }
        else if (rs > 0) { st = `${rs} resp.${left > 0 ? " · " + left + " left" : ""}`; c = "rsp"; }
        else { st = `${n - g} needed`; c = "need"; }
        return `<div class="qpl ${c}"><b>${nm(k)}</b><span><i>${g}/${n}</i>${st}</span></div>`;
      })
      .join("");
    rows = `<div class="qpls">${rows}</div>`;
    return card("clipboard-list", "Vehicle requirements", "", rows, "qreqs");
  }

  function pickCard(m) {
    const nd = shown(m);
    const all = S.un.filter(free).sort((a, b) => need(nd, b) - need(nd, a) || eta(a, m) - eta(b, m));
    const q = window.__uqMid === m.id ? (window.__uq || "") : "";
    const ql = q.trim().toLowerCase();
    const us = ql ? all.filter((u) => [u.cs, U[u.ty][1], (stn(u.sid) || {}).name || ""].join(" ").toLowerCase().includes(ql)) : all;
    const search = `<input id="uq" class="uq" type="search" inputmode="search" autocomplete="off" spellcheck="false" placeholder="Callsign, type or station" value="${esc(q)}" oninput="uqSet(this.value,${m.id})">`;
    const list = us.length
      ? lim(
          us,
          "qp" + m.id,
          (u) => {
            const nstar = need(nd, u) ? `<span class="qneed" title="Needed" aria-label="Needed">★</span>` : "";
            const on = sel.has(u.id);
            return `<label class="qu${on ? " on" : ""}${need(nd, u) ? " nd" : ""}"><input type="checkbox" ${on ? "checked" : ""} onchange="tg(${u.id})"><span class="qub"></span><span class="qui"><span class="qul"><b>${u.cs}</b> ${U[u.ty][1]}</span><span class="qus">${u.st === "back" ? lci("undo-2", 11) + " Returning to " : ""}${stn(u.sid).name}${u.tr.length ? " · " + lci("graduation-cap", 11) + " " + u.tr.map((k) => TR[k][0]).join(", ") : ""}</span></span>${nstar}<span class="que"><b>${Math.ceil(eta(u, m) / 60)}</b> min<small>${Math.round(km(upos(u), mp(m)))} km</small></span></label>`;
          },
          "xpQ"
        )
      : ql
        ? `<div class="qempty">No units match “${esc(q.trim())}”.</div>`
        : `<div class="qempty">No units free right now.</div>`;
    const bar = `<div class="qsel"><b>${sel.size}</b> selected<small>${sel.size ? "Ready to dispatch" : "Pick units below"}</small></div><div class="qbar"><button type="button" class="qb g" onclick="auto()">${lci("wand-sparkles", 14)} Auto-select <kbd>A</kbd></button><button type="button" class="qb go" onclick="go()" ${sel.size && m.adc ? "" : "disabled"}>${lci("send", 14)} Dispatch${sel.size ? " (" + sel.size + ")" : ""} <kbd>↵</kbd></button></div>`;
    window.__qbar = bar;
    const body = `${search}<div class="qlist" id="qpl">${list}${busyH(m)}</div><div class="qfoot">${bar}</div>`;
    return card("truck", "Dispatch units", ql ? `${us.length} of ${all.length}` : `${all.length} available`, body, "qdisp");
  }

  function respCard(m) {
    const us = S.un.filter((u) => u.mid === m.id && u.st === "out");
    const rr = window.Rooms && Rooms.respRows ? Rooms.respRows(m) : { n: 0, h: "" };
    const sc = S.un.filter((u) => u.mid === m.id && u.st === "scene");
    const rs = window.Rooms && Rooms.sceneRows ? Rooms.sceneRows(m) : { n: 0, h: "" };
    const unitRow = (u, isScene) =>
      `<div class="qresp"><span class="qri"><b>${u.cs}</b> ${U[u.ty][1]}<small>${stn(u.sid).name}</small>${nxLine(u)}</span><span class="st ${stc(u)}">${isScene && window.World3D && World3D.landing(u) ? "Landing" : SLU(u)}</span><button class="s ucb" onclick="cancelU(${u.id})">Cancel</button></div>`;
    const qd = queuedFor(m);
    const queuedRow = (u) => {
      const c = mm(u.mid);
      return `<div class="qresp"><span class="qri"><b>${u.cs}</b> ${U[u.ty][1]}<small>${stn(u.sid).name}</small><small>${lci("hourglass", 11)} Goes direct here after ${esc(c ? T[c.k][1] : "current call")}</small></span><span class="st" style="background:#1d4ed8;color:#fff">Queued</span><button class="s ucb" onclick="unqU(${u.id})">Cancel</button></div>`;
    };
    let h = "";
    if (us.length || rr.n || qd.length)
      h += card(
        "siren",
        "Responding",
        us.length + rr.n + qd.length,
        lim(us, "dn" + m.id, (u) => unitRow(u, 0), "xpQ") + qd.map(queuedRow).join("") + rr.h + (us.length > 1 ? `<div class="qall"><button class="s ucb" onclick="cancelU(0,1,'out')">Cancel all</button></div>` : ""),
        "qrsp"
      );
    if (sc.length || rs.n)
      h += card(
        "map-pin",
        "On scene",
        sc.length + rs.n,
        sc.map((u) => unitRow(u, 1)).join("") + rs.h + (sc.length > 1 ? `<div class="qall"><button class="s ucb" onclick="cancelU(0,1,'scene')">Cancel all</button></div>` : ""),
        "qrsp"
      );
    return h;
  }

  /* Transport picker: full-width banner right under the call header (was a small box at the bottom of column 1, easy to miss and cut off) */
  function tdCard(m) {
    const k = tdKind(m);
    if (!k || !m._h || m.td) return "";
    const who = k === "h" ? "patient" : "prisoner";
    const pool = k === "h" ? S.hs.filter((x) => x.ty !== "pn") : S.hs.filter((x) => x.ty === "pn").concat(S.st.filter((x) => x.sv === "p" && x.cl));
    const L = pool.map((d) => ({ d, km: km([m.la, m.lo], [d.lat, d.lon]), f: dcap(d) - hbusy(d) })).sort((a, b) => a.km - b.km);
    const near = L.find((x) => x.f > 0);
    const auto = `<button type="button" class="qto qa" onclick="setTD(${m.id},'auto')"><span class="qton"><b>Auto – nearest with space</b><small>${near ? esc(near.d.name) + " · " + Math.round(near.km) + " km" : "Nothing has space right now"}</small></span>${lci("wand-sparkles", 16)}</button>`;
    const opts = L.map((x) => {
      const full = x.f <= 0, c = full ? "no" : x.f === 1 ? "lo" : "ok";
      return `<button type="button" class="qto" ${full ? "disabled" : ""} onclick="setTD(${m.id},'${x.d.id}')"><span class="qton"><b>${esc(x.d.name)}${near && x === near ? `<span class="qtag">Nearest</span>` : ""}</b><small>${Math.round(x.km)} km away</small></span><span class="qtoc"><span class="${c}">${full ? "Full" : x.f + " free"}</span></span></button>`;
    }).join("");
    const none = `<button type="button" class="qto qn" onclick="setTD(${m.id},'none')"><span class="qton"><b>No transport</b></span></button>`;
    return `<section class="qtd" role="group" aria-label="Transport required"><div class="qtdh"><span class="qtdi">${lci("siren", 16)}</span><span class="qtdt">Transport required <em>– ${who}</em></span><span class="qtds">Choose where to take the ${who}. The call stays open until you pick a destination.</span></div><div class="qtdg">${auto}${opts}${none}</div></section>`;
  }

  function radioCard(m) {
    const r = (m.rd || []).slice().sort((a, b) => a.t - b.t);
    const body = r.length
      ? `<div class="qradio">${r.map((l) => `<div class="qrl"><span class="mu">${new Date(l.t).toLocaleTimeString("en-GB")}</span> ${logH(l)}</div>`).join("")}</div>`
      : `<div class="qempty">No radio traffic yet.</div>`;
    return card("radio", "Call radio", r.length || "", body, "qrad");
  }

  window.uqSet = function uqSet(v, mid) {
    window.__uqMid = mid;
    window.__uq = v;
    const el = document.getElementById("uq");
    const pos = el ? el.selectionStart : null;
    drawQ();
    const next = document.getElementById("uq");
    if (next) { next.focus(); if (pos !== null) next.setSelectionRange(pos, pos); }
  };

  window.drawQ = function drawQ() {
    const m = mm(curM);
    if (!m) { closeM(); return; }
    if (window.__uqMid !== m.id) { window.__uqMid = m.id; window.__uq = ""; }
    const hadFocus = document.activeElement && document.activeElement.id === "uq";
    const caret = hadFocus ? document.activeElement.selectionStart : null;
    const tp = T[m.k], n = 1 + 2 * m.qa.length + (m.hw ? 1 : 0), off = met(m);
    const pc = document.getElementById("clog"), pq = document.querySelector("#sheet .qtr"), same = !!pq && pq.dataset.mid == m.id;
    const ps = same && pc ? pc.scrollTop : null, pn = same && pc ? +pc.dataset.n : 0;
    const pl0 = document.getElementById("qpl"), pls = pl0 ? pl0.scrollTop : 0;
    const sh = $("#sheet");
    const pqc = same ? Array.from(sh.querySelectorAll(".qc")).map((e) => e.scrollTop) : null;
    sh.dataset.qk = qk(m);
    const rw = typeof payOf === "function" ? payOf(m.k, rank()) : tp[5];
    const bub = (who, txt) => `<div class="qmsg ${who}"><small>${who === "d" ? "Control" : "Caller"}</small>${txt}</div>`;
    const transcript =
      bub("d", `“999, which service?”`) +
      bub("c", `${SV[tp[0]]}. ${tp[2]}`) +
      m.qa.map((x) => bub("d", x[0]) + bub("c", x[1])).join("") +
      (m.hw ? bub("d", "Help is on the way.") : "");
    const qs = m.roomOwner
      ? `<div class="mu">Only ${esc(m.roomOwner)}, who shared this call, can question the caller.</div>`
      : S.un.some((u) => u.mid === m.id && need(shown(m), u))
      ? ""
      : `<div class="qqs">${QS.map((q, i) => ((q[2] && q[2] !== tp[0]) || (q[3] && q[3] !== tp[1]) || !cqShow(tp, q, i) || m.qa.some((x) => x[0] === q[0]) ? "" : `<button class="s g" onclick="ask(${i})">${q[0]}</button>`)).join("")}</div>`;
    /* while the questions are available the transcript is always shown (so the answers are visible), whatever the collapse arrow was last set to */
    const qOn = !m.roomOwner && qs.includes("<button"), trHide = trOff && !qOn;
    const qHtml = qs ? card("circle-help", "Questions", "", `<div class="qq">${qs}</div>`, "qqc") : "";

    sh.innerHTML =
      `<div class="qhead"><div class="qh1">${gch(gr(m.k))}<span class="qtitle">${tp[1]}</span><span class="qacts">${(window.Rooms && Rooms.shareBtnHtml) ? Rooms.shareBtnHtml(m) : ""}<button class="qdsp" onclick="openD(${m.id})">Dispatch</button></span></div>` +
      `<div class="qh2"><span class="qcad">${cadOf(m)}</span>${statusPill(m)}<span class="qrw">Reward £${fmt(rw)}</span>${wk(m) ? `<span id="qrem" class="qrem">${remT(m)}</span>` : ""}</div></div>` +
      tdCard(m) +
      `<div class="qinfo"><div class="qi qi-loc"><small>Location</small><b>${m.adc ? m.loc : "Unknown"}</b></div><div class="qi"><small>Caller</small><b>${m.ph}</b></div><div class="qi"><small>Pinged location</small><b>${m.adr && m.adr.t ? m.adr.t : "Unknown"} <span class="qmono">${m.la.toFixed(4)}, ${m.lo.toFixed(4)}</span></b></div><div class="qadr ${m.adc ? "ok" : "no"}">${m.adc ? lci("circle-check", 13) + " Address confirmed" : lci("triangle-alert", 13) + " Ask for the address before dispatching"}</div></div>` +
      `<div class="qgrid"><div class="qc qc1">` +
      card("message-square", "Call transcript", m.qa.length * 2 + 2, trHide ? "" : `<div class="clog${off ? " clog-off" : ""}${n > 6 ? " clog-long" : ""}" id="clog" data-mid="${m.id}" data-n="${n}">${transcript}</div>`, "qtr" + (trHide ? " qtr-c" : ""), (qOn ? "" : `<button type="button" class="qcol" onclick="qtrToggle()" aria-expanded="${trHide ? "false" : "true"}" aria-label="${trHide ? "Expand" : "Collapse"} call transcript" title="${trHide ? "Expand" : "Collapse"} transcript">${lci("chevron-up", 14)}</button>`), `data-mid="${m.id}"`) +
      qHtml +
      (m.ccdone && !S.un.some((u) => u.mid === m.id) ? `<div class="qwarn">${lci("triangle-alert", 14)} Awaiting units dispatch</div>` : "") +
      `</div><div class="qc qc2">${reqCard(m)}${pickCard(m)}</div><div class="qc qc3">${respCard(m)}${radioCard(m)}</div></div>` +
      `<div class="qfix">${window.__qbar}</div>`;

    if (pqc) sh.querySelectorAll(".qc").forEach((e, i) => { if (pqc[i]) e.scrollTop = pqc[i]; });
    const cl = document.getElementById("clog");
    if (cl) cl.scrollTop = ps === null || n > pn ? cl.scrollHeight : ps;

    const pl = document.getElementById("qpl");
    if (pl) pl.scrollTop = pls;
    if (hadFocus) { const u = document.getElementById("uq"); if (u) { u.focus(); if (caret !== null) u.setSelectionRange(caret, caret); } }
  };
})();
