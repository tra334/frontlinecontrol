/* Built-in mini map engine: only used if Leaflet cannot be downloaded from any CDN */
(function(){if(window.L)return;
const NS="http://www.w3.org/2000/svg",TS=256,D=Math.PI/180,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const st=document.createElement("style");st.textContent=".lm{position:relative;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;background:#cfe3f5;cursor:grab}.lm>*{position:absolute;left:0;top:0}.lm svg{width:100%;height:100%;pointer-events:none;overflow:hidden}.lm .lmk,.lm .lt{width:0;height:0}.lm .lmk>*{position:absolute;left:0;top:0;pointer-events:auto}.lm .lt img{position:absolute;left:0;top:0;width:256px;height:256px;max-width:none;user-select:none}.lm .lz{left:auto;right:8px;top:8px;display:flex;flex-direction:column;gap:4px;z-index:5}.lm .lz button{width:30px;height:30px;padding:0;font-size:18px;line-height:1;background:#fff;color:#222;border:1px solid #bbb;border-radius:6px}.lm .la{left:auto;top:auto;right:0;bottom:0;font:10px system-ui;background:#fffc;color:#333;padding:1px 5px;z-index:4;pointer-events:none}";document.head.appendChild(st);
class Ev{on(t,f){(this._e=this._e||{})[t]=((this._e||{})[t]||[]).concat(f);return this}fire(t,d){((this._e||{})[t]||[]).forEach(f=>f(d))}}
const ll=a=>Array.isArray(a)?{lat:a[0],lng:a[1]}:a;
class M extends Ev{constructor(id){super();const el=this.el=typeof id==="string"?document.getElementById(id):id;el.classList.add("lm");el.innerHTML="";
const dv=c=>{const d=document.createElement("div");d.className=c;el.appendChild(d);return d},sv=c=>{const s=document.createElementNS(NS,"svg");s.setAttribute("class",c);el.appendChild(s);return s};
this.bgS=sv("lb");this.bgM=dv("lmk");this.tl=dv("lt");this.fgS=sv("lf");this.fgM=dv("lmk");
const z=dv("lz");z.innerHTML='<button type="button">+</button><button type="button">−</button>';this.la=dv("la");
z.addEventListener("pointerdown",e=>e.stopPropagation());z.addEventListener("dblclick",e=>e.stopPropagation());
z.children[0].onclick=()=>this.zoomAt(1,this.w/2,this.h/2);z.children[1].onclick=()=>this.zoomAt(-1,this.w/2,this.h/2);
this.layers=new Set();this.z=6;this.c={lat:54.3,lng:-2.6};this.w=el.clientWidth;this.h=el.clientHeight;this.tx=0;this.ty=0;
const P=new Map();let g=null,pd=0,wt=0;
const loc=e=>{const r=el.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
el.addEventListener("pointerdown",e=>{P.set(e.pointerId,{x:e.clientX,y:e.clientY});try{el.setPointerCapture(e.pointerId)}catch(_){}
if(P.size===1)g={x:e.clientX,y:e.clientY,m:0};else{g&&(g.m=99);const a=[...P.values()];pd=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}el.style.cursor="grabbing"});
el.addEventListener("pointermove",e=>{const p=P.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
if(P.size===1&&g){g.m+=Math.abs(dx)+Math.abs(dy);if(g.m>6){const[cx,cy]=this.pr(this.c.lat,this.c.lng,this.z);this.c=this.un(cx-dx,cy-dy,this.z);this._r()}}
else if(P.size===2){const a=[...P.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),[mx,my]=loc({clientX:(a[0].x+a[1].x)/2,clientY:(a[0].y+a[1].y)/2});if(pd){if(d/pd>1.5){this.zoomAt(1,mx,my);pd=d}else if(d/pd<.67){this.zoomAt(-1,mx,my);pd=d}}}});
const up=e=>{if(!P.has(e.pointerId))return;P.delete(e.pointerId);el.style.cursor="grab";if(P.size===0&&g){if(g.m<=6){const[x,y]=loc(e),q=this.un(this.tx+x,this.ty+y,this.z);this.fire("click",{latlng:{lat:q.lat,lng:q.lng}})}g=null}};
el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up);
el.addEventListener("wheel",e=>{e.preventDefault();const t=Date.now();if(t-wt<220)return;wt=t;const[x,y]=loc(e);this.zoomAt(e.deltaY<0?1:-1,x,y)},{passive:false});
el.addEventListener("dblclick",e=>{const[x,y]=loc(e);this.zoomAt(1,x,y)});
if(window.ResizeObserver)new ResizeObserver(()=>this.invalidateSize()).observe(el)}
pr(lat,lng,z){const s=TS*Math.pow(2,z),sn=Math.sin(cl(lat,-85.05,85.05)*D);return[(lng+180)/360*s,(.5-Math.log((1+sn)/(1-sn))/(4*Math.PI))*s]}
un(x,y,z){const s=TS*Math.pow(2,z);return{lat:(2*Math.atan(Math.exp((.5-y/s)*2*Math.PI))-Math.PI/2)/D,lng:x/s*360-180}}
pt(a){const p=this.pr(a.lat,a.lng,this.z);return[p[0]-this.tx,p[1]-this.ty]}
_r(){if(this._q)return;this._q=requestAnimationFrame(()=>{this._q=0;this._d()})}
_d(){const[cx,cy]=this.pr(this.c.lat,this.c.lng,this.z);this.tx=cx-this.w/2;this.ty=cy-this.h/2;this.layers.forEach(l=>l._draw&&l._draw(this))}
zoomAt(dz,px,py){const nz=cl(this.z+dz,2,19);if(nz===this.z)return this;const g=this.un(this.tx+px,this.ty+py,this.z);this.z=nz;const[gx,gy]=this.pr(g.lat,g.lng,nz);this.c=this.un(gx-px+this.w/2,gy-py+this.h/2,nz);this._r();return this}
setView(a,z){this.c=ll(a);this.z=z;this._r();return this}
fitBounds(pts,o){o=o||{};const p=o.padding||[0,0],a=pts.map(ll);let z=o.maxZoom||18;const W=Math.max(50,this.w-2*p[0]),H=Math.max(50,this.h-2*p[1]);
const la=a.map(x=>x.lat),lo=a.map(x=>x.lng),n=Math.max(...la),s=Math.min(...la),e=Math.max(...lo),w=Math.min(...lo);
for(;z>2;z--){const A=this.pr(n,w,z),B=this.pr(s,e,z);if(B[0]-A[0]<=W&&B[1]-A[1]<=H)break}
const A=this.pr(n,w,z),B=this.pr(s,e,z);this.z=z;this.c=this.un((A[0]+B[0])/2,(A[1]+B[1])/2,z);this._r();return this}
invalidateSize(){this.w=this.el.clientWidth;this.h=this.el.clientHeight;this._r();return this}
createPane(){return{style:{}}}
removeLayer(l){l._rm&&l._rm();this.layers.delete(l);return this}}
class TL extends Ev{constructor(u,o){super();this.u=u;this.o=o||{};this.t=new Map}
addTo(m){this.m=m;m.layers.add(this);m.la.textContent=this.o.attribution||"";m._r();return this}
_draw(m){const z=m.z,n=Math.pow(2,z),x0=Math.floor(m.tx/TS),x1=Math.floor((m.tx+m.w)/TS),y0=Math.max(0,Math.floor(m.ty/TS)),y1=Math.min(n-1,Math.floor((m.ty+m.h)/TS)),need=new Set(),sd=this.o.subdomains||"abc";
for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const xi=((x%n)+n)%n,k=z+"/"+x+"/"+y;need.add(k);let im=this.t.get(k);
if(!im){im=document.createElement("img");im.alt="";im.draggable=false;im.decoding="async";if(this.o.referrerPolicy)im.referrerPolicy=this.o.referrerPolicy;
im.onload=()=>this.fire("tileload");im.onerror=()=>{im.remove();this.fire("tileerror")};
im.src=this.u.replace("{s}",sd[(xi+y)%sd.length]).replace("{z}",z).replace("{x}",xi).replace("{y}",y).replace("{r}","");this.t.set(k,im);m.tl.appendChild(im)}
im.style.transform="translate("+(x*TS-m.tx)+"px,"+(y*TS-m.ty)+"px)"}
this.t.forEach((im,k)=>{if(!need.has(k)){im.remove();this.t.delete(k)}})}
_rm(){this.t.forEach(im=>im.remove());this.t.clear()}}
class MK extends Ev{constructor(a,o){super();this.ll=ll(a);this.o=o||{}}
addTo(m){this.m=m;const e=this.el=document.createElement("div"),ic=this.o.icon||{};e.className=ic.className||"";e.innerHTML=ic.html||"";
if(this.o.interactive===false)e.style.pointerEvents="none";else{e.addEventListener("pointerdown",x=>x.stopPropagation());e.addEventListener("dblclick",x=>x.stopPropagation());e.addEventListener("click",x=>{x.stopPropagation();this.fire("click",x)})}
(this.o.pane==="bg"?m.bgM:m.fgM).appendChild(e);m.layers.add(this);this._draw(m);return this}
setLatLng(a){this.ll=ll(a);this.m&&this._draw(this.m);return this}
setIcon(ic){this.o.icon=ic;if(this.el){this.el.className=ic.className||"";this.el.innerHTML=ic.html||""}return this}
_draw(m){const p=m.pt(this.ll);this.el.style.display=(p[0]<-200||p[1]<-200||p[0]>m.w+200||p[1]>m.h+200)?"none":"";this.el.style.transform="translate("+p[0]+"px,"+p[1]+"px)"}
_rm(){this.el&&this.el.remove()}}
class PL extends Ev{constructor(p,o,g){super();this.p=p.map(ll);this.o=o||{};this.g=g}
addTo(m){this.m=m;const e=this.el=document.createElementNS(NS,"path"),o=this.o;e.setAttribute("stroke",o.color||"#3388ff");e.setAttribute("stroke-width",o.weight||3);e.setAttribute("stroke-opacity",o.opacity==null?1:o.opacity);e.setAttribute("stroke-linejoin","round");e.setAttribute("stroke-linecap","round");
e.setAttribute("fill",this.g?(o.fillColor||o.color||"#3388ff"):"none");if(this.g)e.setAttribute("fill-opacity",o.fillOpacity==null?.2:o.fillOpacity);
(o.pane==="bg"?m.bgS:m.fgS).appendChild(e);m.layers.add(this);this._draw(m);return this}
_draw(m){let d="",lx=1e9,ly=1e9;const n=this.p.length;for(let i=0;i<n;i++){const q=m.pt(this.p[i]),x=Math.round(q[0]),y=Math.round(q[1]);if(i>0&&i<n-1&&Math.abs(x-lx)<2&&Math.abs(y-ly)<2)continue;d+=(d?"L":"M")+x+" "+y;lx=x;ly=y}this.el.setAttribute("d",d+(this.g?"Z":""))}
_rm(){this.el&&this.el.remove()}}
window.L={shim:1,map:id=>new M(id),tileLayer:(u,o)=>new TL(u,o),marker:(a,o)=>new MK(a,o),divIcon:o=>o,polyline:(p,o)=>new PL(p,o,0),polygon:(p,o)=>new PL(p,o,1)}})();
