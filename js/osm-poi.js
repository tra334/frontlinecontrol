/* ===== Realistic POIs from the map's own vector data layer (OpenFreeMap / OpenMapTiles) =====
   A hidden MapLibre map scans the `poi`, `housenumber`, `building`, `landuse`, `landcover`, `transportation` and `waterway`
   layers around each station (works whichever base map you picked) and caches real pubs, schools, houses, tower blocks,
   industrial land, farmland, bridges and rivers. The address lookup (Nominatim) is the backup, and is used for prisons
   ("HMP"). Matching missions then spawn at those places. Your own POIs (js/poi.js) still take priority.
   Data (c) OpenStreetMap contributors, ODbL. Toggle in Settings. */
const OSM_CHANCE=.85,OSM_RAD={prison:40000,stadium:12000,industrial:10000,farm:12000,home:3000},OSM_CELL=.01,OSM_TTL=7*864e5,OSM_PFX="flc_osm2_",OSM_MAXN=400,OSM_CACHE_CAP=1500000;
const OSM_VEC={prison:1,pub:1,restaurant:1,hotel:1,supermarket:1,shop:1,school:1,college:1,stadium:1,rec:1,leisure:1,hospital:1,petrol:1,car_park:1,church:1,station:1,cemetery:1,office:1,airport:1,harbour:1,attraction:1,civic:1,services:1,care_home:1,coast:1,lake:1,woods:1,home:1,high:1,industrial:1,farm:1,road:1,bridge:1,water:1};
const OSM_NOM={pub:["pub"],restaurant:["takeaway","restaurant"],hotel:["hotel"],supermarket:["supermarket","convenience store"],shop:["shopping centre","department store"],school:["school"],college:["college","university"],stadium:["stadium"],rec:["playing field","recreation ground"],leisure:["leisure centre","gym","swimming pool"],hospital:["hospital"],petrol:["petrol station"],car_park:["car park"],church:["church"],station:["railway station","bus station"],cemetery:["cemetery"],office:["office block","business park"],airport:["airport"],harbour:["harbour","marina"],attraction:["museum","tourist attraction"],civic:["library","town hall"],services:["bank","pharmacy","post office"],care_home:["care home","nursing home"],coast:["beach"],lake:["lake","reservoir"],industrial:["industrial estate","warehouse"],farm:["farm"],woods:["park"],road:["roundabout"],bridge:["bridge"],water:["river"],high:["tower block"],prison:["HMP","prison"],home:[]};
const OSM_NF={prison:/\b(HMP|HMYOI|HM Prison|Prison|Young Offender)/i,stadium:/stadium|arena|racecourse|speedway|velodrome|raceway|dome\b/i};
const OSM_WARM={f:["home","industrial","farm"],p:["pub","shop","school","prison"],a:["home","shop"],aa:[],ph:[]};
/* v2 classifier: drop cached scans made by the old rules (they used the old, wrong place types) */
try{Object.keys(localStorage).filter(x=>x.indexOf("flc_osm_")===0).forEach(x=>localStorage.removeItem(x))}catch(e){}
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
const osmRing=g=>{if(!g)return null;if(g.type==="Polygon")return g.coordinates[0]||null;if(g.type!=="MultiPolygon")return null;let b=null,ba=-1;g.coordinates.forEach(p=>{const r=p[0];if(!r||!r.length)return;const a=osmBox(r);const ar=(a[2]-a[0])*(a[3]-a[1]);if(ar>ba){ba=ar;b=r}});return b};
const osmBox=r=>{let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;r.forEach(q=>{x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1])});return[x0,y0,x1,y1]};
/* footprint of a building in metres (width, height) */
const osmFoot=g=>{const r=osmRing(g);if(!r||r.length<3)return null;const b=osmBox(r),m=111320*Math.cos((b[1]+b[3])/2*Math.PI/180);return[(b[2]-b[0])*m,(b[3]-b[1])*111320]};
const osmIn=(r,x,y)=>{let f=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])f=!f}return f};
/* a point that is always inside the shape: the average vertex if it is inside, otherwise the middle of the widest stretch of the shape at that latitude (fixes parks/woods whose average falls outside) */
const osmCtr=g=>{if(!g)return null;const t=g.type,c=g.coordinates;if(t==="Point")return c;if(t==="LineString")return c[c.length>>1];if(t==="MultiLineString")return c[0][c[0].length>>1];
const r=osmRing(g);if(!r||r.length<3)return null;let x=0,y=0;r.forEach(p=>{x+=p[0];y+=p[1]});x/=r.length;y/=r.length;
if(osmIn(r,x,y))return[x,y];const xs=[];for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}
xs.sort((p,q)=>p-q);let best=null,bw=-1;for(let i=0;i+1<xs.length;i+=2){const w=xs[i+1]-xs[i];if(w>bw){bw=w;best=[(xs[i]+xs[i+1])/2,y]}}return best||[x,y]};
function osmCollect(gl,acc,seen){const q=sl=>{try{return gl.querySourceFeatures("openmaptiles",{sourceLayer:sl})}catch(e){return[]}};
const add=(id,f,nm,cap)=>{const c=osmCtr(f.geometry);if(!c||!isFinite(c[0])||!isFinite(c[1]))return;const k=id+c[1].toFixed(4)+c[0].toFixed(4);if(seen[k])return;const a=acc[id]||(acc[id]=[]);if(a.length>=(cap||1500))return;seen[k]=1;a.push([+c[1].toFixed(5),+c[0].toFixed(5),(nm||"").slice(0,40)])};
/* first match wins, so the more specific types are tested first */
q("poi").forEach(f=>{const p=f.properties||{},t=((p.class||"")+" "+(p.subclass||"")).toLowerCase(),nm=p.name||p["name:latin"]||"";
if(/\b(pub|bar|nightclub|biergarten)\b/.test(t))add("pub",f,nm);
else if(/(supermarket|convenience|grocery)/.test(t))add("supermarket",f,nm);
else if(/(mall|department_store|clothing|clothes|shoe|hardware|furniture|electronics|jewel|shop)/.test(t))add("shop",f,nm);
else if(/(school|kindergarten)/.test(t))add("school",f,nm);
else if(/(college|universit)/.test(t))add("college",f,nm);
else if(/stadium/.test(t)&&OSM_NF.stadium.test(nm))add("stadium",f,nm);
else if(/\bprison\b/.test(t))add("prison",f,nm);
else if(/(sports_centre|swimming|fitness|gym|leisure|ice_rink|bowling)/.test(t))add("leisure",f,nm);
else if(/(pitch|playing_field|recreation_ground|golf|stadium|sports_ground)/.test(t))add("rec",f,nm);
else if(/hospital/.test(t))add("hospital",f,nm);
else if(/(fuel|petrol|gas_station)/.test(t))add("petrol",f,nm);
else if(/(parking|car_park)/.test(t))add("car_park",f,nm);
else if(/(restaurant|fast_food|cafe|takeaway)/.test(t))add("restaurant",f,nm);
else if(/(hotel|motel|lodging|guest_house|hostel)/.test(t))add("hotel",f,nm);
else if(/(place_of_worship|church|chapel|mosque|temple|synagogue)/.test(t))add("church",f,nm);
else if(/(railway|subway|tram_stop|bus_station|bus_stop)/.test(t))add("station",f,nm);
else if(/(cemetery|grave_yard)/.test(t))add("cemetery",f,nm);
else if(/(office|business)/.test(t))add("office",f,nm);
else if(/(airport|aerodrome)/.test(t))add("airport",f,nm);
else if(/(harbou?r|ferry|marina|boatyard|\bport\b)/.test(t))add("harbour",f,nm);
else if(/(attraction|museum|zoo|theme_park|viewpoint|castle|monument)/.test(t))add("attraction",f,nm);
else if(/(library|town_hall|courthouse|public_building|government)/.test(t))add("civic",f,nm);
else if(/(bank|post_office|pharmacy)/.test(t))add("services",f,nm);
else if(/(nursing_home|social_facility|retirement|care_home)/.test(t))add("care_home",f,nm);
else if(/beach/.test(t))add("coast",f,nm);
else if(/\b(park|nature_reserve|playground)\b/.test(t))add("woods",f,nm);
else if(/farm/.test(t))add("farm",f,nm)});
q("housenumber").forEach(f=>add("home",f,""));
/* tower blocks: tall AND a narrow footprint AND a residential/commercial class (or no class). Landmarks such as the London Eye are wide, so they are excluded. */
q("building").forEach(f=>{const p=f.properties||{},h=+p.render_height,c=(p.class||"").toLowerCase(),fp=osmFoot(f.geometry);
if(h>=30&&(!c||/^(residential|apartments|commercial|office|retail|yes|dormitory)$/.test(c))&&fp&&Math.max(fp[0],fp[1])<=45)add("high",f,"");
else if(/hotel/.test(c))add("hotel",f,"");else if(/hospital/.test(c))add("hospital",f,"");else if(/church|chapel|cathedral|mosque|temple/.test(c))add("church",f,"")});
q("landuse").forEach(f=>{const p=f.properties||{},c=p.class||"",nm=p.name;
if(c==="industrial")add("industrial",f,nm);else if(c==="cemetery")add("cemetery",f,nm);else if(c==="hospital")add("hospital",f,nm);else if(c==="school")add("school",f,nm);else if(c==="college"||c==="university")add("college",f,nm);else if(c==="commercial"||c==="retail")add("office",f,nm);else if(c==="pitch"||c==="recreation_ground")add("rec",f,nm);else if(c==="park"||c==="nature_reserve")add("woods",f,nm)});
q("landcover").forEach(f=>{const c=((f.properties||{}).class)||"";if(c==="farmland")add("farm",f,"",60);else if(c==="wood")add("woods",f,"",600);else if(c==="sand")add("coast",f,"",60)});
q("water").forEach(f=>{const c=((f.properties||{}).class)||"";if(/^(lake|reservoir)$/.test(c))add("lake",f,(f.properties||{}).name)});
q("transportation").forEach(f=>{const p=f.properties||{},c=p.class||"";
if(p.brunnel==="bridge"&&/^(motorway|trunk|primary|secondary|tertiary|minor)$/.test(c))add("bridge",f,"");
else if(/^(motorway|trunk|primary)$/.test(c)&&p.brunnel!=="tunnel")add("road",f,"")});
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
const ids=missPoi(t).filter(id=>id in OSM_NOM);if(!ids.length)return null;
const id=pick(ids),d=osmGet(id,b.lat,b.lon);if(!d){osmEnq(id,b.lat,b.lon,1);return null}
const mx=Math.min(id==="prison"?40:8,osmRad(id)/1000),free=d.filter(p=>{const r=km([b.lat,b.lon],[p[0],p[1]]);return r>=.2&&r<=mx&&!S.ms.some(m=>km([m.la,m.lo],[p[0],p[1]])<POI_BUSY_KM)});
if(!free.length)return null;const p=pick(free);return{la:p[0],lo:p[1],nm:p[2]||"",osm:1}}
(function(){const p0=poiPick;poiPick=function(t,b){const u=p0(t);if(u)return u;try{return osmPick(t,b)}catch(e){return null}}})();
/* settings toggle, appended under the custom POI section */
(function(){const h0=poiSettingsH,b0=poiBind;
poiSettingsH=function(){const on=osmOn(),n=Object.keys(osmMem).length;
const st=on?`<div style="color:var(--mu);font-size:11px;margin-top:4px">${osmSt.busy||osmQ.length?"Loading… ":""}${osmSt.src?"Source: "+osmSt.src+". ":""}Loaded ${osmSt.ok}, failed ${osmSt.fail}, queued ${osmQ.length}.${osmSt.err?" Last error: "+osmSt.err:""} <a href="#" id="set_osmr" style="color:#7c3aed">Retry now</a></div>`:"";
return h0()+`<div style="padding:12px 0;border-bottom:1px solid var(--bd)"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div style="font-weight:600">🗺️ Realistic POIs (OpenStreetMap) <span style="display:inline-block;vertical-align:middle;margin-left:4px;padding:2px 8px;border-radius:999px;background:linear-gradient(135deg,#7c3aed,#c026d3 55%,#a78bfa);color:#fff;font:800 10px/1.4 system-ui;letter-spacing:.06em;text-transform:uppercase;box-shadow:0 0 8px rgba(168,85,247,.55),inset 0 0 0 1px rgba(255,255,255,.25)">✨ Experimental</span></div><div style="color:var(--mu);font-size:12px;margin-top:2px">Reads the map’s own POI, building, bridge and river layers (address lookup as backup; prisons searched as “HMP”) so missions spawn at real places near your stations. Prison calls use your own built prisons first, then custom Prison POIs, then real prisons here, then the address lookup. Your own POIs take priority. ${on?n+" area/type sets cached this session.":""}</div>${st}<div style="margin-top:6px;font-size:12px">Scan range: <a href="#" id="set_osmw" style="color:#7c3aed;font-weight:700">${osmWide()?"Wide (~7 km, slower)":"Near (~4 km)"}</a> <span style="color:var(--mu)">tap to switch (reloads POIs)</span></div></div><button id="set_osm" style="flex:none;padding:7px 12px;border:0;border-radius:8px;background:${on?"#16a34a":"var(--bd)"};color:#fff;font:700 12px system-ui;cursor:pointer">${on?"On":"Off"}</button></div></div>`};
poiBind=function(ov,draw){b0(ov,draw);const b=ov.querySelector("#set_osm");if(b)b.onclick=()=>{setSet("osmPoi",!osmOn());if(osmOn())osmWarm();osmShowSync();draw()};
const w=ov.querySelector("#set_osmw");if(w)w.onclick=e=>{e.preventDefault();setSet("osmWide",!osmWide());osmClear();osmWarm();draw()};const r=ov.querySelector("#set_osmr");if(r)r.onclick=e=>{e.preventDefault();for(const k in osmFail)delete osmFail[k];osmVecDown=0;osmWarm();draw();setTimeout(draw,4000)}}})();

/* ---------- prison calls: built prison -> custom prison POI -> OSM POI (map layer) -> address lookup -> random spawn ----------
   Any mission whose POI list includes "prison" (e.g. Prison disturbance) is resolved in this order, never skipping a tier by chance:
   1. your own built prisons (S.hs, ty "pn")  2. your custom Prison POIs  3. a real prison from the map layer (OpenStreetMap)
   4. the address lookup (Nominatim, "HMP"/"prison")  5. if all of those fail, the normal random spawn. */
const PRIS_KM=40;
const isPrisonT=t=>missPoi(t).indexOf("prison")>=0;
const prisBusy=(la,lo)=>S.ms.some(m=>km([m.la,m.lo],[la,lo])<POI_BUSY_KM);
function prisonSync(b){if(!b)return null;
const near=(la,lo)=>km([b.lat,b.lon],[la,lo])<=PRIS_KM;
/* 1. built prisons */
const own=(S.hs||[]).filter(h=>h.ty==="pn"&&near(h.lat,h.lon)&&!prisBusy(h.lat,h.lon));
if(own.length){const h=pick(own);return{la:h.lat,lo:h.lon,nm:h.name,own:1}}
/* 2. custom Prison POIs */
const cu=poiL().filter(p=>p.t==="prison"&&near(p.la,p.lo)&&!prisBusy(p.la,p.lo));
if(cu.length){const p=pick(cu);return{la:p.la,lo:p.lo,nm:"",cpoi:1}}
return null}
/* 3 + 4. OSM map layer first, then the address lookup (osmFetch does both in that order) */
async function prisonLookup(b){if(!b||!osmOn())return null;
let d=osmGet("prison",b.lat,b.lon);
if(!d){const k=osmKey("prison",b.lat,b.lon);if(osmFail[k]>Date.now())return null;
try{d=await Promise.race([osmFetch("prison",b.lat,b.lon),osmWait(30000).then(()=>null)])}catch(e){d=null}
if(d&&d.length)osmPut(k,d);else{osmFail[k]=Date.now()+12e4;return null}}
const free=d.filter(p=>{const r=km([b.lat,b.lon],[p[0],p[1]]);return r<=PRIS_KM&&!prisBusy(p[0],p[1])});
if(!free.length)return null;const p=pick(free);return{la:p[0],lo:p[1],nm:p[2]||"",osm:1}}
(function(){const p0=poiPick;poiPick=function(t,b){if(isPrisonT(t)){const o=prisonSync(b);if(o)return o}return p0(t,b)}})();
