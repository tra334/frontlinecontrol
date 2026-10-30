const GC=["","#dc2626","#f97316","#eab308","#64748b"],GO={"Burglary in progress":2,"Domestic disturbance":2,"Drink driver":2,"Missing child":1,"House fire":1,"Armed robbery":1,"Fatal collision":1,"Stolen vehicle pursuit":2,"Chemical spill":1,"Person in river":1,"Mental health crisis":2,"Suspicious death":2,"Car fire":3,"Welfare check":3};
const gr=k=>{const t=T[k],c=/^Cat (\d)/.exec(t[1]);return c?+c[1]:GO[t[1]]||(t[5]>=2000?1:t[5]>=1000?2:t[5]>=450?3:4)},gch=g=>`<span class="gd" style="background:${GC[g]};color:${g===3?"#000":"#fff"}">G${g}</span>`;
const locT=m=>m.adc?lci("map-pin")+" "+m.loc:lci("map-pin")+" Address not taken yet"+(m.adr&&m.adr.t?" – near "+m.adr.t:"");
const RING=45000,TIMEOUT=1500000,KEY="ukdispatch_v2";
const rateMs=()=>Math.round(R(30,150)*1000);
let S,tab="m",si=0,dirty=false,lastSave=0,dbDoc=null,sel=new Set(),curM=0,bm=null,mv=null,bpin=null,bll=null,bpTok=0,VB={x:0,y:0,w:460},pts=new Map(),tt=0;
let SIMOFF=0;const $=s=>document.querySelector(s),now=()=>Date.now()+SIMOFF,R=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)],fmt=n=>n.toLocaleString("en-GB");
const P=(la,lo)=>[(lo+11)*34.44,(61-la)*60],mrg=(a,b)=>{const o={...a};for(const k in b)o[k]=(o[k]||0)+b[k];return o};
function pip(lat,lon,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)c=!c}return c}
const land=(la,lo)=>LANDS.some(g=>pip(la,lo,g));const OUTMSG="Frontline Control is based in the UK & Ireland. Please select a new location on the map.";
const km=(a,b)=>{const dy=(a[0]-b[0])*111,dx=(a[1]-b[1])*111*Math.cos(a[0]*Math.PI/180);return Math.hypot(dx,dy)};
const near=(la,lo)=>CITY.reduce((b,c)=>km([la,lo],[c[1],c[2]])<km([la,lo],[b[1],b[2]])?c:b)[0];
const rank=()=>{let r=0;RK.forEach((x,i)=>{if(S.done>=x[1])r=i});return r};
function fresh(){return{cr:1000000,done:0,nid:1,fb:{aa:0,ph:0},gf:{aa:0,ph:0},ts:now(),sf:[],sn:0,rq:1,next:now()+rateMs(),lg:[{t:now(),m:"Welcome, controller. You have £1,000,000. Open the Stations tab and build your first station on the map.",r:0}],ms:[],st:[],hs:[],un:[],rate:2,rcl:0,dr:{last:"",day:0}}}
var EXP=new Set(),hi=0,hTab=0;
const mb=(n,k,xp,w)=>`<div style="margin:6px 0 10px"><button class="g s" onclick="${xp}('${k}')">Show ${n} more${w||""}</button></div>`;
const lim=(a,k,fn,xp)=>{const ex=EXP.has(k);return (ex?a:a.slice(0,10)).map(fn).join("")+(!ex&&a.length>10?mb(a.length-10,k,xp):"")};
function xpQ(k){const e=$("#sheet"),t=e.scrollTop;EXP.add(k);drawQ();e.scrollTop=t}
function xpD(k){const e=$("#sheet"),t=e.scrollTop;EXP.add(k);drawD();e.scrollTop=t}
function xpS(k){EXP.add(k);$("#v").dataset.n="";paint()}
function ldg(k,n,e){S.jl=(S.jl||[]).filter(x=>x.t>now()-6048e5).slice(-499);S.jl.push({t:now(),k,n,e,b:S.cr})}
function log(m,r,mid){const pb=S.lg.length?S.lg[0].b:undefined,e={t:now(),m,r:r?1:0,b:S.cr};if(!r&&((pb!==undefined&&pb!==S.cr)||/^(🚧|🏗|🗑)/.test(m)))e.c=1;if(r&&mid&&/^📻 Control → all units on/.test(m))e.u=S.un.filter(u=>u.mid===mid).map(u=>u.cs);S.lg.unshift(e);S.lg=S.lg.slice(0,200);if(r&&mid){const q=S.ms.find(x=>x.id===mid);if(q){(q.rd=q.rd||[]).push({t:e.t,m});if(q.rd.length>40)q.rd.shift()}}dirty=true}
function toast(m){const e=$("#toast");delete e.dataset.cm;e.innerHTML=lci("radio")+" "+emi(esc(m));const x=document.createElement("button");x.className="tx";x.setAttribute("aria-label","Dismiss");x.innerHTML=lci("x");x.onclick=ev=>{ev.stopPropagation();clearTimeout(tt);e.hidden=true};e.appendChild(x);e.hidden=false;clearTimeout(tt);tt=setTimeout(()=>e.hidden=true,6000)}
var pm=null;
const SET_KEY="ukdispatch_settings";
function getSet(){try{return Object.assign({radioPop:true,nearHosp:true,dbgInd:true,iconStyle:"emoji",mapStyle:"osm"},JSON.parse(localStorage.getItem(SET_KEY))||{})}catch(e){return{radioPop:true,nearHosp:true,dbgInd:true,iconStyle:"emoji",mapStyle:"osm"}}}
/* ===== building icons: emoji / letter / custom image (custom images live in this browser only) ===== */
const IMG_KEY="ukdispatch_bldimg",ICO={f:["🚒","F",lci("flame")],p:["🚓","P",lci("siren")],a:["🚑","A",lci("ambulance")],h:["🏥","H",lci("hospital")],aa:["🚁","AA",lci("ambulance")],ph:["🚁","PH",lci("helicopter")],pn:["⛓️","J",lci("columns-4")]},icoIdx=()=>{const s=getSet().iconStyle;return s==="letter"?1:s==="lucide"?2:0};
let IMGS={};try{IMGS=JSON.parse(localStorage.getItem(IMG_KEY))||{}}catch(e){IMGS={}}
const imgSave=()=>{try{localStorage.setItem(IMG_KEY,JSON.stringify(IMGS));return true}catch(e){return false}};
const bKey=(k,id)=>k+id;
/* k: "s" station or "h" hospital, b: building, returns inner html for the icon badge */
function bIco(k,b){const c=IMGS[bKey(k,b.id)];if(c)return '<img src="'+c+'" alt="" draggable="false" style="display:block;width:100%;height:100%;object-fit:cover;border-radius:7px">';const t=k==="h"?(b.ty==="pn"?"pn":"h"):b.sv;return ICO[t][icoIdx()]}
function bBadge(k,b,n){const bg=k==="h"?(b.ty==="pn"?"#475569":"#0369a1"):SC[b.sv],c=IMGS[bKey(k,b.id)],l=getSet().iconStyle==="letter";return '<span style="display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:'+n+'px;height:'+n+'px;border-radius:'+Math.round(n/3)+'px;background:'+bg+';color:#fff;font:700 '+Math.round(n*.55)+'px/1 system-ui;margin-right:6px;overflow:hidden;flex:none">'+bIco(k,b)+'</span>'}
function pickIcon(k,id){const inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=()=>{const f=inp.files&&inp.files[0];if(!f)return;if(!/^image\//.test(f.type)){toast("Please choose an image file.");return}const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{try{const n=96,cv=document.createElement("canvas");cv.width=cv.height=n;const x=cv.getContext("2d"),m=Math.min(im.width,im.height),sx=(im.width-m)/2,sy=(im.height-m)/2;x.drawImage(im,sx,sy,m,m,0,0,n,n);IMGS[bKey(k,id)]=cv.toDataURL("image/png");if(!imgSave()){delete IMGS[bKey(k,id)];toast("Couldn't save that icon – this browser's storage is full.")}else toast("Custom icon saved on this device only.")}catch(e){toast("Couldn't use that image.")}URL.revokeObjectURL(u);iconRefresh()};im.onerror=()=>{URL.revokeObjectURL(u);toast("Couldn't read that image.")};im.src=u};inp.click()}
function clearIcon(k,id){delete IMGS[bKey(k,id)];imgSave();iconRefresh()}
function iconRefresh(){try{sync()}catch(e){}try{if(si){$("#v").dataset.n="";drawS()}}catch(e){}try{paint()}catch(e){}const so=$("#setov");if(so&&so._draw)so._draw()}
function pruneImgs(){let ch=0;for(const key in IMGS){const k=key[0],id=+key.slice(1),ok=k==="s"?S.st.some(x=>x.id===id):S.hs.some(x=>x.id===id);if(!ok){delete IMGS[key];ch=1}}if(ch)imgSave()}
const icoBtns=(k,b)=>'<button class="s g" onclick="pickIcon(\''+k+'\','+b.id+')">'+lci("image")+' Icon</button> '+(IMGS[bKey(k,b.id)]?'<button class="s g" onclick="clearIcon(\''+k+'\','+b.id+')">'+lci("undo-2")+' Reset icon</button> ':'');
function setSet(k,v){const o=getSet();o[k]=v;try{localStorage.setItem(SET_KEY,JSON.stringify(o))}catch(e){}}
function rtoast(m){if(getSet().radioPop)toast(m)}
function ctoast(m){if(!getSet().radioPop)return;const e=$("#toast");e.textContent="";e.dataset.cm=m.id;const h=document.createElement("div");h.style.cssText="font-weight:700;display:flex;align-items:center;gap:8px";const ht=document.createElement("span");ht.innerHTML=lci("radio")+" Incoming 999 call";const cd=document.createElement("span");cd.style.cssText="font:700 12px system-ui;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.18);font-variant-numeric:tabular-nums";const upd=()=>{cd.textContent=""+Math.max(0,Math.ceil((RING-(now()-m.born))/1000))+"s"};upd();h.append(ht,cd);clearInterval(window._ctI);window._ctI=setInterval(()=>{if(e.hidden||m.ans||!S.ms.includes(m)){clearInterval(window._ctI);return}upd()},500);const l=document.createElement("div");l.style.cssText="margin-top:4px;font-size:13px;opacity:.9";l.innerHTML=lci("satellite-dish")+" Pinged location: "+esc(m.loc||(m.la.toFixed(4)+", "+m.lo.toFixed(4)));const p=document.createElement("div");p.style.cssText="margin-top:2px;font-size:13px;opacity:.9";p.innerHTML=lci("phone")+" Caller: "+esc(m.ph);const bt=document.createElement("button");bt.innerHTML=lci("phone")+" Answer";bt.style.cssText="margin-top:8px;background:#16a34a;color:#fff;border:0;border-radius:8px;padding:8px 16px;font:700 14px system-ui;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,.35)";bt.onclick=ev=>{ev.stopPropagation();clearTimeout(tt);e.hidden=true;openQ(m.id)};const x=document.createElement("button");x.className="tx";x.setAttribute("aria-label","Dismiss");x.innerHTML=lci("x");x.onclick=ev=>{ev.stopPropagation();clearTimeout(tt);e.hidden=true};const dc=document.createElement("button");dc.innerHTML=lci("circle-x")+" Decline";dc.style.cssText="margin-top:8px;background:#dc2626;color:#fff;border:0;border-radius:8px;padding:8px 16px;font:700 14px system-ui;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,.35)";dc.onclick=ev=>{ev.stopPropagation();declineQ(m.id)};const br=document.createElement("div");br.style.cssText="display:flex;gap:8px;flex-wrap:wrap";br.append(bt,dc);e.append(h,l,p,br,x);e.hidden=false;clearTimeout(tt);tt=setTimeout(()=>e.hidden=true,10000)}
const stn=id=>S.st.find(s=>s.id===id),mm=id=>S.ms.find(m=>m.id===id);
const stp=u=>{const s=stn(u.sid);return[s.lat,s.lon]},mp=m=>[m.la,m.lo];
function load(){try{return JSON.parse(localStorage.getItem(curKey))}catch(e){return null}}
/* ---- OFFLINE CATCH-UP (conservative) ---- */
const AWAY_MIN=120000,AWAY_CAP=108e5,AWAY_EVERY=720000,AWAY_MAXJOBS=6,AWAY_PAY=.4,AWAY_KEEP=.5,AWAY_SIM=216e5,AWAY_STEP=10000;
function seenBeat(){try{localStorage.setItem(curKey+"_seen",String(Date.now()))}catch(e){}}
addEventListener("pagehide",seenBeat);addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")seenBeat()});
/* replay units/missions through the elapsed time on a virtual clock (no network, no new spawns, no repaint) */
function fixRt(){S.un.forEach(u=>{if((u.st==="out"||u.st==="back"||u.st==="hosp")&&!u.rt&&u.a&&u.b){const k=km(u.a,u.b);u.lk=(u.lk||0)+1;u.rt={p:[u.a,u.b],d:[0,+k.toFixed(3)],len:Math.max(.001,k*(SP[u.ty]>=150?1:1.3))};u.t0=now();dirty=true}})}
function simAway(from){const T0=Date.now(),pz0=S.pz,st0=window.setTimeout,pa0=paint,ls0=lastSave;
S.pz=1;window._sim=1;lastSave=1e18;window.setTimeout=(f)=>{if(typeof f==="function"){try{f()}catch(e){}}return 0};paint=function(){};
try{for(let v=from+AWAY_STEP;;v+=AWAY_STEP){const vv=Math.min(v,T0);SIMOFF=vv-Date.now();fixRt();tick();if(vv>=T0)break}}
finally{SIMOFF=0;window._sim=0;window.setTimeout=st0;paint=pa0;S.pz=pz0;lastSave=ls0;fixRt();dirty=true;try{paint();sync()}catch(e){}}}
function catchUp(){let seen=0;try{seen=+localStorage.getItem(curKey+"_seen")||0}catch(e){}
const t=now(),last=Math.max(+S.ts||0,seen);seenBeat();
if(!last||S.pz)return;let away=t-last;if(!(away>AWAY_MIN))return;away=Math.min(away,AWAY_CAP);
const r0=rank();
/* 1) anything that finished while away is paid at a reduced rate */
const c0=S.cr;simAway(Math.max(last,t-AWAY_SIM));const g1=S.cr-c0;let cut=0;if(g1>0){cut=Math.floor(g1*(1-AWAY_KEEP));S.cr-=cut;if(cut>0)ldg("sp","Offline earnings reduction",-cut)}
/* 2) a few simulated extra jobs, slow rate, reduced pay, capped */
let jobs=0,g2=0;
if(S.st.length&&S.un.length){const rk=rank(),svs=new Set(S.st.map(s=>s.sv));
const pool=T.filter(tp=>Object.entries(tp[3]).every(([k,n])=>kr(k)<=rk&&svs.has(ks(k,tp))&&S.un.filter(u=>has(u,k)&&!u.oos).length>=n));
if(pool.length){jobs=Math.min(AWAY_MAXJOBS,Math.floor(away/AWAY_EVERY));
for(let i=0;i<jobs;i++){const tp=pick(pool),e=Math.floor(tp[5]*AWAY_PAY);g2+=e;S.done++;S.jl=(S.jl||[]).filter(x=>x.t>t-6048e5).slice(-499);S.jl.push({t:t,k:"j",n:tp[1],e:e,b:S.cr+g2})}
S.cr+=g2}}
if(g1>0||jobs){const mins=Math.round(away/60000),net=(g1-cut)+g2;
log("⏳ While you were away (~"+mins+" min): "+jobs+" extra job"+(jobs===1?"":"s")+" handled. Offline earnings reduced – net +£"+fmt(net)+".");
toast("Welcome back – offline earnings +£"+fmt(net)+" (reduced rate)");
if(rank()>r0)log("🎖 Promoted to "+RK[rank()][0]+"! New vehicles unlocked. Claim your £50,000 bonus in the Ranks tab.",1);
persist()}}
function persist(){S.ts=now();try{localStorage.setItem(curKey,JSON.stringify(S))}catch(e){}dirty=false;lastSave=now();cloudDirty=true}
