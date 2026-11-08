/* ===== Frontline Control: startup mode chooser + 3D world =====
   - Every page load asks: Classic map or 3D world (before the game starts).
   - 3D world = MapLibre GL (OpenFreeMap vector tiles, extruded buildings, tilted camera)
     + a Three.js custom layer that draws proper 3D vehicle models at their live positions.
   - Responding units (out / hosp / on scene) flash blue lights, glow and wash the road blue.
   - Stations, hospitals/custody and 999 calls are floating 3D-world markers (clickable).
   Nothing in the 2D game logic is changed: this only reads S, upos(), dd(), along(). */
(function(){
"use strict";
const MODE_KEY="fc_mode",STYLE_URL="https://tiles.openfreemap.org/styles/positron",
 ML_VER="4.7.1",THREE_URLS=["https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js","https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"];
let asked=false,active=false,busy=false,libs=null;
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const hasGL=()=>{try{const c=document.createElement("canvas");return!!(c.getContext("webgl2")||c.getContext("webgl"))}catch(e){return false}};
/* phones/tablets get slightly simpler vehicle models and smaller decal textures */
const LOW=(()=>{try{return/iPhone|iPad|iPod|Android|Mobi/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.platform))||matchMedia("(pointer:coarse)").matches}catch(e){return false}})();
const esc2=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- styles ---------- */
const css=document.createElement("style");css.textContent=`
#w3ov{position:fixed;inset:0;z-index:200000;background:radial-gradient(ellipse at 50% 20%,#14213d,#05080f);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif;color:#e5e7eb}
#w3ov .bx{width:100%;max-width:560px;text-align:center}
#w3ov h1{margin:0 0 4px;font-size:24px;letter-spacing:.02em}#w3ov p.sub{margin:0 0 18px;opacity:.7;font-size:14px}
#w3ov .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:480px){#w3ov .cards{grid-template-columns:1fr}}
#w3ov button.cd{all:unset;box-sizing:border-box;cursor:pointer;text-align:left;padding:16px;border-radius:14px;background:#0f172a;border:2px solid #243049;display:flex;flex-direction:column;gap:6px;transition:.15s}
#w3ov button.cd:hover,#w3ov button.cd:focus-visible,#w3ov button.cd.last{border-color:#3b82f6;background:#13203d}
#w3ov button.cd[disabled]{opacity:.4;cursor:not-allowed}
#w3ov .cd b{font-size:17px}#w3ov .cd span{font-size:13px;opacity:.75;line-height:1.35}#w3ov .cd i{font-style:normal;font-size:26px}
#w3ov .tip{margin-top:14px;font-size:12px;opacity:.55}
#map3d{position:absolute;inset:0;z-index:2;background:#0b0f14}
.w3hud{position:absolute;z-index:1300;left:10px;top:calc(var(--hh,52px) + 8px);max-height:calc(100% - var(--hh,52px) - 90px);overflow:auto;display:flex;flex-direction:column;gap:6px}
.w3hud button,#w3tog{border:0;border-radius:10px;padding:8px 11px;font:700 13px system-ui;background:#0f172ae6;color:#fff;box-shadow:0 2px 8px #0006;cursor:pointer}
.w3hud button.on{background:#2563eb}
#w3tog{position:absolute;z-index:1300;right:56px;top:10px}
.w3m{display:flex;flex-direction:column;align-items:center;cursor:pointer;font:600 11px system-ui;color:#fff;pointer-events:auto;--c:#2563eb}
.w3m .w3l{background:#0b1220d9;padding:1px 6px;border-radius:6px;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.w3st .w3l{display:none}
.w3m .w3b{width:34px;height:34px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;background:var(--c);box-shadow:0 2px 8px #0009;font-size:17px;font-weight:800;overflow:hidden}
.w3m .w3b img{width:100%;height:100%;object-fit:cover}
.w3m .w3p{width:2px;height:24px;background:linear-gradient(var(--c),transparent)}
.w3m .w3d{width:9px;height:9px;border-radius:50%;background:var(--c);box-shadow:0 0 0 4px #ffffff40;margin-bottom:-4px}
.w3m.w3call .w3b{animation:w3p 1.2s infinite}.w3m.w3rs .w3b{border-color:#fde047}
@keyframes w3p{0%{box-shadow:0 0 0 0 var(--c)}100%{box-shadow:0 0 0 16px transparent}}
.w3u{background:#0b1220e6;color:#fff;font:700 10px system-ui;padding:1px 5px;border-radius:5px;border:1px solid var(--c);cursor:pointer;white-space:nowrap;pointer-events:auto}
.w3u.w3rs{border-color:#60a5fa}
`;document.head.appendChild(css);

/* ---------- library loading ---------- */
function loadLibs(){return libs||(libs=(async()=>{
 if(!document.getElementById("mlcss")){const c=document.createElement("link");c.id="mlcss";c.rel="stylesheet";c.href="https://cdn.jsdelivr.net/npm/maplibre-gl@"+ML_VER+"/dist/maplibre-gl.css";document.head.appendChild(c)}
 const jobs=[];
 if(!window.maplibregl)jobs.push(loadAny(["https://cdn.jsdelivr.net/npm/maplibre-gl@"+ML_VER+"/dist/maplibre-gl.js","https://unpkg.com/maplibre-gl@"+ML_VER+"/dist/maplibre-gl.js"]));
 if(!window.THREE)jobs.push(loadAny(THREE_URLS));
 await Promise.all(jobs);
 if(!window.maplibregl||!window.THREE)throw new Error("libs");
})().catch(e=>{libs=null;throw e}))}

/* ---------- startup chooser (every start-up) ---------- */
function chooseMode(){return new Promise(res=>{
 const last=lsGet(MODE_KEY)==="3d"?"3d":"2d",gl=hasGL(),ov=document.createElement("div");ov.id="w3ov";
 ov.innerHTML=`<div class="bx"><h1>Frontline Control</h1><p class="sub">How do you want to play this session?</p><div class="cards">
 <button class="cd${last==="2d"?" last":""}" data-m="2d"><i>🗺️</i><b>Classic map</b><span>The normal flat dispatch map. Lightest, works on any device.</span></button>
 <button class="cd${last==="3d"?" last":""}" data-m="3d"${gl?"":" disabled"}><i>🏙️</i><b>3D world <small style="opacity:.7">(beta)</small></b><span>${gl?"Tilted 3D city, real vehicle models, blue lights when responding.":"3D isn't supported by this browser/device."}</span></button></div>
 <div class="tip">Press 1 or 2 · You can switch any time with the 2D/3D button on the map</div></div>`;
 document.body.appendChild(ov);
 const done=m=>{document.removeEventListener("keydown",kd);lsSet(MODE_KEY,m);ov.remove();res(m)};
 const kd=e=>{if(e.key==="1")done("2d");else if(e.key==="2"&&gl)done("3d")};document.addEventListener("keydown",kd);
 const b3=ov.querySelector('[data-m="3d"]');
 if(gl){const pre=()=>{loadLibs().catch(()=>{})};b3.addEventListener("pointerenter",pre,{once:true});b3.addEventListener("touchstart",pre,{once:true,passive:true})}
 ov.querySelectorAll(".cd").forEach(b=>b.onclick=()=>{if(!b.disabled)done(b.dataset.m)});
 const f=ov.querySelector(".last");if(f)f.focus();
})}

/* ---------- vehicle models: UK emergency-service liveries (units = metres, forward = -z, y up) ---------- */
let T3,BOX,CYL,SPH,CIR,PLN,GLOW,MATS={};
const ON=0x6aa8ff,OFF=0x0d1b45,GLASS="#0e1a28",PI=Math.PI;
/* UK liveries: police = white + blue/yellow Battenburg, fire = red + yellow chevrons, ambulance = white + green/yellow Battenburg */
const LV={pol:{body:"#f7f9fc",a:"#1d4ed8",b:"#f0ea1c",tx:"#1d4ed8",w:"POLICE"},
 fir:{body:"#c8161d",a:"#c8161d",b:"#f4e20a",tx:"#ffffff",w:"FIRE"},
 amb:{body:"#f2dc2e",a:"#17703a",b:"#a8d83c",tx:"#17703a",w:"AMBULANCE"}};
function initShared(){if(BOX)return;T3=window.THREE;BOX=new T3.BoxGeometry(1,1,1);CYL=new T3.CylinderGeometry(1,1,1,LOW?10:16);SPH=new T3.SphereGeometry(1,LOW?10:16,LOW?8:12);CIR=new T3.CircleGeometry(1,24);PLN=new T3.PlaneGeometry(1,1);
 const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d"),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.25,"rgba(120,180,255,.7)");g.addColorStop(1,"rgba(40,100,255,0)");x.fillStyle=g;x.fillRect(0,0,64,64);GLOW=new T3.CanvasTexture(c)}
const mat=c=>MATS[c]||(MATS[c]=new T3.MeshLambertMaterial({color:new T3.Color(c),side:T3.DoubleSide}));
const bmat=c=>MATS["b"+c]||(MATS["b"+c]=new T3.MeshBasicMaterial({color:new T3.Color(c)}));
function box(p,w,h,l,c,x,y,z){const m=new T3.Mesh(BOX,typeof c==="object"?c:mat(c));m.scale.set(w,h,l);m.position.set(x,y,z);p.add(m);return m}
function cyl(p,rx,len,rz,c,x,y,z,ax){const m=new T3.Mesh(CYL,typeof c==="object"?c:mat(c));if(ax==="z")m.rotation.x=PI/2;else if(ax==="x")m.rotation.z=PI/2;m.scale.set(rx,len,rz);m.position.set(x,y,z);p.add(m);return m}
/* extruded side profile (pts are [x forward, y up] in metres) -> solid body, optionally bevelled */
function prof(g,pts,W,c,bv){const sh=new T3.Shape();pts.forEach((p,i)=>i?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]));
 const geo=new T3.ExtrudeGeometry(sh,bv?{depth:W-2*bv,bevelEnabled:true,bevelThickness:bv,bevelSize:bv,bevelSegments:LOW?1:3}:{depth:W,bevelEnabled:false});
 geo.translate(0,0,-(bv?W-2*bv:W)/2);const m=new T3.Mesh(geo,typeof c==="object"?c:mat(c));m.rotation.y=PI/2;g.add(m);return m}
/* sloped glass pane between two profile points (windscreens / rear windows) */
function gp(g,W,x1,y1,x2,y2,o){o=o||.03;const z1=-x1,z2=-x2,dz=z2-z1,dy=y2-y1,len=Math.hypot(dz,dy);let nz=-dy/len,ny=dz/len;if(ny<0){nz=-nz;ny=-ny}
 const m=box(g,W,.04,len,GLASS,0,(y1+y2)/2+ny*o,(z1+z2)/2+nz*o);m.rotation.x=Math.atan2(-dy,dz)}
/* decals */
function tmat(key,w,h,f,rep,tr){let m=MATS[key];if(!m){const c=document.createElement("canvas");c.width=w;c.height=h;f(c.getContext("2d"),w,h);const t=new T3.CanvasTexture(c);
 if(T3.SRGBColorSpace)t.colorSpace=T3.SRGBColorSpace;else if(T3.sRGBEncoding)t.encoding=T3.sRGBEncoding;t.anisotropy=LOW?1:4;if(rep){t.wrapS=t.wrapT=T3.RepeatWrapping;t.repeat.set(rep,1)}
 m=MATS[key]=new T3.MeshLambertMaterial({map:t,transparent:!!tr,depthWrite:!tr,side:T3.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})}return m}
const battM=(a,b,n)=>tmat("bt"+a+b+n,64,32,(c,w,h)=>{c.fillStyle=a;c.fillRect(0,0,w,h);c.fillStyle=b;c.fillRect(w/2,0,w/2,h/2);c.fillRect(0,h/2,w/2,h/2)},n);
const chevM=(a,b)=>tmat("cv"+a+b,64,64,(c,w,h)=>{c.fillStyle=a;c.fillRect(0,0,w,h);c.fillStyle=b;for(let i=-1;i<5;i++){const y=i*16;c.beginPath();c.moveTo(0,y);c.lineTo(w/2,y+16);c.lineTo(w,y);c.lineTo(w,y+8);c.lineTo(w/2,y+24);c.lineTo(0,y+8);c.fill()}});
const shutM=()=>tmat("shut",64,64,(c,w,h)=>{c.fillStyle="#aab2bd";c.fillRect(0,0,w,h);c.fillStyle="#7d8794";for(let y=0;y<h;y+=6)c.fillRect(0,y,w,2);c.strokeStyle="#4b5563";c.lineWidth=3;c.strokeRect(1,1,w-2,h-2)});
function tm(text,col,mir){return tmat("t|"+text+col+(mir?1:0),LOW?256:512,LOW?48:96,(c,w,h)=>{const k=w/512;let fs=68*k;c.font="bold "+fs+"px Arial,Helvetica,sans-serif";while(c.measureText(text).width>w-20*k&&fs>16*k){fs-=4*k;c.font="bold "+fs+"px Arial,Helvetica,sans-serif"}
 c.fillStyle=col;c.textAlign="center";c.textBaseline="middle";if(mir){c.translate(w,0);c.scale(-1,1)}c.fillText(text,w/2,h/2+3*k)},0,true)}
function side(g,m,w,h,x,y,z){[1,-1].forEach(s=>{const p=new T3.Mesh(PLN,m);p.scale.set(w,h,1);p.position.set(s*x,y,z);p.rotation.y=s*PI/2;g.add(p)})}
function face(g,m,w,h,x,y,z,front){const p=new T3.Mesh(PLN,m);p.scale.set(w,h,1);p.position.set(x,y,z);p.rotation.y=front?PI:0;g.add(p)}
function txt(g,text,col,w,x,y,z,mode,mir){const m=tm(text,col,mir),h=w*96/512;if(mode==="side")side(g,m,w,h,x,y,z);else face(g,m,w,h,x,y,z,mode==="front")}
function batt(g,a,b,len,h,x,y,z){side(g,battM(a,b,Math.max(1,Math.round(len/h))),len,h,x,y,z)}
/* lights */
function lights(g,y,z,sp,V){box(g,sp*2+.9,.1,.38,"#0f172a",0,y,z);
 [0,1].forEach(i=>{const m=new T3.MeshBasicMaterial({color:OFF}),s=i?1:-1;V.lm[i].push(m);[1,.4].forEach(k=>box(g,Math.max(.3,sp*.5),.16,.34,m,s*sp*k,y+.12,z));
  const q=new T3.Sprite(new T3.SpriteMaterial({map:GLOW,color:0x3b82ff,transparent:true,depthWrite:false,blending:T3.AdditiveBlending,opacity:0}));q.scale.set(6,6,1);q.position.set(s*sp,y+.35,z);g.add(q);V.sp[i].push(q)})}
function fl(g,V,y,z,sp,sc){[0,1].forEach(i=>{const m=new T3.MeshBasicMaterial({color:OFF}),s=i?1:-1;V.lm[i].push(m);box(g,.24,.1,.06,m,s*sp,y,z);
 const q=new T3.Sprite(new T3.SpriteMaterial({map:GLOW,color:0x3b82ff,transparent:true,depthWrite:false,blending:T3.AdditiveBlending,opacity:0}));q.scale.set(sc||2.6,sc||2.6,1);q.position.set(s*sp,y,z-.1);g.add(q);V.sp[i].push(q)})}
function lamps(g,W,yh,yt,zf,zr,yp){[-1,1].forEach(s=>{box(g,.32,.14,.06,bmat("#fffbe6"),s*W*.36,yh,zf);box(g,.28,.16,.06,bmat("#ff2a2a"),s*W*.38,yt,zr)});
 box(g,.52,.12,.04,bmat("#f4f4f4"),0,yp,zf-.01);box(g,.52,.12,.04,bmat("#f6d100"),0,yp,zr+.01)}
function wheels(g,W,zs,r,w){w=w||.32;zs.forEach(z=>[-1,1].forEach(s=>{cyl(g,r*1.2,.12,r*1.2,"#0a0e14",s*(W/2-.05),r,z,"x");cyl(g,r,w,r,"#14181f",s*(W/2+.04-w/2),r,z,"x");if(!LOW)cyl(g,r*.55,.05,r*.55,"#c4ccd6",s*(W/2+.045),r,z,"x")}))}
function mirrors(g,W,y,z,c){[-1,1].forEach(s=>box(g,.14,.22,.1,c||"#1b2430",s*(W/2+.1),y,z))}

/* ----- cars: Astra/Focus/Corolla-style hatch, estate, saloon, SUV (profile fractions of length / height) ----- */
const BV=.07; /* body bevel: softens edges so panels look moulded, not boxy */
const PR={
 saloon:{p:[[.5,.2],[.5,.5],[.4,.56],[.22,.62],[.08,.98],[-.18,.98],[-.34,.66],[-.5,.64],[-.5,.2]],g:[[[.2,.66],[.09,.94],[-.02,.94],[-.02,.66]],[[-.07,.66],[-.07,.94],[-.17,.94],[-.29,.7]]],r:[[-.19,.96],[-.33,.68]]},
 hatch:{p:[[.5,.2],[.5,.5],[.4,.56],[.24,.62],[.1,.98],[-.28,.98],[-.5,.66],[-.5,.2]],g:[[[.21,.66],[.1,.94],[-.02,.94],[-.02,.66]],[[-.07,.66],[-.07,.94],[-.26,.94],[-.42,.7]]],r:[[-.29,.96],[-.49,.68]]},
 estate:{p:[[.5,.2],[.5,.5],[.4,.56],[.24,.62],[.1,.98],[-.4,.98],[-.5,.9],[-.5,.2]],g:[[[.21,.66],[.1,.94],[-.02,.94],[-.02,.66]],[[-.07,.66],[-.07,.94],[-.4,.94],[-.45,.7]]],r:[[-.5,.9],[-.5,.68]]},
 suv:{p:[[.5,.18],[.5,.58],[.42,.66],[.26,.7],[.12,1],[-.44,1],[-.5,.92],[-.5,.18]],g:[[[.22,.74],[.12,.96],[-.02,.96],[-.02,.74]],[[-.07,.74],[-.07,.96],[-.42,.96],[-.45,.76]]],r:[[-.5,.9],[-.5,.74]]}};
function car(c,V){const g=new T3.Group(),W=c.W,L=c.L,H=c.H,e=BV,P=PR[c.p||"hatch"],lv=LV[c.liv],bc=c.body||(lv&&lv.body)||"#cbd5e1",pt=P.p.map(q=>[q[0]*L,q[1]*H]),sc=a=>a.map(q=>[q[0]*L,q[1]*H]),zf=-L/2-e,zr=L/2+e;
 box(g,W*.9,H*.2,L*.86,"#10151c",0,H*.2,0);prof(g,pt,W,bc,e);P.g.forEach(q=>prof(g,sc(q),W+.06,GLASS));
 gp(g,W*.86,pt[3][0],pt[3][1],pt[4][0],pt[4][1],e+.03);gp(g,W*.84,P.r[0][0]*L,P.r[0][1]*H,P.r[1][0]*L,P.r[1][1]*H,e+.03);
 if(lv){const yb=H*.53;
  if(c.liv==="pol"){batt(g,lv.a,lv.b,L*.62,H*.17,W/2+.03,yb,-L*.02);side(g,bmat(lv.b),L*.19,H*.4,W/2+.02,H*.42,-L*.4);side(g,bmat(lv.b),L*.12,H*.4,W/2+.02,H*.42,L*.44)}
  else batt(g,lv.a,lv.b,L*.8,H*.19,W/2+.03,yb,0);
  txt(g,c.tx||lv.w,lv.tx,L*.34,W/2+.045,H*.31,-L*.02,"side");
  face(g,battM(lv.a,lv.b,Math.max(1,Math.round(W*.9/(H*.14)))),W*.9,H*.14,0,H*.46,zr+.03,false);
  txt(g,lv.w,lv.tx,W*.62,0,H*.34,zf-.03,"front",c.liv!=="pol")}
 mirrors(g,W,H*.66,-L*.2,bc);lamps(g,W,H*.4,H*.42,zf-.02,zr+.02,H*.3);
 if(c.bar===false){fl(g,V,H*.38,zf-.05,W*.22);fl(g,V,H*.95,-L*.1,W*.3,2)}else{lights(g,H*.98+e,L*.04,W*.26,V);fl(g,V,H*.38,zf-.05,W*.22)}
 wheels(g,W,[-L*.31,L*.31],c.p==="suv"?.38:.33);return g}

/* ----- vans (Sprinter / Transit style): LAS ambulances, police vans, command vehicles ----- */
const VP=[[.5,.22],[.5,.5],[.45,.58],[.34,.62],[.27,.96],[-.5,.98],[-.5,.22]];
function van(c,V){const g=new T3.Group(),W=c.W,L=c.L,H=c.H,e=BV,lv=LV[c.liv],amb=c.liv==="amb",bc=c.body||lv.body,pt=VP.map(q=>[q[0]*L,q[1]*H]),sc=a=>a.map(q=>[q[0]*L,q[1]*H]),zf=-L/2-e,zr=L/2+e;
 box(g,W*.9,H*.2,L*.88,"#10151c",0,H*.2,0);prof(g,pt,W,bc,e);box(g,W*.97,H*.24,.3,"#171d26",0,H*.33,zf+.05);
 prof(g,sc([[.31,.66],[.27,.91],[.17,.91],[.17,.66]]),W+.06,GLASS);gp(g,W*.86,pt[3][0],pt[3][1],pt[4][0],pt[4][1],e+.03);
 if(c.ex==="mesh")prof(g,sc([[.1,.62],[.1,.9],[-.44,.9],[-.44,.62]]),W+.04,"#2b3441");
 if(c.ex==="boat")box(g,W*.7,.5,L*.4,"#f97316",0,H+.3,L*.12);
 batt(g,lv.a,lv.b,L*.8,amb?H*.26:H*.17,W/2+.03,amb?H*.3:H*.36,L*.1);
 txt(g,c.tx||(amb?"Emergency Ambulance":lv.w),amb&&!c.tx?"#d9381e":lv.tx,Math.min(L*.42,3.6),W/2+.045,H*.68,L*.14,"side");
 if(c.liv==="pol")face(g,battM(lv.a,lv.b,Math.max(1,Math.round(W*.9/(H*.17)))),W*.9,H*.17,0,H*.5,zr+.03,false);
 else face(g,chevM(lv.a,lv.b),W*.9,H*.3,0,H*.4,zr+.03,false);
 mirrors(g,W,H*.7,-L*.3);lamps(g,W,H*.38,H*.4,zf-.18,zr+.02,H*.27);
 lights(g,H*.98+e,-L*.32,W*.3,V);fl(g,V,H*.36,zf-.2,W*.24);
 wheels(g,W,L>7?[-L*.34,L*.2,L*.34]:[-L*.33,L*.3],.4);return g}

/* ----- pickup (wildfire 4x4) ----- */
const PK=[[.5,.2],[.5,.5],[.4,.55],[.22,.6],[.1,.98],[-.12,.98],[-.2,.62],[-.5,.62],[-.5,.2]];
function pickup(c,V){const g=new T3.Group(),W=c.W,L=c.L,H=c.H,sc=a=>a.map(q=>[q[0]*L,q[1]*H]),pt=sc(PK);
 box(g,W*.9,H*.2,L*.86,"#10151c",0,H*.22,0);prof(g,pt,W,c.body);
 prof(g,sc([[.2,.66],[.1,.94],[-.1,.94],[-.16,.66]]),W+.06,GLASS);gp(g,W*.86,pt[3][0],pt[3][1],pt[4][0],pt[4][1]);
 box(g,W*.82,H*.34,L*.24,"#a8121a",0,H*.62+H*.17,L*.28);box(g,W*.5,.12,L*.2,"#9ca3af",0,H*.62+H*.34+.08,L*.28);
 batt(g,"#c8161d","#f4e20a",L*.7,H*.14,W/2+.03,H*.42,0);txt(g,"FIRE","#ffffff",1.4,W/2+.045,H*.28,-L*.15,"side");
 txt(g,"FIRE","#ffffff",W*.6,0,H*.34,-L/2-.03,"front",true);mirrors(g,W,H*.68,-L*.18);lamps(g,W,H*.4,H*.5,-L/2-.02,L/2+.02,H*.3);
 lights(g,H*.99,-L*.02,W*.26,V);fl(g,V,H*.38,-L/2-.04,W*.22);wheels(g,W,[-L*.31,L*.31],.45,.36);return g}

/* ----- fire appliances (Volvo FL-style crew cab pump, rescue tender, water carrier, aerial ladder platform) ----- */
function truck(c,V){const g=new T3.Group(),W=c.W,L=c.L,H=c.H,cab=c.cab,xf=L/2,cH=H*.9,by=.55,lv=LV[c.liv||"fir"],bc=c.body||lv.body,bl=L-cab,zc=cab/2,bh=H-by,RY="#f4e20a",RD="#c8161d";
 box(g,W*.92,.45,L*.96,"#1b2430",0,.45,0);
 if(c.ex==="tank"){box(g,W,.3,bl,"#1b2430",0,by+.1,zc);cyl(g,W*.5,bl-.2,bh*.5,bc,0,by+bh*.5+.1,zc,"z");[-1,1].forEach(s=>box(g,.06,.12,bl-.4,RY,s*(W*.5),by+bh*.5+.1,zc))}
 else box(g,W,bh,bl,bc,0,by+bh/2,zc);
 prof(g,[[xf-cab,by],[xf-cab,cH],[xf-.3,cH],[xf-.05,cH*.7],[xf,cH*.66],[xf,by]],W,bc);
 gp(g,W*.92,xf-.05,cH*.72,xf-.3,cH-.08);
 (cab>2.8?[[xf-.5,xf-1.6],[xf-1.75,xf-cab+.4]]:[[xf-.5,xf-cab+.4]]).forEach(w=>prof(g,[[w[0],cH*.72],[w[0]-.12,cH-.12],[w[1],cH-.12],[w[1],cH*.72]],W+.06,GLASS));
 box(g,W*.88,.8,.06,"#0b0f14",0,by+.6,-xf-.03);txt(g,"FIRE","#ffffff",.95,W*.2,by+.6,-xf-.07,"front");txt(g,"FIRE","#ffffff",.95,-W*.2,by+.6,-xf-.07,"front",true);
 box(g,W*.97,.3,.3,"#2b3441",0,by+.05,-xf-.1);face(g,chevM(RD,"#ffffff"),W*.92,.26,0,by+.05,-xf-.26,true);
 lamps(g,W,by+.15,by+.5,-xf-.28,xf+.02,by-.1);mirrors(g,W,cH*.82,-xf+.7,"#111827");
 batt(g,RD,RY,cab*.92,.76,W/2+.03,by+.95,-xf+cab/2);
 if(c.ex!=="tank"){const sh=shutM();[-.24,.24].forEach(k=>side(g,sh,bl*.46,bh*.8,W/2+.02,by+bh*.5,zc+bl*k));batt(g,RD,RY,bl*.96,.76,W/2+.035,by+bh*.5,zc);side(g,bmat(RY),bl*.98,.16,W/2+.025,H-.12,zc)}
 if(c.tx)txt(g,c.tx,"#ffffff",Math.min(bl*.55,3.8),W/2+.045,by+bh*.84,zc,"side");
 face(g,chevM(RD,RY),W*.92,bh*.32,0,by+bh*.22,xf+.03,false);
 if(c.kind==="ladder"||c.ex==="turntable"){const ty=H+.5,bll=9,th=.14,cz=L/2-1.2-bll/2*Math.cos(th);
  const bm2=box(g,.5,.45,bll,"#d1d5db",0,ty+bll/2*Math.sin(th),cz);bm2.rotation.x=th;
  box(g,1.7,.9,1.3,"#e5e7eb",0,ty+bll*Math.sin(th)+.35,cz-bll/2*Math.cos(th));box(g,2.2,.3,2.2,"#374151",0,ty-.2,L/2-1.5);
  [-1,1].forEach(s=>cyl(g,.18,.9,.18,"#374151",s*(W/2+.15),.5,L/2-2.2,"x"))}
 else if(c.ex==="crane"){box(g,.45,.4,4.4,"#374151",.5,H+.45,cab/2+.4).rotation.x=.18;box(g,2.2,.5,1.6,RD,0,H+.15,L/2-1.4)}
 else if(c.ex==="pods"){box(g,W*.8,.5,bl*.5,"#e5e7eb",0,H+.25,zc+.4)}
 else if(c.ex!=="tank"){[-.5,.5].forEach(s=>{box(g,.1,.1,bl-.4,"#c5ccd6",s,H+.12,zc);box(g,.1,.1,bl-.4,"#c5ccd6",s*.55,H+.3,zc)});[-.7,-.3,.1,.5,.9].forEach(q=>box(g,1.1,.05,.06,"#c5ccd6",0,H+.12,zc+q*(bl*.45)))}
 lights(g,cH+.04,-xf+.45,W*.34,V);fl(g,V,by+.55,-xf-.08,W*.3,3);
 wheels(g,W,L>=9?[-xf+1.5,xf-3.2,xf-1.5]:[-xf+1.5,xf-1.5],.5,.4);return g}

/* ----- motorbikes: BMW police bike / paramedic response bike ----- */
function bike(c,V){const g=new T3.Group(),lv=LV[c.liv||"pol"];
 [-.8,.8].forEach(z=>{cyl(g,.34,.14,.34,"#111827",0,.34,z,"x");cyl(g,.2,.16,.2,"#cbd5e1",0,.34,z,"x")});
 box(g,.34,.12,1.3,"#1f2937",0,.62,.05);box(g,.42,.42,.8,lv.body,0,.8,-.1);box(g,.5,.5,.3,lv.body,0,.98,-.72);box(g,.4,.34,.04,GLASS,0,1.3,-.8).rotation.x=-.5;
 box(g,.4,.12,.9,"#1f2937",0,.62,.5);
 [-1,1].forEach(s=>{box(g,.26,.34,.5,lv.body,s*.3,.7,.62);side(g,battM(lv.a,lv.b,1),.46,.14,.44,.7,.62);cyl(g,.04,.8,.04,"#9ca3af",s*.24,.7,-.78,"z")});
 box(g,.42,.36,.5,lv.body,0,1.12,.95);txt(g,lv.w,lv.tx,.4,0,1.12,1.21,"rear");
 box(g,.5,.62,.34,"#f4e20a",0,1.35,.12).rotation.x=.12;box(g,.12,.12,.55,"#f4e20a",.32,1.2,-.3);box(g,.12,.12,.55,"#f4e20a",-.32,1.2,-.3);
 box(g,.4,.5,.2,"#111827",0,.85,.38);const hd=new T3.Mesh(SPH,mat("#f8fafc"));hd.scale.set(.2,.22,.22);hd.position.set(0,1.85,0);g.add(hd);box(g,.2,.1,.05,GLASS,0,1.85,-.2);
 fl(g,V,1.05,-.9,.22,2.2);fl(g,V,1.45,1.22,.14,2.2);return g}

/* ----- helicopters: NPAS-style police (EC135) / air ambulance ----- */
function heli(c,V){const g=new T3.Group(),amb=c.liv==="amb",bc=amb?"#d51a1a":"#17306b",tx=amb?"AIR AMBULANCE":"POLICE",W=2.1;
 prof(g,[[2.0,1.15],[2.1,1.75],[1.2,2.5],[-.6,2.6],[-1.7,2.25],[-2.4,1.7],[-2.4,1.4],[-1.5,1.0],[1.4,.95]],W,bc,.3);
 prof(g,[[1.9,1.3],[1.95,1.7],[1.15,2.35],[.7,2.35],[.7,1.3]],W+.06,GLASS);
 box(g,.3,.36,5.2,bc,0,1.72,4.9);box(g,.12,1.2,.8,bc,0,2.3,7.3);box(g,1.6,.1,.5,bc,0,1.85,6.6);
 const tr=new T3.Mesh(new T3.TorusGeometry(.5,.07,8,16),mat(bc));tr.rotation.y=PI/2;tr.position.set(0,2.1,7.0);g.add(tr);
 side(g,bmat("#f4e20a"),3.6,.18,W/2+.02,1.35,.2);txt(g,tx,"#ffffff",2.6,W/2+.03,1.75,.1,"side");
 [-1,1].forEach(s=>{box(g,.1,.1,3.8,"#374151",s*.95,.3,-.1);[-1,1].forEach(z=>box(g,.08,.9,.08,"#374151",s*.9,.75,z))});
 const r=new T3.Group();r.position.set(0,3.15,0);box(r,10.2,.05,.35,"#111827",0,0,0);box(r,.35,.05,10.2,"#111827",0,0,0);box(g,.25,.5,.25,"#374151",0,2.9,0);g.add(r);V.rotor=r;
 fl(g,V,1.1,-2.2,.55,4);fl(g,V,2.9,6.8,.12,3);return g}

const KIND={
 pump:{k:"truck",liv:"fir",L:8.6,W:2.5,H:3.2,cab:3.5},rt:{k:"truck",liv:"fir",L:8.4,W:2.5,H:3.1,cab:3.4,tx:"RESCUE"},
 wc:{k:"truck",liv:"fir",L:9,W:2.5,H:2.8,cab:2.4,ex:"tank",tx:"WATER CARRIER"},alp:{k:"truck",liv:"fir",L:10.5,W:2.5,H:3,cab:2.4,ex:"turntable"},
 icu:{k:"van",liv:"fir",L:6.4,W:2.3,H:2.8,tx:"INCIDENT COMMAND"},hmu:{k:"truck",liv:"fir",L:8,W:2.5,H:3.1,cab:2.4,ex:"pods",tx:"HAZMAT"},
 usar:{k:"truck",liv:"fir",L:8.2,W:2.5,H:3.1,cab:2.4,ex:"crane",tx:"RESCUE"},wru:{k:"van",liv:"fir",L:5.8,W:2.2,H:2.6,ex:"boat",tx:"WATER RESCUE"},
 wf:{k:"pickup",body:"#c8161d",L:5.6,W:2.1,H:2.2},fo:{k:"car",p:"suv",liv:"fir",L:4.7,W:1.9,H:1.6},
 irv:{k:"car",p:"estate",liv:"pol",L:4.6,W:1.9,H:1.5},sgt:{k:"car",p:"hatch",liv:"pol",L:4.5,W:1.85,H:1.5},rp:{k:"car",p:"estate",liv:"pol",L:4.9,W:1.95,H:1.5},
 arv:{k:"car",p:"suv",liv:"pol",L:4.9,W:2,H:1.7},cid:{k:"car",p:"saloon",body:"#475569",bar:false,L:4.7,W:1.9,H:1.45},
 van:{k:"van",liv:"pol",L:5.6,W:2.2,H:2.5},dog:{k:"van",liv:"pol",L:5.2,W:2.1,H:2.3,tx:"DOG UNIT"},po:{k:"van",liv:"pol",L:7.2,W:2.4,H:2.8,ex:"mesh"},
 mc:{k:"bike",liv:"pol"},hel:{k:"heli",liv:"pol"},
 dca:{k:"van",liv:"amb",L:6.3,W:2.3,H:2.9},mci:{k:"van",liv:"amb",L:8,W:2.5,H:3.1,tx:"MAJOR INCIDENT"},hart:{k:"van",liv:"amb",L:6.6,W:2.3,H:2.9,tx:"HART"},
 rrv:{k:"car",p:"estate",liv:"amb",L:4.5,W:1.85,H:1.5},ao:{k:"car",p:"estate",liv:"amb",L:4.7,W:1.9,H:1.5},ccc:{k:"car",p:"suv",liv:"amb",L:4.8,W:1.95,H:1.65},
 bike:{k:"bike",liv:"amb"},air:{k:"heli",liv:"amb"}};
function cfgFor(ty){if(KIND[ty])return KIND[ty];const sv=U[ty]&&U[ty][0];return sv==="f"?KIND.pump:sv==="p"?KIND.irv:KIND.dca}
/* merge a model's static parts: one mesh (one draw call) per material, instead of one per part (a vehicle is ~100 parts).
   Parts that move or animate stay separate: the helicopter rotor (V.rotor). Lights keep their own materials, so their colour still
   changes, and their glow sprites are not meshes, so they are left alone. */
function mergeStatic(g,V){
 g.updateMatrixWorld(true);const inv=new T3.Matrix4().copy(g.matrixWorld).invert(),rotor=V.rotor,groups=new Map(),drop=[];
 g.traverse(o=>{if(!o.isMesh||o===g||o.isSprite)return;
  for(let p=o;p;p=p.parent)if(p===rotor)return;
  const rel=new T3.Matrix4().multiplyMatrices(inv,o.matrixWorld),key=o.material.uuid;
  if(!groups.has(key))groups.set(key,{mat:o.material,parts:[]});
  groups.get(key).parts.push({geo:o.geometry,m:rel});drop.push(o)});
 if(drop.length<2)return;
 for(const grp of groups.values()){
  const geos=grp.parts.map(it=>{const geo=it.geo.index?it.geo.toNonIndexed():it.geo.clone();geo.applyMatrix4(it.m);return geo});
  let n=0;geos.forEach(geo=>n+=geo.attributes.position.count);
  const out=new T3.BufferGeometry();
  ["position","normal","uv"].forEach(nm=>{if(!geos.every(geo=>geo.attributes[nm]))return;
   const size=geos[0].attributes[nm].itemSize,arr=new Float32Array(n*size);let off=0;
   geos.forEach(geo=>{arr.set(geo.attributes[nm].array,off);off+=geo.attributes[nm].array.length});
   out.setAttribute(nm,new T3.BufferAttribute(arr,size))});
  out.computeBoundingSphere();
  g.add(new T3.Mesh(out,grp.mat));
  geos.forEach(geo=>geo.dispose())}
 const shared=[BOX,CYL,SPH,CIR,PLN];
 drop.forEach(o=>{g.remove(o);if(o.geometry&&!shared.includes(o.geometry))o.geometry.dispose()})}
function buildVehicle(u){const c=cfgFor(u.ty),V={u,lm:[[],[]],sp:[[],[]],ph:Math.random()*8,h:null,alt:0,spool:0,rotor:null,on:false};
 const g=c.k==="heli"?heli(c,V):c.k==="bike"?bike(c,V):c.k==="car"?car(c,V):c.k==="van"?van(c,V):c.k==="pickup"?pickup(c,V):truck(Object.assign({kind:c.k},c),V);
 mergeStatic(g,V);const root=new T3.Group();root.add(g);root.traverse(o=>{o.frustumCulled=false});V.g=g;V.root=root;return V}

/* ---------- 3D world ---------- */
const W3={frames:0,err:null,adds:0};const VM_MAX=70; /* largest scale vehicles are drawn at when zoomed out (keeps them readable) */
let VM=1,map3=null,scene,camera,renderer,fleet={},mk={s:{},h:{},m:{},u:{}},vlb={},timers=[],hud=null,follow=null,radLock=false,lastT=0,lastLb=0,rt0=0,rpT=0,keepGoing=false,routesEmpty=true,TMP=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),D2R=Math.PI/180;
const mercOf=(lat,lon)=>maplibregl.MercatorCoordinate.fromLngLat({lng:lon,lat:lat},0);
function angLerp(a,b,f){let d=((b-a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return a+d*f}
function headingOf(u){if(!u.rt||!u.rt.d||!(u.st==="out"||u.st==="back"||u.st==="hosp"))return null;return headingAt(u,dd(u))}
function headingAt(u,d0){
 const a=along(u.rt,Math.max(0,d0-.015)),b=along(u.rt,d0+.015),dy=b[0]-a[0],dx=(b[1]-a[1])*Math.cos(a[0]*D2R);
 return Math.abs(dx)+Math.abs(dy)<1e-9?null:Math.atan2(dx,dy)}
/* on-scene units: the order they arrived in, per call (first arrival parks nearest the call) */
function scnSlots(){const g={};S.un.forEach(x=>{if(x.st==="scene"&&x.mid)(g[x.mid]=g[x.mid]||[]).push(x)});
 for(const k in g)g[k].sort((a,b)=>((a.arr||0)-(b.arr||0))||(a.id-b.id));return g}
/* walk the parked trail (anchor first) to distance w metres from the anchor */
function walkT(T,w){for(let i=0;i<T.length-1;i++){const s=km(T[i],T[i+1])*1000;if(w<=s||i===T.length-2)return{a:T[i],b:T[i+1],f:s>0?w/s:0};w-=s}return null}
/* kerb spot for an on-scene unit: nose to tail along the road it came in on, 3.5 m in from the nearside (left, UK) kerb, facing the way it drove */
function parkOf(u,slots){if(!u.app||u.st!=="scene")return null;const list=slots[u.mid]||[u];const k=Math.max(0,list.findIndex(x=>x.id===u.id));
 const sg=walkT(u.app,3+k*10);if(!sg)return null;
 const de=(sg.b[1]-sg.a[1])*111320*Math.cos(sg.a[0]*D2R),dn=(sg.b[0]-sg.a[0])*111320;
 const tl=Math.hypot(de,dn);if(tl<1e-9)return null;
 const te=-de/tl,tn=-dn/tl;                       /* travel direction: towards the call */
 const cx=sg.a[1]+(sg.b[1]-sg.a[1])*sg.f,cy=sg.a[0]+(sg.b[0]-sg.a[0])*sg.f;
 /* nearside = left of travel: (east,north) offset is (-tn,te) */
 const lat=cy+(te*3.5)/111320;
 return{p:[lat,cx+(-tn*3.5)/(111320*Math.cos(lat*D2R))],h:Math.atan2(te,tn)}}
/* where a unit is drawn, plus the spot offset so parked / on-scene units don't stack */
function posOf(u,i){const p=upos(u);let ox=0,oy=0;
 if(u.st==="idle"){const k=i%8,r=Math.floor(i/8);ox=((k%4)-1.5)*9;oy=20+r*12+(k>=4?10:0)}
 else if(u.st==="scene"){const a=((u.id*137)%360)*D2R,r=7+(u.id%4)*3;ox=Math.sin(a)*r;oy=Math.cos(a)*r}
 return[p[0]+oy/111320,p[1]+ox/(111320*Math.cos(p[0]*D2R))]}
const isLit=u=>u.st==="out"||u.st==="hosp"||u.st==="scene";

/* helicopters: cruise high enough to clear most rooftops (was 45 m, which clipped buildings) */
const HEL_ALT=200,HEL_GAP=25,ORBIT_ALT=120,ORBIT_R=110,ORBIT_T=45,ROTOR_R=6.5,SPOOL_UP=.3,SPOOL_DN=.2,LAND_WAIT=3000;
/* police helicopters (ty "hel") never land: they orbit the scene. Air ambulances (ty "air") land on a clear spot next to it. */
const isHel=u=>u.ty==="hel";
const isAmb=u=>u.ty==="air";
/* an air ambulance on scene puts down on open road or green space nearest the call, never on a building.
   the search runs in real metres on the ground (not screen pixels, which are distorted when the map is tilted), and the spot must
   also be clear of buildings around the rotor disc. returns [lat,lon], null if nothing suitable within 400 m, or undefined if the
   map tiles aren't in yet (try again later). there is no fallback to the call point itself. */
function landSpot(u,taken,st){if(!map3||!map3.areTilesLoaded||!map3.areTilesLoaded())return undefined;
 const LAND_BUDGET=24;   /* candidate spots checked per call: the search resumes next tick, so the page never stalls */
 const ll=upos(u),la0=ll[0],lo0=ll[1],cosL=Math.cos(la0*D2R);
 const enu=(e,n)=>[la0+n/111320,lo0+e/(111320*cosL)];   /* metres east/north of the call -> [lat,lon] */
 const off=(la,lo,e,n)=>[la+n/111320,lo+e/(111320*Math.cos(la*D2R))];   /* metres east/north of any point */
 const sc=(la,lo)=>{try{const p=map3.project([lo,la]);return[p.x,p.y]}catch(e){return null}};
 /* what is drawn at a screen point: "b" building, "open" road or green space, "" anything else */
 const kind=(x,y)=>{let f=[];try{f=map3.queryRenderedFeatures([[x-2,y-2],[x+2,y+2]])}catch(e){}
  let road=false,green=false;
  for(const q of f){const sl=q.sourceLayer||"",cl=String((q.properties&&q.properties.class)||"");
   if(sl==="building")return "b";
   if(sl==="transportation"){if(!/rail|transit|path|track|busway|raceway/i.test(cl))road=true}
   else if(/^(park|landcover|landuse)$/.test(sl)&&/park|grass|wood|scrub|farm|meadow|recreation|pitch|golf|garden|cemetery|sand/i.test(cl))green=true}
  return road||green?"open":""};
 /* the centre must be open ground, and no building may touch the rotor disc */
 const clear=(la,lo)=>{const c=sc(la,lo);if(!c||kind(c[0],c[1])!=="open")return false;
  for(let i=0;i<8;i++){const a=i/8*2*Math.PI,q=off(la,lo,Math.cos(a)*ROTOR_R,Math.sin(a)*ROTOR_R),s=sc(q[0],q[1]);if(!s||kind(s[0],s[1])==="b")return false}
  return true};
 let checked=0;
 while(st.d<=400){const d=st.d,n=d?Math.max(8,Math.round(2*Math.PI*d/15)):1;
  while(st.k<n){const k=st.k++,a=k/n*2*Math.PI,q=enu(Math.cos(a)*d,Math.sin(a)*d);
   if(taken.some(t=>km(t,q)<HEL_GAP/1000))continue;
   if(++checked>LAND_BUDGET)return undefined;   /* out of budget: st keeps where we are */
   if(clear(q[0],q[1])){st.d=0;st.k=0;return q}}
  st.d+=15;st.k=0}
 st.d=0;st.k=0;return null}
/* per-frame state of a helicopter or air ambulance (null for road vehicles):
   - rotor spool: spins up before any lift and spins down only after touchdown
   - ground hold: stays put on the station or landing spot until the rotor is up
   - police helicopter on scene: orbits the scene at ORBIT_ALT, never lands
   - air ambulance on scene: descends onto its landing spot; while no spot is found yet it orbits
   Returns {p:[lat,lon], h:heading or null, alt, spool}. */
function airStep(V,u,dt,t){
 if(!(isHel(u)||isAmb(u)))return null;
 const onScene=u.st==="scene",orbiting=onScene&&(isHel(u)||!V.land),
  moving=u.st==="out"||u.st==="back"||u.st==="hosp",intent=moving||orbiting;
 V.spool=clamp(V.spool+(intent||V.alt>.5?SPOOL_UP:-SPOOL_DN)*dt,0,1);
 const lift=intent&&(V.spool>=.95||V.alt>.5),cruise=orbiting?ORBIT_ALT:HEL_ALT;
 V.alt+=((lift?cruise:0)-V.alt)*Math.min(1,dt*1.5);
 if(!lift&&V.alt<.05)V.alt=0;
 let p=upos(u),h=null;
 if(orbiting){const c=upos(u),w=t*2*Math.PI/ORBIT_T+u.id*1.9,R=ORBIT_R+(u.id%3)*20,e=Math.cos(w)*R,n=Math.sin(w)*R;
  p=[c[0]+n/111320,c[1]+e/(111320*Math.cos(c[0]*D2R))];h=Math.atan2(-Math.sin(w),Math.cos(w))}
 else if(onScene){p=V.land||upos(u)}
 else if(moving&&u.rt&&u.rt.d){
  if(V.lrt!==u.rt){V.lrt=u.rt;V.dOff=0}
  if(!lift){ /* still on the ground: hold position and face the way out while the rotor comes up */
   V.dOff=dd(u);V.hold=V.hold||V.ll||along(u.rt,0);p=V.hold;h=headingAt(u,0)}
  else{ /* airborne: fly the leg, offset by the time spent on the ground so there is no jump */
   V.hold=null;const prog=Math.max(0,Math.min(u.rt.len,dd(u)-(V.dOff||0)));p=along(u.rt,prog);h=headingAt(u,prog)}}
 /* when the state changes, glide from where the aircraft was drawn last frame instead of teleporting */
 const mode=u.st+"|"+(orbiting?"o":"")+(lift?"l":"")+(onScene&&V.land?"L":"");
 if(V.amode!==undefined&&V.amode!==mode&&V.ll)V.gap=[V.ll[0]-p[0],V.ll[1]-p[1]];
 V.amode=mode;
 if(V.gap){const f=Math.exp(-dt*1.5);V.gap=[V.gap[0]*f,V.gap[1]*f];
  if(Math.abs(V.gap[0])+Math.abs(V.gap[1])<1e-8)V.gap=null;else p=[p[0]+V.gap[0],p[1]+V.gap[1]]}
 return{p,h,alt:V.alt,spool:V.spool}}
function vehicleLayer(){return{id:"veh3d",type:"custom",renderingMode:"3d",
 onAdd(m,gl){W3.adds++;scene=new T3.Scene();camera=new T3.Camera();TMP={a:new T3.Matrix4(),b:new T3.Matrix4(),v:new T3.Vector3()};const k=(parseInt(T3.REVISION,10)>=155)?Math.PI:1;scene.add(new T3.AmbientLight(0xffffff,.8*k));const sun=new T3.DirectionalLight(0xffffff,.55*k);sun.position.set(.4,1,.3);scene.add(sun);
  renderer=new T3.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:true});renderer.autoClear=false},
 render(gl,a){if(!map3||!renderer)return;try{const arr=Array.isArray(a)||(a&&a.length===16)?a:(a&&a.defaultProjectionData&&a.defaultProjectionData.mainMatrix);if(!arr)return;
  const t=performance.now()/1000,dt=Math.min(.1,t-(lastT||t));lastT=t;
  const c=map3.getCenter(),mc=mercOf(c.lat,c.lng),s=(mc.meterInMercatorCoordinateUnits||mc.meterInMercatorUnits).call(mc),z=map3.getZoom();
  const mpp=78271.517*Math.cos(c.lat*D2R)/Math.pow(2,z),vm=clamp(34*mpp/5,1,VM_MAX);VM=vm;
  const idx={};let anyVis=false,chg=false,anyMove=false;keepGoing=false;const slots=scnSlots();
  /* only draw vehicles that are on screen (+15% margin): each one is ~100+ meshes, so off-screen ones are pure waste */
  const B=map3.getBounds(),bw=B.getWest(),be=B.getEast(),bs=B.getSouth(),bn=B.getNorth(),mx=(be-bw)*.15,my=(bn-bs)*.15;
  for(const id in fleet){const V=fleet[id],u=V.u;if(!S)continue;const A=airStep(V,u,dt,t);
   if(u.st==="idle"||u.st==="hand"){if(V.root.visible){V.root.visible=false;chg=true}continue}/* parked: hidden, skip all the maths */
   const sid=u.st==="idle"?u.sid:0;const i=sid?(idx[sid]=(idx[sid]||0)+1)-1:0,pk=parkOf(u,slots);const lagOn=!pk&&!!u.rt&&!!u.rt.d&&(u.st==="out"||u.st==="back"||u.st==="hosp");const lg=lagOn?clamp(V.lag||0,-dd(u),Math.max(0,u.rt.len-dd(u))):0;
   const p=A?A.p:pk?pk.p:lagOn?along(u.rt,dd(u)+lg):(u.st==="scene"&&V.land?V.land:posOf(u,i)),m=mercOf(p[0],p[1]);
   const hd=A?A.h:pk?pk.h:lagOn?headingAt(u,dd(u)+lg):headingOf(u);if(hd!=null)V.h=V.h==null?hd:angLerp(V.h,hd,Math.min(1,dt*2.5));else if(V.h==null)V.h=(u.id%8)*Math.PI/4;
   
   V.ll=p;const bx=(m.x-mc.x)/s,bz=(m.y-mc.y)/s;V.bx=bx;V.bz=bz;V.root.position.set(bx,V.alt,bz);V.root.rotation.y=-V.h;V.root.scale.setScalar(vm);{const vis=u.st!=="hand"&&u.st!=="idle"&&p[1]>bw-mx&&p[1]<be+mx&&p[0]>bs-my&&p[0]<bn+my;if(vis!==V.root.visible)chg=true;if(vis){anyVis=true;if(u.st==="out"||u.st==="back"||u.st==="hosp"||(A&&A.alt>0))anyMove=true}V.root.visible=vis}/* vehicles parked at their station are hidden */
   if(V.rotor&&u.st!=="idle")V.rotor.rotation.y+=dt*35*(A?A.spool:1);
   const lit=isLit(u);
   if(lit){const k=Math.floor(t*8+V.ph)%8,L=k===0||k===2,R=k===4||k===6;
    V.lm[0].forEach(x=>x.color.setHex(L?ON:OFF));V.lm[1].forEach(x=>x.color.setHex(R?ON:OFF));
    V.sp[0].forEach(x=>x.material.opacity=L?.95:0);V.sp[1].forEach(x=>x.material.opacity=R?.95:0);V.on=true}
   else if(V.on){V.lm[0].concat(V.lm[1]).forEach(x=>x.color.setHex(OFF));V.sp[0].concat(V.sp[1]).forEach(x=>x.material.opacity=0);V.on=false}}
  /* stop vehicles driving or parking through each other. A moving vehicle slides back or forward along its own route (V.lag, km),
     so a convoy queues single file and each car reaches a bend at its own time. Parked-on-scene vehicles stay put. */
  const sep=[];for(const id in fleet){const V=fleet[id];if(!V.root.visible||V.alt>1||V.bx==null){V.lag=0;continue}const c=cfgFor(V.u.ty);const mv=!!V.u.rt&&!!V.u.rt.d&&(V.u.st==="out"||V.u.st==="back"||V.u.st==="hosp");sep.push({V,r:Math.max(c.L||4.5,c.W||2)/2,fix:!mv})}
  const kk=Math.min(1,dt*10),dec=Math.min(1,dt*.15),gap=2;
  for(let it=0;it<8;it++)for(let i=0;i<sep.length;i++)for(let j=i+1;j<sep.length;j++){
   const A=sep[i],B=sep[j],wi=A.fix?0:1,wj=B.fix?0:1;if(!wi&&!wj)continue;
   const M=wi?A:B,O=wi?B:A,mv=M.V,ov=O.V;
   const h=mv.h||0,fx=Math.sin(h),fz=-Math.cos(h),sx=Math.cos(h),sz=Math.sin(h);
   const rx=ov.bx-mv.bx,rz=ov.bz-mv.bz;
   const sl=rx*fx+rz*fz,ln=rx*sx+rz*sz,minD=A.r+B.r+gap;
   if(Math.abs(ln)>=1.9||Math.abs(sl)>=minD)continue; /* only vehicles about one car-width apart sideways share a lane */
   const sg=sl>=0?1:-1,halfM=(minD-Math.abs(sl))*.5*kk,mM=O.fix?2*halfM:halfM;
   mv.bx-=sg*fx*mM;mv.bz-=sg*fz*mM;mv.lag=(mv.lag||0)-sg*mM/1000;
   if(!O.fix){ov.bx+=sg*fx*halfM;ov.bz+=sg*fz*halfM;ov.lag=(ov.lag||0)+sg*halfM/1000}
  }
  for(const o of sep){const V=o.V;V.lag=o.fix?0:clamp((V.lag||0)*(1-dec),-.08,.08);V.root.position.x=V.bx;V.root.position.z=V.bz}
  TMP.a.makeTranslation(mc.x,mc.y,0).scale(TMP.v.set(s,-s,s)).multiply(TMP.b.makeRotationX(Math.PI/2));
  camera.projectionMatrix.fromArray(arr).multiply(TMP.a);
  keepGoing=anyVis||chg||!!follow;
  if(renderer.resetState)renderer.resetState();else renderer.state.reset();
  renderer.render(scene,camera);W3.frames++}catch(e){if(!W3.err){W3.err=String(e&&e.message||e);console.error('3D render error',e);try{toast('3D vehicle error: '+W3.err)}catch(x){}}}
  /* only keep redrawing (capped ~30fps) while a vehicle is visible; otherwise the map renders on demand and the GPU idles */
  if(map3&&keepGoing&&!rpT&&!document.hidden)rpT=setTimeout(()=>{rpT=0;if(map3)map3.triggerRepaint()},33)}}}
/* restart the repaint loop when a unit becomes active */
function kick(){if(map3&&!rpT&&S&&S.un.some(u=>u.st!=="idle"&&u.st!=="hand"))map3.triggerRepaint()}

/* reconcile 3D models with the game's units */
function disposeV(V){try{V.root.traverse(o=>{if(o.geometry&&o.geometry!==BOX&&o.geometry!==CYL&&o.geometry!==SPH&&o.geometry!==CIR&&o.geometry!==PLN)o.geometry.dispose();if(o.isSprite&&o.material)o.material.dispose()});V.lm[0].concat(V.lm[1]).forEach(m=>m.dispose())}catch(e){}}
function syncFleet(){if(!scene||!S)return;const seen={};
 S.un.forEach(u=>{seen[u.id]=1;let V=fleet[u.id];
  /* server games swap in brand-new unit objects every poll: keep the existing model and just re-point it (only rebuild if the vehicle type changed) */
  if(V&&V.u!==u){if(V.u.ty===u.ty)V.u=u;else{scene.remove(V.root);disposeV(V);delete fleet[u.id];V=null}}
  /* server games send a fresh unit object every poll and never run the arrival on this device, so take the road a unit drove in on
     from its previous poll, and the arrival time for queue order. Helicopters are left alone (they land instead). */
  if(V){const hel=(SP[u.ty]||0)>=150;
   if(u.st==="scene"){if(V.arr==null)V.arr=now();u.arr=V.arr;
    if(!u.app&&!hel&&V.lastRt&&u.b){const L=V.lastRt.p,e=L[L.length-1];if(e&&km(e,u.b)<.05)u.app=parkTrail(L,u.b,V.lastRt.tl)}}
   else V.arr=null;
   if((u.st==="out"||u.st==="back"||u.st==="hosp")&&u.rt&&u.rt.p)V.lastRt={p:u.rt.p,tl:u.rt.tl};else if(u.st!=="scene")V.lastRt=null}
  /* parked units are hidden, so no model is built until a unit first leaves its station */
  if(!V){if(u.st==="idle"||u.st==="hand")return;
   try{V=fleet[u.id]=buildVehicle(u);scene.add(V.root)}catch(e){if(!W3.err){W3.err='model '+u.ty+': '+(e&&e.message||e);console.error(e);toast('3D model error: '+W3.err)}}}});
 for(const id in fleet)if(!seen[id]){scene.remove(fleet[id].root);disposeV(fleet[id]);delete fleet[id]}
 /* air ambulances on scene: choose their landing spot once, when they arrive (kept while they stay on scene). police helicopters never land. */
 const taken=[];for(const id in fleet){const V=fleet[id];if(V.u.st!=="scene"){V.land=null;V.landTry=0;continue}if(V.land)taken.push(V.land)}
 for(const id in fleet){const V=fleet[id];if(V.u.st!=="scene"||!isAmb(V.u)||V.land)continue;if(V.landTry&&now()-V.landTry<LAND_WAIT)continue;
  V.scan=V.scan||{d:0,k:0};const r=landSpot(V.u,taken,V.scan);
  if(r){V.land=r;taken.push(r);V.scan=null}else if(r===null){V.landTry=now()}}}

/* DOM markers: stations, hospitals/custody, calls + unit callsign chips */
function mkEl(cls,c,inner,label,onClick){const e=document.createElement("div");e.className="w3m "+cls;e.style.setProperty("--c",c);
 e.innerHTML=`<div class="w3l">${esc2(label)}</div><div class="w3b">${inner}</div><div class="w3p"></div><div class="w3d"></div>`;
 e.addEventListener("click",ev=>{ev.stopPropagation();onClick()});e.addEventListener("pointerdown",ev=>ev.stopPropagation());return e}
function upsert(group,id,ll,key,make){let o=mk[group][id];
 if(o&&o.k!==key){o.mk.remove();o=mk[group][id]=null}
 if(!o)o=mk[group][id]={k:key,la:ll[0],lo:ll[1],mk:new maplibregl.Marker({element:make(),anchor:"bottom",offset:[0,4]}).setLngLat([ll[1],ll[0]]).addTo(map3)};
 else if(o.la!==ll[0]||o.lo!==ll[1]){o.la=ll[0];o.lo=ll[1];o.mk.setLngLat([ll[1],ll[0]])}}
function syncMarkers(){if(!map3||!S)return;const seen={s:{},h:{},m:{},u:{}};
 S.st.forEach(s=>{seen.s[s.id]=1;upsert("s",s.id,[s.lat,s.lon],s.sv+"|"+s.name+"|"+(IMGS["s"+s.id]?1:0),()=>mkEl("w3st",SC[s.sv],bIco("s",s),s.name,()=>openS(s.id)))});
 S.hs.forEach(x=>{seen.h[x.id]=1;const pn=x.ty==="pn";upsert("h",x.id,[x.lat,x.lon],x.ty+"|"+x.name,()=>mkEl("w3hs",pn?"#475569":"#0369a1",bIco("h",x),x.name,()=>openH(x.id)))});
 S.ms.forEach(m=>{seen.m[m.id]=1;const g=gr(m.k),r=resp(m),key=(m.ans?"a"+g:"p")+"|"+(r?1:0)+"|"+m.k;
  upsert("m",m.id,[m.la,m.lo],key,()=>m.ans?mkEl("w3call"+(r?" w3rs":""),GC[g],`<span style="color:${g===3?"#000":"#fff"}">${g}</span>`,T[m.k][1],()=>openQ(m.id)):mkEl("w3call","#f59e0b",lci("phone"),"Incoming 999 call",()=>openQ(m.id)))});
 for(const g in mk)for(const id in mk[g])if(!seen[g]||!seen[g][id]){mk[g][id].mk.remove();delete mk[g][id]}}
/* placement pin (build / move / POI): mirror the Leaflet pin from menus.js as a draggable MapLibre marker */
let pin3=null,pin3k=null;
function syncPin(){if(!map3)return;
 let on=false;try{on=!!(typeof bpin!=="undefined"&&bpin&&typeof bll!=="undefined"&&bll)}catch(e){}
 if(!on){if(pin3){try{pin3.remove()}catch(e){}pin3=null;pin3k=null}return}
 const k=bpin._k||"";
 if(pin3&&pin3k!==k){try{pin3.remove()}catch(e){}pin3=null}
 if(!pin3){const e=document.createElement("div");e.className="w3pin";e.style.cssText="width:40px;height:52px;cursor:grab;z-index:9";
  try{e.innerHTML=bpin.options.icon.options.html}catch(x){}
  pin3=new maplibregl.Marker({element:e,anchor:"bottom",draggable:true}).setLngLat([bll[1],bll[0]]).addTo(map3);pin3k=k;
  pin3.on("dragend",()=>{const p=pin3.getLngLat();try{bpSet(p.lat,p.lng,0)}catch(x){}});
  pin3.on("dragstart",stopFollow)}
 else if(!pin3.isDragging||!pin3.isDragging()){const p=pin3.getLngLat();if(Math.abs(p.lat-bll[0])>1e-9||Math.abs(p.lng-bll[1])>1e-9)pin3.setLngLat([bll[1],bll[0]])}}
function syncLabels(){if(!map3||!S)return;const z=map3.getZoom();
 S.un.forEach(u=>{let o=vlb[u.id];const V=fleet[u.id],show=V&&u.st!=="hand"&&u.st!=="idle"&&z>=13.5;
  if(!show){if(o)o.mk.getElement().style.display="none";return}
  if(!o){const e=document.createElement("div");e.className="w3u";e.textContent=u.cs;e.style.setProperty("--c",SC[U[u.ty][0]]);e.onclick=ev=>{ev.stopPropagation();try{openUI(u.id)}catch(x){}};e.onpointerdown=ev=>ev.stopPropagation();
   o=vlb[u.id]={mk:new maplibregl.Marker({element:e,anchor:"bottom",offset:[0,-30]}).setLngLat([0,0]).addTo(map3)}}
  const el=o.mk.getElement();el.style.display="";el.classList.toggle("w3rs",isLit(u));const p=V.ll||upos(u);if(o.la!==p[0]||o.lo!==p[1]){o.la=p[0];o.lo=p[1];o.mk.setLngLat([p[1],p[0]])}});
 const ids=new Set(S.un.map(u=>String(u.id)));for(const id in vlb)if(!ids.has(id)){vlb[id].mk.remove();delete vlb[id]}}

/* blue route lines for responding units */
function syncRoutes(){if(!map3||!map3.getSource("routes")||!S)return;const f=[];
 if(getSet().routeLines!==false)S.un.forEach(u=>{if(!(u.st==="out"||u.st==="hosp")||!u.rt||!u.rt.d)return;const R=u.rt,n=R.d.length,p=upos(u),g=clamp(dd(u)/R.len,0,1)*R.d[n-1];let i=1;while(i<n-1&&R.d[i]<g)i++;
  f.push({type:"Feature",properties:{},geometry:{type:"LineString",coordinates:[[p[1],p[0]]].concat(R.p.slice(i).map(q=>[q[1],q[0]]))}})});
 if(!f.length&&routesEmpty)return;routesEmpty=!f.length;
 map3.getSource("routes").setData({type:"FeatureCollection",features:f})}

function addExtrusions(gl){try{if(gl.getLayer("ofm-3d"))return;const st=gl.getStyle(),src=st.sources.openmaptiles?"openmaptiles":Object.keys(st.sources).find(k=>st.sources[k].type==="vector");if(!src)return;
 const lab=st.layers.find(l=>l.type==="symbol");
 (st.layers||[]).forEach(l=>{if(l.type==="fill"&&/^building/.test(l.id)&&!/3d/.test(l.id)){try{gl.setLayoutProperty(l.id,"visibility","none")}catch(e){}}});
 if(gl.getLayer("building-3d"))gl.setLayoutProperty("building-3d","visibility","none");
 gl.addLayer({id:"ofm-3d",type:"fill-extrusion",source:src,"source-layer":"building",minzoom:13,paint:{"fill-extrusion-color":["interpolate",["linear"],["coalesce",["get","render_height"],0],0,"#e4e1da",60,"#c9c5bb",200,"#a9a59b"],"fill-extrusion-height":["coalesce",["get","render_height"],4],"fill-extrusion-base":["coalesce",["get","render_min_height"],0],"fill-extrusion-opacity":1}},lab&&lab.id)}catch(e){console.warn("3D buildings unavailable",e)}}

/* ----- night: the sun's height over the map centre decides, so it follows the real sunset wherever you are looking.
   Night darkens the base map and buildings, glows the main roads, and puts a soft red/blue light under responding vehicles. ----- */
const NIGHT_KEY="fc_night",NORIG=new Map();let NT=-1,NLK_="";
function nightPref(){try{return localStorage.getItem(NIGHT_KEY)||"auto"}catch(e){return "auto"}}
function setNightPref(v){try{localStorage.setItem(NIGHT_KEY,v)}catch(e){}}
function nightLabel(){return "🌙 "+({auto:"Auto",night:"Night",day:"Day"}[nightPref()]||"Auto")}
/* the sun's altitude in degrees (standard low-precision solar position, good to a fraction of a degree) */
function sunAlt(lat,lon,ms){const d=(ms-Date.UTC(2000,0,1,12))/86400000,g=(357.528+.9856003*d)*D2R,L=(280.46+.9856474*d)*D2R,
 lam=L+(1.915*Math.sin(g)+.02*Math.sin(2*g))*D2R,eps=(23.439-4e-7*d)*D2R,
 dec=Math.asin(Math.sin(eps)*Math.sin(lam)),ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam)),
 gmst=((280.46061837+360.98564736629*d)%360+360)%360,H=(gmst+lon)*D2R-ra,la=lat*D2R;
 return Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(H))/D2R}
/* 0 = day, 1 = night. Blends from 2 degrees above the horizon down to 8 below it, so dusk and dawn fade in gradually */
function nightAmount(){if(!map3)return 0;const p=nightPref();if(p==="day")return 0;if(p==="night")return 1;
 const c=map3.getCenter();return clamp((2-sunAlt(c.lat,c.lng,Date.now()))/10,0,1)}
const mixHex=(a,b,t)=>{const p=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));const A=p(a),B=p(b);return"#"+A.map((x,i)=>Math.round(x+(B[i]-x)*t).toString(16).padStart(2,"0")).join("")};
const isHex=c=>typeof c==="string"&&/^#[0-9a-f]{6}$/i.test(c);
/* the night colour for each base-map layer (null = leave alone) */
function nightColor(l){const id=l.id;
 if(l.type==="background")return "#07090d";
 if(l.type==="fill"){if(/water/.test(id))return "#0a1826";if(/park|grass|wood|garden|cemetery|pitch|landcover|landuse|golf|sand/.test(id))return "#0c1512";return "#0f141b"}
 if(l.type==="line")return /motorway|trunk|primary|secondary|tertiary/.test(id)?"#2b3442":"#1a212b";
 if(l.type==="symbol")return "#6f7c8c";
 return null}
/* darken the base map by blending each layer from its own day colour towards its night colour (t: 0 day, 1 night) */
function paintNight(t){const st=map3.getStyle();if(!st||!st.layers)return;
 const PROP={background:"background-color",fill:"fill-color",line:"line-color",symbol:"text-color"};
 for(const l of st.layers){if(/^(ofm-|fc-|routes|building-3d)/.test(l.id))continue;const prop=PROP[l.type],night=nightColor(l);if(!prop||!night)continue;
  const key=l.id+"|"+prop;if(!NORIG.has(key))NORIG.set(key,map3.getPaintProperty(l.id,prop)??null);
  const orig=NORIG.get(key);if(orig==null)continue;
  try{map3.setPaintProperty(l.id,prop,isHex(orig)?mixHex(orig,night,t):(t>.5?night:orig))}catch(e){}}}
/* 3D buildings: the height colour ramp blends to a dark night ramp, and the sun light dims */
function paintBuildings(t){const day=["#e4e1da","#c9c5bb","#a9a59b"],ngt=["#1b1f26","#262b33","#2f3540"],hs=[0,60,200];
 const col=["interpolate",["linear"],["coalesce",["get","render_height"],0]];hs.forEach((h,i)=>col.push(h,mixHex(day[i],ngt[i],t)));
 map3.setPaintProperty("ofm-3d","fill-extrusion-color",col);
 map3.setLight({anchor:"viewport",color:"#ffffff",intensity:.5-.3*t,position:[1.15,210,30]})}
/* glow layers: main roads, and a soft light under each responding vehicle (fed by updateNightLights) */
function addNightLayers(gl){NT=-1;NLK_="";NORIG.clear();if(gl.getSource("fc-lights"))return;
 const st=gl.getStyle(),src=st.sources.openmaptiles?"openmaptiles":Object.keys(st.sources).find(k=>st.sources[k].type==="vector"),
  sym=(st.layers||[]).find(l=>l.type==="symbol"),before=sym?sym.id:undefined;
 if(!src)return;
 gl.addLayer({id:"fc-road-glow",type:"line",source:src,"source-layer":"transportation",minzoom:12,
  filter:["in",["get","class"],["literal",["motorway","trunk","primary"]]],layout:{"line-cap":"round","line-join":"round"},
  paint:{"line-color":"#ffb24a","line-width":["interpolate",["linear"],["zoom"],12,5,17,18],"line-opacity":0}},before);
 gl.addSource("fc-lights",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
 gl.addLayer({id:"fc-light-glow",type:"circle",source:"fc-lights",paint:{"circle-radius":["interpolate",["linear"],["zoom"],12,9,17,28],"circle-color":["get","c"],"circle-blur":.9,"circle-opacity":0}},before)}
function updateNightLights(t){if(!map3||!map3.getSource||!map3.getSource("fc-lights"))return;const f=[];
 if(t>0)for(const id in fleet){const V=fleet[id];if(!V.ll||!isLit(V.u))continue;
  f.push({type:"Feature",geometry:{type:"Point",coordinates:[V.ll[1],V.ll[0]]},properties:{c:cfgFor(V.u.ty).liv==="amb"?"#ff3b3b":"#3b82ff"}})}
 const key=JSON.stringify(f.map(x=>[x.geometry.coordinates,x.properties.c]));if(key===NLK_)return;NLK_=key;
 map3.getSource("fc-lights").setData({type:"FeatureCollection",features:f})}
/* called on every fleet tick: recolours only when the night amount has really changed, glow follows the vehicles */
function syncNight(){if(!map3)return;const t=nightAmount();
 if(NT<0||Math.abs(t-NT)>=.005){NT=t;
  try{paintNight(t);if(map3.getLayer("ofm-3d"))paintBuildings(t);
   if(map3.getLayer("fc-road-glow")){map3.setPaintProperty("fc-road-glow","line-opacity",.45*t);map3.setPaintProperty("fc-light-glow","circle-opacity",.55*t)}}
  catch(e){}}
 updateNightLights(t)}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)kick()});
function showHud(on){if(hud){hud.remove();hud=null}if(!on)return;
 hud=document.createElement("div");hud.className="w3hud";hud.innerHTML=`<button data-a="reset">⟲ Reset view</button><button data-a="follow">🚨 Follow responder</button><button data-a="radio">📻 Radio follow</button><button data-a="tilt">⬍ Tilt</button><button data-a="night">${nightLabel()}</button>`;
 hud.onclick=e=>{const a=e.target.dataset&&e.target.dataset.a;if(!a)return;
  if(a==="reset"){stopFollow();const b=bounds();map3.fitBounds(b,{padding:70,maxZoom:16,pitch:62,bearing:-20,duration:900})}
  else if(a==="tilt"){map3.easeTo({pitch:map3.getPitch()>45?0:65,duration:600})}
  else if(a==="follow")startFollow();
  else if(a==="radio")radioFollowToggle();
  else if(a==="night"){setNightPref({auto:"night",night:"day",day:"auto"}[nightPref()]||"auto");hud.querySelector('[data-a="night"]').textContent=nightLabel();NT=-1;syncNight()}};
 $("#mapw").appendChild(hud)}
function bounds(){const b=new maplibregl.LngLatBounds();let n=0;S.st.forEach(s=>{b.extend([s.lon,s.lat]);n++});S.hs.forEach(h=>{b.extend([h.lon,h.lat]);n++});
 if(!n){const c=map.getCenter();b.extend([c.lng-.01,c.lat-.01]);b.extend([c.lng+.01,c.lat+.01])}return b}

/* chase camera on a responding unit */
let fi=-1,fTimer=0;
function startFollow(){const list=S.un.filter(u=>u.st==="out"||u.st==="hosp");if(!list.length){toast("No units are responding right now");return}
 radLockOff();fi=(fi+1)%list.length;follow=list[fi].id;toast("Following "+list[fi].cs);const p=upos(list[fi]);map3.easeTo({center:[p[1],p[0]],zoom:17.2,pitch:70,duration:800});hud&&hud.querySelector('[data-a="follow"]').classList.add("on")}
function stopFollow(){follow=null;radLock=false;hud&&hud.querySelector('[data-a="radio"]')&&hud.querySelector('[data-a="radio"]').classList.remove("on");hud&&hud.querySelector('[data-a="follow"]')&&hud.querySelector('[data-a="follow"]').classList.remove("on")}
/* the unit most recently on the radio (it transmitted, or control spoke to it) */
/* S.lg is newest-first */
function radioUnitId(){for(let i=0;i<S.lg.length;i++){const l=S.lg[i];if(!isRad(l))continue;const r=radParse(l);if(!r.unit||!r.cs)continue;const u=S.un.find(x=>x.cs===r.cs);if(u)return u.id}return null}
function radLockOff(){radLock=false;hud&&hud.querySelector('[data-a="radio"]')&&hud.querySelector('[data-a="radio"]').classList.remove("on")}
function radioFollowToggle(){if(radLock){stopFollow();return}
 const id=radioUnitId();if(!id){toast("No unit has been on the radio yet");return}
 radLock=true;follow=id;const u=S.un.find(x=>x.id===id);toast("📻 Radio lock: "+u.cs);
 const p=upos(u);map3.easeTo({center:[p[1],p[0]],zoom:17.2,pitch:70,duration:800});
 hud&&hud.querySelector('[data-a="radio"]').classList.add("on")}
function followTick(){if(!map3)return;
 /* radio lock: jump to whichever unit speaks next, and stay on the last one heard when it isn't responding */
 if(radLock){const t=radioUnitId();if(t&&t!==follow){follow=t;const cu=S.un.find(x=>x.id===t);if(cu)toast("📻 Radio lock: "+cu.cs)}}
 if(!follow)return;const u=S.un.find(x=>x.id===follow);if(!u){stopFollow();return}
 if(!(u.st==="out"||u.st==="hosp"||u.st==="scene")){if(radLock)return;stopFollow();return}
 const p=upos(u),c=map3.getCenter(),V=fleet[u.id];let o={center:[c.lng+(p[1]-c.lng)*.25,c.lat+(p[0]-c.lat)*.25]};
 if(V&&V.h!=null){const b=map3.getBearing()*D2R;o.bearing=angLerp(b,V.h,.03)/D2R}map3.jumpTo(o)}

/* phones and tablets: draw at 1x and redraw less often, which is what drains the battery */
const LOW3D=matchMedia("(pointer:coarse)").matches||innerWidth<800;
async function enter3D(){if(active||busy||!S)return;busy=true;
 try{toast("Loading 3D world…");await loadLibs()}catch(e){busy=false;toast("Couldn't load the 3D libraries (check your connection) – staying on the classic map.");setTog();return}
 try{initShared();const w=$("#mapw");let el=$("#map3d");if(!el){el=document.createElement("div");el.id="map3d";w.insertBefore(el,w.firstChild)}
  $("#map").style.display="none";el.style.display="";
  const b=bounds();
  map3=new maplibregl.Map({container:el,style:STYLE_URL,bounds:b,fitBoundsOptions:{padding:70,maxZoom:16,pitch:62,bearing:-20},pitch:62,bearing:-20,maxPitch:85,pixelRatio:LOW3D?1:Math.min(window.devicePixelRatio||1,2),antialias:!LOW3D&&(window.devicePixelRatio||1)<2,attributionControl:false,fadeDuration:0});
  map3.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © OpenMapTiles, © OpenStreetMap contributors'}));
  map3.addControl(new maplibregl.NavigationControl({visualizePitch:true}),"top-right");
  let ok=0;const to=setTimeout(()=>{if(!ok)fail("The 3D map took too long to load.")},20000);
  const fail=m=>{clearTimeout(to);toast(m+" Back to the classic map.");exit3D(true)};
  map3.on("error",e=>{if(!ok&&e&&!e.tile&&!e.sourceId&&e.error&&/style|fetch|Failed/i.test(String(e.error.message||e.error)))fail("Couldn't load the 3D map style.")});
  map3.on("click",e=>{try{if(typeof mv!=="undefined"&&(mv||bm||pm))bpSet(e.lngLat.lat,e.lngLat.lng,0)}catch(x){}});
  map3.on("dragstart",stopFollow);
  map3.once("load",()=>{ok=1;clearTimeout(to);const gl=map3;addExtrusions(gl);addNightLayers(gl);
   routesEmpty=true;gl.addSource("routes",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
   gl.addLayer({id:"routes-casing",type:"line",source:"routes",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#0b1b4d","line-width":8,"line-opacity":.6}});
   gl.addLayer({id:"routes-line",type:"line",source:"routes",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#3b82f6","line-width":4,"line-opacity":.95}});
   try{gl.addLayer(vehicleLayer())}catch(e){W3.err="layer: "+(e&&e.message||e);console.error(e);toast("3D vehicle layer failed: "+W3.err)}
   const safe=f=>()=>{try{f()}catch(e){if(!W3.err2){W3.err2=1;console.error("3D sync",e)}}};
   const tickA=safe(()=>{syncFleet();syncMarkers();syncRoutes();kick();syncNight()}),tickB=safe(()=>{syncLabels();syncPin()}),tickC=safe(followTick);
   tickA();tickB();
   timers.push(setInterval(tickA,500),setInterval(tickB,250),setInterval(tickC,33))});
  active=true;showHud(true);setTog();lsSet(MODE_KEY,"3d")}
 catch(e){console.error(e);toast("3D mode couldn't start on this device – using the classic map.");exit3D(true)}
 busy=false}

function exit3D(silent){timers.forEach(clearInterval);timers=[];clearTimeout(rpT);rpT=0;keepGoing=false;stopFollow();
 for(const g in mk){for(const id in mk[g])try{mk[g][id].mk.remove()}catch(e){}mk[g]={}}
 for(const id in vlb){try{vlb[id].mk.remove()}catch(e){}}vlb={};try{pin3&&pin3.remove()}catch(e){}pin3=null;pin3k=null;
 for(const id in fleet){try{scene&&scene.remove(fleet[id].root)}catch(e){}}fleet={};
 let c=null;if(map3){try{c=map3.getCenter();map3.remove()}catch(e){}map3=null}
 try{renderer&&renderer.dispose()}catch(e){}renderer=scene=camera=null;
 const el=$("#map3d");if(el)el.style.display="none";const m2=$("#map");if(m2)m2.style.display="";
 showHud(false);active=false;busy=false;try{origSync()}catch(e){}try{map.invalidateSize();if(c)map.setView([c.lat,c.lng],map.getZoom())}catch(e){}
 setTog();if(!silent)lsSet(MODE_KEY,"2d")}

function setTog(){let b=$("#w3tog");const w=$("#mapw");if(!w)return;if(!b){b=document.createElement("button");b.id="w3tog";b.type="button";b.onclick=()=>active?exit3D():enter3D();w.appendChild(b)}
 b.textContent=active?"🗺️ 2D":"🏙️ 3D";b.title=active?"Back to the classic map":"Switch to the 3D world";b.hidden=!hasGL()}

/* the hidden classic (Leaflet) map is still synced twice a second by the game loop; skip that while the 3D world is showing */
const origSync=sync;
sync=function(){if(active&&map3)return;return origSync.apply(this,arguments)};

/* ---------- hook into start-up ---------- */
const origStart=startGame;
startGame=function(st){if(asked)return origStart.apply(this,arguments);asked=true;
 chooseMode().then(m=>{origStart(st);setTog();if(m==="3d")setTimeout(enter3D,50)})};
window.World3D={enter:enter3D,exit:exit3D,center(){return map3?map3.getCenter():null},get active(){return active},debug(){return{libs:{three:window.THREE&&THREE.REVISION,maplibre:window.maplibregl&&maplibregl.getVersion&&maplibregl.getVersion()},onAdd:W3.adds,frames:W3.frames,error:W3.err,units:S&&S.un.length,models:Object.keys(fleet).length,sceneChildren:scene&&scene.children.length}}};
})();
