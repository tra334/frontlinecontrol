// unit: [service, name, cost, rank needed, callsign prefix]
const U={pump:["f","Fire engine",8000,0,"FP"],rt:["f","Rescue tender",15000,1,"FR"],wc:["f","Water carrier",10000,2,"FW"],alp:["f","Aerial ladder platform",20000,3,"FA"],icu:["f","Incident command unit",18000,4,"FC"],
fo:["f","Fire officer car",6000,1,"FO"],wf:["f","Wildfire 4x4",9000,2,"FF"],hmu:["f","Hazmat unit",18000,3,"FH",["hazmat"]],usar:["f","Urban search & rescue",22000,4,"FU",["height"]],
irv:["p","Response car",5000,0,"PR"],van:["p","Police van",6000,1,"PV"],rp:["p","Roads policing",8000,1,"PX",["tpac"]],dog:["p","Dog unit",7000,2,"PD"],arv:["p","Armed response",15000,3,"PA",["afo"]],
sgt:["p","Patrol sergeant car",6000,1,"PS"],mc:["p","Police motorcycle",6000,1,"PM",["tpac"]],cid:["p","CID detectives",8000,2,"PC"],po:["p","Public order carrier",12000,3,"PO",["pubord"]],hel:["p","Police helicopter",40000,4,"PH"],
dca:["a","Ambulance",7000,0,"AM"],rrv:["a","Rapid response car",4000,0,"AR"],ao:["a","Ambulance officer",5000,1,"AO",["advpara"]],bike:["a","Paramedic motorbike",4500,1,"AB"],hart:["a","HART team",20000,4,"AH",["trauma","hazmat"]],ccc:["a","Critical care car",16000,3,"AC",["trauma","advpara"]],air:["a","Air ambulance",45000,4,"AA",["trauma"]],mci:["a","Major incident unit",25000,4,"AI"]};
const ABASE={aa:{u:"air",cost:80000,ed:"tr:trauma",edn:"Trauma / critical care"},ph:{u:"hel",cost:80000,ed:"tr:aviation",edn:"Aviation training"}};const BASEACC={aa:["air","ccc"],ph:["hel"]},NOBASE=new Set(["air","hel"]);const accepts=s=>BASEACC[s.sv]||Object.keys(U).filter(k=>U[k][0]===s.sv&&!NOBASE.has(k));/* Free air bases are a one-off grandfather perk: aircraft that were already housed in an ordinary Ambulance/Police station before the air-base update. S.gf snapshots that count once per save (see startGame); S.fb counts the free bases already claimed. */const legacyAir=k=>S.un.filter(u=>{if(u.ty!==ABASE[k].u)return false;const s=S.st.find(x=>x.id===u.sid);return !!s&&s.sv!==k}).length,freeB=k=>Math.max(0,((S.gf||{})[k]||0)-((S.fb||{})[k]||0));const eduOk=k=>!ABASE[k]||S.un.some(u=>has(u,ABASE[k].ed));const AIRMAX={aa:3,ph:6},BAYMAX={aa:10,ph:6};const needTrain=(s,k)=>!!s&&!!ABASE[s.sv]&&ABASE[s.sv].u===k&&!eduOk(s.sv);const trainFee=(s,k)=>TR[ABASE[s.sv].ed.slice(3)][1];function buyT(sid,ty){const s=stn(sid),v=U[ty];if(!s||!v)return;const tk=ABASE[s.sv].ed.slice(3),tot=v[2]+TR[tk][1];if(!ABASE[s.sv]||ABASE[s.sv].u!==ty||v[3]>rank()||S.cr<tot||!accepts(s).includes(ty)||vehReason(s,ty)||S.un.filter(u=>u.sid===sid).length>=cap(s))return;S.cr-=tot;ldg("sp","New unit: "+v[4]+S.nid+" "+v[1]+" with "+TR[tk][0],-tot);const id=S.nid++;const tr=(v[5]||[]).slice();if(!tr.includes(tk))tr.push(tk);S.un.push({id,ty,sid,cs:v[4]+id,st:"idle",mid:0,tr});log("🚗✅ Unit purchased: "+v[4]+id+" "+v[1]+" ("+TR[tk][0]+" trained)");persist();$("#v").dataset.n="";paint();if(si)drawS()}const vehReason=(s,k)=>{if(!s||!ABASE[s.sv]||k!==ABASE[s.sv].u)return"";if(S.un.filter(u=>u.sid===s.id&&u.ty===k).length>=AIRMAX[s.sv])return"Max "+AIRMAX[s.sv]+" "+U[k][1].toLowerCase()+"s at this base.";return""};const HN={hs:"Small Hospital",hm:"Major Hospital",pn:"Prison"},HCOST={hs:30000,hm:150000,pn:50000},HBEDS={hs:2,hm:8,pn:5},cst=k=>ABASE[k]?(freeB(k)>0?0:ABASE[k].cost):HCOST[k]||COST,prc=k=>cst(k)?"£"+fmt(cst(k)):"FREE",bn=k=>HN[k]||SN[k];
const BAYS=8,SP={pump:55,rt:50,wc:45,alp:40,icu:50,fo:65,wf:50,hmu:45,usar:45,irv:75,van:65,rp:85,dog:70,arv:85,sgt:70,mc:85,cid:65,po:60,hel:360,dca:65,rrv:75,ao:65,bike:70,hart:70,ccc:70,air:400,mci:50};
// training: [name, cost, rank needed, services]
const TR={hazmat:["Hazmat / CBRN",6000,1,["f","a"]],water:["Water rescue",5000,1,["f","a"]],height:["Rope & height rescue",5000,2,["f"]],wildfire:["Wildfire tactics",4000,1,["f"]],afo:["Firearms (AFO)",9000,2,["p"]],pubord:["Public order (PSU)",6000,1,["p"]],tpac:["Tactical pursuit",5000,1,["p"]],mh:["Mental health",4000,1,["p","a"]],advpara:["Advanced paramedic",6000,1,["a"]],trauma:["Trauma / critical care",9000,3,["a"]],aviation:["Aviation training",10000,3,["p"]]};
const RK=[["Trainee Call-Handler",0],["Dispatcher",5],["Senior Dispatcher",15],["Duty Officer",35],["Inspector",70],["Chief Controller",120]];
const SV={f:"Fire",p:"Police",a:"Ambulance",aa:"Air Ambulance",ph:"Police Helicopter"},SC={f:"#d92d20",p:"#1d4ed8",a:"#16a34a",aa:"#0f766e",ph:"#1e3a8a"},SN={f:"Fire Station",p:"Police Station",a:"Ambulance Station",aa:"Air Ambulance Station",ph:"Police Helicopter Station"},COST=15000;
const GB=[[-5.7,50.1],[-5.2,49.96],[-4.2,50.35],[-3.5,50.2],[-3,50.7],[-2.45,50.55],[-1.2,50.75],[-0.14,50.82],[0.3,50.77],[0.97,50.92],[1.4,51.15],[1.4,51.35],[0.8,51.4],[0.7,51.6],[1.25,51.8],[1.75,52.45],[1.75,52.75],[1.3,52.95],[0.4,52.95],[0.2,52.85],[0.1,53.3],[0.1,53.58],[-0.2,54.1],[-0.6,54.45],[-1.2,54.6],[-1.4,54.9],[-1.6,55.3],[-2,55.77],[-2.4,56],[-2.6,56.05],[-3.2,56],[-2.6,56.35],[-3,56.45],[-2.4,56.7],[-2,57.15],[-1.8,57.5],[-2.5,57.7],[-3.4,57.7],[-4,57.6],[-3.8,57.85],[-3,58.3],[-3,58.6],[-4.4,58.55],[-5,58.63],[-5.2,58.1],[-5.8,57.4],[-5.6,56.9],[-6.2,56.7],[-5.6,56],[-5.7,55.3],[-4.9,55.9],[-4.6,55.45],[-4.9,54.65],[-3.6,54.85],[-3.4,54.6],[-3.6,54.4],[-3.2,54.1],[-3,54],[-3,53.6],[-3.2,53.4],[-3.5,53.3],[-4.5,53.4],[-4.6,53.1],[-4.7,52.8],[-4.1,52.6],[-4.5,52.2],[-5.3,51.85],[-4.8,51.65],[-3.9,51.6],[-3.2,51.45],[-2.7,51.55],[-3,51.3],[-3.6,51.2],[-4.2,51.2],[-4.55,50.99],[-5.05,50.55],[-5.5,50.2]];
const NI=[[-5.8,54.85],[-6.15,55.22],[-6.7,55.2],[-7.3,55.05],[-7.9,54.7],[-8,54.4],[-7.6,54.15],[-7,54.1],[-6.4,54],[-6,54.1],[-5.55,54.45],[-5.6,54.65]];
const IE=[[-7.4,55.38],[-7.05,55.25],[-6.65,55.2],[-6.15,55.22],[-6.05,55],[-5.8,54.85],[-5.65,54.7],[-5.45,54.5],[-5.52,54.3],[-5.88,54.2],[-6.1,54],[-6.3,53.95],[-6.25,53.7],[-6.05,53.4],[-6.15,53.3],[-6,52.97],[-6.1,52.8],[-6.35,52.3],[-6.35,52.17],[-6.93,52.12],[-7.6,52.07],[-7.85,51.95],[-8.25,51.8],[-8.5,51.67],[-9.82,51.45],[-10.2,51.6],[-10.35,51.9],[-10.4,52.15],[-9.9,52.4],[-9.9,52.56],[-9.25,53.15],[-9.05,53.2],[-10.25,53.4],[-10.1,53.95],[-10,54.2],[-9.2,54.3],[-8.5,54.3],[-8.45,54.6],[-8.3,55.15],[-7.6,55.3]];
const IOM=[[-4.37,54.42],[-4.3,54.3],[-4.4,54.2],[-4.47,54.15],[-4.62,54.07],[-4.8,54.05],[-4.72,54.2],[-4.7,54.23],[-4.58,54.35]];
const IOW=[[-1.58,50.66],[-1.5,50.71],[-1.3,50.77],[-1.15,50.74],[-1.07,50.69],[-1.15,50.65],[-1.2,50.58],[-1.3,50.57],[-1.45,50.6]];
const JER=[[-2.25,49.22],[-2.2,49.26],[-2.05,49.26],[-2,49.2],[-2.02,49.17],[-2.2,49.17]];
const GSY=[[-2.67,49.43],[-2.6,49.5],[-2.5,49.51],[-2.5,49.42],[-2.62,49.41]];
const ALD=[[-2.24,49.71],[-2.19,49.735],[-2.14,49.72],[-2.17,49.7],[-2.22,49.7]];
const SRK=[[-2.38,49.43],[-2.35,49.48],[-2.33,49.47],[-2.35,49.42]];
const ORK=[[[-3.4,58.98],[-3.3,59.1],[-3.1,59.12],[-2.95,59.05],[-2.85,58.98],[-2.8,58.85],[-2.95,58.76],[-3,58.82],[-3.05,58.9],[-3.2,58.92]],[[-3.35,58.78],[-3.3,58.92],[-3.2,58.93],[-3.15,58.8],[-3.25,58.76]],[[-3.08,59.13],[-3,59.17],[-2.93,59.13],[-3,59.1]],[[-3.05,59.28],[-3,59.35],[-2.95,59.3],[-3,59.25]],[[-2.75,59.2],[-2.6,59.28],[-2.5,59.2],[-2.65,59.15]],[[-2.8,59.15],[-2.75,59.2],[-2.7,59.15],[-2.78,59.1]],[[-2.65,59.1],[-2.58,59.15],[-2.5,59.1],[-2.58,59.05]]];
const SHE=[[[-1.27,59.85],[-1.2,60.05],[-1.1,60.15],[-1.1,60.3],[-1.15,60.4],[-1.28,60.45],[-1.3,60.6],[-1.35,60.68],[-1.5,60.55],[-1.6,60.5],[-1.65,60.4],[-1.7,60.3],[-1.5,60.2],[-1.4,60.1],[-1.4,59.95],[-1.35,59.88]],[[-1.22,60.48],[-1.05,60.5],[-0.97,60.6],[-1,60.72],[-1.1,60.72],[-1.2,60.6]],[[-0.95,60.7],[-0.9,60.8],[-0.8,60.85],[-0.78,60.75],[-0.88,60.65]],[[-1.05,60.35],[-1,60.4],[-0.95,60.37],[-1,60.32]]];
const LANDS=[GB,NI,IE,IOM,IOW,JER,GSY,ALD,SRK,...ORK,...SHE];
const CITY=[["London",51.5,-.12],["Manchester",53.48,-2.24],["Birmingham",52.48,-1.9],["Leeds",53.8,-1.55],["Glasgow",55.86,-4.25],["Edinburgh",55.95,-3.19],["Cardiff",51.48,-3.18],["Bristol",51.45,-2.59],["Liverpool",53.4,-2.99],["Newcastle",54.98,-1.62],["Belfast",54.6,-5.93],["Aberdeen",57.15,-2.09],["Inverness",57.48,-4.22],["Norwich",52.63,1.3],["Plymouth",50.37,-4.14],["Southampton",50.9,-1.4],["Sheffield",53.38,-1.47],["Nottingham",52.95,-1.15],["Exeter",50.72,-3.53],["Swansea",51.62,-3.94],["Carlisle",54.89,-2.93],["Cambridge",52.2,.12],["Dublin",53.35,-6.26],["Cork",51.9,-8.47],["Galway",53.27,-9.05],["Limerick",52.66,-8.63],["Douglas",54.15,-4.48],["Isle of Wight",50.68,-1.3],["St Helier",49.19,-2.1],["St Peter Port",49.455,-2.54],["Kirkwall",58.98,-2.96],["Lerwick",60.155,-1.145]];
const ROADS=["High Street","Station Road","Church Lane","Victoria Road","Mill Lane","London Road","Park Avenue","Kings Road","The Green","Albert Street","Elm Grove","Castle Street"];
// [service, title, caller, needs, seconds on scene, credits]
const T=[
["f","House fire","“There’s smoke pouring from the kitchen window!”",{pump:2},70,900],
["f","Chimney fire","“Flames coming out the top of the chimney.”",{pump:1},40,400],
["f","RTC – persons trapped","“Two cars, one driver can’t get out!”",{pump:1,rt:1,dca:1},90,1400],
["f","Car fire","“Vehicle fully alight on the hard shoulder.”",{pump:1},40,450],
["f","Fire alarm – office","“Alarm’s been going for ten minutes.”",{pump:1},35,300],
["f","Flat fire","“The stairwell’s filling with smoke!”",{pump:2,alp:1,dca:1,fo:1},100,2200],
["f","Moorland fire","“The whole hillside is on fire.”",{pump:2,wc:1},80,1100],
["f","Person stuck in lift","“We’ve been stuck between floors for an hour.”",{rt:1},40,350],
["f","Warehouse fire","“Huge fire at the industrial estate!”",{pump:3,alp:1,wc:1,icu:1,hmu:1},120,3500],
["f","Barn fire","“The hay barn’s gone up, animals inside.”",{pump:2,wc:2},90,1300],
["p","Burglary in progress","“Someone’s smashing my back door right now!”",{irv:1},40,350],
["p","Domestic disturbance","“Next door are screaming and throwing things.”",{irv:2},50,500],
["p","Drink driver","“A car’s swerving all over the road.”",{rp:1,van:1},50,500],
["p","Pub brawl","“Chucking-out time, huge fight outside.”",{irv:2,van:1},60,800],
["p","Missing child","“My daughter’s six, she was in the park a minute ago…”",{irv:2,dog:1},90,1100],
["p","Armed robbery","“A man with a gun’s walked into the Co-op!”",{irv:2,"tr:afo":2},80,2200],
["p","Stolen vehicle pursuit","“That’s my van going down the bypass!”",{rp:2,irv:1},70,900],
["p","Football disorder","“Rival fans throwing bottles near the ground.”",{irv:3,van:2,dog:1,"tr:pubord":2},100,1800],
["p","Anti-social behaviour","“Kids on mopeds tearing round the estate.”",{irv:1},25,180],
["p","Fatal collision","“Car’s hit a lorry, driver’s not moving.”",{rp:2,irv:1,dca:1},90,1300],
["p","Cannabis farm raid","“Strong smell and lights on all night at number 14.”",{van:2,irv:2,dog:1},90,1400],
["a","Cat 1 – cardiac arrest","“He’s collapsed, he’s not breathing!”",{rrv:1,dca:1},50,900],
["a","Cat 2 – chest pain","“My husband’s got pain down his left arm.”",{dca:1},45,450],
["a","Cat 3 – fall, elderly","“Nan’s fallen, can’t get up, hip hurts.”",{dca:1},40,300],
["a","Cat 4 – minor injury","“Cut my hand on a tin, bleeding a bit.”",{rrv:1},30,200],
["a","Cat 1 – choking","“My toddler’s choking on a grape!”",{rrv:1,dca:1},40,700],
["a","Cat 2 – stroke","“Her face has dropped and speech is slurred.”",{dca:1,rrv:1},50,650],
["a","Cat 1 – major trauma RTC","“Motorbike versus van, rider’s unconscious.”",{dca:2,"tr:trauma":1,rrv:1},100,2500],
["a","Cat 1 – childbirth","“Her waters broke, baby’s coming now!”",{dca:1,rrv:1},60,800],
["a","Mass casualty – coach crash","“Coach has rolled over, loads hurt!”",{dca:4,hart:1,rrv:2,ao:1,mci:1},120,4000],
["f","Chemical spill","“There’s a tanker leaking and a strange smell!”",{pump:1,"tr:hazmat":1},80,1200],
["f","Person in river","“Someone’s fallen in the river and is being swept away!”",{pump:1,"tr:water":1,dca:1},70,1300],
["f","High-rise rescue","“There’s a person on a ledge, ten floors up!”",{pump:1,alp:1,"tr:height":1,dca:1},90,2000],
["f","Wildfire","“Heath fire spreading towards houses!”",{wf:2,pump:1,wc:1,"tr:wildfire":1},100,1800],
["f","Building collapse","“Part of the building’s come down, people are inside!”",{pump:2,usar:1,rt:1,dca:2},120,3200],
["p","Motorcycle collision","“Biker’s down on the A-road, car’s stopped.”",{mc:1,irv:1,dca:1},60,700],
["p","Suspicious death","“I think our neighbour has died… the door’s open.”",{irv:1,sgt:1,cid:2},80,1100],
["p","Missing person – woods","“Dementia patient missing since dawn.”",{irv:2,hel:1,dog:1},100,1600],
["p","Mental health crisis","“He’s threatening to hurt himself, please hurry.”",{irv:1,"tr:mh":1,sgt:1},60,700],
["p","Riot","“Crowd’s smashing windows and setting bins alight!”",{po:2,irv:3,"tr:pubord":2},110,2600],
["a","Cat 1 – advanced life support","“He’s collapsed and turned blue.”",{dca:1,ccc:1,"tr:advpara":1},60,1300],
["a","Cat 2 – remote rescue","“Walker’s fallen off the hillside, we can’t reach him.”",{air:1,dca:1},80,1700],
["a","Cat 3 – cyclist down","“Cyclist came off, grazed and sore.”",{bike:1},30,250],
["p","Welfare check","“I haven’t seen my neighbour for days and I’m really worried about them.”",{irv:1},50,400],
// ---- Rank 0 ----
["f","Bin fire","“Wheelie bins are on fire behind the shops.”",{pump:1},25,220],
["f","Shed fire","“My neighbour’s garden shed is burning, it’s close to the fence!”",{pump:1},35,380],
["f","Gas smell – outdoors","“There’s a strong smell of gas by the pavement.”",{pump:1},35,320],
["f","Fire alarm – school","“The alarm’s gone off and the children are out on the field.”",{pump:1},35,330],
["p","Shoplifting in progress","“Security have got a man who’s stolen from the shop, he’s kicking off.”",{irv:1},30,200],
["p","Criminal damage","“Someone’s smashing up cars on our street!”",{irv:1},35,260],
["p","Hit and run – minor","“A car clipped me and just drove off.”",{irv:1},35,280],
["p","Noise nuisance – party","“Party next door, it’s 3am and they won’t stop.”",{irv:1},25,160],
["a","Cat 2 – asthma attack","“My son can’t get his breath, his inhaler isn’t working.”",{rrv:1,dca:1},45,500],
["a","Cat 3 – allergic reaction","“She’s come out in a rash and her lips are swelling.”",{rrv:1},40,350],
["a","Cat 3 – abdominal pain","“He’s doubled over with stomach pain since last night.”",{dca:1},40,300],
["a","Cat 4 – nosebleed","“It just won’t stop bleeding.”",{rrv:1},25,170],
// ---- Rank 1 ----
["f","Flooded property","“Water’s pouring through the ceiling and into the hallway!”",{pump:1,rt:1},60,650],
["f","Animal rescue – cow in ditch","“A cow’s stuck in a ditch and can’t get out.”",{rt:1,fo:1},60,600],
["f","Gas leak – street","“Workmen hit a gas main, the whole street smells of it!”",{pump:1,fo:1,"tr:hazmat":1},70,1050],
["f","Tree on house","“A tree’s come through our roof in the storm!”",{pump:1,rt:1},60,700],
["p","Road rage","“Two drivers are fighting in the road, one’s got a bat!”",{rp:1,irv:1},45,550],
["p","Illegal street race","“Cars racing on the industrial estate, loads of spectators.”",{rp:2,mc:1,van:1},70,1000],
["p","Traffic hazard – debris","“Big load of timber has fallen off a lorry on the dual carriageway.”",{mc:1},35,300],
["p","Shop theft – gang","“Group of lads have cleared the shelves and run out.”",{irv:1,van:1},50,600],
["a","Cat 2 – diabetic emergency","“She’s very confused and sweaty, she’s diabetic.”",{rrv:1,dca:1},50,550],
["a","Cat 2 – overdose","“He’s taken a load of pills and is drifting off.”",{dca:1,bike:1},55,750],
["a","Cat 2 – seizure","“He’s fitting on the floor and hasn’t stopped!”",{rrv:1,dca:1,ao:1},55,800],
// ---- Rank 2 ----
["f","Tractor rollover","“Farm tractor’s rolled on a slope, the farmer’s underneath!”",{pump:1,rt:1,wc:1,dca:1},90,1700],
["f","Industrial machinery entrapment","“A worker’s arm is caught in a machine at the factory!”",{pump:1,rt:1,fo:1,dca:1},90,1600],
["f","Quarry cliff rescue","“A climber’s fallen and is stuck on a ledge in the quarry.”",{rt:1,"tr:height":1,dca:1},100,1900],
["f","Hill fire – livestock","“Gorse fire is racing across the hill towards the farm!”",{wf:1,pump:1,wc:2},90,1500],
["p","Kidnap report","“They bundled him into a van outside the gym!”",{irv:2,cid:2,dog:1},100,1900],
["p","Drugs supply raid","“Dealers are running a house, people in and out all day.”",{van:2,cid:2,dog:1,irv:1},100,1700],
["p","Aggravated burglary","“Masked men are inside, the family are upstairs!”",{irv:2,cid:1,dog:1,"tr:afo":1},80,1800],
["p","Vulnerable person on bridge","“There’s someone standing on the wrong side of the bridge.”",{irv:1,sgt:1,"tr:mh":1},70,1300],
["a","Cat 1 – overdose, multiple","“Three people have collapsed at a house party!”",{dca:2,ao:1,rrv:1},70,1500],
["a","Cat 2 – farm accident","“Farmer’s been kicked by a bull, he’s barely moving.”",{dca:1,rrv:1,ao:1},70,1100],
// ---- Rank 3 ----
["f","Tower block – cladding fire","“Fire’s racing up the outside of the block, people on balconies!”",{pump:3,alp:2,fo:1,dca:2},120,3800],
["f","Chemical plant leak","“Alarm sounding and a yellow cloud over the chemical works!”",{pump:2,hmu:1,"tr:hazmat":2,fo:1},110,3300],
["f","Tanker overturned","“Fuel tanker’s on its side and leaking onto the road!”",{pump:2,hmu:1,rt:1,dca:1},110,3000],
["f","Multi-storey car park fire","“Cars are burning on the third level, thick smoke everywhere.”",{pump:2,alp:1,wc:1,fo:1},100,2500],
["p","Siege – barricaded suspect","“He’s locked himself in with a knife and says he’ll use it!”",{arv:2,irv:2,sgt:1,"tr:afo":2},120,3000],
["p","Stabbing – suspect at large","“A lad’s been stabbed and the attacker ran off!”",{irv:2,arv:1,dca:1,cid:1},90,2300],
["p","Suspicious package","“Unattended bag at the shopping centre, security are clearing the area.”",{irv:2,arv:1,sgt:1,po:1},100,2100],
["p","Protest – road blockade","“Protesters have chained themselves across the main road.”",{po:1,irv:2,van:1,"tr:pubord":1},100,2000],
["a","Cat 1 – cardiac arrest, critical care","“Our dad’s collapsed again, paramedics need to bring the heart team!”",{dca:1,ccc:1,rrv:1},70,1700],
["a","Cat 1 – fall from height","“Builder’s fallen off scaffolding, he’s not moving.”",{dca:1,ccc:1,rrv:1,"tr:trauma":1},90,2600],
["a","Cat 1 – crush injury","“Something heavy fell on a worker at the yard!”",{dca:2,ccc:1,ao:1},90,2400],
// ---- Rank 4 ----
["f","Train derailment","“A passenger train’s come off the track, carriages are on their sides!”",{pump:3,rt:2,usar:1,icu:1,dca:3,hart:1,mci:1},150,6500],
["f","Chemical works inferno","“Explosions at the works and a huge black cloud is spreading!”",{pump:4,alp:1,wc:2,icu:1,hmu:1,"tr:hazmat":2},150,6000],
["f","Tunnel collapse","“Roof’s come down in the road tunnel, vehicles are trapped!”",{pump:2,usar:2,rt:1,icu:1,dca:2,hart:1},150,5800],
["f","Flash flood evacuation","“Water’s rising fast and people are stranded on roofs!”",{pump:2,wc:1,"tr:water":2,dca:1},130,3800],
["p","Marauding attack","“A man’s attacking people in the street with a blade, loads running!”",{arv:4,irv:3,hel:1,po:1,sgt:1,cid:2},150,6200],
["p","Hostage situation","“He’s got two staff hostage in the bank and a gun!”",{arv:3,hel:1,sgt:1,cid:2,irv:2},150,5500],
["p","Prison disturbance","“Inmates have taken control of a wing!”",{po:2,irv:3,dog:2,"tr:pubord":2,sgt:1},140,4600],
["a","Major incident – stadium crush","“There’s been a crush at the gates, people are down everywhere!”",{dca:5,hart:1,mci:1,ao:2,rrv:2,air:1},150,6000],
["a","Cat 1 – multi-casualty fire","“Hotel fire, lots of people overcome by smoke!”",{dca:3,hart:1,ao:1,rrv:2,mci:1,pump:4,rt:1,alp:1},130,4500],
["a","Cat 1 – air ambulance critical","“Hiker in a fall off a cliff, needs a doctor with them!”",{air:1,dca:1,ccc:1},110,3400]
];
const FACT={f:["Crews on scene, building is well alight.","Fire’s contained for now.","Neighbours evacuated to the street."],p:["Officers on scene, area is secure.","Witnesses giving statements.","Suspect has left the area."],a:["Crew with patient, observations ongoing.","Patient conscious and talking.","Family members at the scene."]};
