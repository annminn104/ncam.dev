import {
  Color,
  DataTexture,
  FrontSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  RepeatWrapping,
  RGBAFormat,
  Vector2,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type MeshPhysicalMaterialParameters,
  type Object3D,
  type Texture,
} from 'three';
import { clearSwatch } from '../clear-looks';
import { etchColour, GOLD, traceColour } from './decor-colours';
import type { Look } from '../looks';
import { skinById, type Skin, type SkinRole } from '../skins';
import { DYNAMIC_MATERIALS, type DynamicMaterial } from './contract';
import { CLEAR_ROLES, MATERIAL_ROLES, SKIN_ROLES, type MaterialRole } from './material-roles';
import { leatherNormal, quiltNormal, weaveNormal } from './textures/grain';

export type Slots = Record<DynamicMaterial, MeshPhysicalMaterial | MeshBasicMaterial>;

/** The runtime normal maps the roles tile (src/scene/textures/grain.ts). */
export interface GrainMaps {
  /** The leather's pebble grain. */
  grain: Texture;
  /** The lining's diamond quilting. */
  quilt: Texture;
  /** The speaker cloth's and the strap's weave. */
  weave: Texture;
}

/** The skin role of a GLB material, or undefined for one no skin recolours. */
function skinRoleOf(name: string): SkinRole | undefined {
  return Object.hasOwn(SKIN_ROLES, name) ? SKIN_ROLES[name] : undefined;
}

export interface UpgradedMaterials {
  slots: Slots;
  /** Recolours the model's materials in place for a look (applyLook, below). */
  applyLook(look: Look): void;
  dispose(): void;
}

const WHITE = new Color('#ffffff');

/**
 * The leather's sheen colour: its base lifted toward white by the base's own luminance (Rec. 709
 * weights, in three's linear working colour), 40 % at most. A pastel leather (luminance 0.4 or more:
 * Blush, Sage, Cream) gets the full 40 % and its soft highlight; a dark one keeps its depth, since a
 * sheen lifted as far lays a white haze over the whole leather and greys a dark red to a dusty rose.
 * A skin that changes the base brings the sheen with it.
 */
export function leatherSheen(base: Color, target: Color = new Color()): Color {
  const luminance = 0.2126 * base.r + 0.7152 * base.g + 0.0722 * base.b;
  return target.copy(base).lerp(WHITE, Math.min(luminance, 0.4));
}

function physical(
  source: MeshStandardMaterial,
  extra: MeshPhysicalMaterialParameters,
): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    name: source.name,
    color: source.color.clone(),
    roughness: source.roughness,
    metalness: source.metalness,
    ...extra,
  });
}

/**
 * One three material per Blender material, by role (material-roles.ts). How strongly the studio
 * lights a material is the scene's `environmentIntensity` (PlayerScene), not a value here: while
 * the scene has an environment, three applies that to every material without its own `envMap`, so
 * a per-material `envMapIntensity` would never take effect.
 */
export function makeMaterial(
  role: MaterialRole,
  source: MeshStandardMaterial,
  maps: GrainMaps,
): Material {
  switch (role) {
    case 'leather':
      return physical(source, {
        roughness: 0.55,
        sheen: 1,
        sheenRoughness: 0.45,
        sheenColor: leatherSheen(source.color),
        clearcoat: 0.1,
        clearcoatRoughness: 0.4,
        normalMap: maps.grain,
        normalScale: new Vector2(0.45, 0.45),
      });
    case 'fabric':
      return physical(source, {
        roughness: 1,
        sheen: 1,
        sheenRoughness: 0.8,
        sheenColor: new Color('#4a4046'),
        normalMap: maps.weave,
        normalScale: new Vector2(0.9, 0.9),
      });
    case 'lining':
      return physical(source, {
        roughness: 0.85,
        sheen: 0.6,
        sheenRoughness: 0.6,
        sheenColor: new Color('#ffffff'),
        normalMap: maps.quilt,
        normalScale: new Vector2(0.6, 0.6),
      });
    case 'plastic':
      return physical(source, {
        roughness: Math.min(source.roughness, 0.4),
        clearcoat: 0.35,
        clearcoatRoughness: 0.15,
      });
    case 'matte':
      return physical(source, { roughness: Math.max(source.roughness, 0.6), metalness: 0 });
    case 'crystal':
      return new MeshPhysicalMaterial({
        name: source.name,
        color: new Color('#ffffff'),
        metalness: 0,
        roughness: 0.02,
        transmission: 1,
        thickness: 0.002,
        ior: 1.53,
        // The studio's bright panels, reflected in full, fog what sits behind the glass (the
        // booklet's art). A faint reflection and the refracted edges still read as glass.
        specularIntensity: 0.3,
      });
    case 'clear-shell':
      // The see-through shell: clear, faintly tinted (the shell's swatch sets `color`),
      // its back faces left out so the inside shows through one wall at a time.
      return new MeshPhysicalMaterial({
        name: source.name,
        color: new Color('#ffffff'),
        metalness: 0,
        roughness: 0.05,
        transmission: 1,
        thickness: 0.003,
        ior: 1.49,
        specularIntensity: 0.4,
        side: FrontSide,
      });
    case 'frame':
      return physical(source, { roughness: source.roughness, metalness: source.metalness });
    case 'pcb':
      return physical(source, { roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.12 });
    case 'etch':
      // Frosted lines on the shell: a pale, half-opaque, rough surface (no transmission) that
      // leaves the depth buffer alone.
      return new MeshPhysicalMaterial({
        name: source.name,
        color: source.color.clone(),
        metalness: 0,
        roughness: 0.85,
        opacity: 0.5,
        transparent: true,
        depthWrite: false,
        side: FrontSide,
      });
    case 'gold':
      return new MeshPhysicalMaterial({
        name: source.name,
        color: new Color(GOLD),
        metalness: 1,
        roughness: 0.3,
      });
    case 'metal':
      return physical(source, {
        metalness: 1,
        roughness: Math.min(source.roughness, 0.3),
      });
    case 'brushed':
      return physical(source, {
        metalness: 1,
        roughness: 0.28,
        anisotropy: 0.6,
      });
    case 'disc-data':
      return physical(source, {
        metalness: 1,
        roughness: 0.12,
        iridescence: 1,
        iridescenceIOR: 1.8,
        iridescenceThicknessRange: [250, 700],
      });
    case 'foil':
      return physical(source, {
        metalness: 1,
        roughness: 0.1,
        iridescence: 1,
        iridescenceIOR: 1.6,
        iridescenceThicknessRange: [200, 500],
      });
    case 'gloss-black':
      return physical(source, {
        color: new Color('#050506'),
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
      });
    case 'emissive':
      return new MeshBasicMaterial({
        name: source.name,
        color: source.emissive.clone(),
        toneMapped: false,
      });
    case 'print':
      // Paper with a soft sheen. A clearcoat, or the full specular strength, mirrors the studio's
      // bright panels in the art: blacks lift to grey and hot spots sit on it.
      return new MeshPhysicalMaterial({
        name: source.name,
        color: new Color('#ffffff'),
        roughness: 0.38,
        specularIntensity: 0.3,
      });
    case 'screen':
      return new MeshBasicMaterial({
        name: source.name,
        color: new Color('#ffffff'),
        toneMapped: false,
      });
  }
}

/**
 * Recolours `materials` in place for `skin`: each one SKIN_ROLES names takes its role's sRGB hex.
 * `Color.set` reads a hex string as sRGB and stores three's linear working colour, the conversion
 * Blender's lin() makes, so Blush's values give back the GLB's own colours. A leather material's
 * sheen follows its new base. Every other material keeps its colour. Only uniforms change: no
 * texture, no shader, no reload.
 */
export function applySkin(materials: Iterable<Material>, skin: Skin): void {
  for (const material of materials) {
    const role = skinRoleOf(material.name);
    if (!role) continue;
    const surface = material as MeshPhysicalMaterial;
    surface.color.set(skin.palette[role]);
    if (MATERIAL_ROLES[material.name] === 'leather') {
      leatherSheen(surface.color, surface.sheenColor);
    }
  }
}

/**
 * The Clear board's silkscreen, as the Blender render prints it (art/blender/scripts/clear.py):
 * light, linear (0.92, 0.92, 0.90), on a dark board, and dark, linear (0.025, 0.025, 0.03), on a
 * light one. As sRGB hex, the way three converts them.
 */
export const SILK_LIGHT = '#f6f6f3';
export const SILK_DARK = '#2c2c30';

/** A board lighter than this (Rec. 709 luma of its linear colour) takes the dark silkscreen. */
const SILK_LUMA_SWITCH = 0.45;

/**
 * Recolours `materials` in place for `look`: the suitcase's skin roles from its skin (as
 * `applySkin` did), or the Clear model's parts from their swatches, its silkscreen following the
 * board and its `trace` and `etch` the board and the shell. Uniforms only.
 */
export function applyLook(materials: Iterable<Material>, look: Look): void {
  if (look.model === 'suitcase') {
    applySkin(materials, skinById(look.skin));
    return;
  }
  const board = clearSwatch(look.clear, 'board').colour;
  for (const material of materials) {
    if (material.name === 'silk') {
      const { r, g, b } = new Color(board);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      (material as MeshPhysicalMaterial).color.set(
        luma < SILK_LUMA_SWITCH ? SILK_LIGHT : SILK_DARK,
      );
      continue;
    }
    if (material.name === 'trace') {
      (material as MeshPhysicalMaterial).color.set(traceColour(board));
      continue;
    }
    if (material.name === 'etch') {
      const { tint } = clearSwatch(look.clear, 'shell');
      (material as MeshPhysicalMaterial).color.set(etchColour(tint));
      continue;
    }
    const part = Object.hasOwn(CLEAR_ROLES, material.name) ? CLEAR_ROLES[material.name] : undefined;
    if (!part) continue;
    const surface = material as MeshPhysicalMaterial;
    if (part === 'shell') {
      const { tint } = clearSwatch(look.clear, 'shell');
      surface.color.set(tint);
    } else if (part === 'frame') {
      const frame = clearSwatch(look.clear, 'frame');
      surface.color.set(frame.colour);
      surface.metalness = frame.metalness;
      surface.roughness = frame.roughness;
    } else if (part === 'board') {
      surface.color.set(board);
    } else {
      (material as MeshBasicMaterial).color.set(clearSwatch(look.clear, 'light').glow);
    }
  }
}

/**
 * The materials under `root` a look recolours, by name, as sRGB hex (for the live check): a skin's
 * roles on the suitcase, the Clear model's parts, its silkscreen and its `trace` and `etch`.
 */
export function skinColours(root: Object3D): Record<string, string> {
  const colours: Record<string, string> = {};
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial;
    const { name } = material;
    if (
      skinRoleOf(name) ||
      Object.hasOwn(CLEAR_ROLES, name) ||
      name === 'silk' ||
      name === 'trace' ||
      name === 'etch'
    ) {
      colours[name] = `#${material.color.getHexString()}`;
    }
  });
  return colours;
}

/** Swaps every GLB material for its role's three material, once per name; keeps the printed ones. */
export function upgradeMaterials(root: Object3D): UpgradedMaterials {
  // The maps are minified at the hero distance. Filtered and mip-mapped they fade with distance;
  // sampled nearest (a DataTexture's default) they would shimmer whenever the camera moves.
  const dataTexture = (bytes: Uint8Array, size: number, repeat: number) => {
    const texture = new DataTexture(bytes, size, size, RGBAFormat);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    // No renderer to ask for its limit here: three clamps this to what the GPU supports.
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  };
  const maps: GrainMaps = {
    grain: dataTexture(leatherNormal(256), 256, 1),
    // Two diamonds per 5 cm tile; the weave's 16 threads tiled three times are about 1 mm apart.
    quilt: dataTexture(quiltNormal(256, 2), 256, 1),
    weave: dataTexture(weaveNormal(128, 16), 128, 3),
  };
  const made = new Map<string, Material>();
  const slots: Partial<Slots> = {};
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const source = mesh.material as MeshStandardMaterial;
    const role = MATERIAL_ROLES[source.name] ?? 'plastic';
    let material = made.get(source.name);
    if (!material) {
      material = makeMaterial(role, source, maps);
      made.set(source.name, material);
      if ((DYNAMIC_MATERIALS as readonly string[]).includes(source.name)) {
        slots[source.name as DynamicMaterial] = material as
          MeshPhysicalMaterial | MeshBasicMaterial;
      }
    }
    source.dispose();
    mesh.material = material;
    // Glass casts no hard shadow, and neither do the etched lines: three's shadow map ignores
    // opacity, so half-opaque lines would shade the inside of the shell at full strength.
    if ((material as MeshPhysicalMaterial).transmission > 0 || role === 'etch') {
      mesh.castShadow = false;
    }
  });
  return {
    slots: slots as Slots,
    applyLook: (look: Look) => applyLook(made.values(), look),
    dispose: () => {
      for (const material of made.values()) material.dispose();
      maps.grain.dispose();
      maps.quilt.dispose();
      maps.weave.dispose();
    },
  };
}
