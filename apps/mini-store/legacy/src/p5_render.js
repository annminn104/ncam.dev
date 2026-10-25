
// ================= WebGL2 renderer =================
const canvas=document.getElementById('c'),errBox=document.getElementById('err');
function fail(m){errBox.style.display='flex';errBox.textContent=m;throw new Error(m)}
const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,depth:true,powerPreference:'high-performance'});
if(!gl)fail('Trình duyệt không hỗ trợ WebGL2.');
const hasCBF=!!gl.getExtension('EXT_color_buffer_float');gl.getExtension('OES_texture_float_linear');
const ANI=gl.getExtension('EXT_texture_filter_anisotropic');
const HDRF=hasCBF?gl.RGBA16F:gl.RGBA8,HDRT=hasCBF?gl.HALF_FLOAT:gl.UNSIGNED_BYTE;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);console.error(log+'\n'+src.split('\n').map((l,i)=>(i+1)+': '+l).join('\n'));fail('Lỗi shader: '+log)}return s}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))fail('Lỗi link shader: '+gl.getProgramInfoLog(p));
  const u={};for(let i=0,n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i<n;i++){const a=gl.getActiveUniform(p,i);u[a.name.replace('[0]','')]=gl.getUniformLocation(p,a.name)}return{p,u}}
const PM=program(VS_MAIN,FS_MAIN),PG=program(VS_MAIN,FS_GLASS),PR=program(VS_RAIN,FS_RAIN),PAO=program(VS_FS,FS_SSAO),PAOB=program(VS_FS,FS_AOBLUR),
  PDN=program(VS_FS,FS_DOWN),PUP=program(VS_FS,FS_UP),PCO=program(VS_FS,FS_COMP);
function upload(mesh){const d=mesh.pack(),vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,d.v,gl.STATIC_DRAW);
  for(const [l,n,o] of [[0,3,0],[1,3,12],[2,2,24],[3,3,32],[4,4,44]]){gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,n,gl.FLOAT,false,VS*4,o)}
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,d.i,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,n:d.i.length,tris:d.i.length/3}}
const GO=upload(S.op),GG=upload(S.gl),EMPTY=gl.createVertexArray();const DY={};for(const k in S.dyn)DY[k]=upload(S.dyn[k]);
function setTex(t,min,mag){gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,min);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,mag);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)}
const atlasTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,atlasTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,atlasCanvas);gl.generateMipmap(gl.TEXTURE_2D);
setTex(atlasTex,gl.LINEAR_MIPMAP_LINEAR,gl.LINEAR);if(ANI)gl.texParameterf(gl.TEXTURE_2D,ANI.TEXTURE_MAX_ANISOTROPY_EXT,8);
const blackTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,blackTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));setTex(blackTex,gl.NEAREST,gl.NEAREST);

// ---- shadowed spot lights: static depth atlas rendered once, moving objects re-added every frame ----
const PSH=program(VS_SH,FS_SH),PFOG=program(VS_FS,FS_FOG);
const SHS=2048,TILE=SHS/2,NS=Math.min(4,S.spots.length);
function mkShadow(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT24,SHS,SHS);
  setTex(t,gl.LINEAR,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,t,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);return{t,f}}
const SH_S=mkShadow(),SH_D=mkShadow();
const SPM=new Float32Array(64),SPP=new Float32Array(16),SPD=new Float32Array(16),SPC=new Float32Array(16),SPV=[];
S.spots.slice(0,4).forEach((s,i)=>{const l=Math.hypot(...s.d),d=s.d.map(x=>x/l),up=Math.abs(d[1])>.9?[0,0,1]:[0,1,0];
  const m=M4.mul(M4.persp(Math.min(2.9,(2*s.outer+10)*Math.PI/180),1,.25,s.rad),M4.lookAt(s.p,[s.p[0]+d[0],s.p[1]+d[1],s.p[2]+d[2]],up));
  SPV.push(m);SPM.set(m,i*16);SPP.set([...s.p,s.rad],i*4);SPD.set([...d,Math.cos(s.outer*Math.PI/180)],i*4);SPC.set([s.col[0]*s.k,s.col[1]*s.k,s.col[2]*s.k,Math.cos(s.inner*Math.PI/180)],i*4)});
function shadowDraw(list){gl.useProgram(PSH.p);for(let i=0;i<NS;i++){gl.viewport((i%2)*TILE,(i>>1)*TILE,TILE,TILE);gl.uniformMatrix4fv(PSH.u.uLVP,false,SPV[i]);
  for(const d of list){gl.uniformMatrix4fv(PSH.u.uModel,false,d.m);gl.bindVertexArray(d.g.vao);gl.drawElements(gl.TRIANGLES,d.g.n,gl.UNSIGNED_INT,0)}}}
function shadowState(on){if(on){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.6,3);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.BLEND)}else gl.disable(gl.POLYGON_OFFSET_FILL)}
gl.bindFramebuffer(gl.FRAMEBUFFER,SH_S.f);shadowState(true);gl.clear(gl.DEPTH_BUFFER_BIT);shadowDraw([{m:M4.ident(),g:GO}]);shadowState(false);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
function spotUni(pr){const u=pr.u;gl.uniformMatrix4fv(u.uSM,false,SPM);gl.uniform4fv(u.uSP,SPP);gl.uniform4fv(u.uSD,SPD);gl.uniform4fv(u.uSC,SPC);gl.uniform1i(u.uNS,NS);gl.uniform1i(u.uShadow,5)}

// ---- render targets ----
let T=null;const BLV=6;
function mkTex(w,h,ifmt,fmt,type,filter,mips){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  if(mips)gl.texStorage2D(gl.TEXTURE_2D,Math.floor(Math.log2(Math.max(w,h)))+1,ifmt,w,h);else gl.texImage2D(gl.TEXTURE_2D,0,ifmt,w,h,0,fmt,type,null);
  setTex(t,mips?gl.LINEAR_MIPMAP_LINEAR:filter,filter);return t}
function mkFbo(color,depth,depthTex){const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
  if(color)gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,color,0);
  if(depth){if(depthTex)gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);else gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth)}
  const st=gl.checkFramebufferStatus(gl.FRAMEBUFFER);if(st!==gl.FRAMEBUFFER_COMPLETE)console.warn('FBO incomplete',st);return f}
function mkRb(fmt,w,h,s){const r=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,r);if(s>0)gl.renderbufferStorageMultisample(gl.RENDERBUFFER,s,fmt,w,h);else gl.renderbufferStorage(gl.RENDERBUFFER,fmt,w,h);return r}
let SAMPLES=4;try{const sc=gl.getInternalformatParameter(gl.RENDERBUFFER,HDRF,gl.SAMPLES);SAMPLES=Math.min(4,sc&&sc.length?sc[0]:0)}catch(e){SAMPLES=0}
function buildTargets(W,H){if(T)for(const o of T.objs){if(o instanceof WebGLTexture)gl.deleteTexture(o);else if(o instanceof WebGLFramebuffer)gl.deleteFramebuffer(o);else gl.deleteRenderbuffer(o)}
  const o=[],K=x=>(o.push(x),x);const t={W,H,objs:o};
  t.msC=K(mkRb(HDRF,W,H,SAMPLES));t.msD=K(mkRb(gl.DEPTH_COMPONENT24,W,H,SAMPLES));t.ms=K(gl.createFramebuffer());gl.bindFramebuffer(gl.FRAMEBUFFER,t.ms);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,t.msC);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,t.msD);
  t.sceneTex=K(mkTex(W,H,HDRF,gl.RGBA,HDRT,gl.LINEAR));t.depthTex=K(mkTex(W,H,gl.DEPTH_COMPONENT24,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,gl.NEAREST));t.scene=K(mkFbo(t.sceneTex,t.depthTex,true));
  t.hdrTex=K(mkTex(W,H,HDRF,gl.RGBA,HDRT,gl.LINEAR));t.hdr=K(mkFbo(t.hdrTex));
  t.rw=Math.max(1,W>>1);t.rh=Math.max(1,H>>1);t.reflTex=K(mkTex(t.rw,t.rh,HDRF,gl.RGBA,HDRT,gl.LINEAR,true));t.reflD=K(mkRb(gl.DEPTH_COMPONENT24,t.rw,t.rh,0));t.refl=K(mkFbo(t.reflTex,t.reflD,false));
  t.aw=Math.max(1,W>>1);t.ah=Math.max(1,H>>1);t.ao1=K(mkTex(t.aw,t.ah,gl.R8,gl.RED,gl.UNSIGNED_BYTE,gl.LINEAR));t.ao2=K(mkTex(t.aw,t.ah,gl.R8,gl.RED,gl.UNSIGNED_BYTE,gl.LINEAR));
  t.aoF1=K(mkFbo(t.ao1));t.aoF2=K(mkFbo(t.ao2));t.bl=[];t.fogTex=K(mkTex(t.aw,t.ah,HDRF,gl.RGBA,HDRT,gl.LINEAR));t.fogF=K(mkFbo(t.fogTex));
  for(let i=0;i<BLV;i++){const w=Math.max(1,W>>(i+1)),h=Math.max(1,H>>(i+1)),tx=K(mkTex(w,h,HDRF,gl.RGBA,HDRT,gl.LINEAR));t.bl.push({w,h,tex:tx,fb:K(mkFbo(tx))})}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);T=t}

// ---- camera + input ----
const CAM0={yaw:.6,pitch:.46,dist:38,target:[-1.2,5.0,-.4]};const FOV=30*Math.PI/180,NEAR=.5,FAR=140;
const clone=o=>JSON.parse(JSON.stringify(o));let cam=clone(CAM0),goal=clone(CAM0);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),clampD=d=>clamp(d,6,70);
const ptrs=new Map();let pinch=null,IVP=M4.ident(),downAt=null;
// ---- automatic sliding door: click the glass to open (with a door chime) ----
const DOOR={o:0,target:0,closeAt:0};let actx=null;
function chime(){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();const t0=actx.currentTime;
  [[659.25,0],[523.25,.42]].forEach(([f,d])=>{const o=actx.createOscillator(),g=actx.createGain(),o2=actx.createOscillator();o.type='sine';o.frequency.value=f;o2.type='sine';o2.frequency.value=f*2.01;
    g.gain.setValueAtTime(0,t0+d);g.gain.linearRampToValueAtTime(.18,t0+d+.01);g.gain.exponentialRampToValueAtTime(.001,t0+d+1.2);o.connect(g);o2.connect(g);g.connect(actx.destination);o.start(t0+d);o2.start(t0+d);o.stop(t0+d+1.3);o2.stop(t0+d+1.3)})}catch(e){}}
function openDoor(){if(DOOR.target<1)chime();DOOR.target=1;DOOR.closeAt=performance.now()/1000+5}
function rayHitsDoor(cx,cy){const r=canvas.getBoundingClientRect(),x=(cx-r.left)/r.width*2-1,y=1-(cy-r.top)/r.height*2;
  const un=v=>{const w=IVP[3]*v[0]+IVP[7]*v[1]+IVP[11]*v[2]+IVP[15];return[0,1,2].map(i=>(IVP[i]*v[0]+IVP[4+i]*v[1]+IVP[8+i]*v[2]+IVP[12+i])/w)};
  const p0=un([x,y,-1]),p1=un([x,y,1]),d=[p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]],b=S.door.box;let t0=0,t1=1;
  for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-9){if(p0[i]<b[i]||p0[i]>b[i+3])return false;continue}
    let a=(b[i]-p0[i])/d[i],c=(b[i+3]-p0[i])/d[i];if(a>c)[a,c]=[c,a];t0=Math.max(t0,a);t1=Math.min(t1,c);if(t0>t1)return false}return true}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{try{canvas.setPointerCapture(e.pointerId)}catch(_){}ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,b:e.button});downAt={x:e.clientX,y:e.clientY,t:performance.now()};setCruise(false);
  if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),dist:goal.dist}}});
canvas.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p){canvas.style.cursor=rayHitsDoor(e.clientX,e.clientY)?'pointer':'';return}const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(ptrs.size===2&&pinch){const [a,b]=[...ptrs.values()];goal.dist=clampD(pinch.dist*pinch.d/Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)));return}
  if(p.b===2||p.b===1||e.shiftKey){const s=goal.dist*.0011,c=Math.cos(goal.yaw),sn=Math.sin(goal.yaw);goal.target[0]-=c*dx*s;goal.target[2]+=sn*dx*s;goal.target[1]=clamp(goal.target[1]+dy*s,-.5,12)}
  else{goal.yaw-=dx*.005;goal.pitch=clamp(goal.pitch+dy*.004,.04,1.42)}});
const up_=e=>{ptrs.delete(e.pointerId);pinch=null;
  if(e.type==='pointerup'&&downAt&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)<6&&performance.now()-downAt.t<450&&rayHitsDoor(e.clientX,e.clientY))openDoor();downAt=null};canvas.addEventListener('pointerup',up_);canvas.addEventListener('pointercancel',up_);
canvas.addEventListener('wheel',e=>{e.preventDefault();goal.dist=clampD(goal.dist*Math.exp(e.deltaY*.0012))},{passive:false});
canvas.addEventListener('dblclick',()=>{goal=clone(CAM0)});
const $=id=>document.getElementById(id);const UI={rain:1,exp:1.25,bloom:1,fog:.35,ao:true,bike:true,cruise:false};
$('uiRain').oninput=e=>UI.rain=+e.target.value;$('uiExp').oninput=e=>UI.exp=+e.target.value;$('uiBloom').oninput=e=>UI.bloom=+e.target.value;$('uiFog').oninput=e=>UI.fog=+e.target.value;
$('uiAO').onchange=e=>UI.ao=e.target.checked;$('uiBike').onchange=e=>UI.bike=e.target.checked;$('uiCruise').onchange=e=>UI.cruise=e.target.checked;
function setCruise(v){UI.cruise=v;$('uiCruise').checked=v}
addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='KeyC')setCruise(!UI.cruise);else if(e.code==='KeyH')document.body.classList.toggle('hide');else if(e.code==='Escape')setCruise(false);else if(e.code==='KeyO')openDoor()});

// ---- frame ----
// moving rides: Xanh SM VinFast taxi, Grab Wave, Xanh SM e-scooter, Grab scooter on the side street
// wheels are separate meshes so they can roll: [x, y(=radius), z, mesh]
const W_CAR=[[1.31,.345,.775],[1.31,.345,-.775],[-1.3,.345,.775],[-1.3,.345,-.775]].map(w=>[...w,'wCar']),W_BIKE=[[.62,.26,0,'wBikeF'],[-.6,.26,0,'wBikeR']],W_WAVE=[[.64,.27,0,'wWaveF'],[-.6,.27,0,'wWaveR']];
const VEH=[{m:'car',g:'carG',ax:'x',lane:6.9,dir:1,spd:5.2,off:4,len:4.3,hk:26,hy:.7,cone:30,wheels:W_CAR},
  {m:'grabAB',ax:'x',lane:4.62,dir:-1,spd:4.4,off:0,len:1.9,hk:14,hy:.95,cone:24,wheels:W_BIKE},
  {m:'xsmBike',ax:'x',lane:5.25,dir:-1,spd:3.7,off:13,len:1.9,hk:14,hy:.95,cone:24,wheels:W_BIKE},
  {m:'grabScooter',ax:'z',lane:7.1,dir:-1,spd:4.0,off:7,len:1.9,hk:14,hy:.95,cone:24,wheels:W_BIKE}];
const LP=new Float32Array(MAXL*4),LC=new Float32Array(MAXL*4),LD=new Float32Array(MAXL*4);
function drawFS(){gl.bindVertexArray(EMPTY);gl.drawArrays(gl.TRIANGLES,0,3)}
function lightsUni(pr,t){gl.uniform4fv(pr.u.uLP,LP);gl.uniform4fv(pr.u.uLC,LC);gl.uniform4fv(pr.u.uLD,LD);gl.uniform1i(pr.u.uNL,nLights);gl.uniform1f(pr.u.uTime,t)}
let nLights=0,dynI=[],dynG=[];
function drawScene(VPx,eyeX,mirror,w,h,t,probe=false){const pr=PM,u=pr.u;gl.useProgram(pr.p);gl.uniformMatrix4fv(u.uVP,false,VPx);gl.uniformMatrix4fv(u.uModel,false,M4.ident());
  gl.uniform3fv(u.uEye,eyeX);gl.uniform2f(u.uRes,w,h);gl.uniform1f(u.uMirror,mirror);gl.uniform1f(u.uRain,UI.rain);gl.uniform1f(u.uWet,clamp(.55+UI.rain*.45,0,1));lightsUni(pr,t);spotUni(pr);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlasTex);gl.uniform1i(u.uAtlas,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mirror||probe?blackTex:T.reflTex);gl.uniform1i(u.uRefl,1);
  gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_CUBE_MAP,probe?dummyCube:envTex);gl.uniform1i(u.uEnv,6);gl.uniform1f(u.uEnvK,probe||!envReady?0:1);gl.activeTexture(gl.TEXTURE0);
  gl.bindVertexArray(GO.vao);gl.drawElements(gl.TRIANGLES,GO.n,gl.UNSIGNED_INT,0);
  if(!probe)for(const d of dynI){gl.uniformMatrix4fv(u.uModel,false,d.m);gl.bindVertexArray(d.g.vao);gl.drawElements(gl.TRIANGLES,d.g.n,gl.UNSIGNED_INT,0)}}
// ---- static street-level environment probe (cubemap) for paint / glass / chrome reflections ----
const ENVS=256,ENV_P=[1.2,1.0,5.6],envTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_CUBE_MAP,envTex);gl.texStorage2D(gl.TEXTURE_CUBE_MAP,9,HDRF,ENVS,ENVS);
gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
const dummyCube=gl.createTexture();gl.bindTexture(gl.TEXTURE_CUBE_MAP,dummyCube);for(let f=0;f<6;f++)gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+f,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
const envD=mkRb(gl.DEPTH_COMPONENT24,ENVS,ENVS,0),envF=gl.createFramebuffer();let envReady=false;
function captureEnv(t){const PF=M4.persp(Math.PI/2,1,.1,90),F=[[1,0,0,0,-1,0],[-1,0,0,0,-1,0],[0,1,0,0,0,1],[0,-1,0,0,0,-1],[0,0,1,0,-1,0],[0,0,-1,0,-1,0]];
  gl.bindFramebuffer(gl.FRAMEBUFFER,envF);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,envD);gl.viewport(0,0,ENVS,ENVS);
  F.forEach((f,i)=>{gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_CUBE_MAP_POSITIVE_X+i,envTex,0);gl.clearColor(.004,.005,.008,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    drawScene(M4.mul(PF,M4.lookAt(ENV_P,[ENV_P[0]+f[0],ENV_P[1]+f[1],ENV_P[2]+f[2]],[f[3],f[4],f[5]])),ENV_P,0,ENVS,ENVS,t,true)});
  gl.bindTexture(gl.TEXTURE_CUBE_MAP,envTex);gl.generateMipmap(gl.TEXTURE_CUBE_MAP);envReady=true}
let last=performance.now()/1000;const T0=last;let fpsN=0,fpsT=0,Q=1;
function frame(){const now=performance.now()/1000,dt=Math.min(.05,now-last);last=now;const t=now-T0;
  fpsN++;fpsT+=dt;if(fpsT>.5){const f=fpsN/fpsT;$('fps').textContent=f.toFixed(0)+' fps';if(f<32&&Q>.6)Q=Math.max(.6,Q-.1);else if(f>55&&Q<1)Q=Math.min(1,Q+.05);fpsN=0;fpsT=0}
  const dpr=Math.min(devicePixelRatio||1,1.75)*Q,W=Math.max(2,Math.round(canvas.clientWidth*dpr)),H=Math.max(2,Math.round(canvas.clientHeight*dpr));
  if(!T||T.W!==W||T.H!==H){canvas.width=W;canvas.height=H;buildTargets(W,H)}
  if(UI.cruise){goal.yaw+=dt*.09;goal.pitch+=(.46+.12*Math.sin(t*.21)-goal.pitch)*dt*.5}
  const k=1-Math.exp(-dt*7);cam.yaw+=(goal.yaw-cam.yaw)*k;cam.pitch+=(goal.pitch-cam.pitch)*k;cam.dist=Math.exp(Math.log(cam.dist)+(Math.log(goal.dist)-Math.log(cam.dist))*k);
  for(let i=0;i<3;i++)cam.target[i]+=(goal.target[i]-cam.target[i])*k;
  const cd=cam.dist*Math.max(1,1.3/(W/H)),cp=Math.cos(cam.pitch),eye=[cam.target[0]+cd*cp*Math.sin(cam.yaw),cam.target[1]+cd*Math.sin(cam.pitch),cam.target[2]+cd*cp*Math.cos(cam.yaw)];
  const P=M4.persp(FOV,W/H,NEAR,FAR),V=M4.lookAt(eye,cam.target,[0,1,0]),VP=M4.mul(P,V),VPm=M4.mul(VP,M4.mirrorY(0)),eyeM=[eye[0],-eye[1],eye[2]];
  // lights: static + moving scooter headlights
  nLights=0;const addL=(l,d,c)=>{if(nLights>=MAXL)return;LP.set([l[0],l[1],l[2],l[3]],nLights*4);LC.set([l[4],l[5],l[6],l[7]],nLights*4);LD.set(d?[d[0],d[1],d[2],c]:[0,0,0,-2],nLights*4);nLights++};
  IVP=M4.inv(VP);dynI=[];dynG=[];
  if(UI.bike)for(const v of VEH){const s=(t*v.spd+v.off)%24,p=v.dir>0?-12+s:12-s;if(Math.abs(p)>10.6)continue;const bob=v.m==='car'?0:.015*Math.sin(t*9+v.off);
    const m=v.ax==='x'?M4.mul(M4.trans(p,bob,v.lane),M4.rotY(v.dir<0?Math.PI:0)):M4.mul(M4.trans(v.lane,bob,p),M4.rotY(v.dir<0?Math.PI/2:-Math.PI/2));
    dynI.push({m,g:DY[v.m]});if(v.g)dynG.push({m,g:DY[v.g]});const roll=(t*v.spd+v.off);
    for(const w of v.wheels)dynI.push({m:M4.mul(m,M4.mul(M4.trans(w[0],w[1],w[2]),M4.rotZ(-roll/w[1]))),g:DY[w[3]]});
    const P_=(a)=>v.ax==='x'?[p+v.dir*a,0,v.lane]:[v.lane,0,p+v.dir*a];const h=P_(v.len/2+.05),tl=P_(-v.len/2-.35);
    const fw=v.ax==='x'?[v.dir,-.1,0]:[0,-.1,v.dir],fl=Math.hypot(...fw);
    if(Math.abs(p)<9.4){addL([h[0],v.hy,h[2],15,v.hk,v.hk*.96,v.hk*.88,0],fw.map(x=>x/fl),Math.cos(v.cone*Math.PI/180));addL([tl[0],.7,tl[2],2.6,1.8,.08,.04,0])}}
  // sliding door leaves
  if(DOOR.target>0&&now>DOOR.closeAt)DOOR.target=0;DOOR.o+=(DOOR.target-DOOR.o)*Math.min(1,dt*(DOOR.target?4.5:3));
  const ease=DOOR.o*DOOR.o*(3-2*DOOR.o),D=S.door;
  for(const x of [D.left-ease*D.travel,D.right+ease*D.travel]){const m=M4.trans(x,0,D.z);dynI.push({m,g:DY.doorF});dynG.push({m,g:DY.doorG})}
  for(const l of S.lights)addL(l);
  // 0) shadow atlas: copy static depth, then add moving rides + door leaves
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,SH_S.f);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,SH_D.f);gl.blitFramebuffer(0,0,SHS,SHS,0,0,SHS,SHS,gl.DEPTH_BUFFER_BIT,gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,SH_D.f);shadowState(true);shadowDraw(dynI);shadowState(false);
  gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,SH_D.t);gl.activeTexture(gl.TEXTURE0);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.depthMask(true);
  if(!envReady)captureEnv(t);
  // 1) planar reflection of the wet ground
  gl.bindFramebuffer(gl.FRAMEBUFFER,T.refl);gl.viewport(0,0,T.rw,T.rh);gl.clearColor(.004,.005,.008,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  drawScene(VPm,eyeM,1,T.rw,T.rh,t);gl.bindTexture(gl.TEXTURE_2D,T.reflTex);gl.generateMipmap(gl.TEXTURE_2D);
  // 2) opaque scene → MSAA
  gl.bindFramebuffer(gl.FRAMEBUFFER,T.ms);gl.viewport(0,0,W,H);gl.clearColor(.004,.005,.008,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  drawScene(VP,eye,0,W,H,t);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,T.ms);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,T.scene);gl.blitFramebuffer(0,0,W,H,0,0,W,H,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);
  // 3) glass with raindrop refraction
  gl.bindFramebuffer(gl.FRAMEBUFFER,T.ms);gl.useProgram(PG.p);gl.uniformMatrix4fv(PG.u.uVP,false,VP);gl.uniformMatrix4fv(PG.u.uModel,false,M4.ident());
  gl.uniform3fv(PG.u.uEye,eye);gl.uniform2f(PG.u.uRes,W,H);gl.uniform1f(PG.u.uRain,UI.rain);lightsUni(PG,t);spotUni(PG);gl.uniform1i(PG.u.uEnv,6);gl.uniform1f(PG.u.uEnvK,envReady?1:0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,T.sceneTex);gl.uniform1i(PG.u.uScene,0);gl.bindVertexArray(GG.vao);gl.drawElements(gl.TRIANGLES,GG.n,gl.UNSIGNED_INT,0);
  for(const d of dynG){gl.uniformMatrix4fv(PG.u.uModel,false,d.m);gl.bindVertexArray(d.g.vao);gl.drawElements(gl.TRIANGLES,d.g.n,gl.UNSIGNED_INT,0)}
  // 4) rain streaks + ground splashes (additive)
  if(UI.rain>0){gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);gl.useProgram(PR.p);gl.uniformMatrix4fv(PR.u.uVP,false,VP);gl.uniform3fv(PR.u.uEye,eye);gl.uniform1f(PR.u.uRain,UI.rain);gl.uniform1f(PR.u.uPx,2*Math.tan(FOV/2)/H);lightsUni(PR,t);spotUni(PR);
    gl.bindVertexArray(EMPTY);gl.uniform1i(PR.u.uMode,0);gl.drawArraysInstanced(gl.TRIANGLES,0,6,Math.ceil(6500*Math.min(UI.rain,1.5)));
    gl.uniform1i(PR.u.uMode,1);gl.drawArraysInstanced(gl.TRIANGLES,0,6,Math.ceil(1600*Math.min(UI.rain,1.5)));gl.depthMask(true);gl.disable(gl.BLEND)}
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,T.ms);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,T.hdr);gl.blitFramebuffer(0,0,W,H,0,0,W,H,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  gl.disable(gl.DEPTH_TEST);
  // 5) SSAO (half res) + depth-aware blur
  gl.viewport(0,0,T.aw,T.ah);
  if(UI.ao){gl.bindFramebuffer(gl.FRAMEBUFFER,T.aoF1);gl.useProgram(PAO.p);gl.uniformMatrix4fv(PAO.u.uP,false,P);gl.uniformMatrix4fv(PAO.u.uIP,false,M4.inv(P));
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,T.depthTex);gl.uniform1i(PAO.u.uDepth,0);drawFS();
    gl.bindFramebuffer(gl.FRAMEBUFFER,T.aoF2);gl.useProgram(PAOB.p);gl.uniform2f(PAOB.u.uTexel,1/T.aw,1/T.ah);gl.uniform1f(PAOB.u.uNear,NEAR);gl.uniform1f(PAOB.u.uFar,FAR);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,T.ao1);gl.uniform1i(PAOB.u.uAO,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,T.depthTex);gl.uniform1i(PAOB.u.uDepth,1);drawFS()}
  else{gl.bindFramebuffer(gl.FRAMEBUFFER,T.aoF2);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT)}
  // 5b) volumetric haze with shadowed light shafts (half res)
  gl.bindFramebuffer(gl.FRAMEBUFFER,T.fogF);gl.viewport(0,0,T.aw,T.ah);
  if(UI.fog>0){gl.useProgram(PFOG.p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,T.depthTex);gl.uniform1i(PFOG.u.uDepth,0);gl.uniformMatrix4fv(PFOG.u.uIVP,false,IVP);
    gl.uniform3fv(PFOG.u.uEye,eye);gl.uniform1f(PFOG.u.uFog,UI.fog*(.7+.3*Math.min(UI.rain,1)));lightsUni(PFOG,t);spotUni(PFOG);drawFS()}
  else{gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT)}
  // 6) bloom: 13-tap down chain, tent up chain
  gl.useProgram(PDN.p);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(PDN.u.uSrc,0);gl.uniform1f(PDN.u.uThr,1.0);
  for(let i=0;i<BLV;i++){const b=T.bl[i];gl.bindFramebuffer(gl.FRAMEBUFFER,b.fb);gl.viewport(0,0,b.w,b.h);const src=i?T.bl[i-1]:{tex:T.hdrTex,w:W,h:H};
    gl.bindTexture(gl.TEXTURE_2D,src.tex);gl.uniform2f(PDN.u.uTexel,1/src.w,1/src.h);gl.uniform1i(PDN.u.uPre,i?0:1);drawFS()}
  gl.useProgram(PUP.p);gl.uniform1i(PUP.u.uSrc,0);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
  for(let i=BLV-2;i>=0;i--){const b=T.bl[i],s=T.bl[i+1];gl.bindFramebuffer(gl.FRAMEBUFFER,b.fb);gl.viewport(0,0,b.w,b.h);gl.bindTexture(gl.TEXTURE_2D,s.tex);gl.uniform2f(PUP.u.uTexel,1/s.w,1/s.h);drawFS()}
  gl.disable(gl.BLEND);
  // 7) composite: AO · bloom · ACES · vignette · grain
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);gl.useProgram(PCO.p);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,T.hdrTex);gl.uniform1i(PCO.u.uHDR,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,T.bl[0].tex);gl.uniform1i(PCO.u.uBloom,1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,T.ao2);gl.uniform1i(PCO.u.uAO,2);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,T.fogTex);gl.uniform1i(PCO.u.uFogT,3);
  gl.uniform1f(PCO.u.uExp,UI.exp);gl.uniform1f(PCO.u.uBloomK,UI.bloom);gl.uniform1f(PCO.u.uAOK,UI.ao?.85:0);gl.uniform1f(PCO.u.uTime,t);gl.uniform2f(PCO.u.uRes,W,H);drawFS();
  gl.activeTexture(gl.TEXTURE0);
  requestAnimationFrame(frame)}
window.__scene={tris:GO.tris+GG.tris+Object.values(DY).reduce((s,d)=>s+d.tris,0),lights:S.lights.length,samples:SAMPLES,hdr:hasCBF};
requestAnimationFrame(frame);
