/* Desktop only: drag the top edge of the RADIO panel up or down to resize it.
   Dragging up makes the panel taller (more radio entries visible). */
(()=>{
  const rl=document.getElementById("rl");
  if(!rl)return;
  const z=document.createElement("div");
  z.id="rlz";
  z.className="rlz";
  z.title="Drag up or down to resize";
  rl.prepend(z);

  const MIN=120;
  const isDesk=()=>matchMedia("(min-width:1000px)").matches;
  const apply=h=>{document.body.style.gridTemplateRows="auto auto minmax(0,1fr) "+h+"px"};
  let d=null;

  z.addEventListener("pointerdown",e=>{
    if(!isDesk())return;
    e.preventDefault();
    d={y:e.clientY,h:rl.getBoundingClientRect().height};
    try{z.setPointerCapture(e.pointerId)}catch(err){}
    document.body.classList.add("rlz-drag");
  });
  z.addEventListener("pointermove",e=>{
    if(!d)return;
    const max=Math.round(innerHeight*0.85);
    const h=Math.max(MIN,Math.min(max,d.h+(d.y-e.clientY)));
    apply(h);
  });
  const end=()=>{d=null;document.body.classList.remove("rlz-drag")};
  z.addEventListener("pointerup",end);
  z.addEventListener("pointercancel",end);
})();
