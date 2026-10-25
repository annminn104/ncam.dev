import { BackSide, Color } from 'three';

export const skyUniforms = {
  uTop: { value: new Color('#6fb7ff') },
  uBottom: { value: new Color('#dff1ff') },
};

export const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(mix(uBottom, uTop, smoothstep(0.45, 0.9, h)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Gradient sky dome; TimeOfDay drives its colors. */
export function Sky() {
  return (
    <mesh scale={250} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        uniforms={skyUniforms}
        vertexShader={SKY_VERTEX}
        fragmentShader={SKY_FRAGMENT}
      />
    </mesh>
  );
}
