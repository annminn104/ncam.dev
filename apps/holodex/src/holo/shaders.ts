export const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Composites three things over the card art:
 *  - a refraction offset that shifts the foil sample with the viewing angle,
 *    so the foil appears to sit under the card's surface;
 *  - a glare lobe that tracks the pointer;
 *  - a specular streak that sweeps as the card tilts.
 * Tier intensity scales the whole foil contribution, so a Common gets nothing
 * but the art and a soft highlight.
 */
export const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uCard;
  uniform sampler2D uFoil;
  uniform vec2 uPointer;    // -1..1, card space
  uniform float uTime;      // seconds
  uniform float uIntensity; // 0..1 from the rarity tier
  varying vec2 vUv;

  void main() {
    vec4 art = texture2D(uCard, vUv);

    // Refraction: the foil sample slides against the art with the tilt.
    vec2 shift = uPointer * 0.06;
    vec2 foilUv = fract(vUv * vec2(1.6, 1.0) + shift + vec2(uTime * 0.01, 0.0));
    vec3 foil = texture2D(uFoil, foilUv).rgb;

    // Split the channels slightly for a prismatic edge.
    float r = texture2D(uFoil, foilUv + vec2(0.004, 0.0)).r;
    float b = texture2D(uFoil, foilUv - vec2(0.004, 0.0)).b;
    foil = vec3(r, foil.g, b);

    // Glare lobe following the pointer.
    vec2 centred = vUv * 2.0 - 1.0;
    float glare = pow(max(0.0, 1.0 - length(centred - uPointer) * 0.9), 3.0);

    // Specular streak that sweeps across as the card leans.
    float streak = smoothstep(0.35, 0.0, abs(centred.x * 0.8 + centred.y * 0.6 - uPointer.x));

    // Foil only shows where the art has something to catch the light.
    float luma = dot(art.rgb, vec3(0.299, 0.587, 0.114));
    float mask = smoothstep(0.15, 0.85, luma);

    vec3 colour = art.rgb;
    colour += foil * mask * uIntensity * (0.25 + glare * 0.9);
    colour += vec3(streak) * uIntensity * 0.18;
    colour += vec3(glare) * 0.10;

    gl_FragColor = vec4(colour, art.a);
  }
`;
