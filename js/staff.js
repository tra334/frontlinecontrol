/* ===== STAFF =====
   Every station has staff. Vehicles need a minimum crew before they can be dispatched.
   Crew members hold courses (the existing TR list); a vehicle's training (u.tr) is the union of its base
   training (u.bt, e.g. Hazmat unit) and the courses held by its assigned crew.
   S.sf = [{id,n,sid,uid,tr:[],tq:{k,end}|null}]   S.sn = next staff id */
// realistic minimum crew per vehicle type
const MINC={pump:4,rt:4,wc:2,alp:3,icu:3,fo:1,wf:2,hmu:3,usar:5,
irv:2,van:2,rp:2,dog:1,arv:2,sgt:1,mc:1,cid:2,po:4,hel:3,
dca:2,rrv:1,ao:1,bike:1,hart:3,ccc:2,air:3,mci:2};
const NEWREQ={icu:["incident"],mci:["incident"],cid:["detective"],hel:["aviation"]};
const STC=1000,SFREE=2,TRMS=300000,SPB={f:4,p:3,a:3},SFIX={aa:24,ph:24},ALLC=new Set(["afo","tpac"]);
const minCk=k=>MINC[k]||1,minC=u=>minCk(u.ty),maxC=u=>{const m=minC(u);return m+(m>=3?2:1)};
const sgrp=s=>s.sv==="aa"?"a":s.sv==="ph"?"p":s.sv;
const stCap=s=>SFIX[s.sv]||cap(s)*(SPB[s.sv]||3);
const sfAt=sid=>(S.sf||[]).filter(x=>x.sid===sid),sfCrew=u=>(S.sf||[]).filter(x=>x.uid===u.id);
/* required training per vehicle = its U[..][5] list. How many of the minimum crew must hold each course: everyone for AFO / tactical pursuit, otherwise half (at least one). */
const reqOf=u=>U[u.ty][5]||[],needN=(k,m)=>ALLC.has(k)?m:Math.max(1,Math.ceil(m/2));
const trN=(u,k)=>sfCrew(u).filter(x=>x.tr.includes(k)).length;
const reqMiss=u=>reqOf(u).filter(k=>!(u.bt||[]).includes(k)&&trN(u,k)<needN(k,minC(u)));
const crewed=u=>!S.sf||(sfCrew(u).length>=minC(u)&&!reqMiss(u).length);
const crewDesc=k=>{const r=U[k][5]||[];return lci("hard-hat",12)+" Min crew: "+minCk(k)+(r.length?" · Includes trained crew ("+r.map(x=>TR[x][0]).join(", ")+")":"")};
const sfName=sid=>{const used=new Set(sfAt(sid).map(x=>x.n));let n="";for(let i=0;i<12;i++){n=pick(FN)+" "+pick(LN);if(!used.has(n))break}return n};
const mmss=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
const crewTag=(u,l)=>{if(!S.sf)return"";const n=sfCrew(u).length,m=minC(u),ok=crewed(u),ms=reqMiss(u);return `<span style="${ok?"":"color:#dc2626;font-weight:600"}">${lci("hard-hat",12)} ${l?"":"Crew "}${n}/${m}${ok?"":n<m?" – needs crew":" – needs "+ms.map(k=>TR[k][0]).join(", ")+" trained crew"}</span>`};
function recomputeTr(u){const t=(u.bt||[]).slice();sfCrew(u).forEach(x=>x.tr.forEach(k=>{if(!t.includes(k))t.push(k)}));u.tr=t}
const mkStaff=(sid,uid,tr)=>{const x={id:S.sn=(S.sn||0)+1,n:sfName(sid),sid,uid:uid||0,tr:tr||[],tq:null};S.sf.push(x);return x};
function hire(sid,n){for(let i=0;i<n;i++)mkStaff(sid)}
function autoCrew(u){let n=0;const need=minC(u)-sfCrew(u).length;if(need<=0||u.st!=="idle")return 0;
sfAt(u.sid).filter(x=>!x.uid&&!x.tq).sort((a,b)=>reqOf(u).filter(k=>b.tr.includes(k)).length-reqOf(u).filter(k=>a.tr.includes(k)).length||b.tr.length-a.tr.length).slice(0,need).forEach(x=>{x.uid=u.id;n++});recomputeTr(u);return n}
function autoCrewStn(sid){let n=0;S.un.filter(u=>u.sid===sid).forEach(u=>{n+=autoCrew(u)});return n}
/* ---- one-off migration for saves from before staffing: crew every vehicle, refund bought training, grandfather it as free trained crew ---- */
function staffMigrate(){if(S.sf)return;S.sf=[];S.sn=0;let refund=0,crewN=0,trained=0,vs=0;
S.un.forEach(u=>{if(!stn(u.sid))return;const base=(U[u.ty][5]||[]).filter(k=>!(NEWREQ[u.ty]||[]).includes(k)),bought=(u.tr||[]).filter(k=>TR[k]&&!base.includes(k));u.bt=base;
const m=minC(u),cr=[];for(let i=0;i<m;i++)cr.push(mkStaff(u.sid,u.id));crewN+=m;
bought.forEach(k=>{refund+=TR[k][1];const c=ALLC.has(k)?m:Math.max(1,Math.ceil(m/2));cr.slice(0,c).forEach(x=>{if(!x.tr.includes(k)){x.tr.push(k);trained++}})});if(bought.length)vs++;recomputeTr(u)});
if(refund){S.cr+=refund;ldg("rf","Training refund (staffing update)",refund)}
log("👥 Staffing update: "+crewN+" crew members assigned to your "+S.un.length+" vehicles."+(refund?" Vehicle training on "+vs+" vehicle"+(vs>1?"s":"")+" has been refunded (£"+fmt(refund)+") and converted into "+trained+" free qualified crew members.":""));
if(refund||crewN)setTimeout(()=>toast("Staffing added: all vehicles crewed."+(refund?" Training refunded £"+fmt(refund)+".":"")),2500)}
/* ---- legacy vehicles (bought before crews came trained): they keep working on their old built-in training (u.bt) until the owner claims free trained staff in Ranks ---- */
function legacyReq(){if(S.rq)return;S.rq=1;S.un.forEach(u=>{u.bt=(u.bt||[]).slice();reqOf(u).forEach(k=>{if(!u.bt.includes(k)&&trN(u,k)<needN(k,minC(u)))u.bt.push(k)})})}
const claimable=()=>S.un.filter(u=>(u.bt||[]).length&&stn(u.sid));
function claimStaff(){const L=claimable();if(!L.length)return;let added=0,trained=0;
L.forEach(u=>{const m=minC(u);while(sfCrew(u).length<m){mkStaff(u.sid,u.id);added++}
reqOf(u).forEach(k=>{const need=needN(k,m);let have=trN(u,k);sfCrew(u).forEach(x=>{if(have<need&&!x.tr.includes(k)){x.tr.push(k);have++;trained++}})});u.bt=[];recomputeTr(u)});
log("🎓 Claimed free trained staff: "+L.length+" vehicle"+(L.length>1?"s":"")+" crewed ("+added+" new staff, "+trained+" qualifications).");toast("Free trained staff claimed and assigned to "+L.length+" vehicle"+(L.length>1?"s":"")+".");persist();$("#v").dataset.n="";paint();if(si)drawS();drawSF()}
const claimH=()=>{const L=claimable();return L.length?`<div class="card" style="border-left:4px solid #16a34a"><div class="t">${lci("gift",16,"#16a34a")} Free trained staff ready</div><div class="mu" style="margin:4px 0 8px">${L.length} of your vehicles (${L.slice(0,6).map(u=>esc(u.cs)).join(", ")}${L.length>6?"…":""}) were bought before crews came trained. Claim to get their minimum crew, already qualified in the training each vehicle needs, assigned to them for free.</div><button class="s" style="background:#16a34a" onclick="claimStaff()">Claim free trained staff</button></div>`:""};
let sfPop=0;const claimPop=()=>{const L=claimable();if(!L.length)return;confirmDlg(lci("gift",0,"#16a34a")+" Claim free trained staff","You have <b>"+L.length+"</b> vehicle"+(L.length>1?"s":"")+" from before the staffing update. Claim to receive their minimum crew, already trained in the courses each needs, and have them assigned automatically. It's free.","Claim free trained staff",claimStaff,"#16a34a")};
try{document.querySelector('nav [data-t="r"]').addEventListener("click",()=>{if(!sfPop&&S&&S.sf&&claimable().length){sfPop=1;setTimeout(claimPop,80)}})}catch(e){}
/* ---- per-tick upkeep ---- */
function staffTick(){if(!S||!S.sf)return;let ch=0;const t=now();
const uids=new Set(S.un.map(u=>u.id)),sids=new Set(S.st.map(s=>s.id));
if(S.sf.some(x=>!sids.has(x.sid))){S.sf=S.sf.filter(x=>sids.has(x.sid));ch=1}
S.sf.forEach(x=>{if(x.uid){const u=S.un.find(v=>v.id===x.uid);if(!u){x.uid=0;ch=1}else if(u.sid!==x.sid){x.sid=u.sid;ch=1}}
if(x.tq&&x.tq.end<=t){const k=x.tq.k;x.tq=null;if(!x.tr.includes(k))x.tr.push(k);const u=x.uid&&S.un.find(v=>v.id===x.uid);if(u)recomputeTr(u);log("🎓 "+x.n+" qualified: "+TR[k][0]);ch=1}});
const td=ymd(new Date());let gain=0;
S.st.forEach(s=>{if(s.sd===td)return;s.sd=td;const room=Math.max(0,stCap(s)-sfAt(s.id).length),n=Math.min(SFREE,room);if(n>0){hire(s.id,n);gain+=n;log("👥 "+n+" new staff joined "+s.name+" (daily recruits).")}ch=1});
if(gain)try{toast("Daily recruits: "+gain+" free staff joined your stations.")}catch(e){}
if(ch){dirty=true;try{if(si&&!$("#modal").hidden)drawS()}catch(e){}if(sfv)drawSF()}}
{const _t=tick;tick=function(){try{staffTick()}catch(e){console.error(e)}return _t.apply(this,arguments)}}
/* new vehicles: remember purchased base training and crew them from spare staff */
{const wrap=f=>function(){const ids=new Set(S.un.map(u=>u.id)),r=f.apply(this,arguments);let ch=0;S.un.forEach(u=>{if(!ids.has(u.id)){u.bt=[];const m=minC(u),sx=Math.min(m,window._spX||0),lst=[];
if(sx>0){(window._spIds?sfAt(u.sid).filter(x=>!x.uid&&!x.tq&&window._spIds.includes(x.id)):sfAt(u.sid).filter(x=>!x.uid&&!x.tq).sort((a,b)=>reqOf(u).filter(k=>b.tr.includes(k)).length-reqOf(u).filter(k=>a.tr.includes(k)).length)).slice(0,sx).forEach(x=>{x.uid=u.id;lst.push(x)})}
for(let i=lst.length;i<m;i++)lst.push(mkStaff(u.sid,u.id));
reqOf(u).forEach(k=>{const need=needN(k,m);let have=lst.filter(x=>x.tr.includes(k)).length;lst.forEach(x=>{if(have<need&&!x.tr.includes(k)){x.tr.push(k);have++}})});recomputeTr(u);ch=1;
log("👥 "+u.cs+" arrived with "+m+" trained crew"+(sx>0?" ("+Math.min(sx,lst.length)+" from your spare staff)":"")+(reqOf(u).length?" ("+reqOf(u).map(k=>TR[k][0]).join(", ")+")":"")+".")}});if(ch){persist();$("#v").dataset.n="";paint();if(si)drawS()}return r};buy=wrap(buy);buyT=wrap(buyT)}
openT=function(id){openCrew(id)};
/* ---- cheaper purchase using spare staff: x of the minimum crew come from unassigned staff at that station (they get the training free) ---- */
const vehOnly=k=>{const m=minCk(k),r=(U[k][5]||[]).length;return Math.round(U[k][2]/(1+.03*m+.02*r)/100)*100};
const priceX=(k,x)=>{const m=minCk(k),f=U[k][2],sh=(f-vehOnly(k))/m;return Math.round((f-x*sh)/100)*100};
const spareN=sid=>sfAt(sid).filter(x=>!x.uid&&!x.tq).length;
const spareLink=(s,k,lk,why)=>{const sp=spareN(s.id);if(lk||why||sp<1||!(U[k][5]||[]).length||!accepts(s).includes(k))return"";const x=Math.min(sp,minCk(k));return `<button class="s g" style="white-space:normal;text-align:center;font-size:12px;line-height:1.25" ${S.cr<priceX(k,x)?"disabled":""} onclick="spareDlg(${s.id},'${k}')">${lci("hard-hat",12)} Cheaper: crew it with your spare staff · £${fmt(priceX(k,x))}</button>`};
function spareDlg(sid,k){const s=stn(sid),rq=U[k][5]||[],mx=Math.min(spareN(sid),minCk(k));if(!s||mx<1||!rq.length)return;
const pool=sfAt(sid).filter(x=>!x.uid&&!x.tq).sort((p,q)=>rq.filter(c=>q.tr.includes(c)).length-rq.filter(c=>p.tr.includes(c)).length);
window.spSel=new Set(pool.slice(0,mx).map(x=>x.id));
const upd=()=>{const n=window.spSel.size,e=$("#spp");if(e)e.textContent=n?"£"+fmt(priceX(k,n))+" (saves £"+fmt(U[k][2]-priceX(k,n))+")":"Select at least one staff member";const c=$("#spn");if(c)c.textContent=n+" of "+mx+" selected"};
window._spTog=el=>{const id=+el.dataset.id;if(el.checked){if(window.spSel.size>=mx){el.checked=false;toast("This vehicle only needs "+mx+" crew from your spare staff.");return}window.spSel.add(id)}else window.spSel.delete(id);upd()};
const rows=pool.map(x=>'<label style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--bd)"><input type="checkbox" data-id="'+x.id+'" '+(window.spSel.has(x.id)?"checked":"")+' onchange="_spTog(this)"><span><b>'+esc(x.n)+'</b><br><span style="font-size:12px">'+(x.tr.length?x.tr.map(c=>TR[c][0]).join(", "):"No courses yet")+'</span></span></label>').join("");
confirmDlg("Crew it with your spare staff","<b>"+U[k][1]+"</b> at "+esc(s.name)+" needs "+rq.map(x=>TR[x][0]).join(" and ")+" training. Pick which of your unassigned staff here should crew it (up to "+mx+"). They'll be put on this vehicle and trained for free. Any of its "+minCk(k)+" crew you don't pick are hired new and trained.<div style=\"max-height:220px;overflow:auto;margin:10px 0 6px\">"+rows+"</div><span id=\"spn\">"+window.spSel.size+" of "+mx+" selected</span><br>Price: <b id=\"spp\">£"+fmt(priceX(k,window.spSel.size))+" (saves £"+fmt(U[k][2]-priceX(k,window.spSel.size))+")</b>","Purchase",()=>spareGo(sid,k,[...window.spSel]),"#16a34a")}
function spareGo(sid,k,ids){const s=stn(sid);if(!s)return;const ok=new Set(sfAt(sid).filter(x=>!x.uid&&!x.tq).map(x=>x.id));ids=ids.filter(id=>ok.has(id)).slice(0,minCk(k));if(!ids.length){toast("Select at least one spare staff member.");return}
const p=priceX(k,ids.length),full=U[k][2],n0=S.un.length;if(S.cr<p){toast("Not enough credits.");return}
U[k][2]=p;window._spIds=ids;window._spX=ids.length;try{buy(sid,k)}finally{U[k][2]=full;window._spX=0;window._spIds=null}if(S.un.length===n0)toast("Couldn't buy that vehicle here (no free bay or locked).")}
/* ---- UI ---- */
let sfv=null;
function sfOpen(v){sfv=v;drawSF()}
function sfClose(){sfv=null;const o=$("#sfov");if(o)o.remove()}
function openSf(sid){sfOpen({m:"stn",id:sid})}
function openCrew(uid){sfOpen({m:"veh",id:uid})}
function sfRef(){persist();$("#v").dataset.n="";paint();if(si)drawS();drawSF()}
const sfStat=x=>{const u=x.uid&&S.un.find(v=>v.id===x.uid);return x.tq?`<span class="mu">${lci("hourglass",12)} Training ${TR[x.tq.k][0]} · <span data-end="${x.tq.end}">${mmss(x.tq.end-now())}</span></span>`:u?`<span class="mu">${lci("car-front",12)} ${esc(u.cs)} · ${U[u.ty][1]}</span>`:`<span class="mu">Unassigned</span>`};
function sfRow(x,ctx){const u=x.uid&&S.un.find(v=>v.id===x.uid),lockedV=u&&u.st!=="idle",g=S.st.find(s=>s.id===x.sid),
q=x.tr.length?x.tr.map(k=>TR[k][0]).join(", "):"No courses";
let act=`<button class="s g" onclick="sfCourse(${x.id})" ${x.tq?"disabled":""}>${lci("graduation-cap",14)} Train</button>`;
if(u)act+=` <button class="s g" onclick="sfAsg(${x.id},0)" ${lockedV?"disabled":""}>Unassign</button>`;
else if(!x.tq){if(ctx==="veh"){const v=S.un.find(w=>w.id===sfv.id);act+=` <button class="s" onclick="sfAsg(${x.id},${v.id})" ${v.st!=="idle"||sfCrew(v).length>=maxC(v)?"disabled":""}>Assign</button>`}else{const L=S.un.filter(v=>v.sid===x.sid&&v.st==="idle"&&sfCrew(v).length<maxC(v));act+=` <select onchange="sfAsg(${x.id},+this.value)" style="max-width:130px"><option value="0">Assign to…</option>${L.map(v=>`<option value="${v.id}">${esc(v.cs)} (${sfCrew(v).length}/${minC(v)})</option>`).join("")}</select>`}act+=` <button class="s g" title="Release" onclick="sfFire(${x.id})">${lci("trash-2",14)}</button>`}
return `<div class="u" style="align-items:flex-start;gap:8px"><span style="min-width:0"><b>${esc(x.n)}</b><br>${sfStat(x)}<br><span class="mu" style="font-size:12px">${lci("graduation-cap",12)} ${q}</span></span><span style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex:none">${act}</span></div>`}
function stnH(sid){const s=stn(sid);if(!s)return"";const L=sfAt(sid),cp=stCap(s),room=Math.max(0,cp-L.length),us=S.un.filter(u=>u.sid===sid),short=us.filter(u=>!crewed(u));
return `<div class="row"><span class="t" style="font-size:18px">${lci("hard-hat")} Staff · ${esc(s.name)}</span><button class="cx" aria-label="Close" onclick="sfClose()">${lci("x",16)}</button></div>`
+`<div class="mu" style="margin:4px 0 8px">${L.length}/${cp} staff · ${L.filter(x=>x.uid).length} on vehicles · ${L.filter(x=>!x.uid&&!x.tq).length} spare · ${L.filter(x=>x.tq).length} in training. Capacity grows with each station upgrade. This station gets ${SFREE} free recruits every day.</div>`
+`<div class="card" style="border-left-width:1px;margin:0 0 8px"><div class="t" style="font-size:14px">Recruit staff · £${fmt(STC)} each</div><div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap"><input id="sfq" type="number" min="1" max="${room}" value="${Math.min(1,room)||0}" ${room?"":"disabled"} oninput="sfQ(${sid})" style="width:80px;padding:8px;border-radius:8px;border:1px solid var(--bd);background:var(--bg);color:var(--tx);font:inherit"><button class="s" id="sfb" onclick="sfBuy(${sid})" ${room?"":"disabled"}>Recruit</button><span class="mu" id="sfc">${room?"£"+fmt(STC)+" · room for "+room:"Station is full – upgrade it for more room"}</span></div></div>`
+`<button class="s g" style="width:100%;margin-bottom:8px" onclick="sfAuto(${sid})">${lci("users"in LI?"users":"user",14)} Auto-assign spare staff to vehicles${short.length?" ("+short.length+" need crew)":""}</button>`
+(L.length?L.slice().sort((a,b)=>(b.uid?1:0)-(a.uid?1:0)||a.n.localeCompare(b.n)).map(x=>sfRow(x,"stn")).join(""):`<div class="mu">No staff yet.</div>`)}
function vehH(uid){const u=S.un.find(x=>x.id===uid);if(!u)return"";const c=sfCrew(u),s=stn(u.sid),sp=sfAt(u.sid).filter(x=>!x.uid&&!x.tq);
return `<div class="row"><span class="t" style="font-size:18px">${esc(u.cs)} · Crew</span><button class="cx" aria-label="Close" onclick="sfClose()">${lci("x",16)}</button></div>`
+`<div class="mu" style="margin:4px 0 6px">${U[u.ty][1]} · ${s?esc(s.name):""}<br>Minimum crew <b>${minC(u)}</b> · seats <b>${maxC(u)}</b> · ${crewTag(u)}${reqOf(u).length?"<br>Requires: "+reqOf(u).map(k=>needN(k,minC(u))+"× "+TR[k][0]).join(", ")+" trained crew"+((u.bt||[]).length?" (legacy – claim free trained staff in Ranks)":""):""}<br>${lci("graduation-cap",12)} ${u.tr.length?u.tr.map(k=>TR[k][0]).join(", "):"No special training"}</div>`
+(u.st!=="idle"?`<div class="mu" style="color:#b45309;margin-bottom:6px">Crew can only be changed while the vehicle is idle at its station (training can still be bought).</div>`:`<button class="s g" style="width:100%;margin-bottom:8px" onclick="sfAutoV(${u.id})">Auto-fill from spare staff</button>`)
+`<div class="vl">Assigned crew</div>`+(c.length?c.map(x=>sfRow(x,"veh")).join(""):`<div class="mu">Nobody assigned.</div>`)
+`<div class="vl" style="margin-top:10px">Spare staff at ${s?esc(s.name):"station"}</div>`+(sp.length?sp.map(x=>sfRow(x,"veh")).join(""):`<div class="mu">No spare staff – recruit more from the station's Staff panel.</div>`)
+`<button class="s g" style="width:100%;margin-top:10px" onclick="sfClose();openSf(${u.sid})">Open station staff</button>`}
function courseH(xid){const x=(S.sf||[]).find(v=>v.id===xid);if(!x)return"";const s=stn(x.sid),g=s?sgrp(s):"",u=x.uid&&S.un.find(v=>v.id===x.uid),L=Object.entries(TR).filter(([k,v])=>v[3].includes(g));
return `<div class="row"><span class="t" style="font-size:18px">${lci("graduation-cap")} ${esc(x.n)}</span><button class="cx" aria-label="Close" onclick="sfClose()">${lci("x",16)}</button></div>`
+`<div class="mu" style="margin:4px 0 8px">Pay the course fee for instant qualification, or train for free in 5 minutes${u?" (they'll come off "+esc(u.cs)+" while training)":""}. One course at a time.</div>`
+L.map(([k,v])=>{const own=x.tr.includes(k),lk=v[2]>rank(),busy=!!x.tq,fl=u&&u.st!=="idle";return `<div class="u"><span>${v[0]}<br><span class="mu">${own?"Qualified":lk?lci("lock")+" Unlocks at "+RK[v[2]][0]:x.tq&&x.tq.k===k?"In training…":"Fee £"+fmt(v[1])+" or 5 min free"}</span></span>${own?'<span class="st idle">Qualified</span>':lk?`<button class="s g" disabled>${lci("lock")}</button>`:`<span style="display:flex;flex-direction:column;gap:4px"><button class="s" ${busy||S.cr<v[1]?"disabled":""} onclick="sfTrain(${x.id},'${k}',0)">£${fmt(v[1])}</button><button class="s g" ${busy||fl?"disabled":""} onclick="sfTrain(${x.id},'${k}',1)">Free · 5 min</button></span>`}</div>`}).join("")
+`<button class="s g" style="width:100%;margin-top:10px" onclick="sfv=sfv.back||null;drawSF()">Back</button>`}
function drawSF(){if(!sfv){const o=$("#sfov");if(o)o.remove();return}
if(sfv.m==="stn"&&!stn(sfv.id)||sfv.m==="veh"&&!S.un.find(u=>u.id===sfv.id)){sfClose();return}
let ov=$("#sfov");if(!ov){ov=document.createElement("div");ov.id="sfov";ov.style.cssText="position:fixed;inset:0;z-index:99993;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px";ov.onclick=e=>{if(e.target===ov)sfClose()};document.body.appendChild(ov)}
const old=ov.firstElementChild,sc=old?old.scrollTop:0,qv=$("#sfq")?$("#sfq").value:null,body=sfv.m==="crs"?courseH(sfv.id):sfv.m==="veh"?vehH(sfv.id):stnH(sfv.id);
ov.innerHTML=`<div style="width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:14px;padding:18px">${body}</div>`;
ov.firstElementChild.scrollTop=sc;if(qv!==null&&$("#sfq")){$("#sfq").value=qv;try{sfQ(sfv.id)}catch(e){}}}
setInterval(()=>{document.querySelectorAll("#sfov [data-end]").forEach(e=>{e.textContent=mmss(+e.dataset.end-now())})},1000);
function sfCourse(xid){sfv={m:"crs",id:xid,back:sfv.m==="crs"?sfv.back:sfv};drawSF()}
function sfAsg(xid,uid){const x=S.sf.find(v=>v.id===xid);if(!x||x.tq)return;const cur=x.uid&&S.un.find(v=>v.id===x.uid);if(cur&&cur.st!=="idle"){toast(cur.cs+" must be at its station to change crew.");return}
if(!uid){x.uid=0;if(cur)recomputeTr(cur)}else{const u=S.un.find(v=>v.id===uid);if(!u||u.st!=="idle"||u.sid!==x.sid){toast("That vehicle can't take crew right now.");return}if(sfCrew(u).length>=maxC(u)){toast(u.cs+" is full ("+maxC(u)+" seats).");return}x.uid=u.id;recomputeTr(u)}sfRef()}
function sfFire(xid){const x=S.sf.find(v=>v.id===xid);if(!x||x.uid||x.tq)return;confirmDlg("Release staff member?","Release <b>"+esc(x.n)+"</b>? They leave the service (no refund) and free up staff capacity.","Release",()=>{S.sf=S.sf.filter(v=>v.id!==xid);log("👥 "+x.n+" left the service.");sfRef()})}
function sfAuto(sid){const n=autoCrewStn(sid);toast(n?n+" staff assigned to vehicles.":"No vehicles need crew, or no spare staff.");sfRef()}
function sfAutoV(uid){const u=S.un.find(v=>v.id===uid);if(!u)return;const n=autoCrew(u);toast(n?n+" staff assigned to "+u.cs+".":"No spare staff available.");sfRef()}
function sfQ(sid){const s=stn(sid),i=$("#sfq"),c=$("#sfc");if(!s||!i||!c)return;const room=Math.max(0,stCap(s)-sfAt(sid).length);let n=Math.floor(+i.value||0);n=Math.max(0,Math.min(room,n));c.textContent=n+" × £"+fmt(STC)+" = £"+fmt(n*STC)+" · room for "+room;const b=$("#sfb");if(b)b.disabled=!n||S.cr<n*STC}
function sfBuy(sid){const s=stn(sid),i=$("#sfq");if(!s||!i)return;const room=Math.max(0,stCap(s)-sfAt(sid).length);let n=Math.floor(+i.value||0);n=Math.max(0,Math.min(room,n));if(!n){toast("Enter how many staff to recruit.");return}const c=n*STC;if(S.cr<c){toast("Not enough credits.");return}
confirmDlg("Recruit staff","Recruit <b>"+n+"</b> staff member"+(n>1?"s":"")+" at <b>"+esc(s.name)+"</b> for <b>£"+fmt(c)+"</b>?<br><span style=\"font-size:13px\">Balance after: £"+fmt(S.cr-c)+"</span>","Recruit",()=>{if(S.cr<c||sfAt(sid).length+n>stCap(s))return;S.cr-=c;ldg("sp","Recruited "+n+" staff – "+s.name,-c);hire(sid,n);log("👥 Recruited "+n+" staff at "+s.name+" (£"+fmt(c)+").");sfRef()},"#16a34a")}
function sfTrain(xid,k,free){const x=S.sf.find(v=>v.id===xid);if(!x||x.tq||x.tr.includes(k)||!TR[k]||TR[k][2]>rank())return;const f=TR[k][1];
if(free){const u=x.uid&&S.un.find(v=>v.id===x.uid);if(u&&u.st!=="idle"){toast(u.cs+" must be at its station.");return}if(u){x.uid=0;recomputeTr(u)}x.tq={k,end:now()+TRMS};log("🎓 "+x.n+" started "+TR[k][0]+" training (5 min).");if(sfv)sfv=sfv.back||sfv;sfRef();return}
if(S.cr<f)return;confirmDlg("Confirm purchase","Pay <b>£"+fmt(f)+"</b> for <b>"+esc(x.n)+"</b> to qualify in <b>"+TR[k][0]+"</b> immediately?<br><span style=\"font-size:13px\">Balance after purchase: £"+fmt(S.cr-f)+"</span>","Purchase",()=>{if(S.cr<f||x.tr.includes(k))return;S.cr-=f;ldg("sp","Training: "+x.n+" – "+TR[k][0],-f);x.tr.push(k);const u=x.uid&&S.un.find(v=>v.id===x.uid);if(u)recomputeTr(u);log("🎓 "+x.n+" qualified: "+TR[k][0]);if(sfv)sfv=sfv.back||sfv;sfRef()},"#16a34a")}
/* station sheet block */
const staffH=s=>{const L=sfAt(s.id),cp=stCap(s),short=S.un.filter(u=>u.sid===s.id&&!crewed(u)).length;return `<div style="margin-top:10px" class="card"><div class="row"><span class="t" style="font-size:14px">${lci("hard-hat",16)} Staff ${L.length}/${cp}</span><span class="mu">${L.filter(x=>x.uid).length} on vehicles · ${L.filter(x=>!x.uid&&!x.tq).length} spare</span></div>${short?`<div class="mu" style="color:#dc2626;margin-top:4px">${short} vehicle${short>1?"s":""} below minimum crew – can't be dispatched.</div>`:""}<div style="display:flex;gap:8px;margin-top:8px"><button class="s" style="flex:1" onclick="openSf(${s.id})">Manage staff</button><button class="s g" style="flex:1" onclick="sfAuto(${s.id})">Auto-assign</button></div><div class="mu" style="font-size:12px;margin-top:6px">+${SFREE} free recruits daily · upgrades add staff room</div></div>`};

/* ---- station card: Buy vehicles + Manage staff side by side, vehicles grouped into categories ---- */
const CATS={f:[["Frontline",["pump","rt","wc","alp"]],["Command & officers",["icu","fo"]],["Specialist",["wf","hmu","usar"]]],
p:[["Response",["irv","van","sgt","mc","rp"]],["Specialist",["dog","arv","cid","po"]]],
a:[["Emergency",["dca","rrv","bike","ao"]],["Specialist",["hart","ccc","mci"]]],aa:[["Air ambulance & critical care",["air","ccc"]]],ph:[["Helicopters",["hel"]]]};
const BC={};function bcSet(id,i){BC[id]=i;$("#v").dataset.n="";$("#v").dataset.k="";paint();if(si)redrawP()}
const staffBar=(s,free,open)=>{const L=sfAt(s.id),cp=stCap(s),sp=L.filter(x=>!x.uid&&!x.tq).length,short=S.un.filter(u=>u.sid===s.id&&!crewed(u)).length,bs="flex:1;flex-direction:column;align-items:flex-start;gap:2px;margin-top:0;min-width:0";
return `<div style="display:flex;gap:8px;margin-top:14px"><button class="bvh" style="${bs}${open?";border-color:var(--a)":""}" onclick="bvT(${s.id})" aria-expanded="${open}"><span>${lci("plus")} Buy vehicles</span><span class="mu">${free>0?free+" bay"+(free>1?"s":"")+" free":"No free bays"} <span class="bvc${open?" o":""}">${lci("chevron-right",14)}</span></span></button><button class="bvh" style="${bs}" onclick="openSf(${s.id})"><span>${lci("hard-hat")} Manage staff</span><span class="mu">${L.length}/${cp} · ${sp} spare</span></button></div>`+(short?`<div class="mu" style="color:#dc2626;margin:6px 2px 0">${short} vehicle${short>1?"s":""} below minimum crew – can't be dispatched.</div>`:"")};
