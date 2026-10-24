/* ===== consistent caller facts =====
Each call gets ONE fact sheet (m.sc), built once from a seeded RNG and saved with the mission.
Every answer reads from it, so age, sex, counts and what is happening never contradict each other. */
const hk=m=>m.hid&&m.hid.k==="w"&&T[m.k][0]==="a"?"h":m.hid.k;
const rng=s=>{let a=s>>>0;return()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}};
const WD=["no","one","two","three","four","five","six","seven","eight","nine","ten"],cp=s=>s[0].toUpperCase()+s.slice(1);
const PR={m:{He:"He",he:"he",his:"his",him:"him",man:"man",boy:"boy"},f:{He:"She",he:"she",his:"her",him:"her",man:"woman",boy:"girl"}};
const fx=(s,x,a)=>s.replace(/\{(He|he|his|him|man|age)\}/g,(_,k)=>k==="age"?a:PR[x][k]);
const CLO=["a dark jacket","a grey hoodie","a black hoodie","a green parka","a white T-shirt","a black puffer jacket","a red top"],CARS=["dark car","silver hatchback","white van","black saloon","red car","blue estate"];
const sus=(n,r,o)=>{o=o||{};const x=o.x||(r()<.75?"m":"f"),cl=CLO[Math.floor(r()*CLO.length)];if(n===1){const a=Math.floor(18+r()*40);return(x==="m"?"Male":"Female")+", wearing "+cl+", about "+Math.round(a/5)*5+"."}return n<=6?cp(WD[n])+" "+(o.w||(x==="m"?"men":"women"))+", hoods up and dark clothing, late teens to thirties.":"A big group, mostly "+(o.w||"men")+", late teens to thirties."};
// Ambulance: s = sex (omit = random), a = age range, st = breathing/conscious, bl = bleeding
const AP={
"Cat 1 – cardiac arrest":{s:"m",a:[45,85],st:["No — {he}’s not breathing and won’t wake up.","{He}’s unconscious and not breathing, I’m doing chest compressions."],bl:["No bleeding at all."]},
"Cat 2 – chest pain":{s:"m",a:[45,82],st:["{He}’s awake and talking, but pale and sweaty.","Conscious and breathing, but {he}’s clutching {his} chest."],bl:["No bleeding."]},
"Cat 3 – fall, elderly":{s:"f",a:[76,94],st:["{He}’s awake and talking, just in a lot of pain.","Conscious and breathing normally, but {he} can’t move {his} leg."],bl:["No bleeding, just a bruise coming up.","A small graze on {his} elbow, nothing serious."]},
"Cat 4 – minor injury":{self:1,a:[18,70],st:["Yes, I’m awake and breathing fine.","I’m OK, just a bit shaky."],bl:["It’s a small cut on my hand, bleeding a bit.","Just my hand, it’s oozing but slowing down."]},
"Cat 1 – choking":{a:[1,3],st:["{He}’s conscious but can’t breathe or cry — {he}’s going red.","{He}’s gasping and silent, {his} lips are turning blue."],bl:["No bleeding."]},
"Cat 2 – stroke":{s:"f",a:[55,88],st:["{He}’s awake but confused and {his} speech is slurred.","Breathing OK and conscious, but {he} can’t lift {his} right arm."],bl:["No bleeding."]},
"Cat 1 – major trauma RTC":{a:[18,55],st:["{He}’s unconscious but breathing, very shallow.","{He}’s unresponsive — I can see {him} breathing slowly."],bl:["Yes, a lot of blood from {his} leg.","Bleeding from {his} head and {his} leg looks wrong."]},
"Cat 1 – childbirth":{s:"f",a:[19,40],st:["{He}’s awake and talking, contractions are very close together.","Conscious and breathing, but in a lot of pain and starting to push."],bl:["Just the waters, a little blood.","A little bleeding, nothing heavy."]},
"Mass casualty – coach crash":{mix:1},
"Cat 1 – advanced life support":{s:"m",a:[40,80],st:["{He}’s barely breathing and has gone blue.","{He}’s unresponsive, breathing slow and gurgling."],bl:["No bleeding."]},
"Cat 2 – remote rescue":{s:"m",a:[25,70],st:["{He}’s conscious and shouting, but can’t move {his} leg.","Awake and talking, in a lot of pain."],bl:["A cut on {his} head, a bit of blood.","No bleeding that we can see."]},
"Cat 3 – cyclist down":{a:[16,60],st:["Conscious and walking about, a bit shaken.","Awake and talking, {his} knee is sore."],bl:["Just grazes on {his} arm and knee.","A bit of blood from a scraped elbow."]}};
// Fire: fl = flames/smoke, sp = spreading, tr = [trapped answer, people-count answer] pairs (kept together)
const FPD={fl:["Yes, smoke and flames."],sp:["Yes, it’s spreading."],tr:[["I think someone’s still inside!","One person, I think."],["No, everyone’s out.","Everyone’s out."]]};
const FP={
"House fire":{fl:["Yes, thick black smoke and flames from the kitchen window!"],sp:["Yes, it’s spreading fast!","Slowly, towards the next room."],tr:[["I think someone’s still inside!","One person, and I think they’re still inside."],["No, everyone’s out.","Three people live there and they’re all out safe."]]},
"Chimney fire":{fl:["Flames and sparks coming out of the top of the chimney."],sp:["No, it seems to be staying in the chimney."],tr:[["No, everyone’s out of the house.","Two of us, and we’re both outside."]]},
"RTC – persons trapped":{fl:["Some smoke from one bonnet, but no flames yet."],sp:["Not yet, but the smoke is getting thicker."],tr:[["Yes, one driver can’t get out of the car.","Two drivers — one is trapped, the other is out."]]},
"Car fire":{fl:["Yes, the whole vehicle is alight."],sp:["No, it’s only the car so far."],tr:[["No, the driver got out safely.","Just the driver, and they’re out safe."]]},
"Fire alarm – office":{fl:["No flames or smoke, just the alarm sounding."],sp:["There’s no sign of a fire."],tr:[["No, everyone’s gone outside to the assembly point.","About thirty staff, all outside."]],still:"Yes, the alarm’s still going.",hu:"No, nobody’s hurt.",wp:0},
"Flat fire":{fl:["Thick smoke filling the stairwell, I can’t see flames."],sp:["Yes, the smoke’s getting thicker."],tr:[["Yes, residents are still in the flats upstairs!","Quite a few residents are still inside."]]},
"Moorland fire":{fl:["Flames across the hillside and loads of smoke."],sp:["Yes, the wind is pushing it fast."],tr:[["No one’s up there that I know of.","Nobody that I can see."]],wp:0},
"Person stuck in lift":{fl:["No flames or smoke at all."],sp:["There’s no fire."],tr:[["Yes, we’re stuck between floors.","Three of us are stuck in the lift."]],still:"Yes, we’re still stuck.",hu:"No, nobody’s hurt, we’re just stuck.",wp:0},
"Warehouse fire":{fl:["Huge flames and black smoke from the roof!"],sp:["Yes, it’s spreading to the next unit!"],tr:[["Staff say one person hasn’t been accounted for.","One person is missing, the rest are outside."],["No, everyone’s out and accounted for.","Everyone’s out — about twenty staff."]]},
"Barn fire":{fl:["Flames through the roof of the barn."],sp:["Yes, towards the hay store."],tr:[["No people, but animals are trapped inside!","No people, just the animals trapped inside."]]},
"Chemical spill":{fl:["No flames, but there’s a strong smell and fumes."],sp:["Yes, the liquid is running down the road."],tr:[["No, we’ve all moved away.","Only the tanker driver, and they’ve moved clear."]],wp:1,wpT:"Yes, the tanker is leaking and the fumes are strong."},
"Person in river":{fl:["No fire — they’re in the water."],sp:["No fire, but the current is dragging them downstream."],tr:[["Yes, one person is in the river and can’t get out!","Just one person in the water."]],wp:0},
"High-rise rescue":{fl:["No flames or smoke."],sp:["There’s no fire."],tr:[["Yes, one person is on a ledge and can’t get back in.","Just the one person on the ledge."]],wp:0},
"Wildfire":{fl:["Flames and thick smoke across the heath."],sp:["Yes, the wind is driving it towards the houses!"],tr:[["Some residents are still in their houses nearby.","A few households are still at home."],["No, people are leaving the nearest houses.","Nobody’s in danger yet, residents are leaving."]]},
"Building collapse":{fl:["Lots of dust, a little smoke, no flames."],sp:["No fire, but more of it could come down."],tr:[["Yes, people are trapped under the rubble!","At least three people are trapped inside."]]}};
// Police: n = people range, off = where the offenders are (here/foot/vehicle), sub = the main person (age range / sex)
const PP={
"Welfare check":{n:[1,1],off:["here"],sub:{a:[62,92]},nT:"Just the one — {he} lives alone, as far as I know.",desc:"My neighbour, a {man} of about {age}.",offT:"I haven’t seen anyone else about.",vehT:"No vehicle, {he} doesn’t drive any more.",still:"Yes, I’m outside the house now and nobody’s answering.",hu:"I don’t know — that’s what worries me. I haven’t seen {him} for days.",wp:0},
"Burglary in progress":{n:[1,2],off:["here","foot"],wp:0},
"Domestic disturbance":{n:[2,2],off:["here"],nT:"Two — a man and a woman.",desc:"A man and a woman, both in their thirties I think.",offT:"Yes, they’re both still in the house.",vehT:"No, they’re both still in the house.",wp:0},
"Drink driver":{n:[1,1],off:["vehicle"],still:"Yes, they’re still driving — the car’s all over the road.",offT:"No, they’re still on the move down the road.",vehT:"Yes, it’s a {veh}, still heading {dir}.",wp:0},
"Pub brawl":{n:[4,10],off:["here"],hu:"Yes, a couple of people are bleeding on the pavement."},
"Missing child":{n:[1,1],off:["foot"],nT:"Just my daughter — she’s six.",desc:"A girl, six years old, long brown hair, pink coat.",offT:"I haven’t seen anyone with her, I just can’t find her.",vehT:"No, I don’t think so — she was last seen on foot in the park.",still:"Yes, she’s still missing — I’ve looked everywhere.",hu:"No, not that I know of — I just can’t find her.",wp:0},
"Armed robbery":{n:[1,2],off:["here","vehicle"],wp:1,wpT:"Yes! I saw a gun!"},
"Stolen vehicle pursuit":{n:[1,2],off:["vehicle"],veh:"white van",still:"Yes, it’s still going — it’s heading down the bypass.",offT:"No, they’re driving away fast down the bypass.",vehT:"Yes, it’s my white van, heading {dir} on the bypass.",wp:0},
"Football disorder":{n:[8,30],off:["here"],hu:"Yes, a few people have been hit by bottles.",wp:0},
"Anti-social behaviour":{n:[3,5],off:["here","vehicle"],veh:"moped",vb:"ridden",desc:(n,r)=>sus(n,r,{w:"youths"}),vh:"No, they’re still here, riding round on mopeds.",hu:"No, nobody’s hurt, they’re just a nuisance.",wp:0},
"Fatal collision":{n:[2,2],off:["here"],nT:"Two drivers — one isn’t moving, the other is standing by the lorry.",desc:"The car driver isn’t moving. I can’t tell you any more than that.",offT:"The lorry driver is still here, standing by the cab.",vehT:"No, both vehicles are still here at the scene.",still:"Yes, it’s just happened — I’m looking at it now.",hu:"Yes — the car driver isn’t moving at all.",wp:0},
"Cannabis farm raid":{n:[2,3],off:["here"],nT:"I can’t be sure — I’ve seen two or three different people go in.",desc:"I haven’t seen anyone clearly — just lights on all night and people coming and going.",offT:"I think they’re still inside, the lights are on.",vehT:"A van comes and goes, but it isn’t there right now.",hu:"No, not that I know of.",wp:0},
"Motorcycle collision":{n:[2,2],off:["here"],nT:"Two — the biker and the car driver.",desc:"The rider’s down in black leathers, the car driver is standing beside their car.",offT:"Yes, the car driver stopped and is still here.",vehT:"No, the car stopped and the bike’s in the road.",still:"Yes, it’s just happened.",hu:"Yes — the biker is on the ground and isn’t getting up.",wp:0},
"Suspicious death":{n:[1,1],off:["here"],sub:{a:[55,85]},nT:"Just the one person — {he}’s my neighbour.",desc:"My neighbour, a {man} of about {age}.",offT:"I haven’t seen anyone else, but the door was open.",vehT:"I haven’t seen any vehicle.",still:"Yes, I’m standing outside the open door now.",hu:"Yes — I think {he}’s dead, {he} isn’t moving.",wp:0},
"Missing person – woods":{n:[1,1],off:["foot"],sub:{a:[68,90]},nT:"Just the one — {he}’s got dementia.",desc:"A {man}, about {age}, in a coat and slippers I think.",offT:"I don’t think anyone is with {him}.",vehT:"No, {he}’s on foot — {he} doesn’t drive.",still:"Yes, {he}’s still missing since dawn.",hu:"Not that I know of, but {he}’s vulnerable and it’s cold.",wp:0},
"Mental health crisis":{n:[1,1],off:["here"],sub:{a:[20,55],s:"m"},nT:"Just him — he’s alone, I think.",desc:"A man, about {age}, in a dark jumper.",offT:"Yes, he’s still here, he hasn’t left.",vehT:"No vehicle, he’s on foot.",still:"Yes, it’s happening right now — please hurry.",hu:"Not yet, but he’s threatening to hurt himself."},
"Riot":{n:[15,50],off:["here"],hu:"Yes, people are being hurt in the crowd."}};
function scn(m){if(m.sc)return m.sc;const t=T[m.k],sv=t[0],ti=t[1],r=rng(m.id*7919+m.k*131+17),pk=a=>a[Math.floor(r()*a.length)],ri=(a,b)=>a+Math.floor(r()*(b-a+1));
const c={lm:pk(["Next to the post office.","Opposite the pub on the corner.","Near the roundabout by the Co-op.","By the petrol station.","Just past the primary school."])};
if(sv==="a"){const p=AP[ti]||{a:[20,70],st:["Awake and breathing, but in pain."],bl:["No visible bleeding."]};
if(p.mix){const n=ri(15,40);Object.assign(c,{n,nT:"About "+n+" casualties — I can’t count them all.",ageT:"All ages — adults, some children and some elderly.",sexT:"Men, women and children, a real mix.",stT:"Some are awake, some aren’t responding — I can’t check everyone.",blT:"Yes, lots of people are bleeding!",hu:"Yes, loads of people are hurt!",sf:"No, I’m next to the coach — it’s chaos."})}
else{const x=p.s||(r()<.5?"m":"f"),a=ri(p.a[0],p.a[1]),self=!!p.self,ao=a<=12?[(self?"I’m ":"{He}’s ")+a+" year"+(a>1?"s":"")+" old."]:self?["I’m "+a+".","I’m "+a+" years old."]:["{He}’s "+a+".","About "+Math.round(a/5)*5+", I think.","{He}’s "+a+" years old."];
Object.assign(c,{x,age:a,ageT:fx(pk(ao),x,a),sexT:self?"I’m a "+PR[x].man+".":a<=12?"A little "+PR[x].boy+".":a<18?"A teenage "+PR[x].boy+".":"A "+PR[x].man+".",stT:fx(pk(p.st),x,a),blT:fx(pk(p.bl),x,a),nT:self?"Just me.":"Just the one patient.",hu:self?"Yes, it’s me.":"Yes — one person is hurt and needs help.",sf:self?"Yes, I’m safe — I’ve sat down.":"Yes, we’re safe, I’m staying with "+PR[x].him+"."})}
c.still="Yes, it’s happening right now — please hurry!";c.wp=0}
else if(sv==="f"){const p=FP[ti]||FPD,tr=pk(p.tr);Object.assign(c,{fl:pk(p.fl),sp:pk(p.sp),tr:tr[0],nT:tr[1],still:p.still||"Yes, it’s still going.",sf:pk(["Yes, I’m out of harm’s way.","I’m a bit of a distance away, I think I’m OK.","Not really, I’m still close by."])});if(p.wp!==undefined)c.wp=p.wp;if(p.wpT)c.wpT=p.wpT;if(p.hu)c.hu=p.hu}
else{const p=PP[ti]||{},nr=p.n||[1,3],n=ri(nr[0],nr[1]),off=pk(p.off||["here","foot","vehicle"]),veh=p.veh||pk(CARS),dir=pk(["north","south","east","west"]),vb=p.vb||"driven";let sa=0,sx="m";
if(p.sub){sx=p.sub.s||(r()<.5?"m":"f");sa=ri(p.sub.a[0],p.sub.a[1])}
const F=q=>q&&fx(q,sx,sa).replace("{veh}",veh).replace("{dir}",dir);
Object.assign(c,{n,off,nT:F(p.nT)||(n===1?"Just one person.":n<=6?cp(WD[n])+" of them.":"Quite a few — I’d say about "+n+"."),
offT:F(p.offT)||(off==="here"?"Yes, they’re still here.":off==="foot"?"No, they ran off on foot a minute ago.":"No, they’ve "+vb+" off."),
vehT:F(off==="here"&&p.vh?p.vh:p.vehT)||(off==="vehicle"?"Yes, a "+veh+", headed "+dir+".":off==="foot"?"No, they ran off on foot.":"No, they’re still here on foot."),
desc:F(typeof p.desc==="function"?p.desc(n,r):p.desc)||sus(n,r),
still:F(p.still)||(off==="here"?"Yes, it’s happening right now.":"No, they’ve gone — it only happened a minute ago."),
sf:pk(["Yes, I’m out of harm’s way.","I’m a bit of a distance away, I think I’m OK.","Not really, I’m still close by."])});
if(p.hu)c.hu=F(p.hu);if(p.wp!==undefined)c.wp=p.wp;if(p.wpT)c.wpT=p.wpT;
if(ti==="Welfare check"){c.wcNo=Math.random()<.4;c.wcInj=c.wcNo&&Math.random()<.4;
c.wcSeen=F(pk(["Not for about three days — {he}’s usually out in the garden every morning.","Not since last Tuesday, and {his} curtains have stayed shut.","A few days now. The bins haven’t been put out either."]));
c.wcTry=F(c.wcNo?pk(["Yes, I’ve knocked and phoned all morning — nothing. The post is piling up behind the door.","I’ve knocked loudly and shouted through the letterbox, no answer. The lights are on inside."]):pk(["I knocked and rang {him}, but there was no answer. {He} may just be out, I don’t know.","I’ve phoned a few times and no reply, but I can’t say for certain anything’s wrong."]))}}
m.sc=c;dirty=true;return c}
const QS=[["What’s the address of the emergency?",m=>"It’s at "+m.adr.s+", "+m.adr.t+", "+m.adr.pc+"."],
["What’s happened?",m=>T[m.k][2]],["Your name and phone number?",m=>"I’m "+m.cn+", my number’s "+m.ph+"."],
["Nearest landmark or junction?",m=>scn(m).lm],
["Is anyone hurt?",m=>{const c=scn(m),h=m.hid&&hk(m)==="h";if(c.hu){if(h&&/^Yes/.test(c.hu))m.rev=1;return c.hu}if(h){m.rev=1;return"Yes — someone’s injured and needs help."}return"No, as far as I can tell everyone’s OK."}],
["Any weapons or dangers?",m=>{const c=scn(m),w=m.hid&&hk(m)==="w";if(c.wp===0)return"No, nothing like that.";if(c.wp){if(w)m.rev=1;return c.wpT||"Yes, there are hazards nearby."}if(w){m.rev=1;return T[m.k][0]==="p"?"Yes! I saw a weapon.":"Yes, there’s chemicals/gas bottles nearby."}return"No, nothing like that."}],
["How many people are involved?",m=>scn(m).nT],
["Is it still happening?",m=>scn(m).still],
["Is the patient breathing and conscious?",m=>scn(m).stT,"a"],
["Description of anyone involved?",m=>scn(m).desc,"p"],
["Is anyone still inside or trapped?",m=>scn(m).tr,"f"],
["Are you in a safe place right now?",m=>scn(m).sf],
["Can you see flames or smoke?",m=>scn(m).fl,"f"],
["Is the fire spreading?",m=>scn(m).sp,"f"],
["Is there any bleeding?",m=>scn(m).blT,"a"],
["How old is the patient?",m=>scn(m).ageT,"a"],
["Did they leave in a vehicle?",m=>scn(m).vehT,"p"],
["Are the offenders still at the scene?",m=>scn(m).offT,"p"],
["When did you last see them?",m=>scn(m).wcSeen,"p","Welfare check"],
["Have you tried knocking or phoning?",m=>scn(m).wcTry,"p","Welfare check"]];
