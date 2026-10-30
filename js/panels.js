function declineQ(id){const m=mm(id);if(!m||m.ans)return;log("❌ 999 call declined");S.ms=S.ms.filter(x=>x!==m);const e=$("#toast");if(e&&!e.hidden){clearTimeout(tt);e.hidden=true}dirty=true}
function hideCT(id){const e=$("#toast");if(e&&e.dataset.cm==String(id)){clearTimeout(tt);clearInterval(window._ctI);e.hidden=true;delete e.dataset.cm}}
function openQ(id){const m=mm(id);if(!m)return;si=0;curM=id;if(!m.ans){m.ans=1;m.born=now();log("☎ 999 call answered");dirty=true}hideCT(id);$("#modal").hidden=false;drawQ()}
function drawQ(){const m=mm(curM);if(!m){closeM();return}const tp=T[m.k],n=1+2*m.qa.length+(m.hw?1:0),off=met(m),pc=document.getElementById("clog"),same=!!pc&&pc.dataset.mid==m.id,ps=same?pc.scrollTop:null,pn=same?+pc.dataset.n:0;$("#sheet").dataset.qk=qk(m);
$("#sheet").innerHTML=`<div class="row"><div class="t" style="font-size:17px">${gch(gr(m.k))} ${tp[1]}</div><button onclick="openD(${m.id})" style="padding:9px 16px;font-size:15px;flex:none">Dispatch units</button></div><div class="mu">${cadOf(m)}</div><div class="mu">${locT(m)}</div>${wk(m)?`<div id="qrem" style="margin-top:6px;font-weight:700;font-variant-numeric:tabular-nums">${remT(m)}</div>`:""}<div class="mu" style="margin-top:4px">${lci("phone")} Caller: <b>${m.ph}</b></div><div class="mu">${lci("satellite-dish")} Pinged call location: ${m.adr&&m.adr.t?m.adr.t:"Unknown"} (${m.la.toFixed(4)}, ${m.lo.toFixed(4)})</div>${tdH(m)}<div class="clog${off?" clog-off":""}${n>6?" clog-long":""}" id="clog" data-mid="${m.id}" data-n="${n}"><div class="msg c" style="margin-top:8px">“999, which service?” — ${SV[tp[0]]}. ${tp[2]}</div>`+
m.qa.map(x=>`<div class="msg d">${x[0]}</div><div class="msg c">${x[1]}</div>`).join("")+(m.hw?`<div class="msg d">Help is on the way.</div>`:"")+"</div>"+
`<div class="mu" style="margin:8px 0">${m.adc?lci("circle-check",0,"#16a34a")+" Address confirmed":lci("triangle-alert",0,"#f59e0b")+" Ask “What’s the address of the emergency?” before dispatching."}</div>${S.un.some(u=>u.mid===m.id&&need(shown(m),u))?"":`<div style="margin-top:12px;padding-top:10px;border-top:2px solid var(--bd)"><div class="t" style="font-size:15px">${lci("circle-help")} Questions</div><div class="mu" style="margin:4px 0">Ask a question:</div></div><div>${QS.map((q,i)=>(q[2]&&q[2]!==tp[0])||(q[3]&&q[3]!==tp[1])?"":`<button class="s g" style="margin:2px" ${m.qa.some(x=>x[0]===q[0])?"disabled":""} onclick="ask(${i})">${q[0]}</button>`).join("")}</div>`}<div style="margin-top:14px;padding-top:10px;border-top:2px solid var(--bd)"><div class="t" style="font-size:15px">${lci("clipboard-list")} Vehicle Requirements</div><div style="margin-top:4px">${reqChips(m)}</div></div>${dispH(m)}
${(()=>{const cu=S.un.filter(u=>u.mid===m.id&&u.st==="scene");return cu.length?`<div style="margin-top:14px;padding-top:10px;border-top:2px solid var(--bd)"><div class="uch"><div class="t">${lci("map-pin")} On scene (${cu.length})</div>${cu.length>1?`<button class="s ucb" onclick="cancelU(0,1,'scene')">Cancel all</button>`:""}</div>${cu.map(u=>`<div class="ucl"><div class="ui"><b>${u.cs}</b> ${U[u.ty][1]}<div class="us"><span class="st ${u.st}">${lci("map-pin")} On scene</span><span>${stn(u.sid).name}</span></div></div><button class="s ucb" onclick="cancelU(${u.id})">Cancel</button></div>`).join("")}</div>`:""})()}${radH(m)}`;const cl=document.getElementById("clog");if(cl&&cl.classList.contains("clog-long"))cl.scrollTop=(ps===null||n>pn)?cl.scrollHeight:ps}
const canC=u=>u.st==="out"||u.st==="scene";
function cancelU(id,all,st){const m=mm(curM);if(!m)return;const us=S.un.filter(u=>u.mid===m.id&&canC(u)&&(!st||u.st===st)&&(all||u.id===id));if(!us.length)return;
if(all&&!confirm("Cancel all "+us.length+" unit"+(us.length>1?"s":"")+" on this call?"))return;
us.forEach((u,i)=>{log("📻 Control → "+u.cs+": “"+u.cs+", stand down, cancelled on "+T[m.k][1]+". Return to "+stn(u.sid).name+".”",1,m.id);const sn=stn(u.sid).name;u.half=0;leg(u,upos(u),stp(u),"back");u.mid=0;setTimeout(()=>log("📻 "+u.cs+": “Received, "+u.cs+" cancelled, returning to "+sn+".”",1,m.id),1200+i*900)});
if(!S.un.some(u=>u.mid===m.id))m.hw=0;dirty=true;persist();drawQ();paint();sync()}
function bsrClear(){const l=$("#bsl");if(l&&l.firstChild)l.textContent="";const i=$("#bsi");if(i&&i.value)i.value=""}
function bsrMsg(t){const l=$("#bsl");l.textContent="";const d=document.createElement("div");d.className="n";d.textContent=t;l.appendChild(d)}
async function bsrGo(q){q=q.trim();if(!q)return;bsrMsg("Searching…");const j=await J("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q="+encodeURIComponent(q),9000);
if(!j){bsrMsg("Search failed. Check your connection and try again.");return}if(!j.length){bsrMsg("No results found. Try a fuller address or a postcode.");return}
const l=$("#bsl");l.textContent="";j.forEach(r=>{const d=document.createElement("div");d.innerHTML=lci("map-pin")+" "+esc(r.display_name);d.onclick=()=>{const la=+r.lat,lo=+r.lon;map.setView([la,lo],16);if(bm||mv){bpSet(la,lo,16);$("#bsl").textContent=""}if(!(bm||mv))bsrClear()};l.appendChild(d)})}
$("#bsf").onsubmit=e=>{e.preventDefault();bsrGo($("#bsi").value)};
['click','dblclick','mousedown','touchstart','wheel'].forEach(ev=>$("#bsr").addEventListener(ev,e=>e.stopPropagation()));
function ask(i){const m=mm(curM);m.qa.push([QS[i][0],QS[i][1](m)]);if(!m.adc&&m.qa.some(x=>x[0]===QS[0][0])){m.adc=1;log("📍 Address taken: "+m.loc)}dirty=true;drawQ()}
function openD(id){const m0=mm(id);if(!m0)return;if(!m0.adc){toast("Ask for the address of the emergency before dispatching.");openQ(id);return}si=0;curM=id;sel=new Set();$("#modal").hidden=false;if(!m0.ans)m0.ans=1;hideCT(id);drawD()}
function drawD(){const m=mm(curM);if(!m){closeM();return}const tp=T[m.k],nd=shown(m);$("#sheet").dataset.qk="";
const us=S.un.filter(free).sort((a,b)=>need(nd,b)-need(nd,a)||eta(a,m)-eta(b,m));
$("#sheet").innerHTML=`<div class="t" style="font-size:17px">${gch(gr(m.k))} ${tp[1]}</div><div class="mu">${locT(m)}</div><div>${chips(m)}</div><div class="row" style="margin-top:10px"><button class="g" onclick="openQ(${m.id})">Back</button><button class="g" onclick="auto()">Auto</button><button onclick="go()" ${sel.size?"":"disabled"}>Send ${sel.size}</button></div><div class="mu" style="margin:10px 0 4px">Available &amp; returning units (${us.length}). ★ = needed.</div>`+
(us.length?lim(us,"du"+m.id,u=>`<label class="ur"><input type="checkbox" ${sel.has(u.id)?"checked":""} onchange="tg(${u.id})"><span style="flex:1"><b>${u.cs}</b> ${U[u.ty][1]}<br><span class="mu">${u.st==="back"?lci("undo-2")+" Returning to ":""}${stn(u.sid).name}${u.tr.length?" · "+lci("graduation-cap")+" "+u.tr.map(k=>TR[k][0]).join(", "):""}</span></span><span class="mu">${Math.round(km(upos(u),mp(m)))} km · ~${Math.ceil(eta(u,m)/60)} min${need(nd,u)?" ★":""}</span></label>`,"xpD"):`<div class="mu">No units free right now.</div>`)}
const tg=id=>{sel.has(id)?sel.delete(id):sel.add(id);drawD()};
function auto(){const m=mm(curM);sel=new Set();const nd={...shown(m)};for(const k in nd)nd[k]-=asg(m,k);S.un.filter(free).sort((a,b)=>eta(a,m)-eta(b,m)).forEach(u=>{const q=Object.keys(nd).filter(k=>nd[k]>0&&has(u,k));if(q.length){q.forEach(k=>nd[k]--);sel.add(u.id)}});drawD()}
function go(){const m=mm(curM);if(m){sel.forEach(id=>{const u=S.un.find(x=>x.id===id);if(u&&free(u))send(u,m)});if(sel.size){m.hw=1}if(sel.size>1)setTimeout(()=>log("📻 Control → all units on "+T[m.k][1]+": "+sel.size+" units assigned. Update on arrival.",1,m.id),3500)}closeM();persist()}
let upop=0;
function openU(id){upop=upop===id?0:id;sync()}

/* ===== vehicle info popup ===== */
let uiId=0;
function closeUI(){uiId=0;const o=$("#uiov");if(o)o.remove()}
function openUI(id){uiId=id;drawUI()}
function drawUI(){const u=S.un.find(x=>x.id===uiId);if(!u){closeUI();return}
let ov=$("#uiov");if(!ov){ov=document.createElement("div");ov.id="uiov";ov.style.cssText="position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px";ov.onclick=e=>{if(e.target===ov)closeUI()};document.body.appendChild(ov)}
const sv=U[u.ty][0],sn=stn(u.sid),m=u.mid&&mm(u.mid),resp=!!m;
let mi=(u.km||0);if(u.rt&&u.t0&&(u.st==="out"||u.st==="back"||u.st==="hosp"))mi+=Math.min(Math.max(0,dd(u)),u.rt.len);mi*=0.621371;
const r=(a,b)=>`<div class="u"><span>${a}</span><b style="text-align:right">${b}</b></div>`;
const edu=(u.tr&&u.tr.length)?lci("graduation-cap")+" "+u.tr.map(k=>TR[k][0]).join(", "):"No special training";
ov.innerHTML=`<div style="width:100%;max-width:400px;background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:14px;padding:18px"><div class="row"><span class="t" style="font-size:18px">${u.cs}</span><button class="cx" aria-label="Close" onclick="closeUI()">${lci("x",16)}</button></div><div class="mu" style="margin-bottom:6px">${U[u.ty][1]} · ${SV[sv]}</div>`
+r("Home station",sn?`<span class="ulk" onclick="closeUI();openS(${sn.id})">${sn.name}</span>`:"—")
+r("Status",`<span class="st ${stc(u)}">${SLU(u)}</span>`)
+(resp?r("Current mission",`<span class="ulk" onclick="closeUI();openQ(${m.id})">${T[m.k][1]}</span>`)+(m.loc?r("Mission location",m.loc):""):r("Current mission","None"))
+r("Jobs dispatched to (lifetime)",Math.max(u.dsp||0,u.jobs||0))
+(sv==="a"?r("Patients conveyed to hospital (lifetime)",u.pc||0):"")
+r("Crew",crewTag(u,1)+" (min "+minC(u)+")")+r("Education",edu)
+r("Approx. miles driven (lifetime)","~"+Math.round(mi).toLocaleString())
+`<button class="s g" style="margin-top:10px;width:100%" onclick="closeUI();goU('${u.cs.replace(/'/g,"\\'")}')">${lci("map-pin")} Show on map</button><button class="s g" style="margin-top:8px;width:100%" onclick="closeUI();openT(${u.id})">${lci("hard-hat")} Crew &amp; training</button>`
+(u.st==="idle"?`<button class="s" style="margin-top:8px;width:100%;background:${u.oos?"#16a34a":"#1f2937"};color:#fff;border:1px solid ${u.oos?"#16a34a":"#ef4444"}" onclick="setOOS(${u.id},${u.oos?0:1})">${u.oos?lci("circle-check")+" Set available":lci("ban")+" Set out of service"}</button>`:"")+(u.st==="idle"?`<div style="display:flex;gap:8px;margin-top:8px"><button class="s" style="flex:1;background:#0f766e" onclick="mvU(${u.id})">${lci("map-pin")} Move</button><button class="s" style="flex:1;background:#b42318" onclick="delUC(${u.id})">${lci("trash-2")} Delete</button></div>`:`<div class="mu" style="margin-top:8px;font-size:12px">A vehicle must be back at its station and available before it can be moved or deleted.</div>`)
+`</div>`}
setInterval(()=>{if(uiId)drawUI()},1000);
/* ===== move / delete a vehicle ===== */
const VREF_MIN=15000,VREF_PCT=.4,vRefund=ty=>U[ty][2]>=VREF_MIN?Math.round(U[ty][2]*VREF_PCT):0,bayUsed=sid=>S.un.filter(x=>x.sid===sid).length;
function ovl(html){const w=document.createElement("div");w.style.cssText="position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px";w.innerHTML=html;w.onclick=e=>{if(e.target===w)w.remove()};document.body.appendChild(w);return w}
/* Move: pick a destination station. Same station type + at least one free bay required. */
function mvU(id){const u=S.un.find(x=>x.id===id);if(!u)return;if(u.st!=="idle"){toast(u.cs+" must be back at its station before it can be moved.");return}
const o=stn(u.sid);if(!o)return;const from=stp(u);
const L=S.st.filter(s=>s.id!==o.id&&s.sv===o.sv).map(s=>{const full=bayUsed(s.id)>=cap(s),why=full?"No free bays":vehReason(s,u.ty);return{s,why,d:km(from,[s.lat,s.lon])*0.621371}}).sort((a,b)=>(!!a.why-!!b.why)||a.d-b.d);
const rows=L.length?L.map(({s,why,d})=>`<button class="mvs" data-sid="${s.id}" ${why?"disabled":""} style="display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;margin-top:6px;text-align:left;background:var(--bd);color:var(--tx);border-left:4px solid ${SC[s.sv]||"var(--bd)"}"><span><b>${esc(s.name)}</b><br><span class="mu" style="font-size:12px">${why?'<span style="color:#dc2626">'+esc(why)+"</span>":(cap(s)-bayUsed(s.id))+" of "+cap(s)+" bays free"}</span></span><span class="mu" style="white-space:nowrap">${d.toFixed(1)} mi</span></button>`).join(""):`<div class="mu" style="margin-top:8px">You have no other ${esc(SN[o.sv]||"station")}s to move this vehicle to.</div>`;
const w=ovl(`<div style="width:100%;max-width:400px;max-height:85vh;overflow:auto;background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:14px;padding:18px"><div style="font-size:18px;font-weight:700">Move ${esc(u.cs)}</div><div class="mu" style="margin:4px 0 6px">${esc(U[u.ty][1])} · currently at ${esc(o.name)}. Choose a ${esc(SN[o.sv]||"station")} with a free bay:</div>${rows}<button class="g" id="mvx" style="width:100%;margin-top:12px">Cancel</button></div>`);
w.querySelector("#mvx").onclick=()=>w.remove();
w.querySelectorAll(".mvs:not([disabled])").forEach(b=>b.onclick=()=>{const sid=+b.dataset.sid,d=stn(sid);w.remove();if(!d)return;const mi=km(from,[d.lat,d.lon])*0.621371;confirmDlg("Move vehicle","Move <b>"+esc(u.cs)+"</b> from <b>"+esc(o.name)+"</b> to <b>"+esc(d.name)+"</b>?<br><span style=\"font-size:13px\">It will drive there (about "+mi.toFixed(1)+" miles) and its bay at "+esc(d.name)+" is reserved straight away.</span>","Move",()=>mvUGo(id,sid),"#0f766e")})}
function mvUGo(id,sid){const u=S.un.find(x=>x.id===id),d=stn(sid);if(!u||!d)return;
if(u.st!=="idle"){toast(u.cs+" must be back at its station before it can be moved.");return}
const o=stn(u.sid);if(!o||o.id===d.id)return;
if(d.sv!==o.sv){toast("A vehicle can only move to a station of the same type.");return}
if(bayUsed(d.id)>=cap(d)){toast(d.name+" has no free bays.");return}
const why=vehReason(d,u.ty);if(why){toast(why);return}
const from=stp(u);u.sid=d.id;u.mid=0;leg(u,from,[d.lat,d.lon],"back");u.rl=1;
log("🚚 "+u.cs+" "+U[u.ty][1]+" relocating from "+o.name+" to "+d.name+".");toast(u.cs+" is heading to "+d.name+".");
closeUI();persist();$("#v").dataset.n="";$("#v").dataset.k="";paint();if(si)drawS();sync()}
/* Delete: frees the bay. Vehicles that cost £15,000+ get a 40% refund. */
function delUC(id){const u=S.un.find(x=>x.id===id);if(!u)return;if(u.st!=="idle"){toast(u.cs+" must be back at its station before it can be deleted.");return}
const r=vRefund(u.ty),c=U[u.ty][2],sn=stn(u.sid);
confirmDlg("Delete vehicle?","Delete <b>"+esc(u.cs)+"</b> ("+esc(U[u.ty][1])+")"+(sn?" from <b>"+esc(sn.name)+"</b>":"")+"? This frees up its bay and cannot be undone.<br><br>"+(r?"Purchase price £"+fmt(c)+" — you will be refunded <b>£"+fmt(r)+"</b> (40%).":"Purchase price £"+fmt(c)+" — vehicles under £"+fmt(VREF_MIN)+" are <b>not refunded</b>."),r?"Delete & refund £"+fmt(r):"Delete vehicle",()=>delU(id))}
function delU(id){const u=S.un.find(x=>x.id===id);if(!u||u.st!=="idle")return;
const r=vRefund(u.ty),sn=stn(u.sid);S.un=S.un.filter(x=>x.id!==id);if(r){S.cr+=r}ldg("de","Deleted "+u.cs+" "+U[u.ty][1],r);
if(upop===id)upop=0;closeUI();
log("🗑 "+u.cs+" "+U[u.ty][1]+" deleted"+(sn?" from "+sn.name+" (bay freed)":"")+(r?". Refund £"+fmt(r)+".":". No refund."));toast(u.cs+" deleted."+(r?" £"+fmt(r)+" refunded.":""));
persist();$("#v").dataset.n="";$("#v").dataset.k="";paint();if(si)drawS();sync()}
function closeM(){si=0;hi=0;mnOpen="";$("#sheet").dataset.qk="";$("#modal").hidden=true;$("#v").dataset.k="";paint()}
function confirmDlg(title,msg,yes,cb,col){const w=document.createElement("div");w.style.cssText="position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px";w.innerHTML='<div style="width:100%;max-width:380px;background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:14px;padding:18px"><div style="font-size:18px;font-weight:700;margin-bottom:8px">'+title+'</div><div style="color:var(--mu);line-height:1.5">'+msg+'</div><button id="cdy" style="width:100%;margin-top:14px;background:'+(col||"#b42318")+'">'+yes+'</button><button id="cdn" class="g" style="width:100%;margin-top:8px">Cancel</button></div>';document.body.appendChild(w);$("#cdn").onclick=()=>w.remove();$("#cdy").onclick=()=>{w.remove();cb()}}
function resetG(){const w="This will wipe all data and reset your account fresh. All stations and vehicles will be lost and no refunds will be given for building purchases.";confirmDlg(lci("triangle-alert",0,"#f59e0b")+" Are you sure?",w,"Yes, continue",()=>confirmDlg(lci("triangle-alert",0,"#f59e0b")+" Really sure?",w+"<br><br><b>This cannot be undone.</b>","Yes, wipe everything",()=>{S=fresh();IMGS={};imgSave();persist();const ao=$("#acct");if(ao)ao.remove();paint()}))}
