/* Desktop: toggle the right-hand panel (fleet / stations / ranks); the map stretches into the freed space. */
(()=>{
const b=document.getElementById("rpt");if(!b)return;
const K="rpOff";
const set=off=>{
document.body.classList.toggle("rp-off",off);
b.textContent=off?"‹":"›";
const l=off?"Show side panel":"Hide side panel";b.setAttribute("aria-label",l);b.title=l;
try{localStorage.setItem(K,off?"1":"0")}catch(e){}
/* keep the map canvas in step with the animated resize */
const t0=Date.now();(function f(){try{typeof map!=="undefined"&&map.invalidateSize()}catch(e){}if(Date.now()-t0<300)requestAnimationFrame(f)})()};
b.addEventListener("click",()=>set(!document.body.classList.contains("rp-off")));
let init=false;try{init=localStorage.getItem(K)==="1"}catch(e){}
if(init)set(true);
})();
