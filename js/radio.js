/* Radio feed: filters are Radio (radio traffic only) and Events (everything that is not radio traffic). Radio = log entries starting with the radio emoji; everything else is an event. */
let radF="all",radS="all",radM=0;
const RADS=[["all","All services"],["p","Police"],["f","Fire"],["a","Ambulance"],["air","Air"],["hnd","Handovers"]];
const RADF=[["all","Radio"],["ev","Events"]];
const isRad=l=>/^📻/.test(String(l.m));
const unitSv=cs=>{const u=S.un.find(x=>x.cs===cs);return u&&U[u.ty]?U[u.ty][0]:""};
function radParse(l){
 const m=String(l.m).replace(/^📻\s*/,"");let from,to,txt,us,b=/^Control → all units on (.+?): ([\s\S]*)$/.exec(m),a=b?null:/^Control → (.+?): (“[\s\S]*)$/.exec(m);
 if(b){from="CTL";to="all units";txt=b[1]+": "+b[2];us=l.u||[]}
 else if(a){from="CTL";to=a[1];txt=a[2]}else{a=/^(.+?): (“[\s\S]*)$/.exec(m);if(a){from=a[1];to="CTL";txt=a[2]}else{from="CTL";to="";txt=m}}
 const cs=from==="CTL"?to:from,unit=S.un.some(x=>x.cs===cs)||!/^all units/i.test(cs),sv=unit?unitSv(cs):"";
 if(unit&&cs){const e=cs.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");txt=txt.replace(new RegExp("Control, "+e+",? "),"Control, ").replace(new RegExp("“"+e+", "),"“")}
 txt=txt.replace(/\bControl\b/g,"CTL");
 const lo=txt.toLowerCase();let tag="MSG";
 if(from==="CTL")tag=/stand down|cancel/.test(lo)?"CAN":/all units on/i.test(to)?"UPD":"TSK";
 else if(/available for tasking|back at/.test(lo))tag="AVL";
 else if(/received|diverting/.test(lo))tag="ACK";
 else if(/conveying/.test(lo))tag="CNV";
 else if(/from scene/.test(lo))tag="ETA";
 else if(/handed over|returning to/.test(lo))tag="HND";
 else if(/arrived|attendance|handing over/.test(lo))tag="ARR";
 return{t:l.t,us,from,to,cs,unit:unit&&!!cs,sv,txt,tag,hnd:/hand(ed|ing) over|conveying/.test(lo)};
}
const RCL=sv=>"rc-"+(sv||"x");
function radOk(r){switch(radS){case"all":return true;case"air":return r.sv==="aa"||r.sv==="ph";case"hnd":return r.hnd;case"p":return r.sv==="p"||r.sv==="ph";default:return r.sv===radS}}
const radHas=k=>{if(k==="all"||k==="hnd")return true;const has=f=>S.un.some(u=>f(unitSv(u.cs)))||S.lg.some(l=>isRad(l)&&f(radParse(l).sv));
 return k==="p"?has(v=>v==="p"||v==="ph"):k==="air"?has(v=>v==="aa"||v==="ph"):has(v=>v===k)};
function radFilt(){
 if(!radHas(radS))radS="all";
 const nm=(RADS.find(x=>x[0]===radS)||RADS[0])[1],lab=radS==="all"?"Radio":"Radio · "+nm;
 const top=`<div class="rfl"><span class="rfg${radF==="all"?" on":""}"><button class="rfb" onclick="setRadF('all')">${lab}</button><button class="rfb rfa" aria-label="Filter by service" aria-expanded="${!!radM}" onclick="togRadM()">${radM?"▴":"▾"}</button></span><button class="rfb${radF==="ev"?" on":""}" onclick="setRadF('ev')">Events</button></div>`;
 const sub=radM?`<div class="rfl rfs">${RADS.filter(([k])=>radHas(k)).map(([k,n])=>`<button class="rfb${radS===k?" on":""}" onclick="setRadS('${k}')">${n}</button>`).join("")}</div>`:"";
 return`<div class="rfw">${top}${sub}</div>`}
function radRef(){const v=$("#v");v._h=null;const r=$("#rlb");if(r)r._h=null;paint()}
function togRadM(){radM=!radM;radRef()}
function setRadS(k){radS=k;radF="all";radM=0;radRef()}
function setRadF(k){radF=k;const v=$("#v");v._h=null;const r=$("#rlb");if(r)r._h=null;paint()}
function radioH(){
 const rows=[];
 S.lg.forEach(l=>{if(!isRad(l)){rows.push({ev:1,l,t:l.t});return}
  const r=radParse(l),p=rows[rows.length-1];
  if(p&&!p.ev&&(p.from==="CTL")===(r.from==="CTL")&&p.tag===r.tag&&p.txt===r.txt&&Math.abs(p.t-r.t)<=2500&&r.unit&&p.cs!==r.cs&&p.cs){p.cs2.push(r.cs);return}
  r.cs2=[r.cs];rows.push(r)});
 const body=rows.filter(r=>radF==="ev"?r.ev:!r.ev&&radOk(r)).map(r=>{
  if(r.ev){const d=new Date(r.t);return`<div class="rx rxe"><div class="rxt"><b>${d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</b><small>:${String(d.getSeconds()).padStart(2,"0")}</small></div><div class="rxb"><div class="rxm">${logH(r.l)}${balH(r.l)}</div></div></div>`}
  const d=new Date(r.t),hm=d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),ss=":"+String(d.getSeconds()).padStart(2,"0");
  const chip=(c,sv)=>c==="CTL"?`<span class="rxc rc-ctl">CTL</span>`:`<span class="rxc ${RCL(sv)} ulk" onclick="openUC('${c.replace(/'/g,"\\'")}')">${esc(c)}</span>`;
  const us=r.cs2.slice().reverse().map(c=>chip(c,unitSv(c))).join("");
  const grp=r.us?(r.us.length?r.us.slice(0,6).map(c=>chip(c,unitSv(c))).join("")+(r.us.length>6?`<span class="rxc rc-x">+${r.us.length-6}</span>`:""):`<span class="rxc rc-ctl">ALL UNITS</span>`):"";
  const side=r.from==="CTL"?(r.us?grp:r.unit?us:`<span class="rxc rc-ctl">${esc(r.to||"ALL")}</span>`):us;
  const head=r.from==="CTL"?`${chip("CTL")}<span class="rxtx rc-ctl">TX</span><span class="rxar">›</span>${side}`:`${side}<span class="rxtx ${RCL(r.sv)}">RX</span><span class="rxar">›</span>${chip("CTL")}`;
  return`<div class="rx"><div class="rxt"><b>${hm}</b><small>${ss}</small></div><div class="rxb"><div class="rxh">${head}<span class="rxg tg-${r.tag}">${r.tag}</span></div><div class="rxm tm-${r.tag}">${linkH(esc(r.txt))}</div></div></div>`}).join("");
 return radFilt()+(body||`<div class="mu" style="padding:18px 14px">${radF==="ev"?"No events yet.":radS==="all"?"No radio traffic yet.":"No radio traffic for this service."}</div>`)}

/* click helpers: callsign -> unit info panel, station/hospital name -> its panel */
function openUC(cs){const u=S.un.find(x=>x.cs===cs);if(u)openUI(u.id)}
/* wrap callsigns, station names and hospital names in already-escaped HTML with clickable spans (text outside tags only) */
function linkH(h){
 const it=new Map();
 S.un.forEach(u=>{if(u.cs)it.set(esc(u.cs),`openUI(${u.id})`)});
 S.st.forEach(x=>{if(x.name)it.set(esc(x.name),`openS(${x.id})`)});
 S.hs.forEach(x=>{if(x.name)it.set(esc(x.name),`openH(${x.id})`)});
 if(!it.size)return h;
 const names=[...it.keys()].sort((a,b)=>b.length-a.length).map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
 const re=new RegExp("(^|[^A-Za-z0-9])("+names.join("|")+")(?![A-Za-z0-9])","g");
 let inA=0;
 return h.split(/(<[^>]+>)/).map(seg=>{
  if(seg[0]==="<"){if(/^<span[^>]*\bulk\b/.test(seg))inA++;else if(inA&&/^<\/span/.test(seg))inA--;return seg}
  if(inA)return seg;
  return seg.replace(re,(a,pre,n)=>pre+`<span class="ulk" onclick="${it.get(n)}">${n}</span>`)}).join("");
}
