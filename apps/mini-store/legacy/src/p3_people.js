
// ================= People: lofted torso, tapered capsule limbs, face details, hair / caps / helmets =================
const SKINS=['#d9a47e','#c68e65','#b97f58','#e3b48f'];
// local frame faces +z, feet at y=0. o.pose: stand | walk | phone | sit | drink | ride | pillion
function human(M,x,y,z,ry,o={}){M.at(x,y,z,ry,()=>{M.push(M4.scale(o.h||(o.female?.95:1),o.h||(o.female?.95:1),o.h||(o.female?.95:1)));
  const sh=Mat(o.shirt||'#e8e8e8',{r:.78}),pa=Mat(o.pants||'#2a2e36',{r:.82}),sk=Mat(o.skin||pick(SKINS),{r:.5}),hr=Mat(o.hair||'#15100c',{r:.42}),
    so=Mat(o.shoes||'#1a1a1a',{r:.55}),pose=o.pose||'stand',fem=!!o.female,seated=pose==='sit'||pose==='drink',onBike=pose==='ride'||pose==='pillion';
  const ln=pose==='ride'?.08:pose==='pillion'?.03:0,hy=seated?(o.seat||.45)+.1:onBike?(o.seat||.86)+.08:.9;
  // legs
  for(const s of [-1,1]){const hip=[s*.09,hy,0];let knee,ank;
    if(seated){knee=[s*.11,hy-.01,.42];ank=[s*.11,.09,.46]}
    else if(pose==='ride'){knee=[s*.17,hy+.03,.36];ank=[s*.16,(o.foot??.4)+.06,.32]}
    else if(pose==='pillion'){knee=[s*.18,hy+.02,.3];ank=[s*.2,(o.foot??.36)+.05,.16]}
    else if(pose==='walk'){const st=o.stride??.22;knee=[s*.1,.49,s*st*.55];ank=[s*.1,.09+(s>0?.04:0),s*st]}
    else{knee=[s*.1,.49,.02];ank=[s*.1,.09,0]}
    M.capsule(hip,knee,fem?.08:.085,pa,10,.062);M.capsule(knee,ank,.06,o.shorts?sk:pa,10,.04);
    M.sphere(ank[0],ank[1]-.04,ank[2]+.045,.048,.038,.115,12,so);
    if(o.sneaker)M.box(ank[0]-.05,ank[1]-.08,ank[2]-.07,ank[0]+.05,ank[1]-.06,ank[2]+.16,Mat('#f2f2f0',{r:.6}))}
  // torso (pants + shirt lofts)
  const SEC=fem?[[0,.172,.115],[.07,.178,.12],[.17,.135,.095],[.27,.15,.11],[.35,.165,.128],[.43,.172,.105],[.48,.148,.085],[.52,.085,.065],[.545,.05,.048]]
                :[[0,.165,.112],[.07,.172,.118],[.16,.15,.102],[.26,.16,.11],[.36,.18,.12],[.44,.192,.112],[.49,.165,.09],[.53,.09,.07],[.555,.055,.05]];
  const zAt=h=>ln*h/.55,ring=(sec,k=1)=>ringY(0,hy+sec[0],zAt(sec[0])+(sec[0]>.25&&sec[0]<.45?.008:0),sec[1]*k,sec[2]*k,18);
  M.loft([ring(SEC[0]),ring(SEC[1]),ring(SEC[2])],pa,{caps:true});M.loft(SEC.slice(2).map((s,i)=>ring(s,i===0?1.04:1)),sh,{caps:true});
  const nz=zAt(.55);if(o.collar!==false)M.loft([ringY(0,hy+.52,nz,.082,.07,16),ringY(0,hy+.575,nz+.004,.068,.06,16)],Mat(o.collar||o.shirt||'#e8e8e8',{r:.75}));
  M.capsule([0,hy+.53,nz],[0,hy+.64,nz+.01],.046,sk,10,.042);
  // head + face
  const HY=hy+.745,hz=ln*1.2+.012;
  M.sphere(0,HY,hz,.087,.108,.098,16,sk);M.sphere(0,HY-.045,hz+.018,.072,.062,.078,14,sk);M.sphere(0,HY-.012,hz+.094,.012,.022,.018,8,sk);
  for(const s of [-1,1]){M.sphere(s*.086,HY-.005,hz-.008,.012,.026,.02,8,sk);M.sphere(s*.03,HY+.008,hz+.083,.011,.009,.006,8,Mat('#120c08',{r:.15}));
    M.box(s*.03-.016,HY+.026,hz+.08,s*.03+.016,HY+.032,hz+.09,hr)}
  M.box(-.016,HY-.058,hz+.078,.016,HY-.053,hz+.088,Mat('#8a3f35',{r:.5}));
  if(o.mask)M.sphere(0,HY-.043,hz+.05,.074,.05,.06,12,Mat(o.mask,{r:.8}));
  if(o.helmet){const hm=Mat(o.helmet,{r:.16,w:1});M.sphere(0,HY+.03,hz-.005,.128,.124,.142,18,hm);M.sphere(0,HY+.062,hz-.004,.13,.012,.144,18,Mat(o.stripe||'#ffffff',{r:.3,w:1}));
    M.sphere(0,HY+.06,hz+.11,.108,.016,.078,14,Mat(o.visor||o.helmet,{r:.25,w:1}));for(const s of [-1,1])M.rod([s*.09,HY-.02,hz+.02],[s*.04,HY-.1,hz+.04],.006,MT.blackGloss,4)}
  else{M.sphere(0,HY+.028,hz-.012,.092,.085,.103,14,hr);M.sphere(0,HY+.066,hz+.05,.078,.028,.05,12,hr);
    if(o.hairStyle==='long'){M.sphere(0,HY-.07,hz-.055,.098,.15,.06,12,hr);for(const s of [-1,1])M.sphere(s*.075,HY-.04,hz,.028,.1,.05,8,hr)}
    if(o.hairStyle==='bun')M.sphere(0,HY+.07,hz-.09,.045,.045,.045,10,hr);
    if(o.hairStyle==='pony')M.capsule([0,HY+.03,hz-.1],[0,HY-.12,hz-.14],.035,hr,8,.02);
    if(o.cap){const cr=Mat(o.cap==='ck'?'#f4f4f4':o.cap,{r:.65}),cb=Mat('#e4211b',{r:.55});
      M.sphere(0,HY+.05,hz-.008,.098,.066,.106,14,cr);M.sphere(0,HY+.056,hz+.042,.085,.054,.068,12,cb);M.sphere(0,HY+.03,hz+.11,.086,.012,.076,12,cb)}}
  // arms
  for(const s of [-1,1]){const S=[s*(fem?.165:.185),hy+.465,zAt(.46)];let E,W;
    if(onBike&&o.phone&&s>0){E=[.22,hy+.2,.16];W=[.07,hy+.33,.3]}
    else if(pose==='ride'){E=[s*.25,hy+.3,.36];W=[s*.3,o.gripY||1.1,o.gripZ||.78]}
    else if(pose==='pillion'){E=[s*.23,hy+.2,.12];W=[s*.17,hy+.08,.32]}
    else if(pose==='sit'){E=[s*.23,hy+.2,.12];W=[s*.15,hy+.3,.34]}
    else if(pose==='drink'&&s<0){E=[-.22,hy+.25,.16];W=[-.08,hy+.58,.15]}
    else if(pose==='drink'){E=[.23,hy+.2,.12];W=[.15,hy+.3,.34]}
    else if(pose==='phone'&&s>0){E=[.2,hy+.22,.12];W=[.08,hy+.37,.24]}
    else if(pose==='walk'){const sw=-s*(o.stride??.22)*.8;E=[s*.23,hy+.21,sw*.5];W=[s*.25,hy-.02,sw]}
    else if(o.arms==='counter'){E=[s*.24,hy+.2,.1];W=[s*.18,hy+.12,.33]}
    else{E=[s*.235,hy+.2,.02];W=[s*.25,hy-.03,.06]}
    if(o.long)M.capsule(S,E,.05,sh,10,.043);
    else{const mid=[S[0]+(E[0]-S[0])*.45,S[1]+(E[1]-S[1])*.45,S[2]+(E[2]-S[2])*.45];M.capsule(S,mid,.056,sh,10,.052);M.capsule(mid,E,.042,sk,10,.039)}
    M.capsule(E,W,.04,o.long?sh:sk,10,.032);
    const d=[W[0]-E[0],W[1]-E[1],W[2]-E[2]],dl=Math.hypot(...d)||1,H=[W[0]+d[0]/dl*.065,W[1]+d[1]/dl*.065,W[2]+d[2]/dl*.065];M.capsule(W,H,.03,sk,8,.025);
    if(o.stripe&&o.long){const off=[s*.046,.012,0],st=Mat(o.stripe,{r:.5});M.rod([S[0]+off[0],S[1]+off[1],S[2]],[E[0]+off[0]*.9,E[1]+off[1],E[2]],.008,st,4);M.rod([E[0]+off[0]*.85,E[1]+off[1],E[2]],[W[0]+off[0]*.75,W[1]+off[1],W[2]],.007,st,4)}
    if((pose==='phone'||o.phone)&&s>0)M.box(W[0]-.035,W[1]+.02,W[2]-.01,W[0]+.035,W[1]+.15,W[2]+.005,Mat('#12161c',{r:.12,e:.0}));
    if(pose==='drink'&&s<0)M.at(W[0],W[1]-.05,W[2]+.03,0,()=>M.cyl(.035,.13,10,Mat(o.cup||'#c47a2c',{r:.2})))}
  if(o.back){const bz=zAt(.33)-.125;M.quad([.1,hy+.23,bz],[-.1,hy+.23,bz],[-.1,hy+.42,bz],[.1,hy+.42,bz],tex(o.back,.05,{r:.6}))}
  if(o.bag){const bm=Mat(o.bag,{r:.6,w:1}),bz=zAt(.3)-.19;M.sphere(0,hy+.3,bz,.15,.2,.075,14,bm);for(const s of [-1,1])M.rod([s*.1,hy+.48,zAt(.47)-.06],[s*.11,hy+.16,zAt(.2)-.11],.012,bm,4)}
  M.pop()})}
