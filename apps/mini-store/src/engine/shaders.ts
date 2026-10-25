// GLSL ES 3.00 sources. Shared snippets: common noise/hash, light uniforms (+ shadowed spots), PBR helpers.
import { EDGE, MAXL } from './constants';

const GLSL_COMMON = `#version 300 es
precision highp float;precision highp int;
#define MAXL ${MAXL}
float h11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float h21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 h22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+17.1;a*=.5;}return s;}
float flick(float t){float g=step(.55,sin(t*.9)+sin(t*2.3)*.5);float n=h11(floor(t*13.));return 1.-g*step(.6,n)*.85;}
`;
// point lights + up to 4 shadowed spot lights (shadow atlas 2x2 tiles)
const LIGHT_UNI = `uniform vec4 uLP[MAXL];uniform vec4 uLC[MAXL];uniform vec4 uLD[MAXL];uniform int uNL;uniform float uTime;
float beam(int i,vec3 L){vec4 d=uLD[i];return d.w<-1.5?1.:smoothstep(d.w,d.w+.12,dot(-L,d.xyz));}
uniform mat4 uSM[4];uniform vec4 uSP[4];uniform vec4 uSD[4];uniform vec4 uSC[4];uniform int uNS;uniform highp sampler2DShadow uShadow;
float shadowAt(int i,vec3 P,int taps){vec4 c=uSM[i]*vec4(P,1.);if(c.w<=0.)return 1.;vec3 p=c.xyz/c.w*.5+.5;
  if(p.x<=0.||p.x>=1.||p.y<=0.||p.y>=1.||p.z>=1.)return 1.;
  vec2 uv=vec2(float(i-2*(i/2)),float(i/2))*.5+clamp(p.xy,.003,.997)*.5;float z=p.z-.0006;
  if(taps<=1)return texture(uShadow,vec3(uv,z));
  float s=0.;s+=texture(uShadow,vec3(uv+vec2(-.8,-.3)/1300.,z));s+=texture(uShadow,vec3(uv+vec2(.3,-.8)/1300.,z));
  s+=texture(uShadow,vec3(uv+vec2(.8,.3)/1300.,z));s+=texture(uShadow,vec3(uv+vec2(-.3,.8)/1300.,z));return s*.25;}
vec3 spotRad(int i,vec3 P,out vec3 L){vec3 Ld=uSP[i].xyz-P;float d2=dot(Ld,Ld),rad=uSP[i].w;float d=sqrt(d2);L=Ld/max(d,1e-4);if(d>rad)return vec3(0);
  float cone=smoothstep(uSD[i].w,uSC[i].w,dot(-L,uSD[i].xyz));float fall=clamp(1.-pow(d/rad,4.),0.,1.);return uSC[i].rgb*cone*fall*fall/(d2+1.);}`;
const PBR = `
const float PI=3.14159265;
vec3 envCol(vec3 r,float rough){float y=r.y;
  vec3 sky=mix(vec3(.030,.028,.034),vec3(.008,.011,.020),smoothstep(-.05,.6,y));
  sky+=vec3(.09,.040,.018)*exp(-abs(y-.05)*7.)*(1.-rough*.5);
  return y<-.02?vec3(.006,.006,.007):sky;}
vec3 brdf(vec3 N,vec3 V,vec3 L,vec3 alb,float rough,float metal,float wrap,vec3 col){
  vec3 F0=mix(vec3(.04),alb,metal);float a=max(rough*rough,.002),a2=a*a,NV=max(dot(N,V),1e-3),NLr=dot(N,L),NL=max(NLr,0.),NLw=max((NLr+wrap)/(1.+wrap),0.);
  vec3 H=normalize(L+V);float NH=max(dot(N,H),0.),VH=max(dot(V,H),0.);
  float D=a2/(PI*pow(NH*NH*(a2-1.)+1.,2.));float k=(rough+1.)*(rough+1.)/8.;float G=NV/(NV*(1.-k)+k)*NL/(NL*(1.-k)+k);
  vec3 F=F0+(1.-F0)*pow(1.-VH,5.);return (1.-F)*(1.-metal)*alb/PI*col*NLw+D*G*F/(4.*NV*NL+1e-4)*col*NL;}
vec3 lightAll(vec3 P,vec3 N,vec3 V,vec3 alb,float rough,float metal,float wrap){vec3 Lo=vec3(0);
  for(int i=0;i<MAXL;i++){if(i>=uNL)break;vec3 Ld=uLP[i].xyz-P;float d2=dot(Ld,Ld),rad=uLP[i].w;if(d2>rad*rad)continue;
    float d=sqrt(d2);vec3 L=Ld/d;if(dot(N,L)+wrap<=0.)continue;
    float fall=clamp(1.-pow(d/rad,4.),0.,1.);vec3 col=uLC[i].rgb*fall*fall/(d2+1.)*beam(i,L);if(uLC[i].w>.5)col*=flick(uTime+float(i));
    Lo+=brdf(N,V,L,alb,rough,metal,wrap,col);}
  for(int i=0;i<4;i++){if(i>=uNS)break;vec3 L;vec3 c=spotRad(i,P,L);if(c.r+c.g+c.b<1e-6||dot(N,L)+wrap<=0.)continue;
    Lo+=brdf(N,V,L,alb,rough,metal,wrap,c*shadowAt(i,P+N*.045,4));}
  vec3 amb=mix(vec3(.006,.007,.010),vec3(.016,.019,.028),N.y*.5+.5);Lo+=amb*alb*(1.-metal);
  return Lo;}
uniform samplerCube uEnv;uniform float uEnvK;
vec3 envRefl(vec3 r,float rough,vec3 P){bool inside=P.x>-5.&&P.x<2.&&P.z>-7.5&&P.z<1.&&P.y<3.;
  float k=(uEnvK>0.&&!inside)?uEnvK*smoothstep(4.2,2.6,P.y):0.;
  return k>0.?mix(envCol(r,rough),textureLod(uEnv,r,rough*6.).rgb+envCol(r,rough)*.3,k):envCol(r,rough);}
vec3 envSpec(vec3 N,vec3 V,vec3 alb,float rough,float metal,vec3 P){vec3 F0=mix(vec3(.04),alb,metal);
  vec3 Fe=F0+(max(vec3(1.-rough),F0)-F0)*pow(1.-max(dot(N,V),0.),5.);return envRefl(reflect(-V,N),rough,P)*Fe*(1.-rough*.6);}
`;

export const VS_MAIN = `${GLSL_COMMON}
layout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec2 aUV;layout(location=3)in vec3 aC;layout(location=4)in vec4 aM;
uniform mat4 uVP,uModel;out vec3 vP,vN,vC;out vec2 vUV;out vec4 vM;
void main(){vec4 w=uModel*vec4(aP,1.);vP=w.xyz;vN=mat3(uModel)*aN;vUV=aUV;vC=aC;vM=aM;gl_Position=uVP*w;}`;

export const FS_MAIN = `${GLSL_COMMON}${LIGHT_UNI}${PBR}
in vec3 vP,vN,vC;in vec2 vUV;in vec4 vM;out vec4 oC;
uniform sampler2D uAtlas,uRefl;uniform vec3 uEye;uniform vec2 uRes;uniform float uMirror,uRain,uWet;
vec2 ripples(vec2 p,float t){vec2 acc=vec2(0);
  for(int l=0;l<3;l++){float fl=float(l),sc=2.6+fl*1.9;vec2 q=p*sc+vec2(fl*3.1,fl*7.7);vec2 id=floor(q),f=fract(q)-.5;
    float h=h21(id+fl*13.1);vec2 c=(h22(id+fl*5.3)-.5)*.5;float tt=fract(t*(.8+.3*fl)+h);vec2 d=f-c;float r=length(d)+1e-4;
    float x=r-tt*.42;float g=cos(x*38.)*exp(-x*x*260.)*(1.-tt)*(1.-tt);acc+=d/r*g;}
  return acc*uRain;}
void main(){
  if(abs(vP.x)>${EDGE}||abs(vP.z)>${EDGE})discard;
  float kk=vM.w;float wetF=step(15.5,kk);int K=int(kk-16.*wetF+.5);
  bool ground=(K==2||K==3||K==4||K==6);
  if(uMirror>.5&&(vP.y<-.02||ground||vP.y<-.09))discard;
  vec4 tx=texture(uAtlas,vUV);vec3 alb=pow(tx.rgb,vec3(2.2))*vC;
  vec3 N=normalize(vN);vec3 V=normalize(uEye-vP);if(dot(N,V)<0.&&K!=8)N=-N;
  float rough=vM.x,metal=vM.y,emis=vM.z,wrap=0.;float reflAmt=0.,lod=0.;vec2 rip=vec2(0);
  float wet=wetF*uWet*mix(.45,1.,clamp(N.y,0.,1.));
  vec2 xz=vP.xz;
  if(K==2||K==6){float n=fbm(xz*5.3);float spk=step(.82,h21(floor(xz*60.)));
    if(K==2)alb*=.55+.9*n+spk*.5;else alb*=.75+.35*n;
    float pd=fbm(xz*.32+vec2(3.,1.))*.8+fbm(xz*1.4)*.2;float curb=1.-smoothstep(0.,.9,min(abs(vP.z-3.75),abs(vP.x-4.75)));
    float puddle=smoothstep(.5,.56,pd+curb*.18);
    rough=mix(mix(rough,.28,wet),.02,puddle*wet);alb*=mix(1.,.55,wet)*mix(1.,.6,puddle);
    float patch_=smoothstep(.62,.66,fbm(xz*.45+21.));if(K==2)alb*=mix(1.,.7,patch_);
    float b0=fbm(xz*8.),bx=fbm(xz*8.+vec2(.16,0)),bz=fbm(xz*8.+vec2(0,.16));N=normalize(N-vec3(bx-b0,0.,bz-b0)*(1.-puddle)*.35);
    rip=ripples(xz,uTime);reflAmt=mix(.95,1.7,puddle)*wet;lod=mix(2.4,.0,puddle);}
  else if(K==3){vec2 g=xz/.4;vec2 id=floor(g),f=fract(g);float grout=smoothstep(.0,.04,min(min(f.x,1.-f.x),min(f.y,1.-f.y)));
    float h=h21(id);alb*=(.8+.35*h)*mix(.45,1.,grout)*(.85+.3*fbm(xz*7.));N=normalize(N+vec3(h22(id)-.5,0.).xzy*.05*grout);
    float pd=fbm(xz*.5+7.);float puddle=smoothstep(.6,.66,pd)*grout;
    rough=mix(mix(rough,.3,wet),.03,puddle*wet);alb*=mix(1.,.6,wet);rip=ripples(xz,uTime)*.4;reflAmt=mix(.45,1.3,puddle)*wet;lod=mix(3.,.3,puddle);}
  else if(K==4){vec2 g=xz/.6;vec2 f=fract(g);float grout=smoothstep(.0,.02,min(min(f.x,1.-f.x),min(f.y,1.-f.y)));alb*=mix(.6,1.,grout);reflAmt=.55*grout;lod=2.2;}
  else if(K==5){float st=fbm(vec2(vP.x*2.6+vP.z*2.6,vP.y*.35));float low=smoothstep(1.2,0.,fract(vP.y/3.25)*3.25);
    alb*=.78+.35*st;alb*=mix(1.,.62,smoothstep(.45,.8,fbm(vec2((vP.x+vP.z)*9.,vP.y*.8)))*.8);alb*=1.-low*.25;
    rough=mix(rough,mix(.35,.75,st),wet);alb*=mix(1.,.8,wet);}
  else if(K==7){emis*=flick(uTime+2.);}
  else if(K==8){float n=fbm(vP.xy*4.+vP.z*3.);alb*=.6+.8*n;wrap=.6;rough=mix(.6,.3,wet);}
  else if(K==9){alb*=.7+.45*fbm(xz*2.2+vP.y*3.1);rough=mix(rough,.45,wet);alb*=mix(1.,.7,wet);}
  else if(K==11){rough=.18+.15*fbm(vec2(vP.y*40.,vP.x+vP.z));}
  else if(K==12){float fl=h21(floor(vP.xy*300.+vP.z*300.));rough=mix(rough,.22,step(.93,fl));}
  else if(wetF>.5){rough=mix(rough,rough*.55,wet);alb*=mix(1.,.85,wet);}
  if(ground&&N.y>.8){N=normalize(N+vec3(rip.x,0.,rip.y)*.9);}
  vec3 col=lightAll(vP,N,V,alb,rough,metal,wrap);
  if(reflAmt>0.&&uMirror<.5){vec2 suv=gl_FragCoord.xy/uRes;vec2 off=N.xz*vec2(.045,.08)*(1.+lod*.2);
    vec3 refl=textureLod(uRefl,clamp(suv+off,.001,.999),lod).rgb;float F=.04+.96*pow(1.-max(dot(N,V),0.),5.);
    col+=refl*min(F*3.2+.06,1.)*reflAmt;col+=envSpec(N,V,alb,rough,metal,vP)*.5;}
  else col+=envSpec(N,V,alb,rough,metal,vP);
  if(K==12){vec3 Nc=normalize(vN);if(dot(Nc,V)<0.)Nc=-Nc;float Fc=.04+.96*pow(1.-max(dot(Nc,V),0.),5.);
    vec3 cc=vec3(0);for(int i=0;i<4;i++){if(i>=uNS)break;vec3 L;vec3 c=spotRad(i,vP,L);if(c.r+c.g+c.b<1e-6||dot(Nc,L)<=0.)continue;cc+=brdf(Nc,V,L,vec3(0),.05,0.,0.,c*shadowAt(i,vP+Nc*.04,1));}
    col=col*(1.-Fc)+cc+envRefl(reflect(-V,Nc),.015,vP)*Fc*1.25;}
  col+=alb*emis;
  oC=vec4(col,1.);}`;

export const FS_GLASS = `${GLSL_COMMON}${LIGHT_UNI}${PBR}
in vec3 vP,vN,vC;in vec2 vUV;in vec4 vM;out vec4 oC;
uniform sampler2D uScene;uniform vec3 uEye;uniform vec2 uRes;uniform float uRain;
vec3 drops(vec2 uv,float t){vec3 acc=vec3(0);float trail=0.;
  { vec2 q=vec2(uv.x/.11,uv.y/.55);float col=floor(q.x);float hc=h21(vec2(col,9.1));q.y+=t*(.25+.4*hc)+hc*10.;
    vec2 id=vec2(col,floor(q.y));vec2 f=fract(q)-.5;float h=h21(id*1.7+.3);float cx=(h-.5)*.5+sin(q.y*7.+h*10.)*.05;
    vec2 d=vec2((f.x-cx)*.11,f.y*.55);float on=step(.35,h);
    float m=smoothstep(.016,.011,length(d*vec2(1.,.8)))*on;acc.xy+=d/.016*m*1.4;acc.z=max(acc.z,m);
    float tr=smoothstep(.006,.002,abs(d.x))*step(0.,d.y)*smoothstep(.3,.0,d.y)*on;trail=tr;
    float bead=smoothstep(.0045,.002,length(vec2(d.x,fract(d.y*28.)/28.-.018)))*tr;acc.xy+=vec2(d.x,fract(d.y*28.)/28.-.018)/.004*bead*.6;acc.z=max(acc.z,bead);}
  for(int l=0;l<2;l++){float sc=l==0?24.:41.;vec2 q=uv*sc+float(l)*11.7;vec2 id=floor(q),f=fract(q)-.5;
    vec3 h=vec3(h21(id),h21(id+17.3),h21(id+5.1));vec2 c=(h.xy-.5)*.55;float life=fract(t*.05+h.z*3.);
    float r=(.12+.18*h.z)*smoothstep(0.,.12,life)*smoothstep(1.,.85,life);vec2 d=f-c;float m=smoothstep(r,r*.7,length(d))*step(.58,h.x)*(1.-trail);
    acc.xy+=d/max(r,1e-3)*m;acc.z=max(acc.z,m);}
  return acc*min(uRain*1.3,1.);}
void main(){
  vec3 N=normalize(vN);vec3 V=normalize(uEye-vP);if(dot(N,V)<0.)N=-N;
  vec2 pc=abs(N.z)>abs(N.x)?vP.xy:vP.zy;vec3 dr=drops(pc,uTime)*(vM.z>.5?0.:1.);
  vec2 suv=gl_FragCoord.xy/uRes;vec2 off=dr.xy*.018+vec2(0.,-.004)*dr.z;
  vec3 behind=texture(uScene,suv+off).rgb;
  vec2 px=1.5/uRes;vec3 blur=(texture(uScene,suv+px).rgb+texture(uScene,suv-px).rgb+texture(uScene,suv+vec2(px.x,-px.y)).rgb+texture(uScene,suv+vec2(-px.x,px.y)).rgb)*.25;
  behind=mix(mix(behind,blur,.3*min(uRain,1.)),behind,dr.z);
  vec3 Nd=normalize(N+(abs(N.z)>abs(N.x)?vec3(dr.x,dr.y,0.):vec3(0.,dr.y,dr.x))*.8);
  float F=.04+.96*pow(1.-max(dot(Nd,V),0.),5.);
  vec3 refl=envRefl(reflect(-V,Nd),.03,vP)*1.25+lightAll(vP,Nd,V,vec3(0),.06+.1*(1.-dr.z),0.,0.)*1.4;
  vec3 col=behind*(1.-F)*vec3(.9,.95,.94)*vC+refl*(F+dr.z*.25);
  oC=vec4(col,1.);}`;

export const VS_RAIN = `${GLSL_COMMON}${LIGHT_UNI}
uniform mat4 uVP;uniform vec3 uEye;uniform float uRain,uPx;uniform int uMode;out vec3 vCol;out vec2 vQ;out float vA;
const vec2 Q[6]=vec2[6](vec2(-1,0),vec2(1,0),vec2(1,1),vec2(-1,0),vec2(1,1),vec2(-1,1));
bool roofed(vec3 p){return (p.x<2.05&&p.x>-5.&&p.z<.85&&p.y<10.2)||(p.x<-4.95&&p.z<.45&&p.y<13.3)||(p.x>-5.05&&p.x<2.3&&p.z<1.3&&p.y<3.7)||(p.x>-4.6&&p.x<1.4&&p.z<1.95&&p.y<3.7);}
void main(){float fi=float(gl_InstanceID);vec2 c=Q[gl_VertexID];
  vec3 h=vec3(h11(fi*.1373+.1),h11(fi*.7311+3.7),h11(fi*1.371+7.3));vec3 p;vec3 vel;float len,wid,a=1.;
  if(uMode==0){float spd=8.5+h.y*3.;vec3 wind=vec3(.9,0.,.35);
    float y=mod(h.y*17.-uTime*spd,17.);p=vec3(h.x*16.6-8.3,y,h.z*16.6-8.3)+wind*(17.-y)/spd*.6;
    vel=normalize(vec3(wind.x*.6,-spd,wind.z*.6));len=.28+.3*h.x;wid=.0055;
    if(roofed(p)||p.y<0.||abs(p.x)>8.05||abs(p.z)>8.05)a=0.;
    a*=step(fi,6500.*uRain);}
  else{float ph=uTime*2.2+h.y*40.;float cyc=floor(ph);float t=fract(ph);vec2 rp=h22(vec2(fi,cyc))*16.-8.;
    float gy=(rp.y>3.6||rp.x>4.6)?0.:.15;p=vec3(rp.x,gy+t*.07,rp.y);vel=vec3(0,1,0);len=.03+.05*t;wid=.012*(1.-t)+.004;
    a=(1.-t)*step(fi,1600.*uRain);if(roofed(p+vec3(0,.2,0)))a=0.;}
  vec3 toC=uEye-p;float dist=length(toC);toC/=dist;float wf=max(wid,dist*uPx*.8);a*=sqrt(wid/wf);vec3 side=normalize(cross(vel,toC))*wf;
  vec3 wp=p+side*c.x-vel*len*c.y;
  vec3 lc=vec3(.05,.056,.07);
  for(int i=0;i<MAXL;i++){if(i>=uNL)break;vec3 d=uLP[i].xyz-p;float d2=dot(d,d),r=uLP[i].w;if(d2>r*r)continue;float f=1.-sqrt(d2)/r;lc+=uLC[i].rgb*f*f/(d2*.6+.4)*.55*beam(i,-d/sqrt(d2));}
  for(int i=0;i<4;i++){if(i>=uNS)break;vec3 L;vec3 sc=spotRad(i,p,L);if(sc.r+sc.g+sc.b>1e-5)lc+=sc*shadowAt(i,p,1)*.9;}
  vCol=lc;vQ=c;vA=a;gl_Position=a>0.?uVP*vec4(wp,1.):vec4(2.,2.,2.,1.);}`;
export const FS_RAIN = `${GLSL_COMMON}
in vec3 vCol;in vec2 vQ;in float vA;out vec4 oC;
void main(){float w=1.-abs(vQ.x);float l=smoothstep(0.,.25,vQ.y)*smoothstep(1.,.6,vQ.y);oC=vec4(vCol*w*w*l*vA*.38,0.);}`;

export const VS_FS = `#version 300 es
out vec2 vUV;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUV=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
export const FS_SSAO = `${GLSL_COMMON}
in vec2 vUV;out vec4 oC;uniform sampler2D uDepth;uniform mat4 uP,uIP;uniform vec2 uRes;
vec3 vpos(vec2 uv){float d=texture(uDepth,uv).r*2.-1.;vec4 p=uIP*vec4(uv*2.-1.,d,1.);return p.xyz/p.w;}
void main(){float d0=texture(uDepth,vUV).r;if(d0>=1.){oC=vec4(1);return;}
  vec3 P=vpos(vUV);vec3 N=normalize(cross(dFdx(P),dFdy(P)));if(dot(N,P)>0.)N=-N;
  vec3 T=normalize(cross(N,abs(N.y)<.9?vec3(0,1,0):vec3(1,0,0)));vec3 B=cross(N,T);
  float ang=h21(gl_FragCoord.xy)*6.2831,occ=0.,rad=.55;
  for(int i=0;i<14;i++){float fi=(float(i)+.5)/14.;float a=ang+fi*41.;float r=sqrt(fi);vec3 dir=vec3(cos(a)*r,sin(a)*r,sqrt(max(1.-r*r,0.)));
    vec3 S=P+(T*dir.x+B*dir.y+N*dir.z)*rad*(.15+.85*fi*fi);vec4 cp=uP*vec4(S,1.);vec2 su=cp.xy/cp.w*.5+.5;
    float sz=vpos(su).z;float rng=smoothstep(0.,1.,rad/abs(P.z-sz));occ+=step(S.z+.03,sz)*rng;}
  oC=vec4(pow(clamp(1.-occ/14.,0.,1.),1.6));}`;
export const FS_AOBLUR = `${GLSL_COMMON}
in vec2 vUV;out vec4 oC;uniform sampler2D uAO,uDepth;uniform vec2 uTexel;uniform float uNear,uFar;
float lin(float d){float z=d*2.-1.;return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
void main(){float d0=lin(texture(uDepth,vUV).r);float s=0.,w=0.;
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){vec2 o=vec2(x,y)*uTexel;float dz=lin(texture(uDepth,vUV+o).r);float ww=exp(-abs(dz-d0)*4./max(d0*.05,.05));s+=texture(uAO,vUV+o).r*ww;w+=ww;}
  oC=vec4(s/max(w,1e-4));}`;
export const FS_DOWN = `${GLSL_COMMON}
in vec2 vUV;out vec4 oC;uniform sampler2D uSrc;uniform vec2 uTexel;uniform int uPre;uniform float uThr;
vec3 S(vec2 o){return texture(uSrc,vUV+o*uTexel).rgb;}
void main(){vec3 a=S(vec2(-2,-2)),b=S(vec2(0,-2)),c=S(vec2(2,-2)),d=S(vec2(-1,-1)),e=S(vec2(1,-1)),f=S(vec2(-2,0)),g=S(vec2(0,0)),h=S(vec2(2,0)),i=S(vec2(-1,1)),j=S(vec2(1,1)),k=S(vec2(-2,2)),l=S(vec2(0,2)),m=S(vec2(2,2));
  vec3 col=g*.125+(a+c+k+m)*.03125+(b+f+h+l)*.0625+(d+e+i+j)*.125;
  if(uPre==1){col=min(col,vec3(60.));float br=max(col.r,max(col.g,col.b));float kn=uThr*.5;float sft=clamp(br-uThr+kn,0.,2.*kn);sft=sft*sft/(4.*kn+1e-4);
    col*=max(sft,br-uThr)/max(br,1e-4);}
  oC=vec4(col,1.);}`;
export const FS_UP = `${GLSL_COMMON}
in vec2 vUV;out vec4 oC;uniform sampler2D uSrc;uniform vec2 uTexel;
void main(){vec3 s=vec3(0);s+=texture(uSrc,vUV+vec2(-1,-1)*uTexel).rgb+texture(uSrc,vUV+vec2(1,-1)*uTexel).rgb+texture(uSrc,vUV+vec2(-1,1)*uTexel).rgb+texture(uSrc,vUV+vec2(1,1)*uTexel).rgb;
  s+=(texture(uSrc,vUV+vec2(0,-1)*uTexel).rgb+texture(uSrc,vUV+vec2(0,1)*uTexel).rgb+texture(uSrc,vUV+vec2(-1,0)*uTexel).rgb+texture(uSrc,vUV+vec2(1,0)*uTexel).rgb)*2.;
  s+=texture(uSrc,vUV).rgb*4.;oC=vec4(s/16.,1.);}`;
// depth-only pass into a shadow-atlas tile
export const VS_SH = `#version 300 es
layout(location=0)in vec3 aP;uniform mat4 uLVP,uModel;out vec3 vW;void main(){vec4 w=uModel*vec4(aP,1.);vW=w.xyz;gl_Position=uLVP*w;}`;
export const FS_SH = `#version 300 es
precision highp float;in vec3 vW;out vec4 o;void main(){if(abs(vW.x)>${EDGE}||abs(vW.z)>${EDGE})discard;o=vec4(1);}`;
// volumetric haze (half res): analytic in-scatter for point lights + shadowed ray-march through spot cones
export const FS_FOG = `${GLSL_COMMON}${LIGHT_UNI}
in vec2 vUV;out vec4 oC;uniform sampler2D uDepth;uniform mat4 uIVP;uniform vec3 uEye;uniform float uFog;
void main(){float d=texture(uDepth,vUV).r;vec4 w=uIVP*vec4(vUV*2.-1.,d*2.-1.,1.);vec3 P=w.xyz/w.w,rd=P-uEye;float Lr=length(rd);rd/=Lr;Lr=d>=1.?80.:min(Lr,80.);
  vec3 acc=vec3(0);
  for(int i=0;i<MAXL;i++){if(i>=uNL)break;float rad=uLP[i].w*.7;vec3 lp=uLP[i].xyz-uEye;float tc=dot(lp,rd),h=length(lp-tc*rd);if(h>rad)continue;
    vec3 I=uLC[i].rgb;if(uLC[i].w>.5)I*=flick(uTime+float(i));
    if(uLD[i].w<-1.5){float hh=sqrt(h*h+1.);acc+=I*(atan((Lr-tc)/hh)-atan(-tc/hh))/hh*(1.-smoothstep(rad*.2,rad,h));}
    else{float r2=uLP[i].w,hw=sqrt(max(r2*r2-h*h,0.)),t0=max(tc-hw,0.),t1=min(tc+hw,Lr);if(t1>t0){float dt=(t1-t0)/10.;
      for(int k=0;k<10;k++){vec3 x=uEye+rd*(t0+(float(k)+.5)*dt),v=uLP[i].xyz-x;float dd=dot(v,v);acc+=I*beam(i,v/sqrt(dd))/(dd+1.)*dt*1.4;}}}}
  float jit=h21(gl_FragCoord.xy+fract(uTime*7.)*91.);
  for(int i=0;i<4;i++){if(i>=uNS)break;vec3 lp=uSP[i].xyz-uEye;float rad=uSP[i].w,tc=dot(lp,rd),h2=dot(lp,lp)-tc*tc;if(h2>rad*rad)continue;
    float hw=sqrt(rad*rad-h2),t0=max(tc-hw,0.),t1=min(tc+hw,Lr);if(t1<=t0)continue;float dt=(t1-t0)/18.;
    for(int k=0;k<18;k++){vec3 x=uEye+rd*(t0+(float(k)+jit)*dt);vec3 L;vec3 c=spotRad(i,x,L);if(c.r+c.g+c.b<1e-6)continue;acc+=c*shadowAt(i,x,1)*dt*1.6;}}
  oC=vec4(acc*uFog*.0085,1.);}`;
export const FS_COMP = `${GLSL_COMMON}
in vec2 vUV;out vec4 oC;uniform sampler2D uHDR,uBloom,uAO,uFogT;uniform float uExp,uBloomK,uAOK,uTime;uniform vec2 uRes;
const mat3 AIN=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));
const mat3 AOUT=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));
vec3 aces(vec3 c){c=AIN*c;vec3 a=c*(c+.0245786)-.000090537;vec3 b=c*(.983729*c+.4329510)+.238081;return clamp(AOUT*(a/b),0.,1.);}
void main(){vec2 uv=vUV;vec2 cc=uv-.5;float r2=dot(cc,cc);
  vec3 col;col.r=texture(uHDR,uv-cc*.0025).r;col.g=texture(uHDR,uv).g;col.b=texture(uHDR,uv+cc*.0025).b;
  float ao=texture(uAO,uv).r;float lum=dot(col,vec3(.2126,.7152,.0722));col*=mix(1.,ao,uAOK*(1.-smoothstep(.6,3.,lum)));
  col+=texture(uFogT,uv).rgb;
  col+=texture(uBloom,uv).rgb*uBloomK*.085;
  col*=uExp/.6;col=aces(col);col*=1.-r2*.85;
  // photographic grade: slight desaturation, teal shadows / warm highlights, gentle contrast
  float l=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l),col,.9);
  col*=mix(vec3(.93,1.0,1.07),vec3(1.05,1.0,.94),smoothstep(.04,.55,l));col=pow(col,vec3(1.05));
  col=pow(col,vec3(1./2.2));col+=(h21(gl_FragCoord.xy+fract(uTime)*91.)-.5)/180.;
  oC=vec4(col,1.);}`;
