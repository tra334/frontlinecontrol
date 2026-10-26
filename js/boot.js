/* decide which save to use after sign-in */
async function pickState(){const lk=KEY+"_"+AU.user.id;curKey=lk;let loc=null,cl=null,off=false;
try{loc=JSON.parse(localStorage.getItem(lk))}catch(e){}
try{cl=await cloudGet()}catch(e){if(e.authFail){sesClear();return null}off=true;console.error("Cloud load error",e);cloudMsg="⚠ Cloud load failed ("+(e.status||"")+": "+String(e.message||"").slice(0,80)+") – using device save"}
if(off){cloudDirty=true;return loc}
if(cl){let lv=null;try{lv=localStorage.getItem(lk+"_ver")}catch(e){}if(loc&&(loc.ts||0)>(cl.ts||0)){cloudDirty=true;return loc}try{localStorage.setItem(lk+"_ver",cloudVer)}catch(e){}return cl}
let g=null;try{g=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!loc&&g&&(g.done>0||(g.st&&g.st.length))&&confirm("Upload the progress saved on this device to your new account?\n\nOK = upload it, Cancel = start a fresh game."))loc=g;
cloudDirty=true;return loc}
async function bootAuth(){
const hp=new URLSearchParams(location.hash.replace(/^#/,"")),ty=hp.get("type");let note="",mode="in";
if(hp.get("error_description")){note=hp.get("error_description").replace(/\+/g," ");history.replaceState(null,"",location.pathname+location.search)}
else if(hp.get("access_token")){sesSave({access_token:hp.get("access_token"),refresh_token:hp.get("refresh_token"),expires_in:+hp.get("expires_in")||3600});history.replaceState(null,"",location.pathname+location.search);
try{AU.user=await sb("/auth/v1/user",{auth:1});sesSave({access_token:AU.access_token,refresh_token:AU.refresh_token,expires_at:AU.expires_at,user:AU.user})}catch(e){}
if(ty==="recovery"){await authUI("recover");}}
else{try{AU=JSON.parse(localStorage.getItem(SES_KEY))}catch(e){AU=null}
if(AU&&AU.user&&AU.user.id){try{const uu=await sb("/auth/v1/user",{auth:1});if(uu&&uu.id){AU.user=uu;try{localStorage.setItem(SES_KEY,JSON.stringify(AU))}catch(x){}}}catch(e){if(e.status===400||e.status===401||e.status===403)sesClear()}}else AU=null}
if(!AU&&localStorage.getItem(GUEST_KEY)){startGame(load()||null);return}
for(let i=0;i<5&&!AU;i++){const r=await authUI(mode,note);if(r==="guest"){startGame(load()||null);return}note=""}
if(!AU)return;
const st=await pickState();if(!st&&!AU){return bootAuth()}
startGame(st)}
setInterval(()=>{if(cloudDirty&&AU&&gameOn)pushCloud()},12000);
addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&AU&&gameOn){persist();pushCloud(1)}});
addEventListener("pagehide",()=>{if(AU&&gameOn){persist();pushCloud(1)}});

bootAuth();
