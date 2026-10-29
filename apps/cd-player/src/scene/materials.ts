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
import { DYNAMIC_MATERIALS, type DynamicMaterial } from './contract';
import { MATERIAL_ROLES, type MaterialRole } from './material-roles';
import { leatherNormal } from './textures/grain';

export type Slots = Record<DynamicMaterial, MeshPhysicalMaterial | MeshBasicMaterial>;

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

/** One three material per Blender material, by role (material-roles.ts). */
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
        sheenColor: source.color.clone().lerp(new Color('#ffffff'), 0.4),
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
        specularIntensity: 1,
        envMapIntensity: 1.2,
      });
    case 'metal':
      return physical(source, {
        metalness: 1,
        roughness: Math.min(source.roughness, 0.3),
        envMapIntensity: 1.2,
      });
    case 'brushed':
      return physical(source, {
        metalness: 1,
        roughness: 0.28,
        anisotropy: 0.6,
        envMapIntensity: 1.1,
      });
    case 'disc-data':
      return physical(source, {
        metalness: 1,
        roughness: 0.12,
        iridescence: 1,
        iridescenceIOR: 1.8,
        iridescenceThicknessRange: [250, 700],
        envMapIntensity: 1.4,
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
      return new MeshPhysicalMaterial({
        name: source.name,
        color: new Color('#ffffff'),
        roughness: 0.38,
        clearcoat: 0.5,
        clearcoatRoughness: 0.12,
      });
    case 'screen':
      return new MeshBasicMaterial({
        name: source.name,
        color: new Color('#ffffff'),
        toneMapped: false,
      });
  }
}

/** Swaps every GLB material for its role's three material, once per name; keeps the printed ones. */
export function upgradeMaterials(root: Object3D): { slots: Slots; dispose(): void } {
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
    dispose: () => {
      for (const material of made.values()) material.dispose();
      grain.dispose();
    },
  };
}
