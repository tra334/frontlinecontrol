/* ===== Frontline Control: Control Room (EASY mode only) =====
   Operators sit at desks, pick up unanswered 999 calls and run the question script for you.
   The call is then "awaiting dispatch" and you send units exactly as normal.
   HARD mode (chosen at start-up): no operators at all - you answer, question and dispatch yourself.

   Saved in S.cc = { lv, on, ops:[{id,n,desk,calls,mid,next,rest}], ans, nid }
   Uses (does not change): QS, T, mm(), log(), hideCT(), drawQ(), cadOf(), persist(), paint() */
(function(){
"use strict";
const HIRE=1500,
 /* per level: desks, avg pickup (s), gap between questions (s), price to REACH this level, what the script adds */
 LV=[{d:2,pick:6,gap:3.2,cost:0},{d:4,pick:3,gap:2.6,cost:30000},{d:6,pick:2,gap:2.0,cost:80000},{d:8,pick:1,gap:1.5,cost:180000}];
/* every operator asks the full question set at every level; these go first when the call has them, in this order: "Is the patient breathing and conscious?" (QS 8), then "What's happened?" (QS 1) */
const FIRST=[8,1];
const easy=()=>window.FC_DIFF!=="hard";
const ready=()=>typeof S!=="undefined"&&S&&typeof gameOn!=="undefined"&&gameOn;

/* SERVER MODE: the game server owns the game. Then the server runs the operators and sends S.cc; this file only draws it and sends actions. */
const srv=()=>!!(window.SRV&&SRV.on);
function cc(){
 if(srv())return S.cc||null;
 if(!S.cc||!Array.isArray(S.cc.ops))S.cc={lv:1,on:1,ops:[],ans:0,nid:1};
 const c=S.cc;
 if(!c.ops.length&&!c.seeded){c.seeded=1;c.ops.push({id:c.nid++,n:patName(),desk:1,calls:0,mid:0,next:0,rest:0})} /* one starter operator, free */
 return c}
const lv=()=>LV[Math.min(LV.length,Math.max(1,cc().lv))-1];

/* the questions an operator asks on call m at the current level: same filter the Questions panel uses */
function script(m){
 const tp=T[m.k],out=[];
 QS.forEach((q,i)=>{
  if((q[2]&&q[2]!==tp[0])||(q[3]&&q[3]!==tp[1]))return;
  if(typeof cqShow==="function"&&!cqShow(tp,q,i))return;
  /* vehicle-reveal questions: cqShow (scenarios.js) only lets them through when the player can use a revealed unit */
  out.push(i)});
 return out.sort((a,b)=>{const pa=FIRST.indexOf(a),pb=FIRST.indexOf(b);return(pa<0?9:pa)-(pb<0?9:pb)||a-b})}
const asked=(m,i)=>m.qa.some(x=>x[0]===QS[i][0]);

/* same effect as the Ask buttons in the call window */
function opAsk(m,i){
 m.qa.push([QS[i][0],QS[i][1](m)]);
 if(!m.adc&&m.qa.some(x=>x[0]===QS[0][0])){m.adc=1;log("📍 Address taken: "+m.loc)}
 dirty=true}

const opOf=m=>cc().ops.find(o=>o.mid===m.id);
function prog(o){const m=mm(o.mid);if(!m)return[0,0];const s=script(m);return[s.filter(i=>asked(m,i)).length,s.length]}

function pickUp(o,m){
 m.ans=1;m.born=now();m.ccop=o.n;o.mid=m.id;o.next=now()+lv().gap*1000*(.8+Math.random()*.4);
 log("☎ 999 call answered by "+o.n+" (control room desk "+o.desk+")");
 try{hideCT(m.id)}catch(e){}
 dirty=true}

function finish(o,m){
 o.calls++;cc().ans++;o.mid=0;o.rest=now()+1500;o.last=now();
 if(m){m.ccdone=1;log("✅ "+o.n+" finished questioning the caller – "+T[m.k][1]+" awaiting dispatch")}
 dirty=true}

let lastKey="";
function step(){
 if(!ready()||window._sim||!easy()||srv())return;
 const c=cc(),t=now(),L=lv(),desks=L.d;
 const ops=c.ops.filter(o=>o.desk<=desks);

 /* operators already on a call: ask the next question when their timer is up */
 ops.forEach(o=>{
  if(!o.mid)return;
  const m=mm(o.mid);
  if(!m){o.mid=0;o.rest=t+1000;return}
  if(t<o.next)return;
  const nx=script(m).find(i=>!asked(m,i));
  if(nx===undefined){finish(o,m);return}
  opAsk(m,nx);o.next=t+L.gap*1000*(.8+Math.random()*.4);
  if(script(m).every(i=>asked(m,i)))o.next=t+900; /* short beat, then clear down */
  try{if(curM===m.id&&!$("#modal").hidden&&$("#sheet").dataset.qk!=="")drawQ()}catch(e){}});

 /* free operators pick up the oldest ringing call (the player can still answer first) */
 if(c.on){
  const free=ops.filter(o=>!o.mid&&t>=(o.rest||0)).sort((a,b)=>(a.last||0)-(b.last||0)||a.calls-b.calls||a.desk-b.desk); /* longest idle first, so calls rotate between desks */
  if(free.length){
   const ring=S.ms.filter(m=>!m.ans&&!m.roomId&&!m.roomOwner).sort((a,b)=>a.born-b.born);
   ring.forEach(m=>{
    if(!free.length)return;
    if(m._cp==null)m._cp=L.pick*(.8+Math.random()*.4);
    if(t-m.born<m._cp*1000)return;
    pickUp(free.shift(),m)})}}

 const k=key();if(k!==lastKey){lastKey=k;try{if(tab==="s"&&$("#modal").hidden){$("#v").dataset.n="";paint()}}catch(e){}}}

function key(){
 if(!ready()||!easy())return"off";
 const c=cc();if(!c)return"off";
 return c.lv+"."+c.on+"."+(S.cr>=HIRE?1:0)+(c.lv<LV.length&&S.cr>=LV[c.lv].cost?1:0)+"."+c.ans+"."+c.ops.map(o=>o.id+":"+o.desk+":"+o.calls+":"+(o.mid?prog(o).join("/")+"@"+o.mid:"-")).join(",")}

/* ---------- UI (top of the Stations tab) ---------- */
const esc2=s=>String(s==null?"":s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const CSS=document.createElement("style");CSS.textContent=`
.cc{border-left-color:#7c3aed}
.cc .cch{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.cc .cch b{font-size:17px}.cc .cch span{color:var(--mu);font-size:14px;white-space:nowrap}
.cc .ccs{color:var(--mu);font-size:14px;margin:6px 0 0;line-height:1.45}
.cc .ccscr{color:var(--mu);font-size:14px;margin:8px 0 0;display:flex;gap:6px;align-items:flex-start}
.cc .cca{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:12px;border:1px solid var(--bd);border-radius:12px}
.cc .cca b{display:block;font-size:16px;margin-bottom:2px}.cc .cca small{color:var(--mu);font-size:13px;line-height:1.35;display:block}
.cc .ccon{flex:none;min-width:84px;padding:12px 0;border-radius:10px;font-weight:700;font-size:15px;background:#3b5bdb;color:#fff;text-align:center}
.cc .ccon.off{background:var(--bd);color:var(--tx)}
.cc .ccg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.cc .ccd{border:1px solid var(--bd);border-radius:12px;padding:10px 12px;min-height:92px;background:var(--bg)}
.cc .ccd .dk{font-size:12px;letter-spacing:.09em;color:var(--mu);text-transform:uppercase}
.cc .ccd .nm{font-weight:700;font-size:17px;margin:2px 0 5px;overflow-wrap:anywhere}
.cc .ccd .vc{color:var(--mu);font-size:16px;margin:2px 0 8px}
.cc .ccd .pill{display:inline-block;font-size:13px;font-weight:600;padding:2px 10px;border-radius:99px;color:#fff}
.cc .ccd .pill.bz{background:#ef6a5e}.cc .ccd .pill.av{background:#3fbf6a}
.cc .ccd .sb{color:var(--mu);font-size:13px;margin-top:5px;font-variant-numeric:tabular-nums}
.cc .ccd button.hire{width:100%;background:var(--bd);color:var(--tx);padding:11px 6px;border-radius:10px;font-weight:600}
.cc .ccd button.hire:disabled{opacity:.45}
.cc .ccup{width:100%;margin-top:12px;padding:13px 10px;border-radius:12px;background:#3b5bdb;color:#fff;font-weight:700;font-size:15px}
.cc .ccup:disabled{opacity:.45}
.cc .ccmax{margin-top:12px;text-align:center;color:var(--mu);font-size:13px}`;
document.head.appendChild(CSS);

function html(){
 if(!ready()||!easy()||!cc())return"";
 const c=cc(),L=lv(),n=c.ops.filter(o=>o.desk<=L.d).length,busy=c.ops.filter(o=>o.mid&&mm(o.mid)).length,
  up=c.lv<LV.length?LV[c.lv]:null;
 let h=`<div class="card cc"><div class="cch"><b>Frontline Control Room</b><span>Level ${c.lv}/${LV.length}</span></div>
<div class="ccs">${n}/${L.d} desks staffed · ${busy} on a call · pickup ~${L.pick.toFixed(1)}s · ${c.ans} call${c.ans===1?"":"s"} answered</div>
<div class="ccscr">${lci("circle-help")}<span>Script: full question set · what happened / breathing first</span></div>
<div class="cca"><div><b>Auto-answer</b><small>${c.on?"Operators pick up unanswered calls. You can still answer first.":"Operators are idle. You answer every call yourself."}</small></div><button class="ccon${c.on?"":" off"}" onclick="ccAuto()">${c.on?"ON":"OFF"}</button></div>
<div class="ccg">`;
 for(let d=1;d<=L.d;d++){
  const o=c.ops.find(x=>x.desk===d);
  if(!o){h+=`<div class="ccd"><div class="dk">Desk ${d}</div><div class="vc">Vacant</div><button class="hire" ${S.cr<HIRE?"disabled":""} onclick="ccHire(${d})">+ Hire · £${fmt(HIRE)}</button></div>`;continue}
  const m=o.mid?mm(o.mid):null;
  if(m){const p=prog(o);h+=`<div class="ccd"><div class="dk">Desk ${d}</div><div class="nm">${esc2(o.n)}</div><span class="pill bz">On call · Q ${p[0]}/${p[1]}</span><div class="sb">${esc2(cadOf(m))}</div></div>`}
  else h+=`<div class="ccd"><div class="dk">Desk ${d}</div><div class="nm">${esc2(o.n)}</div><span class="pill av">Available</span><div class="sb">${o.calls} call${o.calls===1?"":"s"} taken</div></div>`}
 h+=`</div>`;
 h+=up?`<button class="ccup" ${S.cr<up.cost?"disabled":""} onclick="ccUpg()">🎧 Upgrade: +2 desks, faster pickup &amp; questions · £${fmt(up.cost)}</button>`
      :`<div class="ccmax">Control room fully upgraded</div>`;
 return h+`</div>`}

/* ---------- actions ---------- */
function refresh(){persist();lastKey="";try{$("#v").dataset.n="";paint()}catch(e){}}
window.ccAuto=function(){if(srv()){SRV.act({type:"cc",op:"auto"});return}const c=cc();c.on=c.on?0:1;log(c.on?"🎧 Control room auto-answer ON":"🎧 Control room auto-answer OFF");refresh()};
window.ccHire=function(d){if(srv()){SRV.act({type:"cc",op:"hire",desk:d});return}const c=cc();if(c.ops.some(o=>o.desk===d)||d>lv().d)return;
 if(S.cr<HIRE){toast("Not enough credits.");return}
 S.cr-=HIRE;const o={id:c.nid++,n:patName(),desk:d,calls:0,mid:0,next:0,rest:0};c.ops.push(o);
 ldg("sp","Control room operator hired: "+o.n,-HIRE);log("🎧 "+o.n+" hired as control room operator (desk "+d+", -£"+fmt(HIRE)+")");refresh()};
window.ccUpg=function(){const c=cc();if(c.lv>=LV.length)return;const up=LV[c.lv];
 if(S.cr<up.cost){toast("Not enough credits.");return}
 const go=()=>{if(srv()){SRV.act({type:"cc",op:"upgrade"});return}S.cr-=up.cost;c.lv++;ldg("sp","Control room upgraded to level "+c.lv,-up.cost);log("🎧 Control room upgraded to level "+c.lv+" (-£"+fmt(up.cost)+"): "+LV[c.lv-1].d+" desks, faster pickup and questioning.");toast("Control room upgraded to level "+c.lv);refresh()};
 if(window._ccNoConfirm||typeof confirmDlg!=="function"){go();return}
 confirmDlg("Upgrade control room?","Upgrade to <b>level "+(c.lv+1)+"</b> for <b>£"+fmt(up.cost)+"</b>: "+LV[c.lv].d+" desks, faster pickup and quicker questioning.","Upgrade · £"+fmt(up.cost),go,"#3b5bdb")};

/* server mode: tell the server which difficulty this session chose (it only runs operators in easy) */
let sentD=null,sentAt=0;
setInterval(()=>{try{if(srv()&&ready()&&S.cc&&window.FC_DIFF&&S.cc.diff!==window.FC_DIFF&&(sentD!==window.FC_DIFF||Date.now()-sentAt>10000)){sentD=window.FC_DIFF;sentAt=Date.now();SRV.act({type:"cc",op:"diff",v:window.FC_DIFF})}}catch(e){}},1000);

window.CC={html,key,step,easy,lv:()=>(cc()||{lv:1}).lv};
setInterval(()=>{try{step()}catch(e){console.error("control room",e)}},250);
})();
