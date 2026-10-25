
// ================= Scene: tube houses above + neighbour shop =================
function railing(M,x0,x1,z,y0,y1,step=.14){M.box(x0,y1-.05,z-.03,x1,y1,z+.03,MT.iron);M.box(x0,y0+.08,z-.02,x1,y0+.12,z+.02,MT.iron);
  for(let x=x0+.04;x<x1;x+=step)M.box(x-.012,y0,z-.012,x+.012,y1,z+.012,MT.iron)}
function railingZ(M,z0,z1,x,y0,y1,step=.14){M.box(x-.03,y1-.05,z0,x+.03,y1,z1,MT.iron);for(let z=z0+.04;z<z1;z+=step)M.box(x-.012,y0,z-.012,x+.012,y1,z+.012,MT.iron)}
function grille(M,x0,x1,y0,y1,z,d=.3){M.box(x0,y0,z,x1,y0+.04,z+d,MT.iron);M.box(x0,y1-.04,z,x1,y1,z+d,MT.iron);
  for(let x=x0;x<=x1+.001;x+=(x1-x0)/8)M.box(x-.012,y0,z+d-.025,x+.012,y1,z+d,MT.iron);M.box(x0,(y0+y1)/2-.015,z+d-.03,x1,(y0+y1)/2+.015,z+d,MT.iron)}
function windowZ(x0,x1,y0,y1,z,t,e){decalZ(O,x0,x1,y0,y1,z+.005,tex(t,e,{r:.5}));decalZ(G,x0,x1,y0,y1,z+.03,MT.glass);
  O.box(x0-.06,y0-.08,z,x1+.06,y0,z+.12,MT.slab);O.box(x0-.06,y1,z,x1+.06,y1+.06,z+.06,MT.wallA2)}
function windowX(z0,z1,y0,y1,x,t,e){decalX(O,z0,z1,y0,y1,x+.005,tex(t,e,{r:.5}));decalX(G,z0,z1,y0,y1,x+.03,MT.glass);
  O.box(x,y0-.08,z1-.06,x+.12,y0,z0+.06,MT.slab)}
function plant(M,x,y,z,s=1){M.at(x,y,z,0,()=>{M.cyl(.14*s,.26*s,10,Mat('#8a4b2a',{r:.7,w:1}),{r2:.18*s});
  for(let k=0;k<4;k++)M.sphere((rnd()-.5)*.2*s,.38*s+rnd()*.25*s,(rnd()-.5)*.2*s,.16*s,.2*s,.16*s,8,MT.leaf,.3)})}
function acUnit(M,x0,y0,z0,face='z'){if(face==='z'){M.box(x0,y0,z0,x0+.75,y0+.55,z0+.3,MT.white,{pz:'ac'});M.box(x0+.05,y0-.06,z0-.02,x0+.08,y0,z0+.3,MT.iron);M.box(x0+.67,y0-.06,z0-.02,x0+.7,y0,z0+.3,MT.iron)}
  else{M.box(x0,y0,z0-.75,x0+.3,y0+.55,z0,MT.white,{px:'ac'})}}
function laundry(M,x0,x1,y,z){M.rod([x0,y,z],[x1,y,z],.008,MT.alu);const cols=['#e94f37','#ffffff','#2a7de1','#f2b705','#1fa35a','#d93a8c'];
  for(let x=x0+.1;x<x1-.2;x+=.28+rnd()*.12){const w=.2+rnd()*.14,h=.35+rnd()*.3;M.box(x,y-h,z-.01,x+w,y,z+.01,Mat(pick(cols),{r:.8,w:1}))}}

// ---- House A (above Circle K) ----
O.box(-5,3.7,-7.5,2.0,10,.8,MT.wallA,{ny:false});
O.box(-5.02,6.72,-7.5,2.08,6.88,.9,MT.wallA2);
O.box(-4.6,3.7,.8,1.4,3.86,1.95,MT.slab);railing(O,-4.6,1.4,1.92,3.86,4.8);railingZ(O,.8,1.92,-4.6,3.86,4.8);railingZ(O,.8,1.92,1.4,3.86,4.8);
decalZ(O,-3.6,-.4,3.9,6.2,.805,tex('winA',1.5,{r:.5}));decalZ(G,-3.6,-.4,3.9,6.2,.84,MT.glass);
for(const x of [-3.6,-2,-.4])O.box(x-.04,3.86,.8,x+.04,6.24,.9,MT.alu);O.box(-3.64,6.2,.8,-.36,6.26,.9,MT.alu);
acUnit(O,.35,3.86,1.0);plant(O,-4.2,3.86,1.5);plant(O,-.05,3.86,1.55,.8);plant(O,-1.3,3.86,1.6,.7);
O.box(-4.6,6.88,.8,1.4,7.0,1.5,MT.slab);
windowZ(-4.2,-2.6,7.4,9.1,.8,'winC',1.3);grille(O,-4.25,-2.55,7.32,9.16,.8);
windowZ(-1.4,.2,7.4,9.1,.8,'winA',1.1);grille(O,-1.45,.25,7.32,9.16,.8);
acUnit(O,.8,7.25,.8);laundry(O,-4.3,-2.5,7.2,1.12);
windowX(-.8,-2.2,4.4,5.9,2.0,'winB',.9);for(let z=-.85;z>-2.2;z-=.17)O.box(2.1,4.36,z-.012,2.13,5.94,z+.012,MT.iron);
windowX(-4.1,-5.5,4.4,5.9,2.0,'winA',.25);windowX(-2.2,-3.5,7.4,9.0,2.0,'winA',1.0);windowX(-5.1,-6.4,7.4,9.0,2.0,'winB',.12);
decalX(O,-5.6,-6.9,7.55,8.0,2.006,tex('phong',0,{r:.6,w:1}));acUnit(O,2.0,6.95,-3.7,'x');
// roof
O.box(-5,10,-7.5,2.0,10.15,.8,MT.slab);
O.box(-5,10.15,.68,2.0,10.75,.8,MT.wallA2);O.box(1.88,10.15,-7.5,2.0,10.75,.8,MT.wallA2);O.box(-5,10.15,-7.5,2.0,10.75,-7.38,MT.wallA2);
O.box(-4.7,10.15,-7.3,-3.0,12.3,-5.4,MT.wallA);O.box(-4.8,12.3,-7.4,-2.9,12.4,-5.3,MT.slab);
O.push(M4.mul(M4.trans(-1.2,11.0,-3.6),M4.rotZ(Math.PI/2))).push(M4.trans(0,-.85,0));O.cyl(.55,1.7,28,MT.steel);O.pop().pop();
for(const x of [-1.9,-.5]){O.box(x-.05,10.15,-4.1,x+.05,10.5,-3.1,MT.iron);O.box(x-.06,10.45,-4.15,x+.06,10.55,-3.05,MT.iron)}
O.at(1.1,10.15,-5.8,0,()=>{O.cyl(.025,2.6,6,MT.alu)});for(let k=0;k<4;k++)O.rod([1.1,12.2+k*.12,-6.3+k*.05],[1.1,12.2+k*.12,-5.3-k*.05],.012,MT.alu);

// ---- House B: neighbour "tạp hóa" ----
O.box(-8,.14,-7.5,-5,.16,1.0,MT.concrete,{ny:false});
O.box(-8,.16,-7.5,-7.85,3.2,.6,MT.wallB);O.box(-5.12,.16,-7.5,-5.0,3.2,.6,MT.wallB);
O.box(-8,3.0,-7.5,-5,3.2,.6,MT.ceil);O.box(-7.85,.16,-3.6,-5.12,3.0,-3.4,MT.wood,{pz:false});decalZ(O,-7.85,-5.12,.16,2.9,-3.399,tex('neighGoods',.45));
decalX(O,-.2,-3.3,.5,2.4,-7.849,tex('neighGoods',.4));decalXn(O,-3.3,-.2,.5,2.4,-5.121,tex('neighGoods',.4));
O.box(-7.6,.16,-1.2,-6.5,.95,-.5,MT.white);O.box(-7.62,.95,-1.22,-6.48,1.0,-.48,Mat('#bfe6ff',{r:.05,e:.6}));
for(let k=0;k<6;k++)O.box(-5.95+(k%2)*.42,.16+Math.floor(k/2)*.3,.05,-5.57+(k%2)*.42,.44+Math.floor(k/2)*.3,.45,Mat(k%3?'#c8102e':'#1f6fd1',{r:.5}));
O.box(-7.85,2.6,-3.4,-5.12,2.65,.6,Mat('#ffd9a0',{e:5}));
O.push(M4.mul(M4.trans(-6.45,3.02,.48),M4.rotZ(Math.PI/2))).push(M4.trans(0,-1.45,0));O.cyl(.16,2.9,14,MT.alu);O.pop().pop();
O.box(-8,3.2,.4,-5,4.25,.62,MT.wallB2);O.box(-7.95,3.25,.62,-5.05,4.15,.8,Mat('#0b4ea2',{r:.4,w:1}),{pz:false});decalZ(O,-7.95,-5.05,3.25,4.15,.802,tex('taphoa',1.9,{r:.3,w:1}));
O.box(-8,3.2,-7.5,-5,13.2,.4,MT.wallB,{ny:false});
for(const y of [6.5,9.8])O.box(-8.02,y-.08,-7.5,-4.98,y+.08,.5,MT.wallB2);
for(const [y,t,e] of [[4.25,'winC',1.2],[6.58,'winB',.7],[9.88,'winA',.3]]){
  O.box(-7.9,y,.4,-5.1,y+.14,1.3,MT.slab);railing(O,-7.9,-5.1,1.27,y+.14,y+1.1);
  decalZ(O,-7.4,-5.6,y+.3,y+2.4,.405,tex(t,e,{r:.5}));decalZ(G,-7.4,-5.6,y+.3,y+2.4,.43,MT.glass)}
O.box(-7.4,4.62,1.3,-5.6,5.3,1.42,Mat('#160a1c',{r:.4,w:1}),{pz:false});decalZ(O,-7.4,-5.6,4.62,5.3,1.422,tex('karaoke',3.2,{k:7,w:1}));
plant(O,-7.6,6.72,.9);plant(O,-5.5,6.72,.95,.8);laundry(O,-7.7,-5.6,11.6,.8);plant(O,-6.0,10.02,.9);
O.box(-8,13.2,-7.5,-5,13.35,.4,MT.slab);O.box(-8,13.35,.3,-5,13.9,.4,MT.wallB2);
O.at(-6.3,13.35,-3,0,()=>{O.cyl(.5,1.25,24,MT.steel)});
O.push(M4.mul(M4.trans(-7.3,13.6,-5.6),M4.rotX(-.6)));O.box(-.6,0,-.5,.6,.05,.5,Mat('#1a2a4a',{r:.15,m:.3,w:1}));O.pop();
L(-6.5,2.4,-1.0,7,[1,.72,.42],7);L(-6.5,1.6,1.6,5,[1,.75,.5],2.2);L(-6.5,3.7,1.4,3.5,[.3,.55,1],1.6);
L(-6.5,5.0,1.9,5,[1,.25,.7],3.2,1);L(-2.0,5.0,1.7,4.5,[1,.8,.55],1.5);L(-3.4,8.2,1.4,4,[1,.62,.4],1.1);L(-6.5,5.4,.9,3.5,[1,.6,.4],1.0);
