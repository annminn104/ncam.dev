
// ================= Scene: ground + Circle K storefront =================
rs=7;
const S={op:new Mesh(),gl:new Mesh(),lights:[],spots:[],dyn:{}};
// shadowed spot: position, direction, inner/outer half-angle (deg), radius, colour, intensity
const SPOT=(p,d,inner,outer,rad,col,k)=>S.spots.push({p,d,inner,outer,rad,col,k});
const O=S.op,G=S.gl;
const L=(x,y,z,rad,col,k=1,fl=0)=>S.lights.push([x,y,z,rad,col[0]*k,col[1]*k,col[2]*k,fl]);
const MT={
  asphalt:Mat('#2a2a2d',{r:.55,k:2,w:1}),tile:Mat('#8b857c',{r:.5,k:3,w:1}),curb:Mat('#a19c94',{r:.6,k:9,w:1}),
  paint:Mat('#e9e7e0',{r:.45,k:6,w:1}),paintY:Mat('#e8b418',{r:.45,k:6,w:1}),plinth:Mat('#1b1a19',{r:.85,k:9}),
  wallA:Mat('#cdb886',{r:.75,k:5,w:1}),wallA2:Mat('#c9b27a',{r:.75,k:5,w:1}),wallB:Mat('#97c4ae',{r:.75,k:5,w:1}),wallB2:Mat('#7aa892',{r:.75,k:5,w:1}),
  wallW:Mat('#ebe9e4',{r:.5}),floorIn:Mat('#e6e4df',{r:.12,k:4}),ceil:Mat('#f1f1ef',{r:.85}),
  frame:Mat('#2a2d31',{r:.35,m:.85,w:1}),alu:Mat('#c4c8cc',{r:.3,m:1,w:1}),steel:Mat('#d4d6d8',{r:.22,m:1,k:11,w:1}),
  iron:Mat('#1c1d1f',{r:.45,m:.6,w:1}),concrete:Mat('#8f8b84',{r:.75,k:9,w:1}),slab:Mat('#a09a90',{r:.7,k:9,w:1}),
  red:Mat('#e4211b',{r:.35,w:1}),redIn:Mat('#e4211b',{r:.45}),dark:Mat('#38393c',{r:.5,w:1}),rubber:Mat('#121212',{r:.75,w:1}),
  leaf:Mat('#22431e',{r:.55,k:8,w:1}),trunk:Mat('#4a3b2e',{r:.85,w:1}),wood:Mat('#8a6040',{r:.6}),
  panel:Mat('#ffffff',{e:10}),glass:Mat('#ffffff',{k:1,r:.05,w:1}),glassIn:Mat('#ffffff',{k:1,r:.05,e:1}),
  blackGloss:Mat('#0d0d0e',{r:.2,w:1}),white:Mat('#f2f2f2',{r:.35,w:1}),whiteIn:Mat('#f4f4f2',{r:.3}),
};

// ---- diorama plinth + ground ----
O.box(-8.06,-.95,-8.06,8.06,-.1,8.06,MT.plinth);decalZ(O,-2.2,2.2,-.78,-.26,8.065,Mat('#ffffff',{t:'plaque',r:.25,m:1}));
O.box(-8,-.12,3.75,8,0,8,MT.asphalt,{ny:false});O.box(4.75,-.12,-8,8,0,3.75,MT.asphalt,{ny:false});
O.box(-8,-.1,1,4.6,.14,3.6,MT.tile,{ny:false});O.box(2,-.1,-8,4.6,.14,1,MT.tile,{ny:false});
O.box(-8,-.1,3.6,4.75,.16,3.75,MT.curb,{ny:false});O.box(4.6,-.1,-8,4.75,.16,3.6,MT.curb,{ny:false});
for(let i=0;i<6;i++){const m=i%2?MT.paintY:Mat('#151515',{r:.45,k:6,w:1});O.box(4.75-.5*(i+1),.16,3.6,4.75-.5*i,.165,3.75,m);O.box(4.6,.16,3.6-.5*(i+1),4.75,.165,3.6-.5*i,m)}
for(let x=-8;x<3.6;x+=2.4)O.box(x,0,5.82,Math.min(x+1.3,3.6),.006,5.94,MT.paint);
for(let z=-8;z<2.6;z+=2.4)O.box(6.34,0,z,6.46,.006,Math.min(z+1.3,2.6),MT.paint);
for(let i=0;i<5;i++)O.box(.7+i*.75,0,3.95,1.15+i*.75,.006,7.8,MT.paint);
O.box(4.95,0,3.95,5.1,.006,5.75,MT.paint);O.box(4.95,0,-1,7.95,.006,-.85,MT.paint);O.box(4.9,0,3.85,7.95,.004,4.0,MT.paintY);
for(const x of [-3.2,1.9])O.box(x,0,3.78,x+.7,.008,4.05,MT.iron);
O.at(-1.4,0,6.9,0,()=>O.cyl(.36,.01,20,Mat('#2a2826',{r:.4,m:.8,w:1})));

// ---- store shell ----
const SY=.15;
O.box(-5,-.1,-7.5,2,SY,1,MT.floorIn,{ny:false});
O.box(-5,2.95,-7.5,2,3.05,1,MT.ceil);
O.box(-5,SY,-7.5,-4.9,2.95,1,MT.wallW);O.box(-5,SY,-7.5,2,2.95,-7.4,MT.wallW);
O.box(1.9,SY,-7.5,2.02,2.72,-4.1,MT.wallW);O.box(-5,SY,.9,-4.75,2.72,1.02,MT.wallW);
O.box(1.7,SY,.65,2.06,2.72,1.06,MT.white);O.box(1.68,SY,.63,2.08,.42,1.08,MT.dark);
for(const [a,b] of [[-4.75,-1.55],[.25,1.7]])O.box(a,SY,.94,b,.42,1.0,MT.dark);O.box(1.94,SY,-4.1,2.0,.42,.65,MT.dark);
O.box(-4.75,2.66,.92,1.7,2.72,1.02,MT.frame);O.box(1.92,2.66,-4.1,2.02,2.72,.65,MT.frame);
for(const x of [-4.75,-3.15,-1.55,.25,1.7])O.box(x-.035,SY,.93,x+.035,2.7,1.03,MT.frame);
for(const z of [.65,-.9,-2.5,-4.1])O.box(1.93,SY,z-.035,2.03,2.7,z+.035,MT.frame);
O.box(-1.55,2.33,.93,.25,2.4,1.03,MT.frame);O.box(-1.58,SY,1.02,.28,SY+.03,1.1,MT.alu);
O.box(-.82,2.4,1.03,-.48,2.5,1.1,MT.blackGloss);O.box(-.67,2.43,1.1,-.63,2.47,1.104,Mat('#40ff80',{e:6}));
const pane=(x0,x1,y0,y1,z)=>decalZ(G,x0,x1,y0,y1,z,MT.glass),paneX=(z0,z1,y0,y1,x)=>decalX(G,z0,z1,y0,y1,x,MT.glass);
pane(-4.72,-3.18,.42,2.66,1);pane(-3.12,-1.58,.42,2.66,1);pane(.28,1.67,.42,2.66,1);pane(-1.52,.22,2.4,2.66,1);
paneX(.62,-.87,.42,2.66,2);paneX(-.93,-2.47,.42,2.66,2);paneX(-2.53,-4.07,.42,2.66,2);
// red "CIRCLE K 24hrs" band, welcome banner, posters (inside the glass)
for(const [a,b] of [[-4.72,-3.18],[-3.12,-1.58],[.28,1.67]])decalZ(O,a,b,.86,1.0,.975,tex('glassBand',1.3));
for(const [a,b] of [[.62,-.87],[-.93,-2.47],[-2.53,-4.07]])decalX(O,a,b,.86,1.0,1.975,tex('glassBand',1.3));
decalZ(O,-1.5,.2,2.06,2.31,.975,tex('welcome',1.6));
const P=(n,x,y,w=.56)=>decalZ(O,x,x+w,y,y+w*1.4,.97,tex(n,1.25)),PX=(n,z,y,w=.56)=>decalX(O,z,z-w,y,y+w*1.4,1.97,tex(n,1.25));
P('pLau',-4.6,1.08);P('pKM',-3.0,1.08,.5);P('pFrost',.38,1.08,.62);P('pMiTron',1.05,1.08,.56);P('p247',-2.2,1.12,.48);
PX('pCafeVN',.45,1.08);PX('pKem',-1.1,1.08);PX('pCom',-2.7,1.08);PX('pWifi',-3.55,1.5,.36);
// ---- 3-panel fascia like the real stores ----
O.box(-5,2.72,1.0,2.22,3.7,1.2,MT.white);O.box(2.0,2.72,-7.5,2.22,3.7,1.2,MT.white);
O.box(-5.02,3.7,.9,2.3,3.78,1.3,MT.white);O.box(1.9,3.7,-7.5,2.3,3.78,1.3,MT.white);
const panelZ=(x0,x1,y0,y1,d,t,e)=>{O.box(x0,y0,1.2,x1,y1,1.2+d,MT.red,{pz:false});decalZ(O,x0,x1,y0,y1,1.202+d,tex(t,e,{r:.3,w:1}))};
const panelX=(z0,z1,y0,y1,d,t,e)=>{O.box(2.2,y0,z1,2.2+d,y1,z0,MT.red,{px:false});decalX(O,z0,z1,y0,y1,2.202+d,tex(t,e,{r:.3,w:1}))};
panelZ(-4.95,-2.55,2.8,3.62,.05,'ckPanel',1.25);panelZ(-2.45,.45,2.76,3.66,.1,'ckCenter',1.4);panelZ(.55,2.17,2.8,3.62,.05,'ckPanel',1.25);
panelX(1.15,-1.8,2.8,3.62,.05,'ckPanel',1.25);panelX(-1.9,-5.0,2.76,3.66,.1,'ckCenter',1.4);panelX(-5.1,-7.45,2.8,3.62,.05,'ckPanel',1.25);
O.box(-5,2.7,1.06,2.22,2.72,1.16,Mat('#fff6e8',{e:8}));O.box(2.06,2.7,-7.5,2.16,2.72,1.16,Mat('#fff6e8',{e:8}));
// vertical lightbox sign at the left end
O.box(-4.79,3.78,1.02,-4.65,5.02,1.72,MT.white,{px:false,nx:false});
decalX(O,1.72,1.02,3.78,5.02,-4.648,tex('ckVert',1.8,{r:.3,w:1}));decalXn(O,1.02,1.72,3.78,5.02,-4.792,tex('ckVert',1.8,{r:.3,w:1}));
O.box(-4.74,3.7,.8,-4.7,3.78,1.4,MT.iron);
// door mat
O.box(-1.5,.14,1.12,.2,.152,1.7,Mat('#a8150f',{r:.95}));
// sliding door leaves (animated): frame -> dynamic opaque, glass -> dynamic glass
(()=>{const F=new Mesh(),GG=new Mesh(),w=.43,y0=SY+.01,y1=2.32;
  F.box(-w,y0,-.02,w,y0+.07,.02,MT.alu);F.box(-w,y1-.05,-.02,w,y1,.02,MT.alu);F.box(-w,y0,-.02,-w+.05,y1,.02,MT.alu);F.box(w-.05,y0,-.02,w,y1,.02,MT.alu);
  F.box(-w+.07,1.0,.02,-w+.09,1.5,.05,MT.alu);decalZ(F,-w+.15,w-.15,1.25,1.33,.021,tex('glassBand',1.0));
  decalZ(GG,-w+.05,w-.05,y0+.07,y1-.05,0,MT.glass);S.dyn.doorF=F;S.dyn.doorG=GG})();
S.door={y:SY,z:1.065,left:-1.1,right:-.21,travel:.86,box:[-1.6,SY,.9,.3,2.45,1.2]};
O.box(1.9,.85,-5.95,2.06,2.65,-4.45,MT.frame,{px:false});decalX(O,-4.5,-5.9,.9,2.6,2.065,tex('pCombo',1.6,{r:.2,w:1}));
O.box(2.02,1.0,-7.2,2.12,1.6,-6.7,Mat('#8a8f94',{r:.4,m:.6,w:1}));
SPOT([-1.25,2.55,-.45],[0,-.55,1],28,66,10,[1,.95,.88],19);L(2.7,1.9,-1.6,5.5,[1,.95,.9],2.2);L(-3.6,1.2,1.5,3,[1,.95,.9],.8);
L(-3.2,3.2,1.9,5,[1,.14,.07],2.6);L(.6,3.2,1.9,5,[1,.14,.07],2.6);L(2.9,3.2,-3.2,5,[1,.14,.07],2.6);
L(-4.2,4.4,1.4,4,[1,.35,.3],1.4);
