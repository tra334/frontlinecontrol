/* auth screen */
// sign-in background: dark 999 control room scene, incidents rotate on every login screen
/* [grade, type, place, lat, lon, callsign, service (a/f/p), status] */
const AUTH_SCENES=[
["Manchester",[[1,"Cardiac arrest","Piccadilly Gardens",53.4810,-2.2370,"AM12","a","mobile · ETA 3 min"],[2,"Fire alarm","Arndale Centre",53.4838,-2.2390,"FP04","f","on scene"],[3,"Assault","Deansgate Locks",53.4749,-2.2490,"PR07","p","awaiting dispatch"],[1,"RTC – persons trapped","Oxford Road",53.4668,-2.2339,"FR02","f","mobile · ETA 4 min"]]],
["Leeds",[[1,"Chest pain","Leeds Station",53.7952,-1.5476,"AM08","a","mobile · ETA 4 min"],[2,"Shop fire","Trinity Leeds",53.7977,-1.5442,"FP09","f","on scene"],[3,"Disturbance","Headingley Stadium",53.8176,-1.5821,"PR12","p","awaiting dispatch"],[2,"Cyclist down","University of Leeds",53.8067,-1.5550,"AB04","a","mobile · ETA 5 min"]]],
["Birmingham",[[1,"Stabbing","Bullring",52.4776,-1.8943,"PR14","p","mobile · ETA 3 min"],[2,"Collapse","New Street Station",52.4777,-1.8985,"AM21","a","mobile · ETA 6 min"],[3,"Fire alarm","Centenary Square",52.4797,-1.9125,"FP02","f","on scene"],[2,"RTC","Digbeth",52.4757,-1.8877,"FR05","f","mobile · ETA 7 min"]]],
["London",[[1,"Cardiac arrest","Trafalgar Square",51.5080,-0.1281,"AM33","a","mobile · ETA 3 min"],[2,"Fire in building","King's Cross",51.5309,-0.1233,"FP13","f","on scene"],[1,"Person in river","Tower Bridge",51.5055,-0.0754,"PR21","p","mobile · ETA 4 min"],[3,"Theft in progress","Waterloo Station",51.5031,-0.1132,"PR07","p","awaiting dispatch"]]],
["Glasgow",[[1,"Major trauma RTC","George Square",55.8611,-4.2501,"AA01","a","on scene"],[2,"Assault in progress","Glasgow Central",55.8590,-4.2581,"PR33","p","mobile · ETA 5 min"],[3,"Fire alarm","Kelvingrove",55.8688,-4.2907,"FP02","f","mobile · ETA 7 min"],[2,"Stroke","Glasgow Cross",55.8566,-4.2446,"AM17","a","mobile · ETA 6 min"]]],
["Edinburgh",[[2,"Chest pain","Waverley Station",55.9520,-3.1900,"AM12","a","mobile · ETA 5 min"],[1,"House fire","Royal Mile",55.9495,-3.1909,"FP04","f","on scene"],[3,"Disturbance","Haymarket",55.9459,-3.2184,"PR07","p","awaiting dispatch"],[2,"Cyclist down","Holyrood",55.9526,-3.1727,"AB04","a","mobile · ETA 4 min"]]],
["Cardiff",[[1,"Cardiac arrest","Principality Stadium",51.4782,-3.1828,"AM29","a","mobile · ETA 4 min"],[3,"Burglary","Queen Street",51.4813,-3.1750,"PR07","p","awaiting dispatch"],[2,"Fire alarm – office","Cathays Park",51.4857,-3.1790,"FP02","f","on scene"],[2,"RTC","Cardiff Bay",51.4650,-3.1620,"FR02","f","mobile · ETA 6 min"]]],
["Bristol",[[1,"Childbirth","Temple Meads",51.4491,-2.5813,"AM29","a","mobile · ETA 4 min"],[2,"Fire alarm","Cabot Circus",51.4586,-2.5826,"FP02","f","on scene"],[3,"Disturbance","Stokes Croft",51.4614,-2.5890,"PR07","p","awaiting dispatch"],[1,"Person in water","Harbourside",51.4505,-2.5985,"PR14","p","mobile · ETA 3 min"]]],
["Liverpool",[[2,"Assault in progress","Lime Street",53.4075,-2.9778,"PR21","p","mobile · ETA 5 min"],[1,"Cardiac arrest","Liverpool ONE",53.4046,-2.9886,"AM12","a","mobile · ETA 3 min"],[3,"Fire alarm","Albert Dock",53.4001,-2.9918,"FP04","f","on scene"],[2,"Collapse","Pier Head",53.4064,-2.9957,"AM08","a","mobile · ETA 6 min"]]],
["Newcastle",[[1,"Stabbing","Grey's Monument",54.9738,-1.6137,"PR14","p","mobile · ETA 3 min"],[2,"Chest pain","Central Station",54.9685,-1.6174,"AM17","a","mobile · ETA 5 min"],[3,"Fire alarm","St James' Park",54.9756,-1.6217,"FP02","f","on scene"],[2,"Cyclist down","Quayside",54.9696,-1.5997,"AB04","a","mobile · ETA 5 min"]]],
["Belfast",[[2,"Domestic incident","City Hall",54.5966,-5.9302,"PR33","p","awaiting dispatch"],[1,"Cardiac arrest","Great Victoria Street",54.5948,-5.9358,"AM12","a","mobile · ETA 4 min"],[3,"Fire alarm","Titanic Quarter",54.6081,-5.9108,"FP02","f","on scene"],[2,"RTC","Queen's University",54.5849,-5.9348,"FR05","f","mobile · ETA 6 min"]]],
["Sheffield",[[1,"House fire","Bramall Lane",53.3703,-1.4709,"FP13","f","on scene"],[2,"Stroke","Sheffield Station",53.3781,-1.4620,"AM17","a","mobile · ETA 5 min"],[3,"Theft","Winter Garden",53.3790,-1.4690,"PR07","p","awaiting dispatch"],[2,"Assault","Hallam University",53.3768,-1.4663,"PR21","p","mobile · ETA 4 min"]]]];

const AUTH_PHONE='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>';
const AUTH_GC={1:"#ef4444",2:"#f97316",3:"#94a3b8"},AUTH_SC={f:"#ef4444",p:"#3b82f6",a:"#22c55e"};
let authMapObj=null;

/* a different city on every load (never the same one twice in a row) */
function authPick(){
  let last=-1,i;try{last=+localStorage.getItem("authCity")}catch(e){}
  do{i=Math.floor(Math.random()*AUTH_SCENES.length)}while(i===last&&AUTH_SCENES.length>1);
  try{localStorage.setItem("authCity",i)}catch(e){}
  return AUTH_SCENES[i];
}

function authMapOn(sc){
  authMapOff();
  if(!document.getElementById("authmap-css")){
    const st=document.createElement("style");st.id="authmap-css";
    st.textContent=
      "#authmap{position:fixed;inset:0;z-index:99998;background:#06080c}"+
      /* black tint: invert the light OSM tiles, drop the colour, darken */
      "#authmap .leaflet-tile-pane{filter:invert(1) grayscale(1) brightness(.5) contrast(1.25)}"+
      "#authmap:after{content:'';position:absolute;inset:0;z-index:500;pointer-events:none;background:radial-gradient(circle,transparent 35%,rgba(0,0,0,.6))}"+
      "#authmap .ac{background:none;border:0}"+
      ".aci{position:relative;width:30px;height:30px;border-radius:50%;background:var(--c);color:#fff;display:grid;place-items:center;box-shadow:0 0 14px var(--c)}"+
      ".aci:before,.aci:after{content:'';position:absolute;inset:0;border-radius:50%;border:2px solid var(--c);animation:acp 2.2s ease-out infinite;animation-delay:var(--d)}"+
      ".aci:after{animation-delay:calc(var(--d) + 1.1s)}"+
      ".acl{position:absolute;left:38px;top:5px;white-space:nowrap;padding:2px 8px;border-radius:4px;background:rgba(5,9,18,.85);border:1px solid #17233d;color:#eef1f8;font:500 11px system-ui}"+
      "@keyframes acp{from{transform:scale(1);opacity:.9}to{transform:scale(2.8);opacity:0}}"+
      "@media(prefers-reduced-motion:reduce){.aci:before,.aci:after{animation:none}}"+
      "@media(max-width:700px){.acl{display:none}}"+
      /* desktop: sign-in card on the left so it never covers the incidents */
      "@media(min-width:900px){#authov{align-items:flex-start!important;padding-left:7vw!important}}"+
      ".acat{position:fixed;right:6px;bottom:4px;z-index:99998;font:10px system-ui;color:#5a7096}";
    document.head.appendChild(st);
  }
  const el=document.createElement("div");el.id="authmap";document.body.appendChild(el);
  const at=document.createElement("div");at.id="authmap-at";at.className="acat";at.textContent="© OpenStreetMap contributors";document.body.appendChild(at);
  const narrow=innerWidth<700,pts=sc[1].map(q=>[q[3],q[4]]);
  const m=L.map("authmap",{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,touchZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false});
  /* same tile source the game map uses (TP[0] in map.js) */
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,referrerPolicy:"origin"}).addTo(m);
  /* zoom to the 4 incidents, keeping them clear of the sign-in card */
  const left=narrow?30:Math.round(innerWidth*.07)+440,bottom=narrow?Math.round(innerHeight*.6):60;
  if(m.fitBounds)m.fitBounds(pts,{paddingTopLeft:[left,70],paddingBottomRight:[40,bottom],maxZoom:15,animate:false});
  else m.setView([pts.reduce((a,p)=>a+p[0],0)/4,pts.reduce((a,p)=>a+p[1],0)/4],14);
  sc[1].forEach((q,i)=>{
    L.marker([q[3],q[4]],{interactive:false,icon:L.divIcon({className:"ac",iconSize:[30,30],iconAnchor:[15,15],
      html:'<i class="aci" style="--c:'+AUTH_GC[q[0]]+';--d:'+(i*.5)+'s">'+AUTH_PHONE+'<b class="acl">G'+q[0]+' '+q[1]+' · '+q[2]+'</b></i>'})}).addTo(m);
  });
  try{setTimeout(()=>m.invalidateSize(),0)}catch(e){}
  authMapObj=m;
}
function authMapOff(){
  if(authMapObj){try{authMapObj.remove()}catch(e){}authMapObj=null}
  ["authmap","authmap-at"].forEach(id=>{const e=document.getElementById(id);if(e)e.remove()});
}

/* replaces the old authBg(): starts the map and returns the top strip + queue */
let authQ="";
function authBg(){
  const sc=authPick();authMapOn(sc);
  const rows=sc[1].map(q=>{const stc=/scene/.test(q[7])?"#eab308":AUTH_SC[q[6]];
    return `<div style="display:flex;gap:10px;padding:8px 12px;border-top:1px solid #131e36"><b style="background:${AUTH_GC[q[0]]};color:#fff;font-size:10px;font-weight:500;border-radius:3px;padding:0 6px;height:16px;line-height:16px;flex:none;margin-top:1px">G${q[0]}</b><div style="min-width:0"><div style="font-size:11px;color:#dfe4ee">${q[1]} · ${q[2]}</div><div style="font-size:10px;color:${stc};display:flex;gap:6px;align-items:center"><svg width="16" height="9" viewBox="0 0 24 14"><use href="#av" width="24" height="14" fill="${AUTH_SC[q[6]]}"/></svg>${q[5]} ${q[7]}</div></div></div>`}).join("");
  const seg=["#ef4444","#3b82f6","#ef4444","#3b82f6","#22c55e"].map(c=>`<i style="flex:1;background:${c}"></i>`).join("");
  authQ=`<div class="aq" style="position:relative;z-index:1;flex:none;width:100%;max-width:380px;margin:12px 0 auto;background:rgba(5,9,18,.92);border:1px solid #131e36;border-radius:10px;font-family:ui-monospace,monospace;overflow:hidden"><div style="display:flex;justify-content:space-between;padding:10px 12px;font-size:10px;letter-spacing:2px;color:#5a7096"><span>INCIDENT QUEUE · ${sc[0].toUpperCase()}</span><span>4 OPEN</span></div>${rows}</div>`;
  return `<style>@media(max-height:760px){.aq{display:none}}</style><svg width="0" height="0" style="position:absolute"><defs><symbol id="av" viewBox="0 0 24 14"><rect x="1" y="3" width="22" height="8" rx="2"/><rect x="8" y="0.5" width="8" height="3" rx="1" fill="#e5e9f2"/><circle cx="6" cy="11.5" r="2" fill="#04070d"/><circle cx="18" cy="11.5" r="2" fill="#04070d"/></symbol></defs></svg>`+
  `<div style="position:fixed;top:0;left:0;right:0;z-index:0;height:34px;background:#070b14;display:flex;align-items:center;justify-content:space-between;padding:0 14px;font:500 12px ui-monospace,monospace;color:#dfe4ee;letter-spacing:1.5px">FRONTLINE CONTROL<span style="color:#7f8ca3;font-size:11px;font-weight:400;letter-spacing:0"><i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;margin-right:6px"></i>LIVE <span id="aclk">${new Date().toLocaleTimeString("en-GB")}</span></span></div><div style="position:fixed;top:34px;left:0;right:0;z-index:0;height:3px;display:flex">${seg}</div>`;
}
function authUI(mode,note){return new Promise(res=>{let ov=$("#authov");if(!ov){ov=document.createElement("div");ov.id="authov";ov.style.cssText="position:fixed;inset:0;z-index:99999;background:transparent;display:flex;flex-direction:column;align-items:center;padding:52px 16px 16px;overflow:auto";document.body.appendChild(ov)}
const rec=mode==="recover";let m=mode==="up"?"up":"in";const bgH=authBg(),ti=setInterval(()=>{if(!ov.isConnected){clearInterval(ti);authMapOff();return}const e=$("#aclk");if(e)e.textContent=new Date().toLocaleTimeString("en-GB")},1000);
const draw=(msg,ok)=>{ov.innerHTML=bgH+"<div style=\"position:relative;z-index:1;flex:none;margin-top:auto;width:100%;max-width:380px;background:#060b16;border:1px solid #17233d;border-radius:12px;padding:20px;color:#eef1f8\"><div style=\"font:11px ui-monospace,monospace;letter-spacing:3px;color:#5a7096;text-align:center\">EMERGENCY CONTROL ROOM</div><div style=\"font-size:20px;font-weight:500;text-align:center;margin:6px 0 4px\">"+(rec?"Reset password":m==="up"?"New controller":"Controller sign in")+"</div><div style=\"color:#7f8ca3;text-align:center;margin-bottom:14px\">"+(rec?"Choose a new password":m==="up"?"Create your controller account":"Sign in to load your cloud save")+"</div>"+
(m==="up"?"<input id=\"an\" type=\"text\" maxlength=\"20\" autocomplete=\"nickname\" placeholder=\"Display name (3–20 characters)\" style=\"width:100%;padding:10px;margin-bottom:8px;border:1px solid #1d2c4a;border-radius:8px;background:#03060d;color:#eef1f8;font:inherit\">":"")+
(rec?"":"<input id=\"ae\" type=\"email\" autocomplete=\"email\" placeholder=\"Email\" style=\"width:100%;padding:10px;margin-bottom:8px;border:1px solid #1d2c4a;border-radius:8px;background:#03060d;color:#eef1f8;font:inherit\">")+
"<input id=\"ap\" type=\"password\" autocomplete=\""+(m==="up"||rec?"new-password":"current-password")+"\" placeholder=\""+(rec?"New password":"Password (min 6 characters)")+"\" style=\"width:100%;padding:10px;margin-bottom:8px;border:1px solid #1d2c4a;border-radius:8px;background:#03060d;color:#eef1f8;font:inherit\">"+
"<div id=\"am\" style=\"min-height:20px;margin-bottom:8px;font-size:13px;color:"+(ok?"#34c26a":"#f0594b")+"\">"+esc(msg||note||"")+"</div>"+
(m==="up"?"<div style=\"font-size:12px;color:#7f8ca3;margin-bottom:10px;text-align:center\">By creating an account you agree to our <a href=\"terms.html\" target=\"_blank\" style=\"color:#8fb0ee\">Terms</a> and <a href=\"privacy.html\" target=\"_blank\" style=\"color:#8fb0ee\">Privacy Policy</a>.</div>":"")+
"<button id=\"ago\" style=\"width:100%;padding:11px;border:0;border-radius:8px;background:#244fae;color:#fff;font:700 15px system-ui;cursor:pointer\">"+(rec?"Save new password":m==="up"?"Create account":"Sign in")+"</button>"+
(rec?"":"<div style=\"display:flex;justify-content:space-between;margin-top:12px;font-size:13px\"><a href=\"#\" id=\"asw\" style=\"color:#8fb0ee\">"+(m==="up"?"I have an account":"Create account")+"</a><a href=\"#\" id=\"afg\" style=\"color:#8fb0ee\">Forgot password?</a></div><div style=\"margin-top:14px;padding-top:12px;border-top:1px solid #17233d;text-align:center;font-size:13px\"><a href=\"#\" id=\"agu\" style=\"color:#7f8ca3\">Play offline without cloud saves</a></div>")+"<div style=\"margin-top:12px;font-size:12px;line-height:1.45;color:#f5b942;text-align:center\">Frontline Control is a game, not a real emergency service. In an emergency, call 999.</div></div>"+authQ;
const set=(t,ok2)=>{$("#am").textContent=t;$("#am").style.color=ok2?"#34c26a":"#f0594b"},go=$("#ago"),E=()=>($("#ae")?$("#ae").value.trim():""),P=()=>$("#ap").value;
if(!rec){$("#asw").onclick=e=>{e.preventDefault();m=m==="up"?"in":"up";draw()};$("#afg").onclick=async e=>{e.preventDefault();const em=E();if(!em)return set("Enter your email above first.");try{await sb("/auth/v1/recover"+(redir()?"?redirect_to="+encodeURIComponent(redir()):""),{method:"POST",body:{email:em}});set("If that email has an account, a reset link is on its way.",1)}catch(x){set(friendly(x))}};
$("#agu").onclick=e=>{e.preventDefault();const w=document.createElement("div");w.style.cssText="position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px";w.innerHTML='<div style="width:100%;max-width:380px;background:#060b16;border:1px solid #17233d;border-radius:12px;padding:20px;color:#eef1f8"><div style="font-size:18px;font-weight:600;margin-bottom:10px">'+lci("triangle-alert",0,"#f59e0b")+' Play offline?</div><div style="color:#b4bed0;font-size:14px;line-height:1.5">You have chosen to play offline. Data will save locally on this browser window and you will not be able to retrieve your progress elsewhere. We cannot guarantee that data will save locally each time.<br><br>For the best experience, please create an account to save to the cloud and access your progress anywhere with regular saves.</div><button id="aoc" style="width:100%;padding:11px;margin-top:16px;border:0;border-radius:8px;background:#244fae;color:#fff;font:700 15px system-ui;cursor:pointer">Create account / sign in</button><button id="aog" style="width:100%;padding:11px;margin-top:8px;border:1px solid #1d2c4a;border-radius:8px;background:transparent;color:#b4bed0;font:600 14px system-ui;cursor:pointer">Continue offline</button></div>';document.body.appendChild(w);$("#aoc").onclick=()=>w.remove();$("#aog").onclick=()=>{w.remove();try{localStorage.setItem(GUEST_KEY,"1")}catch(x){}ov.remove();authMapOff();res("guest")}}}
const submit=async()=>{go.disabled=true;go.style.opacity=.6;try{
if(rec){if(P().length<6)throw{message:"Password should be at least 6 characters"};await sb("/auth/v1/user",{method:"PUT",auth:1,body:{password:P()}});ov.remove();authMapOff();return res("ok")}
const em=E(),pw=P();if(!em||!pw)throw{message:"Enter your email and password."};
if(m==="up"){const dn=cleanUN($("#an")&&$("#an").value);if(dn.length<3)throw{message:"Display name must be at least 3 characters."};if(pw.length<6)throw{message:"Password should be at least 6 characters"};const j=await sb("/auth/v1/signup"+(redir()?"?redirect_to="+encodeURIComponent(redir()):""),{method:"POST",body:{email:em,password:pw,data:{username:dn}}});
if(j&&j.access_token){sesSave(j);ov.remove();authMapOff();return res("ok")}
if(j&&j.identities&&!j.identities.length)throw{message:"User already registered"};
m="in";draw("Account created! Check your email to confirm, then sign in.",1);return}
const j=await sb("/auth/v1/token?grant_type=password",{method:"POST",body:{email:em,password:pw}});sesSave(j);ov.remove();authMapOff();res("ok")}
catch(x){set(friendly(x));go.disabled=false;go.style.opacity=1}};
go.onclick=submit;ov.querySelectorAll("input").forEach(i=>i.onkeydown=e=>{if(e.key==="Enter")submit()});const f=$("#ae")||$("#ap");f&&f.focus()};
draw()})}
