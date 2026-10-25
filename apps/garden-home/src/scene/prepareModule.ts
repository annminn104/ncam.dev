import {
  AdditiveBlending,
  DataTexture,
  LinearFilter,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type PointLight,
  ShaderChunk,
  type SpotLight,
} from 'three';
import { koiOf, type PreparedKoi, prepareKoi } from '../systems/koi';
import { applyFoamNight, createWaterMaterial, waterStyle } from '../systems/water';
import { applyWind } from '../systems/wind';
import {
  castsNoShadow,
  extractWindWeights,
  isClearGlass,
  isFoam,
  isGlass,
  isGlow,
  isNightLight,
  isPunctualLight,
  isSheer,
  isWater,
  owningNode,
} from './extras';

export interface PreparedModule {
  nightMaterials: MeshStandardMaterial[];
  /** Night point/spot lights: userData.baseIntensity holds the exported intensity; they start dark and hidden. */
  nightLights: (PointLight | SpotLight)[];
  /** The koi materials of the pond, whose food a click drops (systems/koi.ts feedKoi). */
  koi: PreparedKoi[];
}

/** Glass reflects the sky environment more strongly: this multiplies the scene's environmentIntensity (glass villa spec §7). */
export const GLASS_ENV_INTENSITY = 1.5;
/** Transparent panes draw after opaque geometry; within the pass three sorts them back to front. */
export const GLASS_RENDER_ORDER = 1;

function configureGlass(material: Material): Material {
  const glass = material as MeshStandardMaterial;
  glass.transparent = true;
  glass.depthWrite = false;
  // glTF doubleSided makes three draw every transparent DoubleSide primitive twice (back pass, front pass); the panes are closed
  // 2 cm boxes sharing one material, so a single DoubleSide pass looks the same at half the draw cost.
  glass.forceSinglePass = true;
  // Clear panes stay mirror-like whatever Blender exported; a frosted pane is milky because it is rough, so it keeps its own.
  if (isClearGlass(glass)) glass.roughness = Math.min(glass.roughness, 0.05);
  return glass;
}

/**
 * three ignores material.envMapIntensity while the material has no envMap of its own: it feeds scene.environmentIntensity
 * to such materials instead. So right before each draw (once per material group) the glass material gets the scene
 * environment bound with the boosted intensity; other materials of the mesh (the door frame) are left alone.
 */
const bindGlassEnvironment: Object3D['onBeforeRender'] = (
  _renderer,
  scene,
  _camera,
  _geometry,
  material,
) => {
  if (!isGlass(material)) return;
  const glass = material as MeshStandardMaterial;
  glass.envMap = scene.environment;
  glass.envMapIntensity = scene.environmentIntensity * GLASS_ENV_INTENSITY;
};

/** Texels of the light pools' falloff: plenty for a gradient the GPU interpolates. */
const FALLOFF_TEXELS = 32;
let falloff: DataTexture | null = null;

/**
 * The radial falloff of the GLOW_* light pools, as their alphaMap (three reads its green channel): a pool's UVs run u
 * from 0 at its centre to 1 on its rim (MeshBuilder.disc), and the light stays strong over most of the pool before it
 * fades to nothing at the rim, (1 - u²)². One small texture made here and shared by every pool, so the modules ship none.
 */
export function glowFalloff(): DataTexture {
  if (!falloff) {
    const data = new Uint8Array(FALLOFF_TEXELS * 4);
    for (let i = 0; i < FALLOFF_TEXELS; i++) {
      const alpha = Math.round(255 * (1 - (i / (FALLOFF_TEXELS - 1)) ** 2) ** 2);
      data.set([alpha, alpha, alpha, 255], i * 4);
    }
    falloff = new DataTexture(data, FALLOFF_TEXELS, 1);
    falloff.magFilter = LinearFilter;
    falloff.minFilter = LinearFilter;
    falloff.needsUpdate = true;
  }
  return falloff;
}

/**
 * A light pool's night clone: added onto what is behind it (the lawn), never hiding it, faded out from its centre. The
 * night factor (and its group's toggle) drives its opacity at its full exported emission (interact/effects); it starts
 * hidden, so by day it costs no draw call.
 */
function configureGlow(glow: MeshStandardMaterial): void {
  glow.userData.glow = true;
  glow.transparent = true;
  glow.blending = AdditiveBlending;
  glow.depthWrite = false;
  glow.forceSinglePass = true; // a flat disc seen from above: one pass, not three's back-then-front pair for DoubleSide
  glow.alphaMap = glowFalloff();
  glow.emissiveIntensity = glow.userData.baseEmissive as number;
  glow.opacity = 0;
  glow.visible = false;
}

/**
 * normal_fragment_begin with the face direction held at 1: a back face keeps its front's normal instead of the flipped
 * one three gives a double-sided material's back faces.
 */
const FRONT_NORMAL = ShaderChunk.normal_fragment_begin.replace(
  'gl_FrontFacing ? 1.0 : - 1.0',
  '1.0',
);

/**
 * The curtains' voile (M_sheer, villa v2 spec §12 "Rèm và phụ kiện"), a thin see-through fabric whose ribbons turn their
 * front to the room: drawn in one pass (a ribbon of folds in one colour looks the same, at half the draw calls of three's
 * back-then-front pair for a transparent DoubleSide material), and lit from both sides as a voile is, by the light that
 * falls on its room side: seen from outside at night it shows the warm room's lights rather than the moon (three would
 * light the back face it shows with the moonlit outside), and by day the glass in front of it reflects the sky anyway.
 * The material is shared by every clone of the module: patched once.
 */
function configureSheer(sheer: Material): Material {
  if (sheer.userData.twoSidedLight) return sheer;
  sheer.userData.twoSidedLight = true;
  sheer.forceSinglePass = true;
  sheer.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      FRONT_NORMAL,
    );
  };
  sheer.customProgramCacheKey = () => 'sheer-two-sided-light';
  sheer.needsUpdate = true;
  return sheer;
}

function mapMaterial(mesh: Mesh, fn: (material: Material) => Material): void {
  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fn) : fn(mesh.material);
}

/**
 * Wires a cloned module scene into the runtime systems: shadows (none from cast_shadow = False objects), water, the koi,
 * glass and frosted panes, the curtains' voile, night lights and the light pools (GLOW_*) among them, wind (spec §9).
 */
export function prepareModule(root: Object3D): PreparedModule {
  const nightMaterials: MeshStandardMaterial[] = [];
  const nightLights: (PointLight | SpotLight)[] = [];
  const koiMaterials: PreparedKoi[] = [];
  root.traverse((object) => {
    if (isPunctualLight(object)) {
      // SpotLight.copy swaps target for a detached clone, so a cloned spot would aim at a stale point; re-attach it
      // (GLTFLoader parents the target to the light, at (0, 0, -1) in light space).
      const spot = object as SpotLight;
      if (spot.isSpotLight && spot.target.parent === null) spot.add(spot.target);
      // Lights only ever light the night (contract rule light-not-night); hidden lights cost no shader work.
      if (isNightLight(object)) {
        object.castShadow = false;
        object.userData.baseIntensity = object.intensity;
        object.intensity = 0;
        object.visible = false;
        nightLights.push(object);
      }
      return;
    }
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = !castsNoShadow(mesh); // flat or tiny merged objects: their shadow pass costs more than it shows
    mesh.receiveShadow = true;

    if (isWater(object)) {
      mesh.material = createWaterMaterial(waterStyle(owningNode(object).userData.water));
      mesh.castShadow = false;
      return;
    }

    if (isFoam(object)) {
      mapMaterial(mesh, (material) => {
        applyFoamNight(material); // moonlit, like the water's white, not glowing under the moon
        return material;
      });
      return;
    }

    const koi = koiOf(mesh); // the pond's fish swim in the koi shader, drawn after the water
    if (koi) {
      koiMaterials.push(...prepareKoi(mesh, root, koi));
      return;
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some(isGlass)) {
      mesh.castShadow = false; // sunlight reaches the furniture behind the panes
      mesh.renderOrder = GLASS_RENDER_ORDER;
      mesh.onBeforeRender = bindGlassEnvironment;
      mapMaterial(mesh, (material) => (isGlass(material) ? configureGlass(material) : material));
    }
    if (materials.some(isSheer))
      mapMaterial(mesh, (material) => (isSheer(material) ? configureSheer(material) : material));

    // isNightLight reads the owning glTF node, so split and multi-material objects are covered.
    // Runs before the wind block so wind patches the clone that ends up on the mesh.
    if (isNightLight(mesh)) {
      mesh.castShadow = false;
      mapMaterial(mesh, (material) => {
        const night = material.clone() as MeshStandardMaterial;
        // clone() copies userData but not the onBeforeCompile hook, so drop the inherited flag.
        delete night.userData.windPatched;
        night.userData.baseEmissive = night.emissiveIntensity;
        night.emissiveIntensity = 0;
        if (isGlow(night)) configureGlow(night);
        nightMaterials.push(night);
        return night;
      });
      if ((Array.isArray(mesh.material) ? mesh.material : [mesh.material]).every(isGlow))
        mesh.receiveShadow = false;
    }

    // Geometry is shared between clones: the first clone converts it, later clones see windWeight.
    const weights = extractWindWeights(mesh.geometry);
    if (weights) {
      mesh.geometry.setAttribute('windWeight', weights);
      mesh.geometry.deleteAttribute('color');
    }
    if (mesh.geometry.getAttribute('windWeight')) {
      mapMaterial(mesh, (material) => {
        material.vertexColors = false;
        applyWind(material);
        return material;
      });
    }
  });
  return { nightMaterials, nightLights, koi: koiMaterials };
}
