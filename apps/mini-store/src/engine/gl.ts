// Thin typed helpers over WebGL2: programs, mesh upload, textures, framebuffers.
import type { Mat4 } from './math';
import { VS, type Mesh } from './mesh';

export interface Program {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}
export interface GpuMesh {
  vao: WebGLVertexArrayObject;
  n: number;
  tris: number;
  bufs: WebGLBuffer[];
}
export interface DrawItem {
  m: Mat4;
  g: GpuMesh;
}

export class GLError extends Error {
  override name = 'GLError';
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new GLError("The graphics driver couldn't create a shader.");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) || '';
    console.error(
      log +
        '\n' +
        src
          .split('\n')
          .map((l, i) => i + 1 + ': ' + l)
          .join('\n'),
    );
    throw new GLError('A shader failed to compile on this device.');
  }
  return s;
}

export function program(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const p = gl.createProgram();
  if (!p) throw new GLError("The graphics driver couldn't create a shader program.");
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p) ?? '');
    throw new GLError('A shader failed to link on this device.');
  }
  const u: Program['u'] = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number; i < n; i++) {
    const a = gl.getActiveUniform(p, i);
    if (a) u[a.name.replace('[0]', '')] = gl.getUniformLocation(p, a.name);
  }
  return { p, u };
}

/** interleaved pos3 nrm3 uv2 col3 mat4 + 32-bit indices */
export function upload(gl: WebGL2RenderingContext, mesh: Mesh): GpuMesh {
  const d = mesh.pack(),
    vao = gl.createVertexArray()!,
    vb = gl.createBuffer()!,
    ib = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, d.v, gl.STATIC_DRAW);
  for (const [l, n, o] of [
    [0, 3, 0],
    [1, 3, 12],
    [2, 2, 24],
    [3, 3, 32],
    [4, 4, 44],
  ]) {
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, n, gl.FLOAT, false, VS * 4, o);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.i, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, n: d.i.length, tris: d.i.length / 3, bufs: [vb, ib] };
}

export function setTex(
  gl: WebGL2RenderingContext,
  t: WebGLTexture,
  min: number,
  mag: number,
): void {
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export function mkTex(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  ifmt: number,
  fmt: number,
  type: number,
  filter: number,
  mips = false,
): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  if (mips) gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, ifmt, w, h);
  else gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
  setTex(gl, t, mips ? gl.LINEAR_MIPMAP_LINEAR : filter, filter);
  return t;
}

export function mkFbo(
  gl: WebGL2RenderingContext,
  color: WebGLTexture | null,
  depth?: WebGLTexture | WebGLRenderbuffer | null,
  depthIsTex = false,
): WebGLFramebuffer {
  const f = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  if (color) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  if (depth) {
    if (depthIsTex)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D,
        depth as WebGLTexture,
        0,
      );
    else
      gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.RENDERBUFFER,
        depth as WebGLRenderbuffer,
      );
  }
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) console.warn('FBO incomplete', st);
  return f;
}

export function mkRb(
  gl: WebGL2RenderingContext,
  fmt: number,
  w: number,
  h: number,
  samples: number,
): WebGLRenderbuffer {
  const r = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, r);
  if (samples > 0) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, fmt, w, h);
  else gl.renderbufferStorage(gl.RENDERBUFFER, fmt, w, h);
  return r;
}
