/* ===== Control Rooms =====
   A Control Room is a free building. Placing it creates a room with a square area around it.
   Stations inside the area are in that room. Calls only spawn at stations whose room can cover
   the call, and units are only offered from the room unless it allows pulls within its cap.

   Saved in S.rooms = [{ id, name, bld:{lat,lon}, poly:[[lat,lon],...], on:true,
                         showArea:true, allowOut:false, maxPullKm:60 }]
   Station membership: inside the room's area, unless s.rm is set (s.rm = roomId forces in, s.rm = 0 forces out).
   No rooms = legacy behaviour (everything is in scope). */
(function(){
"use strict";
const DEFAULT_PULL_KM=60;
const HALF_SIDE_DEG=0.35;   // ~39 km each way: the default area is a large square (~78 km side)

/* ---------- geometry ---------- */
const inPoly=(p,poly)=>{
  let c=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [yi,xi]=poly[i],[yj,xj]=poly[j];
    if((xi>p[1])!==(xj>p[1]) && p[0]<(yj-yi)*(p[1]-xi)/((xj-xi)||1e-12)+yi) c=!c;
  }
  return c;
};
const rectPoly=(a,b)=>{
  const la1=Math.min(a[0],b[0]),la2=Math.max(a[0],b[0]),lo1=Math.min(a[1],b[1]),lo2=Math.max(a[1],b[1]);
  return [[la1,lo1],[la1,lo2],[la2,lo2],[la2,lo1]];
};
const squareAround=(la,lo)=>{
  const k=Math.cos(la*Math.PI/180)||1;
  return rectPoly([la-HALF_SIDE_DEG,lo-HALF_SIDE_DEG/k],[la+HALF_SIDE_DEG,lo+HALF_SIDE_DEG/k]);
};

/* ---------- store ---------- */
const rooms=()=>(S.rooms||[]).filter(r=>r.on!==false);
const roomsOn=()=>rooms().length>0;
const roomById=id=>(S.rooms||[]).find(r=>r.id===id)||null;

function roomOfSt(s){
  if(!s)return null;
  if(s.rm===0)return null;
  if(s.rm)return rooms().find(r=>r.id===s.rm)||null;
  return rooms().find(r=>inPoly([s.lat,s.lon],r.poly))||null;
}
function roomOfUnit(u){return roomOfSt(stn(u.sid))}

const srvOn=()=>!!(window.SRV&&SRV.on&&typeof SRV.act==="function");
const viaSrv=a=>{if(srvOn()){SRV.act(a);return true}return false};

function placeBuilding(la,lo){
  if(viaSrv({type:"crplace",lat:la,lon:lo}))return;
  S.rooms=S.rooms||[];
  const id=S.nid++;
  const name="Control Room "+(S.rooms.length+1);
  S.rooms.push({id,name,bld:{lat:la,lon:lo},poly:squareAround(la,lo),on:true,showArea:true,allowOut:false,maxPullKm:DEFAULT_PULL_KM});
  try{log("🏢 "+name+" built. Its area is shown on the map.",1)}catch(e){}
  persist();refresh();
  toast("Control Room built. Stations inside its area are now in its room.");
  return id;
}
function removeRoom(id){ /* local only; the server removes rooms through crdel */
  if(!S.rooms)return;
  S.rooms=S.rooms.filter(r=>r.id!==id);
  S.st.forEach(s=>{if(s.rm===id)delete s.rm});
}
function setStationRoom(stId,roomId){
  const s=S.st.find(x=>x.id===stId);if(!s)return;
  if(roomId==null)delete s.rm;else s.rm=roomId;
}

/* ---------- scope + coverage ---------- */
const stInScope=(s,room)=>!roomsOn()||(room?roomOfSt(s)===room:!!roomOfSt(s));

function unitsIn(room,ty){
  return S.un.filter(u=>u.ty===ty&&crewed(u)&&!u.oos&&roomOfUnit(u)===room).length;
}
function roomCovers(room,t){
  return Object.entries(t[3]).every(([k,n])=>k.startsWith("tr:")||unitsIn(room,k)>=n);
}
function pullOK(room,u){
  if(!room||!roomsOn())return true;
  if(roomOfUnit(u)===room)return true;
  if(!room.allowOut)return false;
  const st=stn(u.sid);
  const inRoom=S.st.filter(s=>roomOfSt(s)===room);
  if(!inRoom.length||!st)return false;
  const d=Math.min(...inRoom.map(s=>km([st.lat,st.lon],[s.lat,s.lon])));
  return d<=(room.maxPullKm||DEFAULT_PULL_KM);
}
function eligibleStations(t,stations){
  if(!roomsOn())return stations;
  return stations.filter(s=>{const r=roomOfSt(s);return r&&roomCovers(r,t)});
}
function unitAllowedFor(u,m){
  if(!roomsOn())return true;
  const room=m&&m.cr?roomById(m.cr):null;
  if(!room)return true;
  return roomOfUnit(u)===room||pullOK(room,u);
}

/* ---------- area redraw (two taps on the map) ---------- */
let redrawId=null, firstCorner=null;
function startRedraw(id){redrawId=id;firstCorner=null;toast("Tap two opposite corners for the new area.");refresh()}
function cancelRedraw(){redrawId=null;firstCorner=null;refresh()}
function onMap(e){
  if(redrawId==null)return;
  const p=[e.latlng.lat,e.latlng.lng];
  if(!firstCorner){firstCorner=p;toast("Now tap the opposite corner.");return}
  const r=roomById(redrawId);
  if(viaSrv({type:"crset",id:redrawId,corners:[firstCorner,p]})){redrawId=null;firstCorner=null;return}
  if(r){r.poly=rectPoly(firstCorner,p);persist();toast(r.name+": area updated.")}
  redrawId=null;firstCorner=null;refresh();
}

/* ---------- map overlay: building pin + optional area outline ---------- */
let mapLayers=[], mapSig="";
function drawMap(){
  if(typeof map==="undefined"||!map||typeof L==="undefined")return;
  const sig=JSON.stringify((S.rooms||[]).map(r=>[r.id,r.on!==false,r.showArea!==false,r.poly,r.bld]));
  if(sig===mapSig)return;
  mapSig=sig;
  mapLayers.forEach(l=>{try{map.removeLayer(l)}catch(e){}});
  mapLayers=[];
  rooms().forEach(r=>{
    try{
      if(r.showArea!==false){
        mapLayers.push(L.polygon(r.poly,{color:"#2563eb",weight:2,fillColor:"#2563eb",fillOpacity:.08,dashArray:"6 4",interactive:false}).addTo(map));
      }
      if(r.bld){
        const icon=L.divIcon({className:"",iconSize:[30,30],iconAnchor:[15,15],
          html:'<div style="width:30px;height:30px;border-radius:8px;background:#1d4ed8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 1px 4px rgba(0,0,0,.45)">🏢</div>'});
        mapLayers.push(L.marker([r.bld.lat,r.bld.lon],{icon,interactive:false}).addTo(map));
      }
    }catch(e){}
  });
}

/* ---------- Stations-tab panel (top of the Stations tab) ---------- */
const esc=t=>String(t==null?"":t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const CSS=document.createElement("style");
CSS.textContent=`
.crm-cr .crm-crh{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.crm-cr .crm-crh b{font-size:17px}.crm-cr .crm-crh span{color:var(--mu);font-size:14px}
.crm-cr .crm-crn{color:var(--mu);font-size:14px;margin:6px 0 0;line-height:1.45}
.crm-cr .crm-crb{border:1px solid var(--bd);border-radius:12px;padding:12px;margin-top:12px}
.crm-cr .crm-crb .crm-nm{font-weight:700;font-size:16px}
.crm-cr .crm-crt{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px;font-size:14px}
.crm-cr .crm-sw{position:relative;width:46px;height:26px;flex:none}
.crm-cr .crm-sw input{opacity:0;width:0;height:0;position:absolute}
.crm-cr .crm-sw span{position:absolute;inset:0;border-radius:99px;background:var(--bd);transition:.15s;cursor:pointer}
.crm-cr .crm-sw span:before{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:#fff;transition:.15s}
.crm-cr .crm-sw input:checked+span{background:#2563eb}
.crm-cr .crm-sw input:checked+span:before{transform:translateX(20px)}
.crm-cr .crm-crp{display:flex;gap:8px;align-items:center;margin-top:8px;font-size:14px;color:var(--mu)}
.crm-cr .crm-crp input{width:84px;padding:6px 8px;border-radius:8px;border:1px solid var(--bd);background:var(--bg);color:var(--tx);font:inherit}
.crm-cr .crm-crx{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.crm-cr .crm-crx button{padding:9px 12px;border-radius:9px;border:0;background:var(--bd);color:var(--tx);font-weight:600;cursor:pointer}
.crm-cr .crm-crx button.pri{background:#2563eb;color:#fff}
.crm-cr .crm-crx button.warn{background:#7f1d1d;color:#fff}
.crm-cr .crm-crs{margin-top:12px}
.crm-cr .crm-crs summary{cursor:pointer;font-weight:600;font-size:14px}
.crm-cr .crm-crsr{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:14px}
.crm-cr .crm-crsr select{padding:6px 8px;border-radius:8px;border:1px solid var(--bd);background:var(--bg);color:var(--tx);font:inherit;max-width:55%}
.crm-cr .crm-crempty{color:var(--mu);font-size:14px;margin-top:6px;line-height:1.45}
.crm-cr .crm-crdraw{color:#2563eb;font-weight:700;font-size:14px;margin-top:8px}
`;
document.head.appendChild(CSS);

function html(){
  if(!ready()) return "";
  const rs=S.rooms||[];
  let h=`<div class="card crm-cr"><div class="crm-crh"><b>🏢 Control Rooms</b><span>${rs.length} built</span></div>`;
  if(!rs.length){
    h+=`<div class="crm-crempty">Build a Control Room from the build menu (free). Its area covers the stations inside it, and calls only spawn where that area has the units they need.</div></div>`;
    return h;
  }
  const outside=S.st.filter(x=>!roomOfSt(x)).length;
  h+=`<div class="crm-crn">Calls only spawn at stations inside a room's area, and only when that room has the units the call needs.</div>`;
  if(outside&&S.st.length)h+=`<div class="crm-crn" style="color:#f59e0b">${outside} station${outside===1?" is":"s are"} outside every room, so ${outside===1?"it takes":"they take"} no calls. Move a room, or set the station to Follow area inside one.</div>`;
  rs.forEach(r=>{
    const inside=S.st.filter(s=>roomOfSt(s)===r).length;
    h+=`<div class="crm-crb"><div class="crm-crh"><span class="crm-nm" style="color:var(--tx)">${esc(r.name)}</span><span>${inside} station${inside===1?"":"s"}</span></div>
<label class="crm-crt"><span>Show area on map</span><span class="crm-sw"><input type="checkbox" ${r.showArea!==false?"checked":""} onchange="CRUI.showArea(${r.id},this.checked)"><span></span></span></label>
<label class="crm-crt"><span>Allow units from outside this room</span><span class="crm-sw"><input type="checkbox" ${r.allowOut?"checked":""} onchange="CRUI.allowOut(${r.id},this.checked)"><span></span></span></label>
<label class="crm-crp">Max pull distance (km) <input type="number" min="0" step="5" value="${r.maxPullKm||DEFAULT_PULL_KM}" onchange="CRUI.cap(${r.id},this.value)"></label>
${redrawId===r.id?`<div class="crm-crdraw">Tap two opposite corners on the map…</div>`:""}
<div class="crm-crx"><button class="pri" onclick="CRUI.redraw(${r.id})">Redraw area</button><button onclick="CRUI.rename(${r.id})">Rename</button><button class="warn" onclick="CRUI.del(${r.id})">Remove</button></div>`;
    h+=`<details class="crm-crs"><summary>Stations (${S.st.length})</summary>`;
    if(!S.st.length)h+=`<div class="crm-crempty">No stations yet.</div>`;
    S.st.forEach(s=>{
      const cur=s.rm===0?"0":(s.rm?String(s.rm):"");
      const opts=[`<option value="" ${cur===""?"selected":""}>Follow area</option>`,`<option value="0" ${cur==="0"?"selected":""}>Excluded</option>`]
        .concat(rs.map(x=>`<option value="${x.id}" ${cur===String(x.id)?"selected":""}>${esc(x.name)}</option>`)).join("");
      const here=roomOfSt(s);
      h+=`<div class="crm-crsr"><span>${esc(s.name)}<br><span style="color:var(--mu)">${here?"in "+esc(here.name):"not in a room"}</span></span><select onchange="CRUI.setSt(${s.id},this.value)">${opts}</select></div>`;
    });
    h+=`</details></div>`;
  });
  return h+`</div>`;
}

const ready=()=>typeof S!=="undefined"&&S;
function refresh(){persist();try{$("#v").dataset.n="";paint()}catch(e){}}

window.CRUI={
  showArea(id,v){if(viaSrv({type:"crset",id,showArea:!!v}))return;const r=roomById(id);if(!r)return;r.showArea=!!v;persist();refresh()},
  allowOut(id,v){if(viaSrv({type:"crset",id,allowOut:!!v}))return;const r=roomById(id);if(!r)return;r.allowOut=!!v;persist();refresh()},
  cap(id,v){if(viaSrv({type:"crset",id,maxPullKm:Math.round(+v||0)}))return;const r=roomById(id);if(!r)return;r.maxPullKm=Math.max(0,+v||0);persist();refresh()},
  redraw(id){const r=roomById(id);if(!r)return;if(redrawId===id)cancelRedraw();else startRedraw(id)},
  rename(id){const r=roomById(id);if(!r)return;const n=prompt("Room name:",r.name);if(!n||!n.trim())return;if(viaSrv({type:"crset",id,name:n.trim()}))return;r.name=n.trim().slice(0,30);persist();refresh()},
  del(id){const r=roomById(id);if(!r)return;if(!confirm("Remove "+r.name+"? Its building is removed, and stations go back to having no room."))return;if(viaSrv({type:"crdel",id}))return;removeRoom(id);persist();refresh()},
  setSt(stId,v){if(viaSrv({type:"crst",sid:stId,v:String(v)}))return;setStationRoom(stId,v===""?null:+v);persist();refresh()}
};

const mapHook=setInterval(()=>{try{if(typeof map!=="undefined"&&map&&map.on){map.on("click",onMap);clearInterval(mapHook)}}catch(e){}},300);
setInterval(()=>{try{drawMap()}catch(e){}},700);

window.CRP={html};
window.ControlRooms={placeBuilding,rooms,roomsOn,roomById,roomOfSt,roomOfUnit,removeRoom,setStationRoom,
  stInScope,unitsIn,roomCovers,pullOK,eligibleStations,unitAllowedFor,rectPoly,inPoly,squareAround,DEFAULT_PULL_KM};
})();
