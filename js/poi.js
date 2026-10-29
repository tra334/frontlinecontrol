/* ===== user Points of Interest (POIs): placed in Settings, always boost matching mission spawns. Hiding them on the map is done from the map filter (js/map-filter.js) and never affects spawning. ===== */
const POI_MAX=50,POI_CHANCE=.6,POI_BUSY_KM=.06;
const POI_TYPES=[
{id:"pub",n:"Pub / bar",e:"🍺",m:"Pub brawls, drink driving, nightlife incidents"},
{id:"restaurant",n:"Restaurant / takeaway",e:"🍔",m:"Choking, allergic reactions, abdominal pain, bin fires, seizures"},
{id:"hotel",n:"Hotel / guesthouse",e:"🏨",m:"Hotel fires, multi-casualty incidents, lift entrapments, nosebleeds"},
{id:"supermarket",n:"Supermarket / convenience",e:"🛒",m:"Armed robbery, shoplifting, falls, minor injuries"},
{id:"shop",n:"Shop / retail",e:"🛍️",m:"Shop theft, criminal damage, bin fires, riots"},
{id:"services",n:"Bank / pharmacy / post office",e:"🏦",m:"Robberies, hostage situations, shoplifting, stabbings"},
{id:"home",n:"Home / residential",e:"🏠",m:"House & flat fires, burglary, domestics, medical calls, welfare checks"},
{id:"care_home",n:"Care home",e:"🏡",m:"Falls, strokes, diabetic emergencies, welfare checks, suspicious deaths"},
{id:"high",n:"Tower block / high-rise",e:"🏢",m:"High-rise rescues, cladding fires, lift and balcony incidents"},
{id:"school",n:"School",e:"🏫",m:"School fire alarms, anti-social behaviour, asthma attacks"},
{id:"college",n:"College / university",e:"🎓",m:"Campus protests, stabbings, mental health crises, fire alarms"},
{id:"civic",n:"Library / town hall / court",e:"🏛️",m:"Protests, suspicious packages, fire alarms, riots"},
{id:"attraction",n:"Attraction / museum",e:"🎡",m:"Missing children, suspicious packages, crowds, chest pain"},
{id:"stadium",n:"Stadium / arena",e:"🏟️",m:"Football disorder, crowd crushes, riots, protests (named venues only)"},
{id:"rec",n:"Playing field / rec ground",e:"⚽",m:"Anti-social behaviour, pitch disorder, minor injuries, missing children"},
{id:"leisure",n:"Leisure centre / gym",e:"🏋️",m:"Cardiac arrests, falls, sports injuries"},
{id:"hospital",n:"Hospital site",e:"🏥",m:"Childbirth, incidents in hospital grounds and car parks"},
{id:"church",n:"Church / place of worship",e:"⛪",m:"Falls, strokes, suspicious deaths, missing persons"},
{id:"station",n:"Railway / bus station",e:"🚉",m:"Missing children, derailments, mental health crises, stabbings"},
{id:"road",n:"Road / junction",e:"🚗",m:"Collisions, pursuits, road rage, debris, cyclists"},
{id:"car_park",n:"Car park",e:"🅿️",m:"Car fires, stolen vehicles, hit and runs, multi-storey car park fires"},
{id:"petrol",n:"Petrol station",e:"⛽",m:"Forecourt robberies, fuel spills, car fires, road rage"},
{id:"office",n:"Office / business park",e:"💼",m:"Office fire alarms, suspicious packages, hostage situations, nosebleeds"},
{id:"airport",n:"Airport",e:"✈️",m:"Kidnaps, suspicious packages, marauding attacks"},
{id:"industrial",n:"Industrial site",e:"🏭",m:"Warehouse & chemical incidents, entrapments, quarry rescues"},
{id:"farm",n:"Farm / countryside",e:"🚜",m:"Barn fires, tractors, livestock, moorland fires"},
{id:"water",n:"River / flood risk",e:"🌊",m:"Person in river, flooding, flash floods"},
{id:"lake",n:"Lake / reservoir",e:"🏞️",m:"Person in water, remote rescues, flash floods"},
{id:"harbour",n:"Harbour / marina",e:"⚓",m:"Person in water, flooding, missing persons"},
{id:"coast",n:"Beach / coast",e:"🏖️",m:"Cliff and coast rescues, missing persons, air ambulance calls"},
{id:"woods",n:"Park / woods",e:"🌲",m:"Missing people, mental health, cyclists, remote rescues, wildfires"},
{id:"cemetery",n:"Cemetery",e:"🪦",m:"Suspicious deaths, missing people"},
{id:"bridge",n:"Bridge",e:"🌉",m:"Vulnerable people on bridges, collisions, train derailments"},
{id:"prison",n:"Prison",e:"⛓️",m:"Prison disturbances"}];
/* the POI types a mission can spawn at are set per mission (7th field in js/data.js, see missPoi) */
const missPoi=t=>Array.isArray(t[6])?t[6]:[];
const poiT=id=>POI_TYPES.find(t=>t.id===id);
const poiL=()=>S.poi||(S.poi=[]);
const poiCnt=id=>poiL().filter(p=>p.t===id).length;
/* pick a POI for a mission template: higher chance only, never forced; skips POIs with an active mission there */
function poiPick(t){const ids=missPoi(t);if(!ids.length)return null;
const pool=poiL().filter(p=>ids.includes(p.t));if(!pool.length||Math.random()>POI_CHANCE)return null;
const free=pool.filter(p=>!S.ms.some(m=>km([m.la,m.lo],[p.la,p.lo])<POI_BUSY_KM));return free.length?pick(free):null}
/* ---- map markers ---- */
var POIM={};
function poiSync(){const seen={};poiL().forEach(p=>{seen[p.id]=1;const ty=poiT(p.t);if(!ty)return;let o=POIM[p.id];if(!o){o=POIM[p.id]=L.marker([p.la,p.lo],{zIndexOffset:-500,icon:ic('<div data-f="poi" style="width:24px;height:24px;border-radius:50%;background:#7c3aed;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.5)">'+ty.e+'</div>')}).addTo(map);o.on("click",()=>poiDel(p.id))}else o.setLatLng([p.la,p.lo])});
for(const id in POIM)if(!seen[id]){map.removeLayer(POIM[id]);delete POIM[id]}}
function poiDel(id){const p=poiL().find(x=>x.id===id);if(!p)return;if(pm)return;if(!confirm("Remove this "+(poiT(p.t)||{n:"POI"}).n+" POI?"))return;S.poi=poiL().filter(x=>x.id!==id);persist();poiSync();refreshSettings()}
/* ---- settings section ---- */
var poiOpen=false;
function poiSettingsH(){const tot=poiL().length;
return `<div style="padding:12px 0;border-bottom:1px solid var(--bd)"><div id="set_poih" style="display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer"><div><div style="font-weight:600">${lci("map-pin")} Custom Points of interest <span style="color:var(--mu);font-weight:400;font-size:12px">(${tot}) ${poiOpen?"▲":"▼"}</span></div>${poiOpen?`<div style="color:var(--mu);font-size:12px;margin-top:2px">Place your own POIs. Matching missions are more likely to spawn at them, but can still spawn anywhere. To hide them on the map without affecting spawning, use the filter button at the top right of the map. If a mission is already active at a POI, another POI or a random area is used. Max ${POI_MAX} of each type (${tot} placed).</div>`:`<div style="color:var(--mu);font-size:12px;margin-top:2px">Tap to expand</div>`}</div></div>`+
(poiOpen?POI_TYPES.map(t=>{const c=poiCnt(t.id),f=c>=POI_MAX;return `<div style="display:flex;align-items:center;gap:8px;margin-top:8px"><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px">${t.e} ${t.n} <span style="color:var(--mu);font-weight:400">${c}/${POI_MAX}</span></div><div style="color:var(--mu);font-size:11px">${t.m}</div></div><button data-poi="${t.id}" ${f?"disabled":""} style="flex:none;padding:7px 12px;border:0;border-radius:8px;background:${f?"var(--bd)":"#7c3aed"};color:#fff;font:700 12px system-ui;cursor:${f?"not-allowed":"pointer"}">${f?"Full":"Place"}</button></div>`}).join(""):"")+`</div>`}
function poiBind(ov,draw){const h=ov.querySelector("#set_poih");if(h)h.onclick=()=>{poiOpen=!poiOpen;draw()};
ov.querySelectorAll("[data-poi]").forEach(b=>b.onclick=()=>poiStart(b.dataset.poi))}
/* ---- placement mode (reuses the draggable pin) ---- */
function poiStart(id){if(!poiT(id)||poiCnt(id)>=POI_MAX)return;bm=null;mv=null;pm={t:id,n:0};
const so=$("#setov");if(so)so.remove();const a=$("#ac_x");if(a){let e=a;while(e.parentNode&&e.parentNode!==document.body)e=e.parentNode;if(e.parentNode===document.body)e.remove()}
$("#fabm").hidden=true;try{closeM()}catch(e){}setTab("m");paint();toast("Drag the pin or tap the map, then press Place POI.")}
function poiExit(){pm=null;paint();const n=0;refreshSettings()}
function poiType(v){if(!pm||!poiT(v))return;pm.t=v;paint()}
function pmBanner(){const t=poiT(pm.t),c=poiCnt(pm.t);
return `<div style="font-weight:700">${t.e} Place POI: <b>${t.n}</b> · ${c}/${POI_MAX}${pm.n?" · "+pm.n+" added":""}</div><div class="mu" style="margin:2px 0 6px;font-size:12px">Drag the pin or tap the map, then press Place POI.<span id="bpn"></span></div><select onchange="poiType(this.value)" style="width:100%;padding:8px;margin-bottom:8px;border-radius:8px;border:1px solid var(--bd);background:var(--card);color:var(--tx);font:600 13px system-ui" aria-label="POI type">${POI_TYPES.map(x=>`<option value="${x.id}"${x.id===pm.t?" selected":""}>${x.e} ${x.n} (${poiCnt(x.id)}/${POI_MAX})</option>`).join("")}</select><div style="display:flex;gap:8px"><button class="s g" style="flex:1" onclick="poiExit()">Exit</button><button class="s" style="flex:2;background:#7c3aed" ${c>=POI_MAX?"disabled":""} onclick="poiConfirm()">${lci("plus")} Place POI</button></div>`}
function poiConfirm(){if(!pm||!bll)return;const t=poiT(pm.t);if(poiCnt(pm.t)>=POI_MAX){toast("Maximum of "+POI_MAX+" "+t.n+" POIs reached.");return}
if(!land(bll[0],bll[1])){toast(OUTMSG);return}
S.poiN=(S.poiN||0)+1;poiL().push({id:S.poiN,t:pm.t,la:+bll[0].toFixed(5),lo:+bll[1].toFixed(5)});pm.n++;persist();poiSync();toast(t.e+" "+t.n+" POI placed ("+poiCnt(pm.t)+"/"+POI_MAX+"). Move the pin to add another, switch type, or press Exit.");paint()}
/* keep markers in step with the normal map sync */
(function(){const s0=sync;sync=function(){s0.apply(this,arguments);try{poiSync()}catch(e){}}})();
try{poiSync()}catch(e){}
