/* ===== map filter (top right of the map): hide station / hospital / prison / custom POI markers visually.
   Purely cosmetic: hidden buildings and POIs stay fully active in the game (units, calls, spawning, beds, etc.).
   Markers carry data-f="f|p|a|h|pn|poi"; hiding is done with CSS via body[data-hf] (see css/fixes.css). ===== */
(function(){
const KEY="mapHide",
ITEMS=[["f","Fire stations"],["p","Police stations"],["a","Ambulance stations"],["aa","Air ambulance stations"],["ph","Police helicopter stations"],["h","Hospitals"],["pn","Prisons"],["poi","Custom POIs"],["osm","Realistic POIs (OSM)"],["ally","Ally stations (room)"],["allyv","Ally vehicles (room)"],["allym","Shared missions (room)"]],
BG={f:SC.f,p:SC.p,a:SC.a,aa:SC.aa,ph:SC.ph,h:"#0369a1",pn:"#475569",poi:"#7c3aed",osm:"#0d9488",ally:"#6366f1",allyv:"#818cf8",allym:"#4f46e5"},
hid=()=>{const v=getSet()[KEY];return Array.isArray(v)?v.filter(k=>ITEMS.some(i=>i[0]===k)):[]},
apply=()=>{document.body.setAttribute("data-hf",hid().join(" "));const b=document.getElementById("mfb");if(b)b.classList.toggle("act",hid().length>0)},
ico=k=>k==="poi"||k==="osm"||k==="ally"||k==="allyv"||k==="allym"?lci("map-pin",16):ICO[k][icoIdx()];
const w=document.getElementById("mapw");if(!w)return;
const btn=document.createElement("button");btn.id="mfb";btn.type="button";btn.title="Map filter";btn.setAttribute("aria-label","Map filter");btn.setAttribute("aria-expanded","false");btn.innerHTML=lci("funnel",18);if(L.shim)btn.classList.add("shim");
const pan=document.createElement("div");pan.id="mfp";pan.hidden=true;if(L.shim)pan.classList.add("shim");
w.appendChild(btn);w.appendChild(pan);
function osmChips(){if(getSet().osmShow!==true)return"";const hd=Array.isArray(getSet().osmHide)?getSet().osmHide:[],c=typeof osmCounts==="function"?osmCounts():{};
return '<div class="mfc" style="display:flex;flex-wrap:wrap;gap:6px;padding:6px 4px 8px">'+POI_TYPES.filter(t=>t.id in OSM_NOM).map(t=>{const on=hd.indexOf(t.id)<0;return '<button type="button" class="mfo" data-ot="'+t.id+'" title="'+t.n+'" style="padding:4px 8px;border-radius:14px;border:1px solid #0d9488;background:'+(on?'#0d9488':'transparent')+';color:'+(on?'#fff':'inherit')+';font:600 12px system-ui;opacity:'+(on?1:.55)+'">'+t.e+' '+(c[t.id]||0)+'</button>'}).join('')+'</div>'}
function draw(){const h=hid();
pan.innerHTML='<div class="mfh">Show on map</div>'+ITEMS.map(i=>{const on=i[0]==="osm"?getSet().osmShow===true:h.indexOf(i[0])<0;return '<button type="button" class="mfr" data-k="'+i[0]+'" role="switch" aria-checked="'+on+'"><span class="mfi" style="background:'+BG[i[0]]+'">'+ico(i[0])+'</span><span class="mfl">'+i[1]+'</span><span class="mfs'+(on?" on":"")+'"><i></i></span></button>'}).join("")+osmChips()+'<div class="mfn">Hidden items are only hidden visually. They keep working and spawning calls as normal.</div>'+(h.length?'<button type="button" class="mfa">Show all</button>':"");
pan.querySelectorAll(".mfr").forEach(r=>r.onclick=()=>{const k=r.dataset.k;if(k==="osm"){osmSetShow(getSet().osmShow!==true);draw();return}const c=hid(),n=c.indexOf(k)<0?c.concat(k):c.filter(x=>x!==k);setSet(KEY,n);apply();draw()});
pan.querySelectorAll(".mfo").forEach(b=>b.onclick=()=>{osmToggleType(b.dataset.ot);draw()});
const a=pan.querySelector(".mfa");if(a)a.onclick=()=>{setSet(KEY,[]);apply();draw()}}
const open=v=>{pan.hidden=!v;btn.setAttribute("aria-expanded",String(v));if(v)draw()};
btn.addEventListener("click",e=>{e.stopPropagation();open(pan.hidden)});
["pointerdown","dblclick","wheel"].forEach(t=>{btn.addEventListener(t,e=>e.stopPropagation());pan.addEventListener(t,e=>e.stopPropagation(),t==="wheel"?{passive:true}:undefined)});
document.addEventListener("pointerdown",e=>{if(!pan.hidden&&!pan.contains(e.target)&&e.target!==btn&&!btn.contains(e.target))open(false)},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!pan.hidden)open(false)});
apply();
})();
/* keep the address search bar clear of the placement banner whatever its height (POI banner is taller than the build one) */
(function(){const b=document.getElementById("bm");if(!b||!window.ResizeObserver)return;const r=document.documentElement.style,u=()=>r.setProperty("--bmh",b.offsetHeight+"px");new ResizeObserver(u).observe(b);u()})();
