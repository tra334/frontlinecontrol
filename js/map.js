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
useTiles();

const MK={s:{},m:{},u:{},r:{},p:{},h:{}},ic=h=>L.divIcon({html:h,className:"mk",iconSize:[0,0]});
map.createPane("bg").style.zIndex=150;
[IE,GB,IOM,IOW,JER,GSY,ALD,SRK,...ORK,...SHE,NI].forEach(p=>L.polygon(p.map(c=>[c[1],c[0]]),{pane:"bg",interactive:false,color:"#8a94a6",weight:1,fillColor:"#eef1e6",fillOpacity:1}).addTo(map));
CITY.forEach(c=>L.marker([c[1],c[2]],{pane:"bg",interactive:false,icon:ic('<span style="font:11px system-ui;color:#556;text-shadow:0 0 3px #fff">'+c[0]+'</span>')}).addTo(map));
function sync(){const seen={s:{},m:{},u:{},r:{},p:{},h:{}};if(upop){const pu=S.un.find(x=>x.id===upop);if(!pu||pu.st==="idle"||pu.st==="scene"||pu.st==="hand")upop=0}
const up=(g,id,ll,h,fn)=>{seen[g][id]=1;let o=MK[g][id];if(!o){o=MK[g][id]=L.marker(ll,{icon:ic(h)}).addTo(map);o._h=h;if(fn)o.on("click",fn)}else{o.setLatLng(ll);if(o._h!==h){o._h=h;o.setIcon(ic(h))}}};
S.st.forEach(s=>up("s",s.id,[s.lat,s.lon],`<div class="sm${IMGS["s"+s.id]?" ci":""}" style="background:${SC[s.sv]}">${bIco("s",s)}</div>`,()=>openS(s.id)));S.hs.forEach(x=>up("h",x.id,[x.lat,x.lon],`<div class="sm${IMGS["h"+x.id]?" ci":""}" style="background:${x.ty==="pn"?"#475569":"#0369a1"}">${bIco("h",x)}</div>`,()=>openH(x.id)));
S.ms.forEach(m=>{const g=gr(m.k);up("m",m.id,[m.la,m.lo],m.ans?`<div class="cw"><div class="im ${g===1&&!wk(m)?"pu":""}${resp(m)?" rs":""}${m._h&&!m.td&&wk(m)?" trqm":""}" style="background:${GC[g]};border-color:${resp(m)?"#fde047":SC[T[m.k][0]]};color:${g===3?"#000":"#fff"}">${g}${allOn(m)?ringH(m):""}</div>${moreU(m)?`<div class="ni">i</div>`:""}</div>`:`<div class="cw"><div class="im pu" style="background:#f59e0b;border-color:#fff">☎</div></div>`,()=>openQ(m.id))});
S.un.forEach(u=>{if(u.st==="idle"||u.st==="scene"||u.st==="hand")return;let p=upos(u);
up("u",u.id,p,`<div class="vi ${u.st==="scene"||u.st==="back"||u.st==="hand"?"sc":""}" style="background:${SC[U[u.ty][0]]}">${u.cs}</div>`,()=>openU(u.id));
if(upop===u.id){const sn=stn(u.sid);up("p",u.id,p,`<div class="upw"><div class="upop"><span class="ux" onclick="openU(${u.id})">✕</span><div><b style="font-size:14px">${u.cs}</b></div><div style="opacity:.75">${U[u.ty][1]}</div><div>Station: ${sn?`<span class="ulk" onclick="openS(${sn.id})">${sn.name}</span>`:"—"}</div><div>Status: <b>${SLU(u)}</b></div>${(u.st==="out"||u.st==="hosp")&&mm(u.mid)?`<div>Mission: <span class="ulk" onclick="upop=0;openQ(${u.mid})">${T[mm(u.mid).k][1]}</span></div>`:""}${u.st==="hosp"?`<button onclick="cancelHosp(${u.id})" style="margin-top:8px;width:100%;padding:8px;border:0;border-radius:8px;background:#dc2626;color:#fff;font:700 13px system-ui;cursor:pointer">🗑 Cancel transport &amp; return to base</button>`:""}</div></div>`)}
if(u.rt&&u.st!=="scene"){seen.r[u.id]=1;let o=MK.r[u.id];if(!o||o._k!==u.t0){if(o)map.removeLayer(o);o=MK.r[u.id]=L.polyline(u.rt.p,{color:SC[U[u.ty][0]],weight:3,opacity:.55,interactive:false}).addTo(map);o._k=u.t0}}});
for(const g in MK)for(const id in MK[g])if(!seen[g][id]){map.removeLayer(MK[g][id]);delete MK[g][id]}}
map.on("click",e=>{if(mv)doMove(e.latlng.lat,e.latlng.lng);else if(bm)place(e.latlng.lat,e.latlng.lng)});
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>setTab(b.dataset.t===tab&&tab!=="m"?"m":b.dataset.t));
