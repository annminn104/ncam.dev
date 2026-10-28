import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  NormalBlending,
  type Object3D,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  ShaderLib,
  ShaderMaterial,
  SpotLight,
  Texture,
  type WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { describe, expect, it } from 'vitest';
import { feedKoi, KOI_RENDER_ORDER, koiFoodOf, koiHunger } from '../systems/koi';
import { WATER_STYLES } from '../systems/water';
import {
  GLASS_ENV_INTENSITY,
  GLASS_RENDER_ORDER,
  glowFalloff,
  prepareModule,
} from './prepareModule';

function mesh(
  name: string,
  geometry = new BufferGeometry(),
  material = new MeshStandardMaterial(),
): Mesh {
  const m = new Mesh(geometry, material);
  m.name = name;
  return m;
}

describe('prepareModule', () => {
  it('enables shadows on ordinary meshes', () => {
    const rock = mesh('Rock');
    const root = new Group();
    root.add(rock);
    prepareModule(root);
    expect([rock.castShadow, rock.receiveShadow]).toEqual([true, true]);
  });

  it('casts no shadow from an object exported with cast_shadow = false, though it still receives one', () => {
    // The flat or tiny merged objects of the garden (paving, flower beds, rim tufts): their shadow pass cost frames.
    const paving = mesh('Paving');
    paving.userData.cast_shadow = false;
    const beds = new Group();
    beds.userData.name = 'Flower_beds'; // a multi-material object: its node is the Group
    beds.userData.cast_shadow = false;
    const bed = mesh('Flower_beds_1');
    beds.add(bed);
    const tufts = mesh('Rim_tufts');
    tufts.userData.cast_shadow = 0; // how Blender may store a bool
    const rock = mesh('Rock');
    const root = new Group();
    root.add(paving, beds, tufts, rock);
    prepareModule(root);
    for (const flat of [paving, bed, tufts])
      expect([flat.castShadow, flat.receiveShadow]).toEqual([false, true]);
    expect(rock.castShadow).toBe(true);
  });

  it('draws GLOW_* light pools additively over the ground, unlit by shadows and hidden until the night drives them', () => {
    const pool = new MeshStandardMaterial({ emissive: 0xffb070, emissiveIntensity: 1.5 });
    pool.name = 'GLOW_pool';
    const lamps = new Group();
    lamps.userData.name = 'Garden_lamps';
    lamps.userData.night_light = true;
    const body = mesh('Garden_lamps_1');
    const disc = mesh('Garden_lamps_2', undefined, pool);
    lamps.add(body, disc);
    const root = new Group();
    root.add(lamps);
    const { nightMaterials } = prepareModule(root);
    const glow = disc.material as MeshStandardMaterial;
    expect(glow).not.toBe(pool);
    expect(nightMaterials).toContain(glow);
    expect(glow.userData.glow).toBe(true);
    expect([glow.blending, glow.transparent, glow.depthWrite, glow.forceSinglePass]).toEqual([
      AdditiveBlending,
      true,
      false,
      true,
    ]);
    expect(glow.alphaMap).toBe(glowFalloff()); // no texture of its own: the falloff runs along its UVs
    expect([glow.visible, glow.opacity, glow.emissiveIntensity]).toEqual([false, 0, 1.5]); // the opacity follows the night
    expect([disc.castShadow, disc.receiveShadow]).toEqual([false, false]);
    expect([body.receiveShadow, (body.material as MeshStandardMaterial).blending]).toEqual([
      true,
      NormalBlending,
    ]);
  });

  it('fades a light pool from opaque at its centre (u 0) to clear at its rim (u 1)', () => {
    const map = glowFalloff();
    const { data, width } = map.image as { data: Uint8Array; width: number };
    const alpha = Array.from({ length: width }, (_, i) => data[4 * i + 1]); // three reads an alphaMap's green channel
    expect(alpha[0]).toBe(255);
    expect(alpha[width - 1]).toBe(0);
    for (let i = 1; i < width; i++) expect(alpha[i]).toBeLessThanOrEqual(alpha[i - 1]);
    expect(glowFalloff()).toBe(map); // one map shared by every pool
  });

  it('swaps WATER_* to the water shader without casting shadows', () => {
    const water = mesh('WATER_surface');
    const root = new Group();
    root.add(water);
    prepareModule(root);
    expect(water.material).toBeInstanceOf(ShaderMaterial);
    expect((water.material as ShaderMaterial).name).toBe('water');
    expect(water.castShadow).toBe(false);
  });

  it("gives a WATER_* node the water style its extras name, the pool's otherwise", () => {
    const pond = mesh('WATER_surface');
    pond.userData.water = 'pond';
    const pool = mesh('WATER_pool');
    const odd = mesh('WATER_odd');
    odd.userData.water = 'lava';
    const root = new Group();
    root.add(pond, pool, odd);
    prepareModule(root);
    const shallow = (m: Mesh) => (m.material as ShaderMaterial).uniforms.uShallow.value;
    expect(shallow(pond)).toEqual(WATER_STYLES.pond.shallow);
    expect(shallow(pool)).toEqual(WATER_STYLES.pool.shallow);
    expect(shallow(odd)).toEqual(WATER_STYLES.pool.shallow); // an unknown style falls back to the pool's
  });

  it('turns COLOR_0 into windWeight and patches the material', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    geometry.setAttribute(
      'color',
      new BufferAttribute(new Float32Array([1, 0, 0, 0.5, 0, 0, 0, 0, 0]), 3),
    );
    const material = new MeshStandardMaterial({ vertexColors: true });
    const root = new Group();
    root.add(mesh('Reeds', geometry, material));
    prepareModule(root);
    expect(geometry.getAttribute('color')).toBeUndefined();
    expect(Array.from(geometry.getAttribute('windWeight').array)).toEqual([1, 0.5, 0]);
    expect(material.vertexColors).toBe(false);
    expect(material.userData.windPatched).toBe(true);
  });

  it('clones night-light materials and starts them dark', () => {
    const material = new MeshStandardMaterial({ emissiveIntensity: 4 });
    const bulb = mesh('Lamp_bulb', undefined, material);
    bulb.userData.night_light = true;
    const root = new Group();
    root.add(bulb);
    const { nightMaterials } = prepareModule(root);
    expect(nightMaterials).toHaveLength(1);
    expect(bulb.material).not.toBe(material);
    expect(nightMaterials[0].userData.baseEmissive).toBe(4);
    expect(nightMaterials[0].emissiveIntensity).toBe(0);
    expect(bulb.castShadow).toBe(false);
  });

  it('honours night_light on a multi-material parent group', () => {
    const group = new Group();
    group.userData.name = 'Lamp_bulb'; // GLTFLoader records the glTF node name here
    group.userData.night_light = true;
    group.add(mesh('Lamp_bulb_0'));
    const root = new Group();
    root.add(group);
    expect(prepareModule(root).nightMaterials).toHaveLength(1);
  });

  it('sets the koi up to swim in the koi shader, drawn after the water, never culled, casting no shadow', () => {
    // The pond's Koi node as GLTFLoader leaves it: a Group (the quantized node, its matrix the dequantization) carrying
    // the loops in its extras, a Mesh per colour whose fish are numbered by the "koi" UV map (TEXCOORD_1, three's uv1).
    const koi = new Group();
    koi.userData = {
      name: 'Koi',
      koi: [1, 2, 2, 1, 0, -0.3, 0.6, 0, 0, 0.01, 0, 0],
      koi_water: -0.07,
      cast_shadow: false,
    };
    koi.scale.set(3, 3, 3);
    koi.position.set(0.5, -0.2, 0.1);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    geometry.setAttribute(
      'uv1',
      new BufferAttribute(new Float32Array([1 / 32, 0, 1 / 32, 0, 1 / 32, 0]), 2),
    );
    const orange = new MeshStandardMaterial();
    const body = mesh('Koi_1', geometry, orange);
    koi.add(body);
    const root = new Group();
    root.add(koi);
    prepareModule(root);
    const material = body.material as MeshStandardMaterial;
    expect(material).not.toBe(orange); // its own clone: the shader patch must not reach other meshes of the material
    expect(material.userData.koi).toBe(true);
    expect([material.transparent, body.renderOrder, body.frustumCulled]).toEqual([
      true,
      KOI_RENDER_ORDER,
      false,
    ]);
    expect(body.renderOrder).toBeGreaterThan(0); // the water draws at 0
    expect(body.castShadow).toBe(false);
    expect(geometry.getAttribute('koiFish').getX(0)).toBeCloseTo(1 / 32, 6);
    expect(geometry.getAttribute('uv1')).toBeUndefined();
    expect(material.customProgramCacheKey()).toBe('koi');
  });

  it("hands the koi's uniforms back, unfed, and keeps the fish out of the pointer's way", () => {
    const koi = new Group();
    koi.userData = {
      name: 'Koi',
      koi: [1, 2, 2, 1, 0, -0.3, 0.6, 0, 0, 0.01, 0, 0],
      koi_water: -0.07,
    };
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    const body = mesh('Koi_1', geometry);
    koi.add(body);
    const root = new Group();
    root.add(koi);
    const prepared = prepareModule(root);
    expect(prepared.koi).toHaveLength(1);
    expect(prepared.koi[0].uniforms.uKoiFeed.value.w).toBe(0);
    expect(prepared.koi[0].loops).toHaveLength(1);
    const hits: unknown[] = [];
    body.raycast(new Raycaster(), hits as never);
    expect(hits).toEqual([]); // drawn where the shader swims them, not where they were built: the water takes the click
    expect(prepareModule(new Group()).koi).toEqual([]);
  });

  it("drops the food a click put on the pond in its feeding disc, in the module's space; food thrown again glides there", () => {
    const koi = new Group();
    koi.userData = {
      name: 'Koi',
      koi: [1, 2, 2, 1, 0, -0.3, 0.6, 0, 0, 0.01, 0, 0],
      koi_water: -0.07,
      koi_feed: [1, 2, 1.5],
    };
    koi.add(mesh('Koi_1'));
    const root = new Group();
    root.add(koi);
    const slot = new Group();
    slot.position.set(9, 0, 11); // the koi pond's slot: Blender (9, -11)
    slot.add(root);
    const prepared = prepareModule(root);
    expect(prepared.koi[0].feed).toEqual({ centre: [1, 2], radius: 1.5 });
    slot.updateMatrixWorld(true);
    feedKoi(prepared, root, { point: [13, -0.07, 9], at: 30 }); // Blender (13, -9): module (4, 2), east of the disc
    const feed = prepared.koi[0].uniforms.uKoiFeed.value;
    expect([feed.z, feed.w]).toEqual([30, 1]);
    expect([feed.x, feed.y]).toEqual([expect.closeTo(2.5, 6), expect.closeTo(2, 6)]); // on the disc's east rim
    expect(koiFoodOf(prepared.koi[0].uniforms)).toMatchObject({
      from: [feed.x, feed.y],
      start: 30,
    });
    // a second click at 34 s, on (1, 2.5): the rings glide there from the first food, the koi as fed as they were
    feedKoi(prepared, root, { point: [10, -0.07, 8.5], at: 34 });
    const again = koiFoodOf(prepared.koi[0].uniforms)!;
    expect([again.x, again.y, again.at]).toEqual([
      expect.closeTo(1, 6),
      expect.closeTo(2.5, 6),
      34,
    ]);
    expect(again.from).toEqual([expect.closeTo(2.5, 6), expect.closeTo(2, 6)]);
    expect(koiHunger(34 - again.start)).toBeCloseTo(koiHunger(34 - 30), 9);
  });

  it("dims the foam at the foot of falling water with the night (a *_foam node: the waterfall's)", () => {
    const foam = mesh('Waterfall_foam');
    const stone = mesh('Pond_stones');
    const root = new Group();
    root.add(foam, stone);
    prepareModule(root);
    expect((foam.material as MeshStandardMaterial).customProgramCacheKey()).toBe('foam-night');
    expect((stone.material as MeshStandardMaterial).customProgramCacheKey()).not.toBe('foam-night');
  });

  it('feeds no koi whose object carries no feeding disc', () => {
    const koi = new Group();
    koi.userData = {
      name: 'Koi',
      koi: [1, 2, 2, 1, 0, -0.3, 0.6, 0, 0, 0.01, 0, 0],
      koi_water: -0.07,
    };
    koi.add(mesh('Koi_1'));
    const root = new Group();
    root.add(koi);
    const prepared = prepareModule(root);
    expect(prepared.koi[0].feed).toBeNull();
    feedKoi(prepared, root, { point: [0, -0.07, 0], at: 30 });
    expect(prepared.koi[0].uniforms.uKoiFeed.value.w).toBe(0);
  });

  it('keeps wind on night-light meshes', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    geometry.setAttribute(
      'color',
      new BufferAttribute(new Float32Array([1, 0, 0, 0.5, 0, 0, 0, 0, 0]), 3),
    );
    const bulb = mesh('Lamp_bulb', geometry, new MeshStandardMaterial({ vertexColors: true }));
    bulb.userData.night_light = true;
    const root = new Group();
    root.add(bulb);
    const { nightMaterials } = prepareModule(root);
    const final = bulb.material as MeshStandardMaterial;
    expect(nightMaterials).toContain(final);
    expect(final.userData.windPatched).toBe(true);
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: ShaderLib.physical.vertexShader,
      fragmentShader: '',
    };
    final.onBeforeCompile(shader as never, null as never);
    expect(shader.vertexShader).toContain('windWeight');
  });
});

/** One GLB written by hand (a single triangle shared by every mesh) so the real GLTFLoader builds the scene graph. */
function glbOf(json: object): ArrayBuffer {
  const bin = new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  const total = 12 + 8 + jsonLength + 8 + bin.length;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(jsonBytes, 20);
  const binChunk = 20 + jsonLength;
  view.setUint32(binChunk, bin.length, true);
  view.setUint32(binChunk + 4, 0x004e4942, true); // 'BIN\0'
  bytes.set(bin, binChunk + 8);
  return buffer;
}

const primitive = (material: number) => ({ attributes: { POSITION: 0 }, material });

/** The shapes the pipeline really produces: gltf-transform moves the mesh of an animated or parent node into an
 *  unnamed child (the pond's Fish), and a multi-material object becomes one mesh with several primitives. */
const STRUCTURES = {
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0, 2, 3, 6] }],
  buffers: [{ byteLength: 36 }],
  bufferViews: [{ buffer: 0, byteLength: 36 }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
  ],
  materials: [{ name: 'A' }, { name: 'B' }],
  meshes: [
    { name: 'Plane', primitives: [primitive(0)] },
    { name: 'Plane.003', primitives: [primitive(0), primitive(1)] },
    { name: 'Bulb_mesh', primitives: [primitive(0)] },
    { name: 'Pole_mesh', primitives: [primitive(0)] },
  ],
  nodes: [
    { name: 'WATER_pond', children: [1] }, // 0: named node whose mesh sits on an unnamed child
    { mesh: 0 }, // 1
    { name: 'WATER_multi', mesh: 1 }, // 2: two primitives -> a Group of two Meshes
    { name: 'Lamp', extras: { night_light: true }, children: [4, 5] }, // 3
    { mesh: 2 }, // 4: the lamp's own mesh, on an unnamed child
    { name: 'Lamp_pole', mesh: 3 }, // 5: a separate named object under the lamp
    { name: 'Rock', mesh: 3 }, // 6
  ],
};

describe('prepareModule on GLTFLoader output', () => {
  async function load() {
    const gltf = await new GLTFLoader().parseAsync(glbOf(STRUCTURES), '');
    const root = cloneSkinned(gltf.scene); // what ModuleInstance does
    const { nightMaterials } = prepareModule(root);
    const meshesOf = (name: string) => {
      const found: Mesh[] = [];
      root.getObjectByName(name)?.traverse((o: Object3D) => {
        if ((o as Mesh).isMesh) found.push(o as Mesh);
      });
      return found;
    };
    return { root, nightMaterials, meshesOf };
  }

  it('GLTFLoader keeps the original node name in userData.name and leaves split children unnamed', async () => {
    const { root } = await load();
    const pond = root.getObjectByName('WATER_pond');
    expect(pond?.userData.name).toBe('WATER_pond');
    expect(pond?.children[0].userData.name).toBeUndefined();
    expect(pond?.children[0].name).toBe('Plane'); // the mesh data name, not the node name
  });

  it('applies the water shader to a WATER_* node whose mesh is an unnamed child', async () => {
    const { meshesOf } = await load();
    const meshes = meshesOf('WATER_pond');
    expect(meshes).toHaveLength(1);
    expect(meshes[0].material).toBeInstanceOf(ShaderMaterial);
    expect(meshes[0].castShadow).toBe(false);
  });

  it('applies the water shader to every primitive of a multi-material WATER_* node', async () => {
    const { meshesOf } = await load();
    const meshes = meshesOf('WATER_multi');
    expect(meshes).toHaveLength(2);
    for (const mesh of meshes) expect(mesh.material).toBeInstanceOf(ShaderMaterial);
  });

  it('lights the owning night_light node but not its named child objects', async () => {
    const { nightMaterials, meshesOf } = await load();
    const [bulb] = meshesOf('Lamp').filter((m) => m.name === 'Bulb_mesh');
    const [pole] = meshesOf('Lamp_pole');
    expect(nightMaterials).toHaveLength(1);
    expect(bulb.material).toBe(nightMaterials[0]);
    expect(bulb.castShadow).toBe(false);
    expect(pole.material).not.toBe(nightMaterials[0]);
    expect(pole.castShadow).toBe(true);
  });

  it('leaves ordinary nodes alone', async () => {
    const { meshesOf, nightMaterials } = await load();
    const [rock] = meshesOf('Rock');
    expect(rock.material).toBeInstanceOf(MeshStandardMaterial);
    expect(nightMaterials).not.toContain(rock.material);
  });
});

describe("prepareModule: the curtains' voile (art/README.md, Interior)", () => {
  function decor(): {
    root: Group;
    mesh: Mesh;
    sheer: MeshStandardMaterial;
    drape: MeshStandardMaterial;
  } {
    // as GLTFLoader makes a blended, double-sided glTF material
    const sheer = new MeshStandardMaterial({
      name: 'M_sheer',
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: DoubleSide,
    });
    const drape = new MeshStandardMaterial({ name: 'M_drape' });
    const mesh = new Mesh(new BufferGeometry(), [drape, sheer]);
    mesh.name = 'Interior_decor';
    const root = new Group();
    root.add(mesh);
    return { root, mesh, sheer, drape };
  }

  it("draws M_sheer in one pass, not three's back-then-front pair for a see-through double-sided material", () => {
    const { root, mesh, sheer, drape } = decor();
    prepareModule(root);
    expect([sheer.forceSinglePass, drape.forceSinglePass]).toEqual([true, false]);
    expect([sheer.transparent, sheer.opacity, sheer.side]).toEqual([true, 0.75, DoubleSide]);
    expect(mesh.renderOrder).toBe(0); // not a pane
  });

  it("lights it from both sides: from outside at night it shows the warm room's light, not the moon's", () => {
    const { root, sheer, drape } = decor();
    prepareModule(root);
    prepareModule(root); // a second clone of the module shares the material: one patch
    // three flips the normal of a double-sided material's back faces; the voile's keep the front's, which faces the room
    const shader = {
      fragmentShader: ShaderLib.standard.fragmentShader,
      vertexShader: ShaderLib.standard.vertexShader,
      uniforms: {},
    };
    sheer.onBeforeCompile(shader as never, {} as WebGLRenderer);
    expect(shader.fragmentShader).not.toContain('#include <normal_fragment_begin>');
    expect(shader.fragmentShader).toContain('float faceDirection = 1.0;');
    expect(shader.fragmentShader).not.toContain('gl_FrontFacing');
    expect(sheer.customProgramCacheKey()).not.toBe(drape.customProgramCacheKey());
    expect(sheer.userData.twoSidedLight).toBe(true);
  });
});

describe('prepareModule: glass villa', () => {
  /** three calls Object3D.onBeforeRender once per drawn material group, right before the program is set up. */
  function drawn(object: Object3D, scene: Scene, material: Material): void {
    object.onBeforeRender(
      {} as WebGLRenderer,
      scene,
      new PerspectiveCamera(),
      new BufferGeometry(),
      material,
      new Group(),
    );
  }

  it('makes GLASS_* panes alpha-blended, reflective, glossy and shadowless', () => {
    const glass = new MeshStandardMaterial({
      name: 'GLASS_clear',
      transparent: true,
      opacity: 0.2,
      roughness: 0.3,
    });
    const pane = mesh('GLASS_front_01', undefined, glass);
    const root = new Group();
    root.add(pane);
    prepareModule(root);
    expect([glass.transparent, glass.depthWrite, glass.roughness, glass.opacity]).toEqual([
      true,
      false,
      0.05,
      0.2,
    ]);
    expect(glass.forceSinglePass).toBe(true); // a transparent DoubleSide material would otherwise be drawn twice per frame
    expect([pane.castShadow, pane.renderOrder]).toEqual([false, GLASS_RENDER_ORDER]);
  });

  it('sets FROSTED_* panes up as transparent glass but keeps their own roughness', () => {
    const frosted = new MeshStandardMaterial({
      name: 'FROSTED_bath',
      transparent: true,
      opacity: 0.6,
      roughness: 0.5,
    });
    const clear = new MeshStandardMaterial({
      name: 'GLASS_clear',
      transparent: true,
      opacity: 0.2,
      roughness: 0.5,
    });
    const frostedPane = mesh('FROSTED_bath_01', undefined, frosted);
    const clearPane = mesh('GLASS_front_01', undefined, clear);
    const root = new Group();
    root.add(frostedPane, clearPane);
    prepareModule(root);
    // The roughness clamp is for clear glass only: a frosted pane is milky because it is rough.
    expect([frosted.roughness, clear.roughness]).toEqual([0.5, 0.05]);
    expect([frosted.transparent, frosted.depthWrite, frosted.opacity]).toEqual([true, false, 0.6]);
    expect(frosted.forceSinglePass).toBe(true);
    expect([frostedPane.castShadow, frostedPane.renderOrder]).toEqual([false, GLASS_RENDER_ORDER]);
  });

  it('keeps the glass setup on a frosted pane that also glows at night', () => {
    const frosted = new MeshStandardMaterial({
      name: 'FROSTED_bath',
      transparent: true,
      opacity: 0.6,
      roughness: 0.5,
    });
    frosted.emissive.setRGB(0.45, 0.32, 0.19);
    const pane = mesh('FROSTED_bath_01', undefined, frosted);
    pane.userData.night_light = true;
    const root = new Group();
    root.add(pane);
    const { nightMaterials } = prepareModule(root);
    const glowing = pane.material as MeshStandardMaterial;
    expect(nightMaterials).toEqual([glowing]); // the pane got its own night material, dark until dusk
    expect(glowing.emissiveIntensity).toBe(0);
    expect(glowing.userData.baseEmissive).toBe(1);
    expect([
      glowing.transparent,
      glowing.depthWrite,
      glowing.forceSinglePass,
      glowing.roughness,
    ]).toEqual([true, false, true, 0.5]);
    expect([pane.castShadow, pane.renderOrder]).toEqual([false, GLASS_RENDER_ORDER]);
    const scene = new Scene();
    scene.environment = new Texture();
    drawn(pane, scene, glowing);
    expect(glowing.envMap).toBe(scene.environment); // the draw-time material is the clone, and it still counts as glass
  });

  it('binds the scene environment to frosted panes right before each draw, like clear glass', () => {
    const frosted = new MeshStandardMaterial({ name: 'FROSTED_bath' });
    const pane = mesh('FROSTED_bath_01', undefined, frosted);
    const root = new Group();
    root.add(pane);
    prepareModule(root);
    const scene = new Scene();
    scene.environment = new Texture();
    scene.environmentIntensity = 0.5;
    drawn(pane, scene, frosted);
    expect([frosted.envMap, frosted.envMapIntensity]).toEqual([
      scene.environment,
      0.5 * GLASS_ENV_INTENSITY,
    ]);
  });

  it('binds the scene environment to the glass right before each draw, boosted by GLASS_ENV_INTENSITY', () => {
    const glass = new MeshStandardMaterial({ name: 'GLASS_clear' });
    const pane = mesh('GLASS_front_01', undefined, glass);
    const root = new Group();
    root.add(pane);
    prepareModule(root);
    expect(glass.envMap).toBeNull();
    const scene = new Scene();
    scene.environment = new Texture();
    scene.environmentIntensity = 0.5;
    drawn(pane, scene, glass);
    expect([glass.envMap, glass.envMapIntensity]).toEqual([
      scene.environment,
      0.5 * GLASS_ENV_INTENSITY,
    ]);
  });

  it('touches only the glass material of a mixed door mesh', () => {
    const frame = new MeshStandardMaterial({ name: 'M_frame' });
    const glass = new MeshStandardMaterial({
      name: 'GLASS_clear',
      transparent: true,
      opacity: 0.2,
    });
    const door = new Mesh(new BufferGeometry(), [frame, glass]);
    door.name = 'Door_main';
    const root = new Group();
    root.add(door);
    prepareModule(root);
    expect([frame.depthWrite, glass.depthWrite, door.renderOrder]).toEqual([
      true,
      false,
      GLASS_RENDER_ORDER,
    ]);
    const scene = new Scene();
    scene.environment = new Texture();
    drawn(door, scene, frame);
    drawn(door, scene, glass);
    expect([frame.envMap, glass.envMap]).toEqual([null, scene.environment]);
  });

  it('starts night point lights dark and hidden and remembers their exported intensity', () => {
    const lamp = new PointLight(0xffffff, 60);
    lamp.name = 'L_living';
    lamp.userData = { name: 'L_living', night_light: true };
    const always = new PointLight(0xffffff, 5);
    always.name = 'L_other';
    const root = new Group();
    root.add(lamp, always);
    const { nightLights } = prepareModule(root);
    expect(nightLights).toEqual([lamp]);
    expect([lamp.intensity, lamp.visible, lamp.userData.baseIntensity, lamp.castShadow]).toEqual([
      0,
      false,
      60,
      false,
    ]);
    expect([always.intensity, always.visible]).toEqual([5, true]);
  });

  it('re-attaches the target of a cloned spot light to the clone', () => {
    const spot = new SpotLight(0xffffff, 40); // built the way GLTFLoader builds a KHR_lights_punctual spot
    spot.name = 'L_spot';
    spot.userData = { name: 'L_spot', night_light: true };
    spot.target.position.set(0, 0, -1);
    spot.add(spot.target);
    const source = new Group();
    source.add(spot);
    const root = cloneSkinned(source); // what ModuleInstance does
    const cloned = root.getObjectByName('L_spot') as SpotLight;
    expect(cloned).not.toBe(spot);
    expect(cloned.target.parent).toBeNull(); // SpotLight.copy leaves a detached clone
    const { nightLights } = prepareModule(root);
    expect(nightLights).toEqual([cloned]);
    expect(cloned.target.parent).toBe(cloned);
    expect(cloned.target.position.toArray()).toEqual([0, 0, -1]);
  });
});
