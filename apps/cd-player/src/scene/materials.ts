import {
  Color,
  DataTexture,
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
import type { Skin, SkinRole } from '../skins';
import { DYNAMIC_MATERIALS, type DynamicMaterial } from './contract';
import { MATERIAL_ROLES, SKIN_ROLES, type MaterialRole } from './material-roles';
import { leatherNormal } from './textures/grain';

export type Slots = Record<DynamicMaterial, MeshPhysicalMaterial | MeshBasicMaterial>;

/** The skin role of a GLB material, or undefined for one no skin recolours. */
function skinRoleOf(name: string): SkinRole | undefined {
  return Object.hasOwn(SKIN_ROLES, name) ? SKIN_ROLES[name] : undefined;
}

export interface UpgradedMaterials {
  slots: Slots;
  /** Recolours the skin's roles in place (applySkin, below). */
  applySkin(skin: Skin): void;
  dispose(): void;
}

const WHITE = new Color('#ffffff');

/**
 * The leather's sheen: its base lifted 40 % toward white, in three's linear working colour. A skin
 * that changes the base brings the sheen with it, so every colourway keeps the same soft highlight.
 */
export function leatherSheen(base: Color, target: Color = new Color()): Color {
  return target.copy(base).lerp(WHITE, 0.4);
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
  grain: Texture,
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
        normalMap: grain,
        normalScale: new Vector2(0.45, 0.45),
      });
    case 'fabric':
      return physical(source, {
        roughness: 1,
        sheen: 1,
        sheenRoughness: 0.8,
        sheenColor: new Color('#4a4046'),
        normalMap: grain,
        normalScale: new Vector2(0.8, 0.8),
      });
    case 'lining':
      return physical(source, {
        roughness: 0.85,
        sheen: 0.6,
        sheenRoughness: 0.6,
        sheenColor: new Color('#ffffff'),
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

/** The materials under `root` a skin recolours, by name, as sRGB hex (for the live check). */
export function skinColours(root: Object3D): Record<string, string> {
  const colours: Record<string, string> = {};
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial;
    if (skinRoleOf(material.name)) colours[material.name] = `#${material.color.getHexString()}`;
  });
  return colours;
}

/** Swaps every GLB material for its role's three material, once per name; keeps the printed ones. */
export function upgradeMaterials(root: Object3D): UpgradedMaterials {
  const size = 256;
  const grain = new DataTexture(leatherNormal(size), size, size, RGBAFormat);
  grain.wrapS = grain.wrapT = RepeatWrapping;
  // The grain is minified at the hero distance. Filtered and mip-mapped it fades with distance;
  // sampled nearest (a DataTexture's default) it would shimmer whenever the camera moves.
  grain.magFilter = LinearFilter;
  grain.minFilter = LinearMipmapLinearFilter;
  grain.generateMipmaps = true;
  // No renderer to ask for its limit here: three clamps this to what the GPU supports.
  grain.anisotropy = 4;
  grain.needsUpdate = true;
  const made = new Map<string, Material>();
  const slots: Partial<Slots> = {};
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const source = mesh.material as MeshStandardMaterial;
    let material = made.get(source.name);
    if (!material) {
      material = makeMaterial(MATERIAL_ROLES[source.name] ?? 'plastic', source, grain);
      made.set(source.name, material);
      if ((DYNAMIC_MATERIALS as readonly string[]).includes(source.name)) {
        slots[source.name as DynamicMaterial] = material as
          MeshPhysicalMaterial | MeshBasicMaterial;
      }
    }
    source.dispose();
    mesh.material = material;
    // Glass casts no hard shadow.
    if ((material as MeshPhysicalMaterial).transmission > 0) mesh.castShadow = false;
  });
  return {
    slots: slots as Slots,
    applySkin: (skin: Skin) => applySkin(made.values(), skin),
    dispose: () => {
      for (const material of made.values()) material.dispose();
      grain.dispose();
    },
  };
}
