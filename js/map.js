// map
const map=L.map("map",{preferCanvas:true}).setView([54.3,-2.6],6);
const TP=[["https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,maxNativeZoom:19,attribution:"© OpenStreetMap contributors"}],
["https://tile.openstreetmap.de/{z}/{x}/{y}.png",{maxZoom:19,maxNativeZoom:18,attribution:"© OpenStreetMap contributors"}],
["https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",{subdomains:"abc",maxZoom:19,maxNativeZoom:20,attribution:"© OpenStreetMap contributors"}]];
let ti=0,tl=null,tok=0,tbad=0,tmo=0,tmsg=0;
function nextTiles(){if(ti<TP.length-1){ti++;useTiles()}else if(!tok&&!tmsg){tmsg=1;toast("Online map tiles are blocked on this device – showing the offline UK outline.")}}
function useTiles(){clearTimeout(tmo);if(tl)map.removeLayer(tl);tok=0;tbad=0;const mine=tl=L.tileLayer(TP[ti][0],Object.assign({referrerPolicy:"origin",keepBuffer:3,updateWhenIdle:false},TP[ti][1])).addTo(map);
mine.on("tileload",()=>{if(mine===tl)tok++});mine.on("tileerror",()=>{if(mine===tl&&!tok&&++tbad>=3)nextTiles()});
tmo=setTimeout(()=>{if(mine===tl&&!tok)nextTiles()},7000)}

/* ===== selectable base map: OpenStreetMap raster (default) or OpenFreeMap vector styles ===== */
const MAP_STYLES={osm:{n:"OpenStreetMap (default)"},positron:{n:"Positron",u:"positron"},bright:{n:"Bright",u:"bright"},liberty:{n:"Liberty",u:"liberty"},dark:{n:"Dark",u:"dark"},fiord:{n:"Fiord",u:"fiord"},"3d":{n:"3D",u:"liberty",d3:1},cadD:{n:"CAD - Dark",u:"dark",dp:"d"},cadL:{n:"CAD - Light",u:"positron",dp:"l"}};
const OFM_ATTR='<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
let vl=null,vId="osm",vseq=0,vlibs=null;
const mapStyleId=()=>{const v=getSet().mapStyle;return MAP_STYLES[v]?v:"osm"};
function loadScript(u){return new Promise((ok,no)=>{const e=document.createElement("script");e.src=u;e.onload=ok;e.onerror=()=>{e.remove();no(new Error(u))};document.head.appendChild(e)})}
async function loadAny(us){let er;for(const u of us){try{await loadScript(u);return}catch(e){er=e}}throw er}
/* MapLibre is only downloaded when a vector style is actually chosen, so the default OSM map loads exactly as before */
function loadVectorLibs(){if(window.maplibregl&&L.maplibreGL)return Promise.resolve();
return vlibs||(vlibs=(async()=>{if(!document.getElementById("mlcss")){const c=document.createElement("link");c.id="mlcss";c.rel="stylesheet";c.href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css";document.head.appendChild(c)}
if(!window.maplibregl)await loadAny(["https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js","https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"]);
if(!L.maplibreGL)await loadAny(["https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js","https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js"])})().catch(e=>{vlibs=null;throw e}))}
function dropRaster(){clearTimeout(tmo);if(tl){map.removeLayer(tl);tl=null}}
function dropVector(){if(vl){try{map.removeLayer(vl)}catch(e){}vl=null}}
function refreshSettings(){const o=document.getElementById("setov");if(o&&o._draw)o._draw()}
/* CAD look (like a real CAD/control-room map): muted land & water, no POI/shop clutter, road hierarchy
   emphasised so unit markers and routes stand out. Restyles whichever OpenFreeMap style loaded, by layer id / source-layer. */
function dispatchStyle(gl,mode){const dk=mode==="d",C=dk?{bg:"#0b0f14",land:"#0f151c",water:"#0a2236",park:"#0f1b1a",bld:"#161e27",mw:"#e8b04a",tr:"#c9d3df",pr:"#a9b6c5",sc:"#6f7f91",mi:"#46535f",cs:"#05080b",txt:"#d3dce6",hal:"#05080b",rail:"#3f4c5a",bd:"#2b3744"}
:{bg:"#e9ecef",land:"#eceff2",water:"#bcd3e6",park:"#d8e6d4",bld:"#dde1e6",mw:"#f2a33a",tr:"#f5c06a",pr:"#ffffff",sc:"#ffffff",mi:"#fafbfc",cs:"#b4bcc6",txt:"#4a5563",hal:"#ffffff",rail:"#9aa4b0",bd:"#a9b2bd"};
const set=(id,k,v)=>{try{gl.setPaintProperty(id,k,v)}catch(e){}},hide=id=>{try{gl.setLayoutProperty(id,"visibility","none")}catch(e){}};
const rd=(i,t)=>{const a=/motorway/.test(i)?0:/trunk/.test(i)?1:/primary/.test(i)?2:/secondary|tertiary/.test(i)?3:4;return a};
try{gl.getStyle().layers.forEach(l=>{const id=l.id,sl=l["source-layer"]||"",ty=l.type;
if(ty==="background"){set(id,"background-color",C.bg);return}
if(ty==="symbol"){if(/poi|housenumber|peak|aeroway|aerodrome|airport|rail|station|ferry|waterway|water_name/.test(id+" "+sl)&&!/place/.test(sl)){hide(id);return}
set(id,"text-color",C.txt);set(id,"text-halo-color",C.hal);set(id,"text-halo-width",1.4);return}
if(ty==="fill-extrusion"){return}
if(sl==="water"||/water/.test(id)&&ty==="fill"){set(id,"fill-color",C.water);return}
if(ty==="line"&&/waterway|river|stream|canal/.test(id)){set(id,"line-color",C.water);return}
if(sl==="building"||/building/.test(id)){if(ty==="fill"){set(id,"fill-color",C.bld);set(id,"fill-outline-color",C.bd)}return}
if(ty==="fill"&&/park|wood|forest|grass|green|landcover|landuse|nature|scrub|farm/.test(id+" "+sl)){set(id,"fill-color",C.park);set(id,"fill-opacity",.85);return}
if(ty==="fill"&&/landuse|residential|land/.test(id)){set(id,"fill-color",C.land);return}
if(ty==="line"&&/rail|transit|subway|tram/.test(id)){set(id,"line-color",C.rail);return}
if(ty==="line"&&/boundary|admin/.test(id)){set(id,"line-color",C.bd);return}
if(ty==="line"&&(sl==="transportation"||/road|highway|bridge|tunnel|motorway|street|path|service|link|ramp|trunk|primary|secondary|tertiary|minor/.test(id))){
const cs=/casing|outline/.test(id),r=rd(id);
if(/path|track|pedestrian|cycleway|footway|steps/.test(id)){set(id,"line-color",C.mi);set(id,"line-opacity",.5);return}
set(id,"line-color",cs?C.cs:[C.mw,C.tr,C.pr,C.sc,C.mi][r]);
if(!cs&&dk)set(id,"line-opacity",r<=1?1:.95);return}
if(ty==="fill"){set(id,"fill-color",C.land)}})}catch(e){console.warn("dispatch style failed",e)}}
/* 3D: Liberty with extruded buildings (the Leaflet overlay stays top-down so markers stay on their exact spot) */
function glBuildings(gl,on){try{if(gl.getLayer("building-3d")){gl.setLayoutProperty("building-3d","visibility",on?"visible":"none");return}
if(!on)return;const sts=gl.getStyle(),src=sts.sources.openmaptiles?"openmaptiles":Object.keys(sts.sources).find(k=>sts.sources[k].type==="vector");if(!src)return;
const lab=sts.layers.find(l=>l.type==="symbol");
gl.addLayer({id:"ofm-3d",type:"fill-extrusion",source:src,"source-layer":"building",minzoom:14,paint:{"fill-extrusion-color":["interpolate",["linear"],["coalesce",["get","render_height"],0],0,"#e4e1da",60,"#c9c5bb",200,"#a9a59b"],"fill-extrusion-height":["coalesce",["get","render_height"],0],"fill-extrusion-base":["coalesce",["get","render_min_height"],0],"fill-extrusion-opacity":.92}},lab&&lab.id)}catch(e){console.warn("3D buildings unavailable",e)}}
async function showVector(id){const my=++vseq,st=MAP_STYLES[id],prev=vId;
const fail=m=>{if(my!==vseq)return;if(newL&&newL!==vl){try{map.removeLayer(newL)}catch(e){}}
if(prev==="osm"&&!vl&&!tl)useTiles();setSet("mapStyle",vl?prev:"osm");vId=vl?prev:"osm";toast(m);refreshSettings()};
let newL=null;
if(L.shim){fail("Vector map styles need the full map library, which couldn't be loaded – using OpenStreetMap.");return}
try{await loadVectorLibs()}catch(e){fail("Couldn't load the "+st.n+" map style (check your connection or blockers) – keeping the current map.");return}
if(my!==vseq)return;
let gl;try{newL=L.maplibreGL({style:"https://tiles.openfreemap.org/styles/"+st.u,pane:"tilePane",attribution:OFM_ATTR}).addTo(map);gl=newL.getMaplibreMap()}catch(e){fail("Couldn't start the "+st.n+" map style – keeping the current map.");return}
let done=0;const to=setTimeout(()=>{if(!done){done=1;fail("The "+st.n+" map style took too long to load – keeping the current map.")}},15000);
gl.on("error",e=>{if(!done&&e&&!e.tile&&!e.sourceId){done=1;clearTimeout(to);fail("Couldn't load the "+st.n+" map style – keeping the current map.")}});
gl.once("load",()=>{if(done)return;done=1;clearTimeout(to);if(my!==vseq){try{map.removeLayer(newL)}catch(e){}return}
glBuildings(gl,!!st.d3);if(st.dp)dispatchStyle(gl,st.dp);const old=vl;vl=newL;vId=id;dropRaster();if(old&&old!==newL){try{map.removeLayer(old)}catch(e){}}})}
function applyMapStyle(id){id=MAP_STYLES[id]?id:"osm";if(id==="osm"){++vseq;dropVector();vId="osm";if(!tl)useTiles();return}showVector(id)}
/* start-up: only fetch OSM raster tiles straight away when OSM is the chosen map */
if(mapStyleId()==="osm")useTiles();else applyMapStyle(mapStyleId());

const MK={s:{},m:{},u:{},r:{},p:{},h:{}},ic=h=>L.divIcon({html:h,className:"mk",iconSize:[0,0]});
map.createPane("bg").style.zIndex=150;
[IE,GB,IOM,IOW,JER,GSY,ALD,SRK,...ORK,...SHE,NI].forEach(p=>L.polygon(p.map(c=>[c[1],c[0]]),{pane:"bg",interactive:false,color:"#8a94a6",weight:1,fillColor:"#eef1e6",fillOpacity:1}).addTo(map));
CITY.forEach(c=>L.marker([c[1],c[2]],{pane:"bg",interactive:false,icon:ic('<span style="font:11px system-ui;color:#556;text-shadow:0 0 3px #fff">'+c[0]+'</span>')}).addTo(map));
function sync(){const seen={s:{},m:{},u:{},r:{},p:{},h:{}};if(upop){const pu=S.un.find(x=>x.id===upop);if(!pu||pu.st==="idle"||pu.st==="scene"||pu.st==="hand")upop=0}
const up=(g,id,ll,h,fn)=>{seen[g][id]=1;let o=MK[g][id];if(!o){o=MK[g][id]=L.marker(ll,{icon:ic(h)}).addTo(map);o._h=h;if(fn)o.on("click",fn)}else{o.setLatLng(ll);if(o._h!==h){o._h=h;o.setIcon(ic(h))}}};
S.st.forEach(s=>up("s",s.id,[s.lat,s.lon],`<div class="sm${IMGS["s"+s.id]?" ci":""}" data-f="${s.sv}" style="background:${SC[s.sv]}">${bIco("s",s)}</div>`,()=>openS(s.id)));S.hs.forEach(x=>up("h",x.id,[x.lat,x.lon],`<div class="sm${IMGS["h"+x.id]?" ci":""}" data-f="${x.ty==="pn"?"pn":"h"}" style="background:${x.ty==="pn"?"#475569":"#0369a1"}">${bIco("h",x)}</div>`,()=>openH(x.id)));
S.ms.forEach(m=>{const g=gr(m.k);up("m",m.id,[m.la,m.lo],m.ans?`<div class="cw"><div class="im${resp(m)?" rs":""}${m._h&&!m.td&&wk(m)?" trqm":""}" style="background:${GC[g]};border-color:${resp(m)?"#fde047":SC[T[m.k][0]]};color:${g===3?"#000":"#fff"}">${g}${allOn(m)?ringH(m):""}</div>${moreU(m)?`<div class="ni">i</div>`:""}</div>`:`<div class="cw"><div class="im callp" style="background:#f59e0b;border-color:#fff">${lci("phone")}</div></div>`,()=>openQ(m.id))});
S.un.forEach(u=>{if(u.st==="idle"||u.st==="scene"||u.st==="hand")return;let p=upos(u);
up("u",u.id,p,`<div class="vi ${u.st==="scene"||u.st==="back"||u.st==="hand"?"sc":""}" style="background:${SC[U[u.ty][0]]}">${u.cs}</div>`,()=>openU(u.id));
if(upop===u.id){const sn=stn(u.sid);up("p",u.id,p,`<div class="upw"><div class="upop"><span class="ux" onclick="openU(${u.id})">${lci("x")}</span><div><b style="font-size:14px">${u.cs}</b></div><div style="opacity:.75">${U[u.ty][1]}</div><div>Station: ${sn?`<span class="ulk" onclick="openS(${sn.id})">${sn.name}</span>`:"—"}</div><div>Status: <b>${SLU(u)}</b></div>${(u.st==="out"||u.st==="hosp")&&mm(u.mid)?`<div>Mission: <span class="ulk" onclick="upop=0;openQ(${u.mid})">${T[mm(u.mid).k][1]}</span></div>`:""}${u.st==="hosp"?`<button onclick="cancelHosp(${u.id})" style="margin-top:8px;width:100%;padding:8px;border:0;border-radius:8px;background:#dc2626;color:#fff;font:700 13px system-ui;cursor:pointer">${lci("trash-2")} Cancel transport &amp; return to base</button>`:""}</div></div>`)}
if(u.rt&&u.st!=="scene"&&getSet().routeLines!==false){seen.r[u.id]=1;let o=MK.r[u.id];if(!o||o._k!==u.t0){if(o)map.removeLayer(o);o=MK.r[u.id]=L.polyline(u.rt.p,{color:SC[U[u.ty][0]],weight:3,opacity:.55,interactive:false}).addTo(map);o._k=u.t0}}});
for(const g in MK)for(const id in MK[g])if(!seen[g][id]){map.removeLayer(MK[g][id]);delete MK[g][id]}}
map.on("click",e=>{if(mv||bm||pm)bpSet(e.latlng.lat,e.latlng.lng,0)});
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>setTab(b.dataset.t===tab&&tab!=="m"?"m":b.dataset.t));
