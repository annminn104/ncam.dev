import { useFrame } from '@react-three/fiber';
import { useContext, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Fog,
} from 'three';
import { QualityContext } from '../../quality';
import { own } from '../dispose';
import { seeded } from './textures';

// The parts every arena is built from. Each arena owns its sky, fog, lights and ambient effects;
// the chess pieces keep their own studio reflections (materials.ts), so an arena reaches them
// through its lights: the key's colour and direction, the hemisphere's sky and ground, the fog.

/** A direction from an azimuth (degrees, 0 = +x, 90 = +z, the white player) and an elevation. */
export function direction(azimuth: number, elevation: number): [number, number, number] {
  const a = (azimuth * Math.PI) / 180;
  const e = (elevation * Math.PI) / 180;
  return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
}

/**
 * Linear fog measured from the board rather than from the camera: it starts `near` past the
 * board's centre and is total `far` past it. A phone held upright pulls the camera back three
 * times as far (rig-math's framingFit), so fog fixed in world units would swallow the board
 * there; this keeps the board clear and the distance hazy at every zoom.
 */
export function ArenaFog({ color, near, far }: { color: string; near: number; far: number }) {
  const fog = useRef<Fog>(null);
  useFrame(({ camera }) => {
    const f = fog.current;
    if (!f) return;
    // The rig always looks at the origin (it has no pan), so this is the distance to the board.
    const d = camera.position.length();
    f.near = d + near;
    f.far = d + far;
  });
  return <fog ref={fog} attach="fog" args={[color, near, far]} />;
}

/**
 * The shadow-casting key light. Its shadow frustum covers the board and the tallest piece; a weak
 * GPU ('low') gets a quarter of the shadow map.
 */
export function KeyLight(props: {
  position: [number, number, number];
  color: string;
  intensity: number;
}) {
  const quality = useContext(QualityContext);
  const size = quality === 'high' ? 2048 : 1024;
  return (
    <directionalLight
      {...props}
      castShadow
      shadow-mapSize={[size, size]}
      shadow-camera-left={-7.5}
      shadow-camera-right={7.5}
      shadow-camera-top={7.5}
      shadow-camera-bottom={-7.5}
      shadow-camera-near={1}
      shadow-camera-far={40}
      shadow-bias={-0.0004}
    />
  );
}

export interface SkyLook {
  /** The sky at and below the horizon: the arena's fog and clear colour, so they meet unseen. */
  horizon: string;
  zenith: string;
  /** How fast the zenith colour takes over going up: 1 is linear, higher is sooner. */
  curve: number;
  /** A broad glow round a direction (the sun's or the moon's light in the air). */
  glow?: { dir: [number, number, number]; color: string; power: number; strength: number };
  /** A second glow: the last of the sunset opposite the moon. */
  afterglow?: { dir: [number, number, number]; color: string; power: number; strength: number };
  /** A sun or moon disc (radius in degrees) with a tight halo of its own colour. */
  disc?: { dir: [number, number, number]; color: string; radius: number; halo: number };
  /** Star density, 0..1. */
  stars?: number;
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4( position, 1.0 );
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
  // Pinned to the far plane: behind everything, whatever the dome's radius. The lake's mirror
  // pass skews its far plane (an oblique near plane cuts at the water), which would otherwise
  // slice the dome off in the reflection.
  gl_Position.z = gl_Position.w;
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform float uCurve;
uniform vec3 uGlowDir;
uniform vec3 uGlowColor;
uniform float uGlowPower;
uniform vec3 uAfterDir;
uniform vec3 uAfterColor;
uniform float uAfterPower;
uniform vec3 uDiscDir;
uniform vec3 uDiscColor;
uniform float uDiscCos;
uniform float uHalo;
uniform float uStars;
uniform float uTime;
varying vec3 vWorld;

float skyHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
}

void main() {
  // From the eye, not the dome's centre: the reflector's mirrored camera sees a mirrored sky.
  vec3 dir = normalize( vWorld - cameraPosition );
  float up = max( dir.y, 0.0 );
  // Eases out of the horizon with a finite slope: no crease where the fogged ground meets it.
  vec3 col = mix( uHorizon, uZenith, 1.0 - pow( 1.0 - up, uCurve ) );
  // The glows rise out of the haze: at the horizon itself the sky is exactly the fog colour,
  // as the ground running into it is.
  float aboveHaze = smoothstep( -0.01, 0.12, dir.y );
  col += uGlowColor * pow( max( dot( dir, uGlowDir ), 0.0 ), uGlowPower ) * aboveHaze;
  col += uAfterColor * pow( max( dot( dir, uAfterDir ), 0.0 ), uAfterPower ) * aboveHaze;

  if ( uStars > 0.0 && dir.y > 0.0 ) {
    // One candidate star per cell of a ~1 degree latitude-longitude grid.
    vec2 g = vec2( atan( dir.z, dir.x ), asin( dir.y ) ) * 60.0;
    vec2 cell = floor( g );
    if ( skyHash( cell ) < uStars * 0.16 ) {
      vec2 at = vec2( skyHash( cell + 17.0 ), skyHash( cell + 41.0 ) ) * 0.7 + 0.15;
      float b = skyHash( cell + 7.0 );
      float twinkle = 0.7 + 0.3 * sin( uTime * ( 0.8 + 2.0 * b ) + b * 40.0 );
      float star = smoothstep( 0.1 + 0.08 * b, 0.0, length( fract( g ) - at ) );
      col += vec3( 0.95, 0.93, 1.0 ) * star * ( 0.3 + 0.7 * b ) * twinkle * smoothstep( 0.03, 0.22, dir.y );
    }
  }

  float c = dot( dir, uDiscDir );
  col += uDiscColor * pow( max( c, 0.0 ), uHalo ) * 0.5 * aboveHaze;
  // A soft edge a few pixels wide (no disc: uDiscCos is 2, out of reach).
  float edge = 0.08 * max( 1.0 - uDiscCos, 0.0 ) + 0.00004;
  col = mix( col, uDiscColor, smoothstep( uDiscCos - edge, uDiscCos + edge, c ) );

  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const NONE = new Vector3(0, -1, 0);

/**
 * The sky: a gradient dome with an optional glow, sun or moon and stars, all in one shader, so
 * it costs one draw call and nothing to load. Unfogged and not tone mapped, so its horizon is
 * exactly the fog colour. Below the horizon it stays the horizon colour, wherever the arena's
 * ground runs out.
 */
export function SkyDome({ look }: { look: SkyLook }) {
  const material = useMemo(() => {
    const v = (d?: [number, number, number]) => (d ? new Vector3(...d).normalize() : NONE.clone());
    const discCos = look.disc ? Math.cos((look.disc.radius * Math.PI) / 180) : 2;
    return own(
      new ShaderMaterial({
        uniforms: {
          uHorizon: { value: new Color(look.horizon) },
          uZenith: { value: new Color(look.zenith) },
          uCurve: { value: look.curve },
          uGlowDir: { value: v(look.glow?.dir) },
          uGlowColor: {
            value: new Color(look.glow?.color ?? '#000').multiplyScalar(look.glow?.strength ?? 0),
          },
          uGlowPower: { value: look.glow?.power ?? 1 },
          uAfterDir: { value: v(look.afterglow?.dir) },
          uAfterColor: {
            value: new Color(look.afterglow?.color ?? '#000').multiplyScalar(
              look.afterglow?.strength ?? 0,
            ),
          },
          uAfterPower: { value: look.afterglow?.power ?? 1 },
          uDiscDir: { value: v(look.disc?.dir) },
          uDiscColor: { value: new Color(look.disc?.color ?? '#000') },
          uDiscCos: { value: discCos },
          uHalo: { value: look.disc?.halo ?? 1 },
          uStars: { value: look.stars ?? 0 },
          uTime: { value: 0 },
        },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
  }, [look]);
  // Larger than the farthest camera (rig-math's ORBIT on a narrow phone), so the eye is inside.
  const geometry = useMemo(() => own(new SphereGeometry(300, 48, 24)), []);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });
  // Drawn after the opaque scene, so only the pixels nothing else covered pay for its shader.
  return <mesh geometry={geometry} material={material} renderOrder={1} frustumCulled={false} />;
}

/** Drifting motes of light: embers rising off the lava, fireflies over the lake. */
export interface MotesLook {
  count: { high: number; low: number };
  seed: number;
  /** Annulus round the board they wander in, and the height band they live in. */
  radius: [min: number, max: number];
  y: [bottom: number, span: number];
  /** Rise speed (world units per second); 0 keeps them hovering. */
  rise: number;
  sway: number;
  /** World-space size. */
  size: number;
  color: string;
  /** 0 = steady, 1 = fireflies, blinking out and back. */
  blink: number;
}

const MOTES_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uRise;
uniform float uSpan;
uniform float uSway;
uniform float uSize;
uniform float uScale;
uniform float uBlink;
attribute vec2 aMote;
varying float vAlpha;
void main() {
  vec3 p = position;
  // aMote.x is the mote's phase, aMote.y its own pace. Rising motes wrap round their band.
  float life = fract( aMote.x + uTime * uRise * aMote.y / uSpan );
  p.y += life * uSpan;
  float w = uTime * ( 0.35 + 0.5 * aMote.y ) + aMote.x * 6.2832;
  p.x += sin( w ) * uSway;
  p.z += cos( w * 0.8 ) * uSway;
  p.y += sin( w * 1.3 ) * uSway * 0.4;
  float fade = uRise > 0.0 ? smoothstep( 0.0, 0.12, life ) * ( 1.0 - smoothstep( 0.55, 1.0, life ) ) : 1.0;
  float blink = pow( 0.5 + 0.5 * sin( uTime * ( 0.7 + aMote.y ) + aMote.x * 31.0 ), 3.0 );
  vAlpha = fade * mix( 1.0, 0.1 + 0.9 * blink, uBlink );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max( 1.5, uSize * uScale / -mv.z );
}`;

const MOTES_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length( gl_PointCoord - 0.5 ) * 2.0;
  float a = pow( max( 0.0, 1.0 - d ), 1.6 ) * vAlpha;
  gl_FragColor = vec4( uColor * a, 1.0 );
  #include <colorspace_fragment>
}`;

/** Where the motes start ([x, bottom, z] each) and their [phase, pace]: seeded, so stable. */
export function motePlacements(look: MotesLook, count: number) {
  const rand = seeded(look.seed);
  const position = new Float32Array(count * 3);
  const mote = new Float32Array(count * 2);
  const [r0, r1] = look.radius;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    // Uniform over the annulus's area, not bunched at its inner edge.
    const r = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0));
    position.set([Math.cos(a) * r, look.y[0], Math.sin(a) * r], i * 3);
    mote.set([rand(), 0.6 + rand() * 0.8], i * 2);
  }
  return { position, mote };
}

export function Motes({ look }: { look: MotesLook }) {
  const quality = useContext(QualityContext);
  const count = look.count[quality];
  const geometry = useMemo(() => {
    const { position, mote } = motePlacements(look, count);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(position, 3));
    g.setAttribute('aMote', new Float32BufferAttribute(mote, 2));
    return own(g);
  }, [look, count]);
  const material = useMemo(
    () =>
      own(
        new ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uRise: { value: look.rise },
            uSpan: { value: look.y[1] },
            uSway: { value: look.sway },
            uSize: { value: look.size },
            uScale: { value: 1 },
            uBlink: { value: look.blink },
            uColor: { value: new Color(look.color) },
          },
          vertexShader: MOTES_VERTEX,
          fragmentShader: MOTES_FRAGMENT,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
        }),
      ),
    [look],
  );
  useFrame(({ clock, size, viewport, camera }) => {
    const u = material.uniforms;
    u.uTime.value = clock.elapsedTime;
    // Pixels per world unit at distance 1, so a mote keeps its world size at any resolution.
    const fov = 'fov' in camera ? (camera.fov as number) : 40;
    u.uScale.value = (size.height * viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
  });
  // Their bounding sphere would be that of the start positions; they wander off it.
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
