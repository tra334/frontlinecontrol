/* ===== Save backup: export / import a .json file (moves progress between browsers) ===== */
function saveFileName(){const d=new Date(),p=n=>String(n).padStart(2,"0");return"frontline-control-save-"+d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+".json"}
function exportSave(){
if(!S){toast("Nothing to export yet");return}
try{persist()}catch(e){}
const doc={app:"frontline-control",format:1,exported:new Date().toISOString(),data:S};
const url=URL.createObjectURL(new Blob([JSON.stringify(doc)],{type:"application/json"})),a=document.createElement("a");
a.href=url;a.download=saveFileName();document.body.appendChild(a);a.click();a.remove();
setTimeout(()=>URL.revokeObjectURL(url),4000);toast("Save file downloaded")}
/* returns "" if the save looks usable, otherwise a short reason */
function checkSave(d){
if(!d||typeof d!=="object"||Array.isArray(d))return"this isn't a save file.";
if(!Number.isFinite(d.cr)||!Number.isFinite(d.done))return"core game data is missing.";
for(const k of["ms","st","un"])if(!Array.isArray(d[k]))return"the "+k+" list is missing.";
if(d.hs!==undefined&&!Array.isArray(d.hs))return"hospital data is damaged.";
if(d.un.some(u=>!u||typeof u!=="object"||!Object.prototype.hasOwnProperty.call(U,u.ty)))return"it contains an unknown vehicle type.";
if(d.ms.some(m=>!m||typeof m!=="object"||!Number.isInteger(m.k)||!T[m.k]))return"it contains an unknown incident type.";
return""}
function saveSummary(d){const t=d.ts?new Date(d.ts).toLocaleString("en-GB"):"unknown time";return"\u00a3"+fmt(d.cr)+", "+d.done+" jobs, "+d.st.length+" stations, "+d.un.length+" units (saved "+t+")"}
function importSave(){
if(AU){alert("Importing a save file is only available when playing offline. Signed-in accounts use their cloud save.");return}
const inp=document.createElement("input");inp.type="file";inp.accept=".json,application/json";
inp.onchange=()=>{const f=inp.files&&inp.files[0];if(!f)return;
if(f.size>5e6){alert("That file is too large to be a save file.");return}
const r=new FileReader();
r.onerror=()=>alert("Couldn't read that file.");
r.onload=()=>{let d;
try{const j=JSON.parse(r.result);d=j&&j.app==="frontline-control"&&j.data?j.data:j}catch(e){alert("That file isn't valid JSON.");return}
const bad=checkSave(d);if(bad){alert("Can't import: "+bad);return}
if(!confirm("Replace your current offline progress with this save?\n\n"+saveSummary(d)+"\n\nYour current save is kept as a one-step backup in this browser."))return;
try{const old=localStorage.getItem(curKey);if(old)localStorage.setItem(curKey+"_backup",old);
localStorage.setItem(curKey,JSON.stringify(d));localStorage.setItem(curKey+"_seen",String(Date.now()));localStorage.setItem(GUEST_KEY,"1")}
catch(e){alert("Couldn't write to this browser's storage (it may be full or blocked).");return}
persist=function(){};gameOn=false;location.reload()};
r.readAsText(f)};
inp.click()}
