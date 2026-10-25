
// ================= Interior: coolers, gondolas with 3D stock, black POS counter, orange menu wall =================
rs=41;
// one row of packaged goods standing on a shelf. axis 'x': row along x, facing dir*z ; axis 'z': row along z, facing dir*x
function stock(M,a0,a1,y,front,dir,depth,hMax,axis='x',small=false){let a=a0+.015;
  while(a<a1-.04){const w=(small?.035:.05)+rnd()*(small?.04:.08),h=hMax*(.45+rnd()*.5),d=depth*(.55+rnd()*.4),n=1+Math.floor(rnd()*3);
    const c=hex(pick(PACK)).map(v=>v*.45+.4),mt=Mat(c,{r:.35}),lab=labelUV(Math.floor(rnd()*8),Math.floor(rnd()*8));
    for(let k=0;k<n&&a+w<a1;k++){const f0=front,f1=front-dir*d,lo=Math.min(f0,f1),hi=Math.max(f0,f1);
      if(axis==='x')M.box(a,y,lo,a+w-.006,y+h,hi,mt,{ny:false,[dir>0?'nz':'pz']:false,[dir>0?'pz':'nz']:lab});
      else M.box(lo,y,a,hi,y+h,a+w-.006,mt,{ny:false,[dir>0?'nx':'px']:false,[dir>0?'px':'nx']:lab});a+=w}a+=.004+rnd()*.012}}
function shelfEdge(M,a0,a1,y,front,dir,axis){const m=Mat('#f4f4f0',{r:.4});if(axis==='x')M.box(a0,y-.035,front-(dir>0?.01:-.01)-.005,a1,y+.01,front+(dir>0?.012:-.012),m);
  else M.box(front-(dir>0?.01:-.01)-.005,y-.035,a0,front+(dir>0?.012:-.012),y+.01,a1,m)}
// ---- ceiling: linear LED, AC cassette ----
for(const x of [-4.0,-2.8,-1.6,-.4,.8])O.box(x-.035,2.915,-6.8,x+.035,2.95,.55,MT.panel);
O.box(-1.4,2.9,-3.6,-.6,2.95,-2.8,MT.whiteIn);for(let k=0;k<4;k++)O.box(-1.32+k*.2,2.895,-3.5,-1.22+k*.2,2.9,-2.9,Mat('#9aa0a6',{r:.5}));
L(-3.4,2.55,-1.2,8,[1,.97,.94],8);L(-1.2,2.55,-1.2,8,[1,.97,.94],8);L(1.0,2.55,-1.6,8,[1,.97,.94],8);
L(-3.4,2.55,-4.4,8,[1,.97,.94],7.5);L(-1.2,2.55,-4.4,8,[1,.97,.94],7.5);L(1.0,2.55,-5.6,7,[1,.95,.9],7);
// ---- back-wall glass-door coolers ----
const CX0=-4.85,CX1=-.6,CZ=-6.72;
O.box(CX0,SY,-7.4,CX1,2.28,CZ,Mat('#2b2d31',{r:.4,m:.5}),{pz:false});O.box(CX0,SY,-7.36,CX1,2.24,-7.34,Mat('#ffffff',{e:1.6}));
for(const y of [.45,.8,1.15,1.5,1.85]){O.box(CX0,y-.015,-7.33,CX1,y,CZ-.04,Mat('#d8dde2',{r:.3,m:.6}));
  for(let x=CX0+.05;x<CX1-.06;x+=.075+rnd()*.02){const c=pick(['#e8402f','#2a7de1','#1fa35a','#f2b705','#ffffff','#13a3b5','#d93a8c','#f07c1b']),hh=.2+rnd()*.12;
    O.at(x,y,-6.95,0,()=>{O.cyl(.032,hh,8,Mat(c,{r:.15}));O.push(M4.trans(0,hh,0));O.cyl(.014,.035,6,Mat('#ddd',{r:.3}),{r2:.012});O.pop()});
    O.box(x-.03,y+hh*.35,-6.918,x+.03,y+hh*.6,-6.916,Mat('#ffffff',{r:.4}))}}
const NDOOR=6,DW=(CX1-CX0)/NDOOR;
for(let k=0;k<=NDOOR;k++){const x=CX0+k*DW;O.box(x-.03,SY,CZ-.02,x+.03,2.28,CZ+.03,Mat('#18191b',{r:.35,m:.6}));if(k<NDOOR)O.box(x+.05,SY+.1,CZ-.06,x+.06,2.18,CZ-.05,Mat('#ffffff',{e:5}))}
for(let k=0;k<NDOOR;k++){const x=CX0+k*DW;decalZ(G,x+.03,x+DW-.03,SY+.06,2.22,CZ+.02,MT.glassIn);O.box(x+DW-.1,.9,CZ+.03,x+DW-.08,1.6,CZ+.07,MT.alu)}
O.box(CX0,SY,CZ-.02,CX1,SY+.06,CZ+.04,Mat('#18191b',{r:.4}));O.box(CX0,2.28,-7.0,CX1,2.78,CZ+.02,MT.redIn,{pz:false});decalZ(O,CX0,CX1,2.3,2.76,CZ+.021,tex('beverage',1.8));
L(-2.7,1.3,-6.3,4.5,[.85,.93,1],2.6);
// ---- left wall shelving ----
O.box(-4.9,SY,-6.6,-4.86,2.1,-.45,MT.whiteIn);
for(const y of [.2,.6,1.0,1.4,1.78]){O.box(-4.86,y-.02,-6.6,-4.46,y,-.45,MT.whiteIn);stock(O,-6.55,-.5,y,-4.47,1,.36,.32,'z');shelfEdge(O,-6.6,-.45,y,-4.46,1,'z')}
O.box(-4.86,2.1,-6.6,-4.5,2.16,-.45,MT.redIn);
O.box(-4.86,2.24,-3.05,-4.82,2.78,-1.95,MT.blackGloss);decalX(O,-1.98,-3.02,2.26,2.76,-4.818,tex('tv',2));
// ---- gondolas with real stock ----
for(const z of [-1.75,-3.15,-4.55]){const x0=-4.1,x1=-1.3;
  O.box(x0,SY,z-.31,x1,SY+.1,z+.31,Mat('#6b6f74',{r:.5,m:.4}));O.box(x0,SY,z-.02,x1,1.52,z+.02,MT.whiteIn);
  for(const y of [.27,.62,.97,1.32])for(const s of [-1,1]){O.box(x0,y-.02,s>0?z+.02:z-.3,x1,y,s>0?z+.3:z-.02,MT.whiteIn);stock(O,x0,x1,y,z+s*.29,s,.26,.3,'x',y>1.2);shelfEdge(O,x0,x1,y,z+s*.3,s,'x')}
  stock(O,z-.28,z+.28,SY+.1,x1+.26,1,.24,.34,'z');
  O.box(x1-.02,1.52,z-.31,x1+.04,1.84,z+.31,MT.redIn,{px:false});decalX(O,z+.31,z-.31,1.54,1.82,x1+.041,tex('ckPanel',1.4))}
// ---- black POS counter + candy rack ----
const blk=Mat('#121214',{r:.25}),gran=Mat('#08080a',{r:.1});
O.box(-.45,SY,-5.4,1.85,1.0,-4.85,blk);O.box(-.5,1.0,-5.45,1.9,1.05,-4.8,gran);
decalZ(O,.95,1.45,.3,1.0,-4.848,tex('thanhtoan',.5,{r:.4}));
O.box(-.42,SY,-4.85,.36,1.08,-4.82,blk);for(let k=0;k<4;k++){const y=.3+k*.2;O.box(-.42,y,-4.82,.36,y+.015,-4.56,Mat('#2a2b2e',{r:.4,m:.5}));stock(O,-.4,.34,y+.015,-4.57,1,.22,.13,'x',true)}
O.box(-.42,1.05,-4.78,.0,1.4,-4.7,Mat('#1e3a8a',{r:.3}));stock(O,-.4,-.02,1.05,-4.7,1,.06,.3,'x',true);
O.rod([.42,1.05,-5.22],[.42,1.18,-5.22],.025,MT.alu,6);O.box(.22,1.15,-5.27,.62,1.42,-5.22,MT.blackGloss,{nz:false});decalZn(O,.22,.62,1.15,1.42,-5.271,tex('pos',1.8));
O.box(.26,1.08,-5.12,.56,1.26,-5.1,MT.blackGloss,{pz:false});decalZ(O,.26,.56,1.08,1.26,-5.098,tex('pos',1.4));O.box(.8,1.05,-5.15,.92,1.1,-5.0,Mat('#202226',{r:.3}));
// hot dog roller + warmer case
O.box(1.1,1.05,-5.36,1.82,1.1,-4.9,MT.alu);O.box(1.1,1.48,-5.36,1.82,1.52,-4.9,MT.alu);
for(const x of [1.12,1.8])O.box(x-.02,1.1,-5.36,x+.02,1.48,-5.32,MT.alu);decalZ(G,1.12,1.8,1.1,1.48,-4.9,MT.glassIn);decalX(G,-4.9,-5.36,1.1,1.48,1.82,MT.glassIn);
O.box(1.12,1.1,-5.35,1.8,1.48,-5.33,tex('hotfood',2.2,{r:.1}));
for(let k=0;k<7;k++){O.push(M4.mul(M4.trans(1.18+k*.09,1.16,-5.3),M4.rotX(Math.PI/2)));O.cyl(.017,.34,8,Mat('#c2541f',{r:.25,e:.4}));O.pop()}
O.box(1.18,1.3,-5.3,1.75,1.31,-4.96,Mat('#cfd3d8',{r:.2,m:1}));for(let k=0;k<5;k++)O.sphere(1.25+k*.11,1.36,-5.12,.045,.04,.045,8,Mat('#f3d9a8',{r:.5,e:.3}));
// ---- back counter, orange menu wall ----
decalZ(O,-.5,1.9,.95,2.95,-7.39,Mat('#f2661c',{r:.35,e:.12}));
O.box(-.45,SY,-7.4,1.9,.95,-6.85,MT.whiteIn);O.box(-.47,.95,-7.4,1.92,.99,-6.83,Mat('#d9d9d6',{r:.3}));
O.box(-.35,.99,-7.35,.12,1.6,-6.95,Mat('#151517',{r:.25,m:.4}));O.box(-.3,1.2,-6.951,.07,1.45,-6.949,Mat('#cfd3d8',{r:.2,m:1}));O.box(-.2,1.04,-7.0,-.08,1.1,-6.9,MT.alu);
for(let k=0;k<4;k++)O.at(.25+k*.09,.99,-7.2,0,()=>O.cyl(.04,.3+rnd()*.12,10,MT.whiteIn,{r2:.045}));
O.box(.7,.99,-7.35,1.2,1.3,-6.95,Mat('#e6e6e6',{r:.3,m:.3}));O.box(.73,1.03,-6.951,1.05,1.26,-6.949,MT.blackGloss);
O.box(1.35,.99,-7.3,1.85,1.42,-6.95,MT.alu);decalZ(G,1.37,1.83,1.01,1.4,-6.94,MT.glassIn);for(let k=0;k<6;k++)O.sphere(1.45+(k%3)*.15,1.08+Math.floor(k/3)*.15,-7.12,.06,.05,.06,10,Mat('#faf6ee',{r:.6,e:.4}));
O.box(-.45,1.62,-7.4,1.9,1.65,-7.15,MT.whiteIn);for(let k=0;k<10;k++)O.at(-.35+k*.22,1.65,-7.28,0,()=>O.cyl(.04,.22,8,Mat(k%3?'#ffffff':'#e4211b',{r:.4})));
[['menuScr1',-.42],['menuScr2',.38],['menuScr3',1.18]].forEach(([t,x])=>{O.box(x-.02,2.06,-7.39,x+.72,2.5,-7.34,MT.blackGloss);decalZ(O,x,x+.7,2.08,2.48,-7.338,tex(t,2.3))});
L(.7,2.1,-6.6,4,[1,.6,.35],1.6);
// ---- Froster corner + ice-cream chest + baskets + wet-floor sign ----
O.box(1.35,SY,-3.95,1.88,.95,-2.65,MT.whiteIn);O.box(1.4,.95,-3.9,1.86,1.62,-3.25,Mat('#18181b',{r:.3,m:.3}));decalXn(O,-3.9,-3.25,.97,1.6,1.398,tex('froster',1.8));
for(const [z,c] of [[-3.75,'#e8346c'],[-3.42,'#2a7de1']])O.at(1.63,1.0,z,0,()=>O.cyl(.12,.42,14,Mat(c,{r:.08,e:.9})));
for(let k=0;k<3;k++)O.at(1.6,.95,-3.05+k*.12,0,()=>O.cyl(.04,.25,10,MT.whiteIn,{r2:.045}));
O.box(.35,SY,-1.25,1.5,.8,-.7,MT.whiteIn);O.box(.33,.8,-1.27,1.52,.84,-.68,MT.alu);decalZ(G,.37,1.48,.6,.84,-.69,MT.glassIn);
for(let k=0;k<18;k++)O.cbox(.42+(k%6)*.18,.72,-1.15+Math.floor(k/6)*.17,.15,.07,.14,Mat(pick(PACK),{r:.4}));decalZ(O,.6,1.25,.25,.75,-.698,tex('pKem',.4));
for(let k=0;k<5;k++)O.box(1.0+k*.008,SY+k*.11,.35,1.42+k*.008,SY+k*.11+.18,.7,Mat('#d7261e',{r:.4}));
O.quad([.5,SY,.25],[.9,SY,.25],[.9,.85,.12],[.5,.85,.12],tex('wetfloor',.2));O.quad([.9,SY,-.02],[.5,SY,-.02],[.5,.85,.12],[.9,.85,.12],tex('wetfloor',.2));
// ---- window bar ----
O.box(-4.7,1.0,.42,-1.75,1.05,.9,MT.wood);O.box(-4.7,.15,.85,-1.75,1.0,.9,MT.whiteIn);
for(const x of [-4.2,-3.4,-2.6])O.at(x,SY,.15,0,()=>{O.cyl(.03,.62,8,MT.alu,{caps:false});O.push(M4.trans(0,.62,0));O.cyl(.17,.06,16,MT.redIn);O.pop()});
// ---- people inside ----
human(O,.7,SY,-5.95,0,{shirt:'#e4211b',pants:'#1c1c20',cap:'ck',arms:'counter'});
human(O,.78,SY,-4.4,Math.PI,{shirt:'#3b6fb6',pants:'#222831',bag:'#2a2a2a'});
human(O,-2.6,SY,-2.45,Math.PI,{shirt:'#e4211b',pants:'#1c1c20',cap:'ck',arms:'counter',female:true,hairStyle:'bun'});
human(O,-2.0,SY,-6.25,Math.PI,{shirt:'#f2c5d0',pants:'#e8e2d6',female:true,hairStyle:'long'});
human(O,-3.4,SY,.15,0,{pose:'sit',seat:.68,shirt:'#f4f1ea',pants:'#2a3550'});
human(O,-2.6,SY,.15,0,{pose:'drink',seat:.68,shirt:'#ffd166',pants:'#3a3a40',female:true,hairStyle:'long',cup:'#e8346c'});
O.box(-3.62,1.05,.5,-3.2,1.07,.78,Mat('#1a1a1c',{r:.2}));O.box(-3.62,1.07,.76,-3.2,1.33,.78,Mat('#9fd0ff',{e:2.2}));
O.at(-2.85,1.05,.6,0,()=>O.cyl(.045,.16,10,Mat('#c47a2c',{r:.2})));
