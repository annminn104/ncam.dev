
// ================= Vehicles: Honda Air Blade-style scooter, VinFast e-scooter, Wave underbone, VinFast VF e34 / VF5 taxis =================
const V_DK=Mat('#1d1e20',{r:.45,w:1}),V_CHROME=Mat('#d6dade',{r:.08,m:1,w:1}),V_TIRE=Mat('#0f0f10',{r:.82,w:1}),V_SILVER=Mat('#b4b8bd',{r:.28,m:.65,w:1}),V_BLK=Mat('#101112',{r:.3,w:1});
// wheel centred at (x,y,z), axle along z. rounded tyre shoulders, split-spoke alloy, optional disc + caliper
function wheel(M,x,y,z,r,w,o={}){const rim=o.rim||V_SILVER,face=o.face||V_DK,ns=o.spokes||5;M.push(M4.mul(M4.trans(x,y,z-w/2),M4.rotX(Math.PI/2)));
  M.push(M4.trans(0,w*.12,0));M.cyl(r,w*.76,28,V_TIRE,{caps:false});M.pop();M.cyl(r*.95,w,28,V_TIRE);
  for(const side of [w+.002,-.002]){M.push(M4.trans(0,side-.001,0));M.cyl(r*.9,.002,28,Mat('#1b1b1c',{r:.7}),{caps:false});M.pop()}
  M.push(M4.trans(0,-.003,0));M.cyl(r*.66,w+.006,24,face);M.pop();
  const rr=r*.64;for(const side of [w+.004,-.004])for(let k=0;k<ns;k++)for(const sp of (o.split?[-.09,.09]:[0])){const a=k/ns*Math.PI*2+sp;
    M.push(M4.rotY(a));M.box(r*.15,side-.005,-.013,rr,side+.005,.013,rim);M.pop()}
  for(const side of [w+.006,-.006]){M.push(M4.trans(0,side-.003,0));M.cyl(r*.645,.006,28,rim,{caps:false});M.cyl(r*.17,.008,12,rim);M.pop()}
  if(o.disc){M.push(M4.trans(0,w+.014,0));M.cyl(r*.48,.005,24,Mat('#b9bec4',{r:.3,m:1}));M.pop();M.push(M4.rotY(-.6));M.box(r*.32,w+.012,-.035,r*.52,w+.042,.035,Mat(o.caliper||'#c0201a',{r:.3}));M.pop()}
  M.pop()}
const carWheel=(M,x,y,z)=>wheel(M,x,y,z,.345,.225,{spokes:5,split:1,rim:Mat('#d4d7db',{r:.28,m:.65}),face:Mat('#17181a',{r:.35,m:.5}),disc:1,caliper:'#2a2c30'});
const bikeWheelF=(M,x,y,z,o={})=>wheel(M,x,y,z,.26,.09,{disc:1,split:1,rim:o.rim||V_SILVER});
const bikeWheelR=(M,x,y,z,o={})=>wheel(M,x,y,z,.26,.11,{split:!o.ev,spokes:o.ev?6:5,rim:o.rim||V_SILVER});
function sideDecal(M,x0,x1,y0,y1,z,t,e=.05){decalZ(M,x0,x1,y0,y1,z,tex(t,e,{r:.3,w:1}));decalZn(M,x0,x1,y0,y1,-z,tex(t,e,{r:.3,w:1}))}
function plateQuad(M,x,y,t='plate',w=.12,h=.11){M.quad([x,y,-w],[x,y,w],[x,y+h,w],[x,y+h,-w],tex(t,.04,{r:.3,w:1}))}
function plateQuadF(M,x,y,t,w,h){M.quad([x,y,w],[x,y,-w],[x,y+h,-w],[x,y+h,w],tex(t,.04,{r:.3,w:1}))}
function mirrors(M,x,y,w){for(const s of [-1,1]){M.rod([x,y,w*s],[x-.04,y+.24,(w+.04)*s],.008,V_CHROME,4);M.sphere(x-.05,y+.28,(w+.05)*s,.025,.045,.065,10,V_BLK)}}
function spring(M,a,b,r,turns,mt){const N=turns*8;let prev=null;for(let k=0;k<=N;k++){const t=k/N,an=t*turns*Math.PI*2,c=[a[0]+(b[0]-a[0])*t+Math.cos(an)*r,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t+Math.sin(an)*r];if(prev)M.rod(prev,c,.007,mt,4);prev=c}}
// Honda Air Blade 150-style sport scooter (o.ev → VinFast e-scooter: hub motor, no exhaust). Local +x forward.
function scooter(M,o={}){const body=Mat(o.col||'#c8102e',{k:12,r:.3,m:.25,w:1}),seat=Mat(o.seat||'#18181a',{r:.45,w:1}),acc=o.accent?Mat(o.accent,{r:.2,m:.6,w:1}):V_SILVER,lit=o.lit;
  if(!o.noWheels){bikeWheelF(M,.62,.26,0,{rim:o.rimCol?Mat(o.rimCol,{r:.3,m:.6}):V_SILVER});bikeWheelR(M,-.6,.26,0,{ev:o.ev})}
  for(const s of [-1,1]){M.rod([.555,.96,s*.065],[.585,.6,s*.065],.03,V_BLK,8);M.rod([.585,.62,s*.065],[.62,.26,s*.065],.021,V_CHROME,8)}
  // front fender + shield (apron) with V-shaped LED headlamp and side indicators
  M.bprism([[.42,.53],[.86,.5],[.92,.57],[.48,.645]],.15,.03,body);
  M.loft([[.25,.2,.34,.6],[.34,.21,.34,.86],[.46,.205,.36,1.0],[.56,.18,.5,1.08],[.64,.13,.72,1.06],[.68,.08,.86,.99]].map(s=>ringX(s[0],s[1],s[2],s[3],{et:4,eb:5,wt:.8},22)),body,{caps:true});
  M.prism([[.3,.33],[.47,.33],[.53,.56],[.34,.55]],-.214,.214,V_BLK);M.prism([[.5,.6],[.58,.6],[.655,.9],[.6,.9]],-.2,.2,acc);
  for(const s of [-1,1]){const z0=s>0?.02:-.13,z1=s>0?.13:-.02;M.prism([[.62,.88],[.675,.91],[.69,.985],[.64,.965]],z0,z1,Mat('#fffaf0',{e:lit?42:.5,r:.05}));
    M.rod([.66,.875,s*.02],[.63,.84,s*.16],.008,Mat('#ffffff',{e:lit?14:.4}),4);M.box(.6,.8,s*.165-.03,.645,.835,s*.165+.03,Mat('#ffae00',{e:.35,r:.2}))}
  M.prism([[.2,.4],[.3,.42],[.36,.96],[.25,.92]],-.18,.18,V_BLK);
  M.box(-.16,.3,-.17,.3,.4,.17,V_BLK);for(let k=0;k<5;k++)M.box(-.1+k*.07,.4,-.16,-.07+k*.07,.408,.16,V_SILVER);
  // rear body + seats as rounded lofts
  M.loft([[-1.0,.07,.72,.8],[-.96,.12,.63,.86],[-.82,.175,.55,.9],[-.5,.2,.47,.905],[-.25,.192,.4,.885],[-.1,.165,.38,.83],[.04,.12,.42,.7]].map(s=>ringX(s[0],s[1],s[2],s[3],{et:3,eb:3,wt:.82},22)),body,{caps:true});
  M.prism([[-.74,.42],[-.12,.34],[-.02,.42],[-.66,.54]],-.196,.196,V_BLK);M.prism([[-.82,.64],[-.22,.52],[-.16,.58],[-.78,.72]],-.204,.204,acc);
  if(o.ab)sideDecal(M,-.74,-.36,.73,.8,.198,o.ab,.08);
  M.box(-.62,.18,.02,-.1,.42,.17,Mat('#3a3d42',{r:.35,m:.6}));M.box(-.58,.22,.17,-.2,.38,.176,V_SILVER);
  M.loft([[-.99,.09,.9,.97],[-.92,.13,.89,1.035],[-.62,.15,.885,1.03],[-.52,.155,.88,.995],[-.25,.16,.86,.99],[0.0,.15,.85,.95],[.06,.11,.86,.92]].map(s=>ringX(s[0],s[1],s[2],s[3],{et:3,eb:6,wt:.85},20)),seat,{caps:true});
  M.rod([-.52,1.0,-.14],[-.52,1.0,.14],.004,Mat('#5a4a3a',{r:.6}),3);
  for(const s of [-1,1])M.rod([-.98,.99,s*.165],[-.56,.96,s*.18],.014,V_SILVER,6);M.rod([-.98,.99,-.165],[-.98,.99,.165],.014,V_SILVER,6);
  for(const s of [-1,1])M.sphere(-.985,.765,s*.055,.03,.035,.06,10,Mat('#ff1a0a',{e:lit?12:.18,r:.1}));M.box(-1.0,.7,-.11,-.97,.72,.11,Mat('#ff1a0a',{e:lit?8:.12}));
  M.prism([[-1.03,.45],[-.93,.43],[-.93,.66],[-1.06,.62]],-.09,.09,V_BLK);plateQuad(M,-1.062,.49,o.plate||'plate',.11,.1);
  spring(M,[-.62,.36,.135],[-.86,.78,.135],.028,7,Mat(o.ev?'#c9cdd2':o.spring||'#d01c1c',{r:.3,m:.5}));M.rod([-.62,.36,.135],[-.86,.78,.135],.012,V_CHROME,5);
  if(o.ev){M.push(M4.mul(M4.trans(-.6,.26,.075),M4.rotX(Math.PI/2)));M.cyl(.14,.05,18,Mat('#2f3236',{r:.3,m:.8}));M.pop();M.box(-.12,.3,-.16,.28,.33,.16,Mat('#2f3236',{r:.4,m:.5}))}
  else{M.rod([-.05,.28,.15],[-.48,.33,.2],.026,V_DK,6);M.push(M4.mul(M4.trans(-.42,.37,.21),M4.rotZ(Math.PI/2)));M.cyl(.068,.44,16,V_CHROME);M.push(M4.trans(0,.44,0));M.cyl(.048,.03,12,V_BLK);M.pop();M.pop();
    M.push(M4.mul(M4.trans(-.5,.37,.215),M4.rotZ(Math.PI/2)));M.cyl(.074,.26,16,Mat('#c3c7cc',{r:.18,m:1}),{caps:false});M.pop()}
  M.bprism([[.36,1.05],[.6,1.0],[.67,1.12],[.44,1.21]],.38,.04,V_BLK);M.box(.43,1.175,-.07,.5,1.2,.07,Mat('#62c8ff',{e:lit?2:.3}));
  M.prism([[.5,1.16],[.62,1.12],[.6,1.24],[.52,1.24]],-.12,.12,Mat('#15171a',{r:.08,m:.2,w:1}));
  M.rod([.45,1.16,-.38],[.45,1.16,.38],.016,V_CHROME,6);for(const s of [-1,1]){M.rod([.45,1.16,s*.3],[.45,1.16,s*.41],.023,V_DK,8);M.rod([.47,1.17,s*.25],[.56,1.15,s*.38],.007,V_SILVER,4)}
  mirrors(M,.43,1.18,.3);
  if(o.decal)sideDecal(M,-.78,-.32,.6,.76,.206,o.decal);
  if(o.kick)M.rod([-.15,.3,-.12],[-.28,.01,-.3],.014,V_CHROME,4);
  if(o.helmet)M.sphere(.43,1.43,.34*o.helmet,.13,.12,.14,14,Mat(o.hcol||'#f2c12e',{r:.2,w:1}))}
// Honda Wave-style underbone
const waveWheelF=(M,x,y,z)=>wheel(M,x,y,z,.27,.08,{spokes:6,disc:1}),waveWheelR=(M,x,y,z)=>wheel(M,x,y,z,.27,.09,{spokes:6});
function wave(M,o={}){const body=Mat(o.col||'#1b1b1d',{k:12,r:.3,m:.25,w:1}),seat=Mat('#141414',{r:.5,w:1}),eng=Mat('#5d6166',{r:.35,m:.7,w:1});
  if(!o.noWheels){waveWheelF(M,.64,.27,0);waveWheelR(M,-.6,.27,0)}
  M.bprism([[.28,.42],[.42,.42],[.52,.98],[.42,1.02],[.3,.9]],.36,.045,body);
  M.rod([.44,.95,0],[.06,.45,0],.04,body,8);M.rod([.06,.45,0],[-.32,.66,0],.04,body,8);
  M.box(-.18,.2,-.13,.2,.47,.12,eng);for(let k=0;k<4;k++)M.box(.18,.28+k*.045,-.1,.26,.3+k*.045,.1,eng);
  M.box(-.62,.24,-.15,-.1,.3,-.12,V_BLK);
  M.bprism([[-.84,.62],[-.22,.56],[-.12,.68],[-.18,.84],[-.82,.88],[-.92,.76]],.3,.04,body);M.prism([[-.7,.62],[-.25,.58],[-.2,.62],[-.66,.67]],-.152,.152,V_SILVER);
  M.bprism([[-.9,.86],[-.08,.83],[.0,.91],[-.3,.98],[-.84,.97]],.3,.04,seat);
  M.box(-1.02,.88,-.13,-.72,.9,.13,V_CHROME);for(const s of [-1,1]){spring(M,[-.62,.3,s*.13],[-.86,.84,s*.13],.026,7,V_CHROME);M.rod([-.62,.3,s*.13],[-.86,.84,s*.13],.012,V_CHROME,5)}
  M.bprism([[.4,.52],[.9,.5],[.92,.56],[.48,.62]],.14,.03,V_CHROME);
  M.bprism([[.38,1.0],[.62,1.0],[.66,1.1],[.42,1.17]],.36,.04,body);M.box(.62,1.02,-.1,.68,1.1,.1,Mat('#fff7e8',{e:o.lit?42:.5,r:.08}));
  M.rod([.46,1.14,-.37],[.46,1.14,.37],.016,V_CHROME,6);for(const s of [-1,1])M.rod([.46,1.14,s*.3],[.46,1.14,s*.4],.022,V_DK,8);mirrors(M,.44,1.16,.3);
  for(const s of [-1,1])M.rod([.56,.98,s*.065],[.64,.27,s*.065],.022,V_CHROME,8);
  M.rod([-.15,.27,.14],[-.6,.34,.17],.026,V_DK,6);M.push(M4.mul(M4.trans(-.55,.35,.18),M4.rotZ(Math.PI/2)));M.cyl(.05,.4,12,V_CHROME);M.pop();
  M.box(-.95,.74,-.11,-.9,.82,.11,Mat('#ff1a0a',{e:o.lit?12:.15,r:.1}));plateQuad(M,-.955,.5,o.plate||'plate2');
  if(o.decal)sideDecal(M,-.74,-.3,.64,.8,.154,o.decal)}
// riders, built in bike-local space
function rider(M,o){M.at(-.32,0,0,Math.PI/2,()=>human(M,0,0,0,0,Object.assign({pose:'ride',seat:.9,foot:o.wave?.3:.41,gripY:1.16,gripZ:.77,long:true,mask:'#3a4a5a',sneaker:true},o)))}
function pillion(M,o){M.at(-.74,0,0,Math.PI/2,()=>human(M,0,0,0,0,Object.assign({pose:'pillion',seat:.95,foot:.36,sneaker:true},o)))}
// VinFast VF e34 (o.model:'vf5' → shorter VF5 with roof TAXI box), Xanh SM livery. G receives the tinted cabin glass.
const CAR_WHEELS=[[1.31,.345,.775],[1.31,.345,-.775],[-1.3,.345,.775],[-1.3,.345,-.775]];
function vfCar(M,G,o={}){const vf5=o.model==='vf5',SC=vf5?M4.scale(.925,.98,.96):M4.ident();M.push(SC);G.push(SC);
  const body=Mat(o.col||'#20c6d6',{k:12,r:.3,m:.12,w:1}),clad=Mat('#121314',{r:.62,w:1}),trim=Mat('#0b0c0d',{r:.22,w:1}),lit=o.lit;
  // body: superellipse sections along x; lower edge follows the wheel arches. Black cladding is a slightly wider band underneath.
  const SEC=[[-2.16,.8,.38,1.0,.62],[-2.13,.86,.3,1.06,.72],[-1.98,.89,.27,1.08,.78],[-1.76,.9,.6,1.09,.79],[-1.62,.9,.71,1.09,.79],[-1.3,.9,.765,1.085,.79],[-.98,.9,.71,1.08,.79],
    [-.86,.9,.27,1.075,.79],[-.3,.9,.24,1.06,.79],[.4,.9,.24,1.04,.79],[.86,.9,.27,1.02,.79],[.9,.9,.71,1.0,.79],[1.31,.895,.765,.96,.77],[1.62,.89,.71,.9,.74],
    [1.74,.885,.32,.88,.72],[1.98,.86,.3,.85,.66],[2.1,.8,.34,.8,.56],[2.16,.7,.42,.72,.4]];
  const th=s=>s[2]>.5?.085:.24;
  M.loft(SEC.map(s=>carRing(s[0],s[1],s[2]+th(s)-.03,s[3],s[4],.035,.45)),body,{caps:true});
  M.loft(SEC.map(s=>ringX(s[0],s[1]+.013,s[2],s[2]+th(s),{et:8,eb:8,wt:1},24)),clad,{caps:true});
  if(!o.noWheels)for(const w of CAR_WHEELS)carWheel(M,w[0],w[1],w[2]);
  for(const x of [1.31,-1.3])M.box(x-.4,.32,-.62,x+.4,.8,.62,clad);
  // greenhouse (tinted glass) with tumblehome, roof skin on top
  G.loft([[-2.07,.7,1.07,1.34,.52],[-1.93,.74,1.085,1.48,.6],[-1.65,.77,1.09,1.53,.63],[-.7,.785,1.075,1.56,.645],[0,.79,1.05,1.55,.64],[.55,.79,1.02,1.28,.66],[.98,.79,1.0,1.03,.75]]
    .map(s=>carRing(s[0],s[1],s[2],s[3],s[4],.04,.3)),Mat([.3,.34,.36],{k:1,r:.04,w:1}),{caps:true});
  M.loft([[-1.9,.6,1.455,1.5,.55],[-1.62,.635,1.5,1.548,.58],[-.7,.65,1.53,1.578,.6],[-.05,.645,1.52,1.568,.59],[.1,.6,1.49,1.53,.55]].map(s=>carRing(s[0],s[1],s[2],s[3],s[4],.045,.4)),body,{caps:true});
  for(const s of [-1,1]){M.rod([.99,1.0,s*.79],[.08,1.53,s*.645],.036,trim,6);M.rod([-.34,1.075,s*.786],[-.34,1.54,s*.648],.05,trim,6);
    M.quad([-1.93,1.085,s*.748],[-1.64,1.09,s*.776],[-1.6,1.535,s*.636],[-1.9,1.48,s*.603],body);M.rod([-2.07,1.07,s*.7],[-1.92,1.48,s*.6],.035,body,6);
    M.rod([.98,1.005,s*.795],[-1.95,1.085,s*.748],.012,trim,4);M.rod([.08,1.535,s*.646],[-1.62,1.54,s*.636],.014,trim,4);
    M.rod([-1.55,1.62,s*.5],[-.1,1.61,s*.5],.02,V_BLK,6);for(const x of [-1.5,-.15])M.rod([x,1.565,s*.5],[x,1.62,s*.5],.016,V_BLK,4);
    M.rod([-.86,.49,s*.915],[.86,.49,s*.915],.008,V_CHROME,4);
    for(const [x,y0,y1] of [[.9,.5,1.0],[-.34,.48,1.05],[-1.32,.5,1.08]])M.rod([x,y0,s*.903],[x,y1,s*.9],.004,trim,3);
    for(const x of [.32,-.86])M.box(x-.09,.88,s*.898-.012,x+.05,.905,s*.898+.012,body);
    M.rod([.86,1.05,s*.82],[.8,1.08,s*.95],.022,trim,5);M.sphere(.78,1.1,s*.99,.085,.06,.07,14,trim);M.box(.8,1.075,s*.955,.86,1.09,s*1.035,Mat('#ffae00',{e:lit?3:.35}));
    // front: chrome V wing running from the badge out over the lamps, slim projector headlamps
    M.rod([2.155,.755,0],[2.09,.79,s*.42],.013,V_CHROME,6);M.rod([2.09,.79,s*.42],[1.98,.825,s*.78],.013,V_CHROME,6);M.rod([1.98,.825,s*.78],[1.76,.875,s*.865],.011,V_CHROME,6);
    M.rod([2.15,.74,0],[2.085,.775,s*.42],.007,Mat('#ffffff',{e:lit?20:.4}),4);M.rod([2.085,.775,s*.42],[1.97,.81,s*.77],.007,Mat('#ffffff',{e:lit?20:.4}),4);
    M.sphere(2.035,.69,s*.62,.04,.032,.15,14,Mat('#fffaf0',{e:lit?30:.6,r:.05}));M.sphere(2.0,.69,s*.62,.06,.05,.17,14,trim);M.sphere(2.045,.69,s*.5,.022,.022,.022,8,V_CHROME);
    M.sphere(2.08,.44,s*.68,.03,.04,.07,10,trim);
    M.box(-2.135,.92,s*.62-.18,-2.09,.99,s*.62+.18,Mat('#ff1a0a',{e:lit?9:1.1,r:.1}));M.box(-2.14,.62,s*.76-.05,-2.12,.66,s*.76+.05,Mat('#a8160e',{e:.3}))}
  M.rod([-2.13,.955,-.44],[-2.13,.955,.44],.008,Mat('#ff1a0a',{e:lit?6:.8}),4);M.rod([-2.0,1.12,0],[-1.95,1.25,0],.006,V_BLK,3);
  decalX(M,.09,-.09,.68,.8,2.172,tex('vfBadge',.2,{r:.15,m:.9}));decalXn(M,-.08,.08,1.02,1.12,-2.142,tex('vfBadge',.15,{r:.15,m:.9}));
  M.box(2.08,.34,-.58,2.17,.6,.58,Mat('#0b0b0c',{r:.4}));for(let j=0;j<3;j++)for(let k=0;k<10;k++)M.box(2.171,.37+j*.075,-.53+k*.107+(j%2)*.05,2.176,.42+j*.075,-.49+k*.107+(j%2)*.05,V_DK);
  M.rod([2.16,.335,-.6],[2.16,.335,.6],.011,V_CHROME,4);
  plateQuadF(M,2.182,.45,'plateTaxi',.2,.11);plateQuad(M,-2.165,.58,'plateTaxi',.2,.11);
  if(o.decal){sideDecal(M,.06,.86,.55,.83,.906,o.decal,.06);sideDecal(M,-1.2,-.62,.82,.92,.904,'xsmHot',.06)}
  if(vf5){M.box(-.52,1.62,-.24,-.08,1.8,.24,Mat('#f2f4d0',{r:.3}),{px:false,nx:false});decalX(M,.24,-.24,1.63,1.79,-.079,tex('taxiSign',lit?2.4:1.6));decalXn(M,-.24,.24,1.63,1.79,-.521,tex('taxiSign',lit?2.4:1.6))}
  // interior
  const seatM=Mat('#2a2b2e',{r:.6});for(const s of [-1,1]){M.box(-.32,.55,s*.38-.22,.18,.76,s*.38+.22,seatM);M.box(-.4,.76,s*.38-.22,-.28,1.32,s*.38+.22,seatM)}
  M.box(-1.45,.55,-.62,-.85,.76,.62,seatM);M.box(-1.55,.76,-.62,-1.43,1.28,.62,seatM);
  M.box(.62,.86,-.74,.98,1.0,.74,Mat('#1b1c1f',{r:.5}));M.box(.55,.99,-.15,.62,1.13,.15,Mat('#9fe6ff',{e:2.2}));
  M.push(M4.mul(M4.trans(.4,1.04,-.38),M4.rotZ(1.15)));M.cyl(.17,.03,18,V_DK,{caps:false});M.cyl(.05,.035,10,V_DK);M.pop();
  if(o.driver)M.at(-.15,0,-.38,Math.PI/2,()=>human(M,0,0,0,0,{pose:'sit',seat:.6,shirt:'#14b8c8',long:true,arms:'counter',skin:'#c68e65',collar:'#0e8a96'}));
  M.pop();G.pop()}
