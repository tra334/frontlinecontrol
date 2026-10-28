/* ===== Realistic POIs from the map's own vector data layer (OpenFreeMap / OpenMapTiles) =====
   A hidden MapLibre map scans the `poi`, `housenumber`, `building`, `landuse`, `landcover`, `transportation` and `waterway`
   layers around each station (works whichever base map you picked) and caches real pubs, schools, houses, tower blocks,
   industrial land, farmland, bridges and rivers. The address lookup (Nominatim) is the backup, and is used for prisons
   ("HMP"). Matching missions then spawn at those places. Your own POIs (js/poi.js) still take priority.
   Data (c) OpenStreetMap contributors, ODbL. Toggle in Settings. */
const OSM_CHANCE=.85,OSM_RAD={prison:40000,stadium:12000,industrial:10000,farm:12000,home:3000},OSM_CELL=.01,OSM_TTL=7*864e5,OSM_PFX="flc_osm_",OSM_MAXN=400,OSM_CACHE_CAP=1500000;
const OSM_VEC={pub:1,shop:1,school:1,stadium:1,woods:1,home:1,high:1,industrial:1,farm:1,bridge:1,water:1};
const OSM_NOM={pub:["pub"],shop:["supermarket","convenience store"],school:["school"],stadium:["stadium"],industrial:["industrial estate","warehouse"],farm:["farm"],woods:["park"],bridge:["bridge"],water:["river"],road:["roundabout"],high:["tower block"],prison:["HMP"],home:[]};
const OSM_NF={prison:/\b(HMP|HMYOI|HM Prison|Prison|Young Offender)/i};
const OSM_WARM={f:["home","industrial","farm"],p:["pub","shop","school","prison"],a:["home","shop"],aa:[],ph:[]};
const osmOn=()=>getSet().osmPoi!==false;
const osmWide=()=>getSet().osmWide===true,osmRad=id=>OSM_RAD[id]||(osmWide()?7300:4400),osmMem={},osmQ=[],osmFail={},osmScans={},osmSt={ok:0,fail:0,err:"",busy:0,src:""};let osmBusy=0,osmVecDown=0;
const osmCell=v=>Math.round(v/OSM_CELL)*OSM_CELL,osmWait=ms=>new Promise(r=>setTimeout(r,ms));
const osmKey=(id,la,lo)=>OSM_PFX+id+"_"+osmCell(la).toFixed(2)+"_"+osmCell(lo).toFixed(2);
function osmGet(id,la,lo){const k=osmKey(id,la,lo);if(osmMem[k])return osmMem[k];
try{const j=JSON.parse(localStorage.getItem(k));if(j&&Date.now()-j.t<OSM_TTL){osmMem[k]=j.d;return j.d}}catch(e){}return null}
function osmTrim(){try{const ks=Object.keys(localStorage).filter(x=>x.indexOf(OSM_PFX)===0);let tot=0;const a=ks.map(k=>{const v=localStorage.getItem(k)||"";tot+=v.length;let t=0;try{t=JSON.parse(v).t}catch(e){}return{k,t,n:v.length}});
if(tot<=OSM_CACHE_CAP)return;a.sort((x,y)=>x.t-y.t);for(const x of a){if(tot<=OSM_CACHE_CAP*.7)break;localStorage.removeItem(x.k);tot-=x.n}}catch(e){}}
function osmClear(){try{Object.keys(localStorage).filter(x=>x.indexOf(OSM_PFX)===0).forEach(x=>localStorage.removeItem(x))}catch(e){}for(const k in osmMem)delete osmMem[k];for(const k in osmScans)delete osmScans[k];for(const k in osmFail)delete osmFail[k];osmShowSync()}
function osmPut(k,d){osmMem[k]=d;const v=JSON.stringify({t:Date.now(),d});osmTrim();
try{localStorage.setItem(k,v)}catch(e){try{Object.keys(localStorage).filter(x=>x.indexOf(OSM_PFX)===0&&x!==k).forEach(x=>localStorage.removeItem(x));localStorage.setItem(k,v)}catch(x){}}}
const osmThin=(a,n)=>{a=a.slice();while(a.length>(n||OSM_MAXN))a.splice(Math.floor(Math.random()*a.length),1);return a};
/* ---------- 1. the map's vector layers, read through a hidden MapLibre map ---------- */
let osmGl=null,osmGlP=null,osmGlT=0;
function osmMapInit(){if(osmGl)return Promise.resolve(osmGl);if(osmGlP)return osmGlP;
return osmGlP=(async()=>{if(typeof L!=="undefined"&&L.shim)throw new Error("vector maps unavailable");
await loadVectorLibs();const d=document.createElement("div");d.style.cssText="position:fixed;left:-3000px;top:0;width:1000px;height:1000px;pointer-events:none";document.body.appendChild(d);
const gl=new maplibregl.Map({container:d,style:"https://tiles.openfreemap.org/styles/positron",center:[-.12,51.5],zoom:14,interactive:false,attributionControl:false,pixelRatio:1,fadeDuration:0});gl._d=d;
await new Promise((ok,no)=>{const t=setTimeout(()=>no(new Error("map layer timed out")),25000);gl.once("load",()=>{clearTimeout(t);ok()});gl.on("error",e=>{if(e&&!e.tile&&!e.sourceId){clearTimeout(t);no(new Error("map style failed"))}})});
return osmGl=gl})().catch(e=>{osmGlP=null;try{document.querySelectorAll("div[style*='-3000px']").forEach(x=>x.remove())}catch(_){}throw e})}
function osmMapDrop(){if(!osmGl)return;try{const d=osmGl._d;osmGl.remove();d&&d.remove()}catch(e){}osmGl=null;osmGlP=null}
const osmCtr=g=>{if(!g)return null;const t=g.type,c=g.coordinates;if(t==="Point")return c;if(t==="LineString")return c[c.length>>1];if(t==="MultiLineString")return c[0][c[0].length>>1];
const r=t==="Polygon"?c[0]:t==="MultiPolygon"?c[0][0]:null;if(!r||!r.length)return null;let x=0,y=0;r.forEach(p=>{x+=p[0];y+=p[1]});return[x/r.length,y/r.length]};
function osmCollect(gl,acc,seen){const q=sl=>{try{return gl.querySourceFeatures("openmaptiles",{sourceLayer:sl})}catch(e){return[]}};
const add=(id,f,nm,cap)=>{const c=osmCtr(f.geometry);if(!c||!isFinite(c[0])||!isFinite(c[1]))return;const k=id+c[1].toFixed(4)+c[0].toFixed(4);if(seen[k])return;const a=acc[id]||(acc[id]=[]);if(a.length>=(cap||1500))return;seen[k]=1;a.push([+c[1].toFixed(5),+c[0].toFixed(5),(nm||"").slice(0,40)])};
q("poi").forEach(f=>{const p=f.properties||{},t=((p.class||"")+" "+(p.subclass||"")).toLowerCase(),nm=p.name||p["name:latin"]||"";
if(/\b(pub|bar|nightclub)\b/.test(t))add("pub",f,nm);else if(/(supermarket|convenience|mall|department_store|grocery|clothing_store)/.test(t))add("shop",f,nm);
else if(/(school|college|kindergarten)/.test(t))add("school",f,nm);else if(/(stadium|sports_centre)/.test(t))add("stadium",f,nm);
else if(/(park|nature_reserve)/.test(t))add("woods",f,nm);else if(/farm/.test(t))add("farm",f,nm)});
q("housenumber").forEach(f=>add("home",f,""));
q("building").forEach(f=>{const h=+((f.properties||{}).render_height);if(h>=30)add("high",f,"")});
q("landuse").forEach(f=>{if(((f.properties||{}).class)==="industrial")add("industrial",f,(f.properties||{}).name)});
q("landcover").forEach(f=>{if(((f.properties||{}).class)==="farmland")add("farm",f,"",60)});
q("transportation").forEach(f=>{const p=f.properties||{};if(p.brunnel==="bridge"&&/^(motorway|trunk|primary|secondary|tertiary|minor)$/.test(p.class||""))add("bridge",f,"")});
q("waterway").forEach(f=>{const p=f.properties||{};if(/^(river|canal)$/.test(p.class||""))add("water",f,p.name)})}
/* 3x3 grid of views (about 3 km each) centred on the station, so everything within ~4.4 km is read at full detail */
async function osmScan(la,lo){const gl=await osmMapInit(),acc={},seen={},dl=k=>k/111.32,dn=k=>k/(111.32*Math.cos(la*Math.PI/180));
const G=osmWide()?[-5.8,-2.9,0,2.9,5.8]:[-2.9,0,2.9];for(const a of G)for(const b of G){gl.jumpTo({center:[lo+dn(b),la+dl(a)],zoom:14});
await new Promise(r=>{const t=setTimeout(r,9000);gl.once("idle",()=>{clearTimeout(t);r()});gl.triggerRepaint()});osmCollect(gl,acc,seen)}
clearTimeout(osmGlT);osmGlT=setTimeout(osmMapDrop,90000);return acc}
/* ---------- 2. backup: the address lookup (Nominatim), one search per phrase, 1 request/sec ---------- */
async function osmNom(id,la,lo){const ph=OSM_NOM[id]||[],c=[osmCell(la),osmCell(lo)],r=osmRad(id)/111000,rl=r/Math.cos(c[0]*Math.PI/180),nf=OSM_NF[id],out=[],seen={};let bad=0;
for(const q of ph){const j=await J("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=40&bounded=1&viewbox="+[c[1]-rl,c[0]+r,c[1]+rl,c[0]-r].map(v=>v.toFixed(4)).join(",")+"&q="+encodeURIComponent(q),12000);
if(!Array.isArray(j)){bad++;osmSt.err="address lookup gave no response";await osmWait(1100);continue}
j.forEach(x=>{if(x.class==="boundary"||x.class==="place"||(id==="prison"&&/^(highway|railway|waterway)$/.test(x.class)))return;const nm=x.name||"";if(nf&&!nf.test(nm))return;const y=+x.lat,z=+x.lon,k=y.toFixed(4)+","+z.toFixed(4);
if(isFinite(y)&&isFinite(z)&&!seen[k]&&land(y,z)){seen[k]=1;out.push([+y.toFixed(5),+z.toFixed(5),nm.slice(0,40)])}});
await osmWait(1100)}
return ph.length&&bad===ph.length?null:out.slice(0,OSM_MAXN)}
/* ---------- 3. fetch one type: map layer first, address lookup if the layer has nothing ---------- */
async function osmFetch(id,la,lo){
if(OSM_VEC[id]&&Date.now()>osmVecDown){const sk=osmKey("vec"+(osmWide()?"w":""),la,lo);let sc=osmScans[sk];
if(!sc){try{sc=osmScans[sk]=await osmScan(la,lo)}catch(e){osmVecDown=Date.now()+3e5;osmSt.err="map layer: "+String(e.message||e).slice(0,60);console.warn("map layer scan failed",e)}}
if(sc){/* cache everything the scan found so other types need no further work */
for(const t in sc){const k=osmKey(t,la,lo);const a=sc[t].filter(p=>land(p[0],p[1]));if(a.length&&!osmMem[k])osmPut(k,osmThin(a))}
const a=osmMem[osmKey(id,la,lo)];if(a){osmSt.src="Map layer";return a}}}
const n=await osmNom(id,la,lo);if(n&&n.length)osmSt.src="Address lookup";return n}
function osmEnq(id,la,lo,hi){if(!(id in OSM_NOM))return;const k=osmKey(id,la,lo);
if(osmMem[k]||osmFail[k]>Date.now()||osmQ.some(x=>x.k===k))return;
try{const j=JSON.parse(localStorage.getItem(k));if(j&&Date.now()-j.t<OSM_TTL){osmMem[k]=j.d;return}}catch(e){}
hi?osmQ.unshift({k,id,la,lo}):osmQ.push({k,id,la,lo});osmRun()}
async function osmRun(){if(osmBusy)return;osmBusy=1;osmSt.busy=1;
try{while(osmQ.length){const x=osmQ.shift();if(osmMem[x.k])continue;let d=null;try{d=await osmFetch(x.id,x.la,x.lo)}catch(e){osmSt.err=String(e.message||e).slice(0,60)}
if(d){if(!osmMem[x.k])osmPut(x.k,d);osmSt.ok++;osmSt.err="";osmShowSync()}else{osmFail[x.k]=Date.now()+12e4;osmSt.fail++;console.warn("POI load failed:",x.id,osmSt.err)}}}
finally{osmBusy=0;osmSt.busy=0}}
function osmWarm(){if(!osmOn()||typeof S==="undefined"||!S.st||osmQ.length>=4)return;
S.st.forEach(s=>(OSM_WARM[s.sv]||[]).forEach(id=>{if(osmQ.length<4)osmEnq(id,s.lat,s.lon)}))}
setInterval(()=>{try{osmWarm()}catch(e){}},20000);setTimeout(()=>{try{osmWarm()}catch(e){}},4000);
setInterval(()=>{try{if(osmSt.busy&&document.getElementById("set_osmr"))refreshSettings()}catch(e){}},3000);

/* ---------- optional map markers for the cached POIs (Map filter button -> "Realistic POIs (OSM)", off by default) ---------- */
const OSMM={},OSM_SHOWCAP=1500,OSM_NOBND=500,osmShown=()=>getSet().osmShow===true,osmHidT=()=>Array.isArray(getSet().osmHide)?getSet().osmHide:[];
function osmShowSync(){try{
if(!osmShown()||!osmOn()||typeof S==="undefined"||!S.st){for(const k in OSMM){map.removeLayer(OSMM[k]);delete OSMM[k]}return}
const want={},hd=osmHidT();let n=0,bd=null,cap=OSM_NOBND;
try{if(!L.shim&&map.getBounds){if(map.getZoom()<12){for(const k in OSMM){map.removeLayer(OSMM[k]);delete OSMM[k]}return}bd=map.getBounds().pad(.25);cap=OSM_SHOWCAP}}catch(e){bd=null}
S.st.forEach(s=>{for(const id in OSM_NOM){if(hd.indexOf(id)>=0)continue;const d=osmGet(id,s.lat,s.lon);if(!d)continue;d.forEach(p=>{const k=id+p[0]+","+p[1];if(n>=cap||want[k])return;if(bd&&!bd.contains([p[0],p[1]]))return;want[k]=[id,p];n++})}});
for(const k in OSMM)if(!want[k]){map.removeLayer(OSMM[k]);delete OSMM[k]}
for(const k in want){if(OSMM[k])continue;const id=want[k][0],p=want[k][1],ty=poiT(id);if(!ty)continue;
const o=OSMM[k]=L.marker([p[0],p[1]],{zIndexOffset:-600,icon:ic('<div style="width:18px;height:18px;border-radius:50%;background:#0d9488;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 1px 3px rgba(0,0,0,.5);opacity:.92">'+ty.e+'</div>')}).addTo(map);
o.on("click",()=>toast(ty.e+" "+(p[2]||ty.n)+" – "+ty.n))}}catch(e){}}
/* load every type for every station so the layer is complete when switched on */
function osmShowAll(){if(typeof S==="undefined"||!S.st)return;S.st.forEach(s=>{for(const id in OSM_NOM)osmEnq(id,s.lat,s.lon)})}
function osmCounts(){const c={};if(typeof S==="undefined"||!S.st)return c;const seen={};S.st.forEach(s=>{for(const id in OSM_NOM){const d=osmGet(id,s.lat,s.lon);if(!d)continue;d.forEach(p=>{const k=id+p[0]+","+p[1];if(!seen[k]){seen[k]=1;c[id]=(c[id]||0)+1}})}});return c}
function osmToggleType(id){const h=osmHidT().slice(),i=h.indexOf(id);i<0?h.push(id):h.splice(i,1);setSet("osmHide",h);osmShowSync()}
let osmMvT=0;try{map.on("moveend",()=>{clearTimeout(osmMvT);osmMvT=setTimeout(osmShowSync,250)})}catch(e){}
function osmSetShow(v){setSet("osmShow",!!v);if(v){osmShowAll()}osmShowSync()}
setInterval(osmShowSync,15000);setTimeout(osmShowSync,5000);
/* ---------- pick a real place for mission template t near station b; null = normal random spawn ---------- */
function osmPick(t,b){if(!osmOn()||Math.random()>OSM_CHANCE)return null;if(!b){const o=(S.st||[]).filter(x=>x.sv===t[0]);if(!o.length)return null;b=pick(o)}
const ids=POI_TYPES.filter(x=>x.r.test(t[1])&&(x.id in OSM_NOM)).map(x=>x.id);if(!ids.length)return null;
const id=pick(ids),d=osmGet(id,b.lat,b.lon);if(!d){osmEnq(id,b.lat,b.lon,1);return null}
const mx=Math.min(id==="prison"?40:8,osmRad(id)/1000),free=d.filter(p=>{const r=km([b.lat,b.lon],[p[0],p[1]]);return r>=.2&&r<=mx&&!S.ms.some(m=>km([m.la,m.lo],[p[0],p[1]])<POI_BUSY_KM)});
if(!free.length)return null;const p=pick(free);return{la:p[0],lo:p[1],nm:p[2]||"",osm:1}}
(function(){const p0=poiPick;poiPick=function(t,b){const u=p0(t);if(u)return u;try{return osmPick(t,b)}catch(e){return null}}})();
/* settings toggle, appended under the custom POI section */
(function(){const h0=poiSettingsH,b0=poiBind;
poiSettingsH=function(){const on=osmOn(),n=Object.keys(osmMem).length;
const st=on?`<div style="color:var(--mu);font-size:11px;margin-top:4px">${osmSt.busy||osmQ.length?"Loading… ":""}${osmSt.src?"Source: "+osmSt.src+". ":""}Loaded ${osmSt.ok}, failed ${osmSt.fail}, queued ${osmQ.length}.${osmSt.err?" Last error: "+osmSt.err:""} <a href="#" id="set_osmr" style="color:#7c3aed">Retry now</a></div>`:"";
return h0()+`<div style="padding:12px 0;border-bottom:1px solid var(--bd)"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div style="font-weight:600">🗺️ Realistic POIs (OpenStreetMap)</div><div style="color:var(--mu);font-size:12px;margin-top:2px">Reads the map’s own POI, building, bridge and river layers (address lookup as backup; prisons searched as “HMP”) so missions spawn at real places near your stations. Your own POIs take priority. ${on?n+" area/type sets cached this session.":""}</div>${st}<div style="margin-top:6px;font-size:12px">Scan range: <a href="#" id="set_osmw" style="color:#7c3aed;font-weight:700">${osmWide()?"Wide (~7 km, slower)":"Near (~4 km)"}</a> <span style="color:var(--mu)">tap to switch (reloads POIs)</span></div></div><button id="set_osm" style="flex:none;padding:7px 12px;border:0;border-radius:8px;background:${on?"#16a34a":"var(--bd)"};color:#fff;font:700 12px system-ui;cursor:pointer">${on?"On":"Off"}</button></div></div>`};
poiBind=function(ov,draw){b0(ov,draw);const b=ov.querySelector("#set_osm");if(b)b.onclick=()=>{setSet("osmPoi",!osmOn());if(osmOn())osmWarm();osmShowSync();draw()};
const w=ov.querySelector("#set_osmw");if(w)w.onclick=e=>{e.preventDefault();setSet("osmWide",!osmWide());osmClear();osmWarm();draw()};const r=ov.querySelector("#set_osmr");if(r)r.onclick=e=>{e.preventDefault();for(const k in osmFail)delete osmFail[k];osmVecDown=0;osmWarm();draw();setTimeout(draw,4000)}}})();
