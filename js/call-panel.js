/* Call panel redesign: header (grade, title, CAD, status, reward) + three cards columns.
   Col 1: incident + call transcript (+ questions). Col 2: vehicle requirements + dispatch units.
   Col 3: responding / on scene + call radio. Replaces drawQ from panels.js (loaded after it).
   On phones the columns stack and the dispatch picker stays on its own Dispatch screen. */
(function () {
  window.rdPick = function () { if (document.querySelector("#sheet .qdisp")) drawQ(); else drawD(); };
  const card = (ico, title, badge, body, cls) =>
    `<section class="qcard ${cls || ""}"><h4 class="qct">${lci(ico, 13)}<span>${title}</span>${badge != null && badge !== "" ? `<i class="qcn">${badge}</i>` : ""}</h4>${body}</section>`;
  const row = (ico, k, v) => `<div class="qrow"><span class="qk">${lci(ico, 13)} ${k}</span><span class="qv">${v}</span></div>`;

  function statusPill(m) {
    const us = S.un.filter((u) => u.mid === m.id);
    const rr = window.Rooms && Rooms.respRows ? Rooms.respRows(m).n : 0;
    if (us.some((u) => u.st === "scene")) return `<span class="qpill ok"><i></i>On scene</span>`;
    if (us.some((u) => u.st === "out") || rr) return `<span class="qpill rsp"><i></i>Units en route</span>`;
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
    const us = S.un.filter(free).sort((a, b) => need(nd, b) - need(nd, a) || eta(a, m) - eta(b, m));
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
      : `<div class="qempty">No units free right now.</div>`;
    const bar = `<div class="qsel"><b>${sel.size}</b> selected<small>${sel.size ? "Ready to dispatch" : "Pick units below"}</small></div><div class="qbar"><button type="button" class="qb g" onclick="auto()">${lci("wand-sparkles", 14)} Auto-select <kbd>A</kbd></button><button type="button" class="qb go" onclick="go()" ${sel.size && m.adc ? "" : "disabled"}>${lci("send", 14)} Dispatch${sel.size ? " (" + sel.size + ")" : ""} <kbd>↵</kbd></button></div>`;
    window.__qbar = bar;
    const body = `<div class="qlist" id="qpl">${list}${busyH(m)}</div><div class="qfoot">${bar}</div>`;
    return card("truck", "Dispatch units", `${us.length} available`, body, "qdisp");
  }

  function respCard(m) {
    const us = S.un.filter((u) => u.mid === m.id && u.st === "out");
    const rr = window.Rooms && Rooms.respRows ? Rooms.respRows(m) : { n: 0, h: "" };
    const sc = S.un.filter((u) => u.mid === m.id && u.st === "scene");
    const rs = window.Rooms && Rooms.sceneRows ? Rooms.sceneRows(m) : { n: 0, h: "" };
    const unitRow = (u, isScene) =>
      `<div class="qresp"><span class="qri"><b>${u.cs}</b> ${U[u.ty][1]}<small>${stn(u.sid).name}</small>${nxLine(u)}</span><span class="st ${stc(u)}">${isScene && window.World3D && World3D.landing(u) ? "Landing" : SLU(u)}</span><button class="s ucb" onclick="cancelU(${u.id})">Cancel</button></div>`;
    let h = "";
    if (us.length || rr.n)
      h += card(
        "siren",
        "Responding",
        us.length + rr.n,
        lim(us, "dn" + m.id, (u) => unitRow(u, 0), "xpQ") + rr.h + (us.length > 1 ? `<div class="qall"><button class="s ucb" onclick="cancelU(0,1,'out')">Cancel all</button></div>` : ""),
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

  function radioCard(m) {
    const r = (m.rd || []).slice().sort((a, b) => a.t - b.t);
    const body = r.length
      ? `<div class="qradio">${r.map((l) => `<div class="qrl"><span class="mu">${new Date(l.t).toLocaleTimeString("en-GB")}</span> ${logH(l)}</div>`).join("")}</div>`
      : `<div class="qempty">No radio traffic yet.</div>`;
    return card("radio", "Call radio", r.length || "", body, "qrad");
  }

  window.drawQ = function drawQ() {
    const m = mm(curM);
    if (!m) { closeM(); return; }
    const tp = T[m.k], n = 1 + 2 * m.qa.length + (m.hw ? 1 : 0), off = met(m);
    const pc = document.getElementById("clog"), same = !!pc && pc.dataset.mid == m.id;
    const ps = same ? pc.scrollTop : null, pn = same ? +pc.dataset.n : 0;
    const pl0 = document.getElementById("qpl"), pls = pl0 ? pl0.scrollTop : 0;
    const sh = $("#sheet");
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
    const qHtml = qs ? card("circle-help", "Questions", "", `<div class="qq">${qs}</div>`, "qqc") : "";

    sh.innerHTML =
      `<div class="qhead"><div class="qh1">${gch(gr(m.k))}<span class="qtitle">${tp[1]}</span><span class="qacts">${(window.Rooms && Rooms.shareBtnHtml) ? Rooms.shareBtnHtml(m) : ""}<button class="qdsp" onclick="openD(${m.id})">Dispatch</button></span></div>` +
      `<div class="qh2"><span class="qcad">${cadOf(m)}</span>${statusPill(m)}<span class="qrw">Reward £${fmt(rw)}</span>${wk(m) ? `<span id="qrem" class="qrem">${remT(m)}</span>` : ""}</div></div>` +
      `<div class="qinfo"><div class="qi qi-loc"><small>Location</small><b>${m.adc ? m.loc : "Unknown"}</b></div><div class="qi"><small>Caller</small><b>${m.ph}</b></div><div class="qi"><small>Pinged location</small><b>${m.adr && m.adr.t ? m.adr.t : "Unknown"} <span class="qmono">${m.la.toFixed(4)}, ${m.lo.toFixed(4)}</span></b></div><div class="qadr ${m.adc ? "ok" : "no"}">${m.adc ? lci("circle-check", 13) + " Address confirmed" : lci("triangle-alert", 13) + " Ask for the address before dispatching"}</div></div>` +
      `<div class="qgrid"><div class="qc qc1">` +
      card("message-square", "Call transcript", m.qa.length * 2 + 2, `<div class="clog${off ? " clog-off" : ""}${n > 6 ? " clog-long" : ""}" id="clog" data-mid="${m.id}" data-n="${n}">${transcript}</div>`, "qtr") +
      qHtml +
      (m.ccdone && !S.un.some((u) => u.mid === m.id) ? `<div class="qwarn">${lci("triangle-alert", 14)} Awaiting units dispatch</div>` : "") +
      tdH(m) +
      `</div><div class="qc qc2">${reqCard(m)}${pickCard(m)}</div><div class="qc qc3">${respCard(m)}${radioCard(m)}</div></div>` +
      `<div class="qfix">${window.__qbar}</div>`;

    const cl = document.getElementById("clog");
    if (cl) cl.scrollTop = ps === null || n > pn ? cl.scrollHeight : ps;
    const pl = document.getElementById("qpl");
    if (pl) pl.scrollTop = pls;
  };
})();
