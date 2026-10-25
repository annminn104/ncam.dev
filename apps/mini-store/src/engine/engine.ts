// WebGL2 renderer for the diorama:
// shadow atlas → planar wet-ground reflection → MSAA opaque → glass (refraction + raindrops) → rain → SSAO → volumetric haze → bloom → ACES composite.
import { chime } from './audio';
import { MAXL, MAXS } from './constants';
import {
  GLError,
  mkFbo,
  mkRb,
  mkTex,
  program,
  setTex,
  upload,
  type DrawItem,
  type GpuMesh,
  type Program,
} from './gl';
import { clamp, M4, type Mat4, type Vec3 } from './math';
import { getScene, type SceneData } from './scene';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import * as SH from './shaders';
import { RIDES, rideAhead, rideMatrix, ridePos } from './traffic';

export interface EngineEvents {
  onFps?(fps: number): void;
  /** the user grabbed the camera, which cancels auto-orbit */
  onCruiseChange?(on: boolean): void;
  /** fired once, after the first frame is on screen */
  onReady?(): void;
}
export interface EngineOptions {
  /**
   * Capture only (scripts/capture-poster.mjs): pin the scene clock (traffic, rain, grain) at this
   * many seconds and hold full render quality, so every capture is the same picture.
   */
  freezeAt?: number;
}
export interface CamState {
  yaw: number;
  pitch: number;
  dist: number;
  target: Vec3;
}
export const CAM0: CamState = { yaw: 0.6, pitch: 0.46, dist: 38, target: [-1.2, 5.0, -0.4] };

const FOV = (30 * Math.PI) / 180,
  NEAR = 0.5,
  FAR = 140,
  BLV = 6;
const SHS = 2048,
  TILE = SHS / 2,
  ENVS = 256,
  ENV_P: Vec3 = [1.2, 1.0, 5.6];
const CLEAR: [number, number, number, number] = [0.004, 0.005, 0.008, 1];

interface Bloom {
  w: number;
  h: number;
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
}
interface Targets {
  W: number;
  H: number;
  objs: (WebGLTexture | WebGLFramebuffer | WebGLRenderbuffer)[];
  ms: WebGLFramebuffer;
  sceneTex: WebGLTexture;
  depthTex: WebGLTexture;
  scene: WebGLFramebuffer;
  hdrTex: WebGLTexture;
  hdr: WebGLFramebuffer;
  rw: number;
  rh: number;
  reflTex: WebGLTexture;
  refl: WebGLFramebuffer;
  aw: number;
  ah: number;
  ao1: WebGLTexture;
  ao2: WebGLTexture;
  aoF1: WebGLFramebuffer;
  aoF2: WebGLFramebuffer;
  fogTex: WebGLTexture;
  fogF: WebGLFramebuffer;
  bl: Bloom[];
}
const cloneCam = (c: CamState): CamState => ({ ...c, target: [...c.target] });

export class Engine {
  readonly stats: { tris: number; lights: number; samples: number; hdr: boolean };
  private readonly gl: WebGL2RenderingContext;
  private readonly scene: SceneData;
  private settings: Settings;
  private readonly hdrF: number;
  private readonly hdrT: number;
  private readonly samples: number;
  private readonly prog: Record<
    'main' | 'glass' | 'rain' | 'ao' | 'aoBlur' | 'down' | 'up' | 'comp' | 'shadow' | 'fog',
    Program
  >;
  private readonly GO: GpuMesh;
  private readonly GG: GpuMesh;
  private readonly DY: Record<string, GpuMesh> = {};
  private readonly empty: WebGLVertexArrayObject;
  private readonly atlasTex: WebGLTexture;
  private readonly blackTex: WebGLTexture;
  // shadowed spots
  private readonly shStatic: { t: WebGLTexture; f: WebGLFramebuffer };
  private readonly shDyn: { t: WebGLTexture; f: WebGLFramebuffer };
  private readonly ns: number;
  private readonly spv: Mat4[] = [];
  private readonly spm = new Float32Array(64);
  private readonly spp = new Float32Array(16);
  private readonly spd = new Float32Array(16);
  private readonly spc = new Float32Array(16);
  // environment probe
  private readonly envTex: WebGLTexture;
  private readonly dummyCube: WebGLTexture;
  private readonly envD: WebGLRenderbuffer;
  private readonly envF: WebGLFramebuffer;
  private envReady = false;
  private T: Targets | null = null;
  // per-frame state
  private readonly LP = new Float32Array(MAXL * 4);
  private readonly LC = new Float32Array(MAXL * 4);
  private readonly LD = new Float32Array(MAXL * 4);
  private nLights = 0;
  private dynI: DrawItem[] = [];
  private dynG: DrawItem[] = [];
  private cam = cloneCam(CAM0);
  private goal = cloneCam(CAM0);
  private IVP = M4.ident();
  private door = { o: 0, target: 0, closeAt: 0 };
  private raf = 0;
  private last = performance.now() / 1000;
  private readonly t0 = this.last;
  private fpsN = 0;
  private fpsT = 0;
  private quality = 1;
  private readySent = false;
  // input
  private readonly ptrs = new Map<number, { x: number; y: number; b: number }>();
  private pinch: { d: number; dist: number } | null = null;
  private downAt: { x: number; y: number; t: number } | null = null;
  private readonly unlisten: (() => void)[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    settings: Partial<Settings> = {},
    private readonly ev: EngineEvents = {},
    private readonly opts: EngineOptions = {},
  ) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new GLError("This browser doesn't support WebGL2, which the diorama needs.");
    this.gl = gl;
    const hasCBF = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    const ani = gl.getExtension('EXT_texture_filter_anisotropic');
    this.hdrF = hasCBF ? gl.RGBA16F : gl.RGBA8;
    this.hdrT = hasCBF ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    let samples: number;
    try {
      const sc = gl.getInternalformatParameter(
        gl.RENDERBUFFER,
        this.hdrF,
        gl.SAMPLES,
      ) as Int32Array | null;
      samples = Math.min(4, sc && sc.length ? sc[0] : 0);
    } catch {
      samples = 0;
    }
    this.samples = samples;

    this.prog = {
      main: program(gl, SH.VS_MAIN, SH.FS_MAIN),
      glass: program(gl, SH.VS_MAIN, SH.FS_GLASS),
      rain: program(gl, SH.VS_RAIN, SH.FS_RAIN),
      ao: program(gl, SH.VS_FS, SH.FS_SSAO),
      aoBlur: program(gl, SH.VS_FS, SH.FS_AOBLUR),
      down: program(gl, SH.VS_FS, SH.FS_DOWN),
      up: program(gl, SH.VS_FS, SH.FS_UP),
      comp: program(gl, SH.VS_FS, SH.FS_COMP),
      shadow: program(gl, SH.VS_SH, SH.FS_SH),
      fog: program(gl, SH.VS_FS, SH.FS_FOG),
    };

    const { scene, atlas } = getScene();
    this.scene = scene;
    this.GO = upload(gl, scene.op);
    this.GG = upload(gl, scene.gl);
    for (const k in scene.dyn) this.DY[k] = upload(gl, scene.dyn[k]);
    this.empty = gl.createVertexArray()!;

    this.atlasTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.generateMipmap(gl.TEXTURE_2D);
    setTex(gl, this.atlasTex, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
    if (ani) gl.texParameterf(gl.TEXTURE_2D, ani.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    this.blackTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.blackTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    );
    setTex(gl, this.blackTex, gl.NEAREST, gl.NEAREST);

    // shadow atlas (2×2 tiles): static geometry once, moving objects added each frame on a copy
    this.shStatic = this.mkShadow();
    this.shDyn = this.mkShadow();
    this.ns = Math.min(MAXS, scene.spots.length);
    scene.spots.slice(0, MAXS).forEach((s, i) => {
      const l = Math.hypot(s.d[0], s.d[1], s.d[2]),
        d = s.d.map((x) => x / l),
        up = Math.abs(d[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
      const m = M4.mul(
        M4.persp(Math.min(2.9, ((2 * s.outer + 10) * Math.PI) / 180), 1, 0.25, s.rad),
        M4.lookAt(s.p, [s.p[0] + d[0], s.p[1] + d[1], s.p[2] + d[2]], up),
      );
      this.spv.push(m);
      this.spm.set(m, i * 16);
      this.spp.set([...s.p, s.rad], i * 4);
      this.spd.set([...d, Math.cos((s.outer * Math.PI) / 180)], i * 4);
      this.spc.set(
        [s.col[0] * s.k, s.col[1] * s.k, s.col[2] * s.k, Math.cos((s.inner * Math.PI) / 180)],
        i * 4,
      );
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shStatic.f);
    this.shadowState(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    this.shadowDraw([{ m: M4.ident(), g: this.GO }]);
    this.shadowState(false);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // street-level environment cubemap (captured on the first frame)
    this.envTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.envTex);
    gl.texStorage2D(gl.TEXTURE_CUBE_MAP, 9, this.hdrF, ENVS, ENVS);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.dummyCube = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.dummyCube);
    for (let f = 0; f < 6; f++)
      gl.texImage2D(
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + f,
        0,
        gl.RGBA8,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 255]),
      );
    this.envD = mkRb(gl, gl.DEPTH_COMPONENT24, ENVS, ENVS, 0);
    this.envF = gl.createFramebuffer()!;

    this.stats = {
      tris: this.GO.tris + this.GG.tris + Object.values(this.DY).reduce((s, d) => s + d.tris, 0),
      lights: scene.lights.length,
      samples,
      hdr: hasCBF,
    };
    this.bindInput();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------------- public API ----------------
  setSettings(s: Partial<Settings>): void {
    this.settings = { ...this.settings, ...s };
  }
  openDoor(): void {
    if (this.door.target < 1) chime();
    this.door.target = 1;
    this.door.closeAt = performance.now() / 1000 + 5;
  }
  resetCamera(): void {
    this.goal = cloneCam(CAM0);
  }
  /** move the camera goal (immediate = no smoothing) */
  setCamera(c: Partial<CamState>, immediate = false): void {
    this.goal = { ...this.goal, ...c, target: c.target ? [...c.target] : this.goal.target };
    if (immediate) this.cam = cloneCam(this.goal);
  }
  dispose(): void {
    cancelAnimationFrame(this.raf);
    for (const off of this.unlisten) off();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  // ---------------- GPU resources ----------------
  private mkShadow() {
    const gl = this.gl,
      t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHS, SHS);
    setTex(gl, t, gl.LINEAR, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    return { t, f };
  }
  private buildTargets(W: number, H: number): void {
    const gl = this.gl,
      F = this.hdrF,
      Ty = this.hdrT;
    if (this.T)
      for (const o of this.T.objs) {
        if (o instanceof WebGLTexture) gl.deleteTexture(o);
        else if (o instanceof WebGLFramebuffer) gl.deleteFramebuffer(o);
        else gl.deleteRenderbuffer(o);
      }
    const objs: Targets['objs'] = [],
      K = <X extends WebGLTexture | WebGLFramebuffer | WebGLRenderbuffer>(x: X): X => (
        objs.push(x),
        x
      );
    const msC = K(mkRb(gl, F, W, H, this.samples)),
      msD = K(mkRb(gl, gl.DEPTH_COMPONENT24, W, H, this.samples)),
      ms = K(gl.createFramebuffer()!);
    gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msC);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msD);
    const sceneTex = K(mkTex(gl, W, H, F, gl.RGBA, Ty, gl.LINEAR)),
      depthTex = K(
        mkTex(gl, W, H, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST),
      );
    const hdrTex = K(mkTex(gl, W, H, F, gl.RGBA, Ty, gl.LINEAR));
    const rw = Math.max(1, W >> 1),
      rh = Math.max(1, H >> 1),
      reflTex = K(mkTex(gl, rw, rh, F, gl.RGBA, Ty, gl.LINEAR, true)),
      reflD = K(mkRb(gl, gl.DEPTH_COMPONENT24, rw, rh, 0));
    const aw = Math.max(1, W >> 1),
      ah = Math.max(1, H >> 1);
    const ao1 = K(mkTex(gl, aw, ah, gl.R8, gl.RED, gl.UNSIGNED_BYTE, gl.LINEAR)),
      ao2 = K(mkTex(gl, aw, ah, gl.R8, gl.RED, gl.UNSIGNED_BYTE, gl.LINEAR));
    const fogTex = K(mkTex(gl, aw, ah, F, gl.RGBA, Ty, gl.LINEAR));
    const bl: Bloom[] = [];
    for (let i = 0; i < BLV; i++) {
      const w = Math.max(1, W >> (i + 1)),
        h = Math.max(1, H >> (i + 1)),
        tex = K(mkTex(gl, w, h, F, gl.RGBA, Ty, gl.LINEAR));
      bl.push({ w, h, tex, fb: K(mkFbo(gl, tex)) });
    }
    this.T = {
      W,
      H,
      objs,
      ms,
      sceneTex,
      depthTex,
      scene: K(mkFbo(gl, sceneTex, depthTex, true)),
      hdrTex,
      hdr: K(mkFbo(gl, hdrTex)),
      rw,
      rh,
      reflTex,
      refl: K(mkFbo(gl, reflTex, reflD)),
      aw,
      ah,
      ao1,
      ao2,
      aoF1: K(mkFbo(gl, ao1)),
      aoF2: K(mkFbo(gl, ao2)),
      fogTex,
      fogF: K(mkFbo(gl, fogTex)),
      bl,
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ---------------- uniforms / draw helpers ----------------
  private drawFS(): void {
    this.gl.bindVertexArray(this.empty);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }
  private lightsUni(pr: Program, t: number): void {
    const gl = this.gl;
    gl.uniform4fv(pr.u.uLP, this.LP);
    gl.uniform4fv(pr.u.uLC, this.LC);
    gl.uniform4fv(pr.u.uLD, this.LD);
    gl.uniform1i(pr.u.uNL, this.nLights);
    gl.uniform1f(pr.u.uTime, t);
  }
  private spotUni(pr: Program): void {
    const gl = this.gl,
      u = pr.u;
    gl.uniformMatrix4fv(u.uSM, false, this.spm);
    gl.uniform4fv(u.uSP, this.spp);
    gl.uniform4fv(u.uSD, this.spd);
    gl.uniform4fv(u.uSC, this.spc);
    gl.uniform1i(u.uNS, this.ns);
    gl.uniform1i(u.uShadow, 5);
  }
  private shadowState(on: boolean): void {
    const gl = this.gl;
    if (on) {
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.6, 3);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    } else gl.disable(gl.POLYGON_OFFSET_FILL);
  }
  private shadowDraw(list: DrawItem[]): void {
    const gl = this.gl,
      pr = this.prog.shadow;
    gl.useProgram(pr.p);
    for (let i = 0; i < this.ns; i++) {
      gl.viewport((i % 2) * TILE, (i >> 1) * TILE, TILE, TILE);
      gl.uniformMatrix4fv(pr.u.uLVP, false, this.spv[i]);
      for (const d of list) {
        gl.uniformMatrix4fv(pr.u.uModel, false, d.m);
        gl.bindVertexArray(d.g.vao);
        gl.drawElements(gl.TRIANGLES, d.g.n, gl.UNSIGNED_INT, 0);
      }
    }
  }
  private drawScene(
    VPx: Mat4,
    eyeX: Vec3,
    mirror: number,
    w: number,
    h: number,
    t: number,
    probe = false,
  ): void {
    const gl = this.gl,
      pr = this.prog.main,
      u = pr.u,
      T = this.T!;
    gl.useProgram(pr.p);
    gl.uniformMatrix4fv(u.uVP, false, VPx);
    gl.uniformMatrix4fv(u.uModel, false, M4.ident());
    gl.uniform3fv(u.uEye, eyeX);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform1f(u.uMirror, mirror);
    gl.uniform1f(u.uRain, this.settings.rain);
    gl.uniform1f(u.uWet, clamp(0.55 + this.settings.rain * 0.45, 0, 1));
    this.lightsUni(pr, t);
    this.spotUni(pr);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform1i(u.uAtlas, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mirror || probe ? this.blackTex : T.reflTex);
    gl.uniform1i(u.uRefl, 1);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, probe ? this.dummyCube : this.envTex);
    gl.uniform1i(u.uEnv, 6);
    gl.uniform1f(u.uEnvK, probe || !this.envReady ? 0 : 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(this.GO.vao);
    gl.drawElements(gl.TRIANGLES, this.GO.n, gl.UNSIGNED_INT, 0);
    if (!probe)
      for (const d of this.dynI) {
        gl.uniformMatrix4fv(u.uModel, false, d.m);
        gl.bindVertexArray(d.g.vao);
        gl.drawElements(gl.TRIANGLES, d.g.n, gl.UNSIGNED_INT, 0);
      }
  }
  private captureEnv(t: number): void {
    const gl = this.gl,
      PF = M4.persp(Math.PI / 2, 1, 0.1, 90);
    const faces = [
      [1, 0, 0, 0, -1, 0],
      [-1, 0, 0, 0, -1, 0],
      [0, 1, 0, 0, 0, 1],
      [0, -1, 0, 0, 0, -1],
      [0, 0, 1, 0, -1, 0],
      [0, 0, -1, 0, -1, 0],
    ];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.envF);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.envD);
    gl.viewport(0, 0, ENVS, ENVS);
    faces.forEach((f, i) => {
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        this.envTex,
        0,
      );
      gl.clearColor(...CLEAR);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      this.drawScene(
        M4.mul(
          PF,
          M4.lookAt(ENV_P, [ENV_P[0] + f[0], ENV_P[1] + f[1], ENV_P[2] + f[2]], [f[3], f[4], f[5]]),
        ),
        ENV_P,
        0,
        ENVS,
        ENVS,
        t,
        true,
      );
    });
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.envTex);
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    this.envReady = true;
  }

  // ---------------- input ----------------
  private on<K extends keyof HTMLElementEventMap>(
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ): void {
    this.canvas.addEventListener(type, fn, opts);
    this.unlisten.push(() => this.canvas.removeEventListener(type, fn, opts));
  }
  private stopCruise(): void {
    if (this.settings.cruise) {
      this.settings.cruise = false;
      this.ev.onCruiseChange?.(false);
    }
  }
  private rayHitsDoor(cx: number, cy: number): boolean {
    const r = this.canvas.getBoundingClientRect(),
      x = ((cx - r.left) / r.width) * 2 - 1,
      y = 1 - ((cy - r.top) / r.height) * 2,
      I = this.IVP;
    const un = (v: Vec3): Vec3 => {
      const w = I[3] * v[0] + I[7] * v[1] + I[11] * v[2] + I[15];
      return [0, 1, 2].map(
        (i) => (I[i] * v[0] + I[4 + i] * v[1] + I[8 + i] * v[2] + I[12 + i]) / w,
      );
    };
    const p0 = un([x, y, -1]),
      p1 = un([x, y, 1]),
      d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]],
      b = this.scene.door.box;
    let t0 = 0,
      t1 = 1;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (p0[i] < b[i] || p0[i] > b[i + 3]) return false;
        continue;
      }
      let a = (b[i] - p0[i]) / d[i],
        c = (b[i + 3] - p0[i]) / d[i];
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, c);
      if (t0 > t1) return false;
    }
    return true;
  }
  private bindInput(): void {
    const clampD = (d: number) => clamp(d, 6, 70);
    this.on('contextmenu', (e) => e.preventDefault());
    this.on('pointerdown', (e) => {
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointer */
      }
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button });
      this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.stopCruise();
      if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.goal.dist };
      }
    });
    this.on('pointermove', (e) => {
      const p = this.ptrs.get(e.pointerId);
      if (!p) {
        this.canvas.style.cursor = this.rayHitsDoor(e.clientX, e.clientY) ? 'pointer' : '';
        return;
      }
      const dx = e.clientX - p.x,
        dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      const g = this.goal;
      if (this.ptrs.size === 2 && this.pinch) {
        const [a, b] = [...this.ptrs.values()];
        g.dist = clampD(
          (this.pinch.dist * this.pinch.d) / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        );
        return;
      }
      if (p.b === 2 || p.b === 1 || e.shiftKey) {
        const s = g.dist * 0.0011,
          c = Math.cos(g.yaw),
          sn = Math.sin(g.yaw);
        g.target[0] -= c * dx * s;
        g.target[2] += sn * dx * s;
        g.target[1] = clamp(g.target[1] + dy * s, -0.5, 12);
      } else {
        g.yaw -= dx * 0.005;
        g.pitch = clamp(g.pitch + dy * 0.004, 0.04, 1.42);
      }
    });
    const up = (e: PointerEvent) => {
      this.ptrs.delete(e.pointerId);
      this.pinch = null;
      const d = this.downAt;
      if (
        e.type === 'pointerup' &&
        d &&
        Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 &&
        performance.now() - d.t < 450 &&
        this.rayHitsDoor(e.clientX, e.clientY)
      )
        this.openDoor();
      this.downAt = null;
    };
    this.on('pointerup', up);
    this.on('pointercancel', up);
    this.on(
      'wheel',
      (e) => {
        e.preventDefault();
        this.goal.dist = clampD(this.goal.dist * Math.exp(e.deltaY * 0.0012));
      },
      { passive: false },
    );
    this.on('dblclick', () => this.resetCamera());
  }

  // ---------------- frame ----------------
  private frame = (): void => {
    this.raf = requestAnimationFrame(this.frame);
    if (this.gl.isContextLost()) return;
    const gl = this.gl,
      S = this.settings,
      now = performance.now() / 1000,
      dt = Math.min(0.05, now - this.last),
      t = this.opts.freezeAt ?? now - this.t0;
    this.last = now;
    this.fpsN++;
    this.fpsT += dt;
    if (this.fpsT > 0.5) {
      const f = this.fpsN / this.fpsT;
      this.ev.onFps?.(f);
      // a capture holds full quality, whatever the frame rate
      if (this.opts.freezeAt === undefined) {
        if (f < 32 && this.quality > 0.6) this.quality = Math.max(0.6, this.quality - 0.1);
        else if (f > 55 && this.quality < 1) this.quality = Math.min(1, this.quality + 0.05);
      }
      this.fpsN = 0;
      this.fpsT = 0;
    }
    const dpr = Math.min(devicePixelRatio || 1, 1.75) * this.quality;
    const W = Math.max(2, Math.round(this.canvas.clientWidth * dpr)),
      H = Math.max(2, Math.round(this.canvas.clientHeight * dpr));
    if (!this.T || this.T.W !== W || this.T.H !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
      this.buildTargets(W, H);
    }
    const T = this.T!;

    // camera (smoothed towards goal)
    const cam = this.cam,
      goal = this.goal;
    if (S.cruise) {
      goal.yaw += dt * 0.09;
      goal.pitch += (0.46 + 0.12 * Math.sin(t * 0.21) - goal.pitch) * dt * 0.5;
    }
    const k = 1 - Math.exp(-dt * 7);
    cam.yaw += (goal.yaw - cam.yaw) * k;
    cam.pitch += (goal.pitch - cam.pitch) * k;
    cam.dist = Math.exp(Math.log(cam.dist) + (Math.log(goal.dist) - Math.log(cam.dist)) * k);
    for (let i = 0; i < 3; i++) cam.target[i] += (goal.target[i] - cam.target[i]) * k;
    const cd = cam.dist * Math.max(1, 1.3 / (W / H)),
      cp = Math.cos(cam.pitch);
    const eye: Vec3 = [
      cam.target[0] + cd * cp * Math.sin(cam.yaw),
      cam.target[1] + cd * Math.sin(cam.pitch),
      cam.target[2] + cd * cp * Math.cos(cam.yaw),
    ];
    const P = M4.persp(FOV, W / H, NEAR, FAR),
      V = M4.lookAt(eye, cam.target, [0, 1, 0]),
      VP = M4.mul(P, V);
    const VPm = M4.mul(VP, M4.mirrorY(0)),
      eyeM: Vec3 = [eye[0], -eye[1], eye[2]];
    this.IVP = M4.inv(VP);

    // lights + moving objects
    this.nLights = 0;
    const addL = (l: number[], d?: Vec3, c = -2) => {
      if (this.nLights >= MAXL) return;
      const o = this.nLights * 4;
      this.LP.set([l[0], l[1], l[2], l[3]], o);
      this.LC.set([l[4], l[5], l[6], l[7]], o);
      this.LD.set(d ? [d[0], d[1], d[2], c] : [0, 0, 0, -2], o);
      this.nLights++;
    };
    this.dynI = [];
    this.dynG = [];
    if (S.traffic)
      for (const r of RIDES) {
        const p = ridePos(r, t);
        if (Math.abs(p) > 10.6) continue;
        const m = rideMatrix(r, p, r.m === 'car' ? 0 : 0.015 * Math.sin(t * 9 + r.off)),
          roll = t * r.spd + r.off;
        this.dynI.push({ m, g: this.DY[r.m] });
        if (r.g) this.dynG.push({ m, g: this.DY[r.g] });
        for (const w of r.wheels)
          this.dynI.push({
            m: M4.mul(m, M4.mul(M4.trans(w[0], w[1], w[2]), M4.rotZ(-roll / w[1]))),
            g: this.DY[w[3]],
          });
        if (Math.abs(p) < 9.4) {
          const h = rideAhead(r, p, r.len / 2 + 0.05),
            tl = rideAhead(r, p, -r.len / 2 - 0.35);
          const fw = r.ax === 'x' ? [r.dir, -0.1, 0] : [0, -0.1, r.dir],
            fl = Math.hypot(fw[0], fw[1], fw[2]);
          addL(
            [h[0], r.hy, h[2], 15, r.hk, r.hk * 0.96, r.hk * 0.88, 0],
            fw.map((x) => x / fl),
            Math.cos((r.cone * Math.PI) / 180),
          );
          addL([tl[0], 0.7, tl[2], 2.6, 1.8, 0.08, 0.04, 0]);
        }
      }
    const door = this.door,
      D = this.scene.door;
    if (door.target > 0 && now > door.closeAt) door.target = 0;
    door.o += (door.target - door.o) * Math.min(1, dt * (door.target ? 4.5 : 3));
    const ease = door.o * door.o * (3 - 2 * door.o);
    for (const x of [D.left - ease * D.travel, D.right + ease * D.travel]) {
      const m = M4.trans(x, 0, D.z);
      this.dynI.push({ m, g: this.DY.doorF });
      this.dynG.push({ m, g: this.DY.doorG });
    }
    for (const l of this.scene.lights) addL(l);

    // 0) shadow atlas: copy static depth, then add the moving objects
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.shStatic.f);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.shDyn.f);
    gl.blitFramebuffer(0, 0, SHS, SHS, 0, 0, SHS, SHS, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shDyn.f);
    this.shadowState(true);
    this.shadowDraw(this.dynI);
    this.shadowState(false);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this.shDyn.t);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(true);
    if (!this.envReady) this.captureEnv(t);

    // 1) planar reflection of the wet ground
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.refl);
    gl.viewport(0, 0, T.rw, T.rh);
    gl.clearColor(...CLEAR);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawScene(VPm, eyeM, 1, T.rw, T.rh, t);
    gl.bindTexture(gl.TEXTURE_2D, T.reflTex);
    gl.generateMipmap(gl.TEXTURE_2D);
    // 2) opaque scene → MSAA, resolve colour + depth
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.ms);
    gl.viewport(0, 0, W, H);
    gl.clearColor(...CLEAR);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawScene(VP, eye, 0, W, H, t);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.ms);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.scene);
    gl.blitFramebuffer(
      0,
      0,
      W,
      H,
      0,
      0,
      W,
      H,
      gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
      gl.NEAREST,
    );
    // 3) glass with raindrop refraction
    const pg = this.prog.glass;
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.ms);
    gl.useProgram(pg.p);
    gl.uniformMatrix4fv(pg.u.uVP, false, VP);
    gl.uniformMatrix4fv(pg.u.uModel, false, M4.ident());
    gl.uniform3fv(pg.u.uEye, eye);
    gl.uniform2f(pg.u.uRes, W, H);
    gl.uniform1f(pg.u.uRain, S.rain);
    this.lightsUni(pg, t);
    this.spotUni(pg);
    gl.uniform1i(pg.u.uEnv, 6);
    gl.uniform1f(pg.u.uEnvK, this.envReady ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, T.sceneTex);
    gl.uniform1i(pg.u.uScene, 0);
    gl.bindVertexArray(this.GG.vao);
    gl.drawElements(gl.TRIANGLES, this.GG.n, gl.UNSIGNED_INT, 0);
    for (const d of this.dynG) {
      gl.uniformMatrix4fv(pg.u.uModel, false, d.m);
      gl.bindVertexArray(d.g.vao);
      gl.drawElements(gl.TRIANGLES, d.g.n, gl.UNSIGNED_INT, 0);
    }
    // 4) rain streaks + ground splashes (additive)
    if (S.rain > 0) {
      const pr = this.prog.rain,
        rk = Math.min(S.rain, 1.5);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.useProgram(pr.p);
      gl.uniformMatrix4fv(pr.u.uVP, false, VP);
      gl.uniform3fv(pr.u.uEye, eye);
      gl.uniform1f(pr.u.uRain, S.rain);
      gl.uniform1f(pr.u.uPx, (2 * Math.tan(FOV / 2)) / H);
      this.lightsUni(pr, t);
      this.spotUni(pr);
      gl.bindVertexArray(this.empty);
      gl.uniform1i(pr.u.uMode, 0);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.ceil(6500 * rk));
      gl.uniform1i(pr.u.uMode, 1);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.ceil(1600 * rk));
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.ms);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.hdr);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.disable(gl.DEPTH_TEST);
    // 5) SSAO (half res) + depth-aware blur
    gl.viewport(0, 0, T.aw, T.ah);
    if (S.ao) {
      const pa = this.prog.ao,
        pb = this.prog.aoBlur;
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.aoF1);
      gl.useProgram(pa.p);
      gl.uniformMatrix4fv(pa.u.uP, false, P);
      gl.uniformMatrix4fv(pa.u.uIP, false, M4.inv(P));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, T.depthTex);
      gl.uniform1i(pa.u.uDepth, 0);
      this.drawFS();
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.aoF2);
      gl.useProgram(pb.p);
      gl.uniform2f(pb.u.uTexel, 1 / T.aw, 1 / T.ah);
      gl.uniform1f(pb.u.uNear, NEAR);
      gl.uniform1f(pb.u.uFar, FAR);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, T.ao1);
      gl.uniform1i(pb.u.uAO, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, T.depthTex);
      gl.uniform1i(pb.u.uDepth, 1);
      this.drawFS();
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.aoF2);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // 5b) volumetric haze with shadowed light shafts (half res)
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fogF);
    gl.viewport(0, 0, T.aw, T.ah);
    if (S.fog > 0) {
      const pf = this.prog.fog;
      gl.useProgram(pf.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, T.depthTex);
      gl.uniform1i(pf.u.uDepth, 0);
      gl.uniformMatrix4fv(pf.u.uIVP, false, this.IVP);
      gl.uniform3fv(pf.u.uEye, eye);
      gl.uniform1f(pf.u.uFog, S.fog * (0.7 + 0.3 * Math.min(S.rain, 1)));
      this.lightsUni(pf, t);
      this.spotUni(pf);
      this.drawFS();
    } else {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // 6) bloom: 13-tap down chain, tent up chain
    const pd = this.prog.down,
      pu = this.prog.up;
    gl.useProgram(pd.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(pd.u.uSrc, 0);
    gl.uniform1f(pd.u.uThr, 1.0);
    for (let i = 0; i < BLV; i++) {
      const b = T.bl[i],
        src = i ? T.bl[i - 1] : { tex: T.hdrTex, w: W, h: H };
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb);
      gl.viewport(0, 0, b.w, b.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(pd.u.uTexel, 1 / src.w, 1 / src.h);
      gl.uniform1i(pd.u.uPre, i ? 0 : 1);
      this.drawFS();
    }
    gl.useProgram(pu.p);
    gl.uniform1i(pu.u.uSrc, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = BLV - 2; i >= 0; i--) {
      const b = T.bl[i],
        s = T.bl[i + 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb);
      gl.viewport(0, 0, b.w, b.h);
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      gl.uniform2f(pu.u.uTexel, 1 / s.w, 1 / s.h);
      this.drawFS();
    }
    gl.disable(gl.BLEND);
    // 7) composite: AO · haze · bloom · ACES · grade · vignette · grain
    const pc = this.prog.comp;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(pc.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, T.hdrTex);
    gl.uniform1i(pc.u.uHDR, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, T.bl[0].tex);
    gl.uniform1i(pc.u.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, T.ao2);
    gl.uniform1i(pc.u.uAO, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, T.fogTex);
    gl.uniform1i(pc.u.uFogT, 3);
    gl.uniform1f(pc.u.uExp, S.exposure);
    gl.uniform1f(pc.u.uBloomK, S.bloom);
    gl.uniform1f(pc.u.uAOK, S.ao ? 0.85 : 0);
    gl.uniform1f(pc.u.uTime, t);
    gl.uniform2f(pc.u.uRes, W, H);
    this.drawFS();
    gl.activeTexture(gl.TEXTURE0);
    if (!this.readySent) {
      this.readySent = true;
      this.ev.onReady?.();
    }
  };
}
