import {
  type AnimationAction,
  type AnimationClip,
  type AnimationMixer,
  AnimationUtils,
  LoopOnce,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type PointLight,
  type SpotLight,
} from 'three';
import type { PreparedModule } from '../scene/prepareModule';
import { collectGroups, groupKind, type InteractGroup, interactiveNode } from './groups';
import { GLOW_KINDS, glowFactor, isOn, type ToggleState } from './toggles';

/** What the toggles of one module drive (interaction spec §3.2). */
export interface InteractionModel {
  groups: Map<string, InteractGroup>;
  /** Night materials and lights of the glowing groups (lights, screens), by group; the rest follow the night alone. */
  glowing: Map<Material | PointLight | SpotLight, string>;
  /** What a group shows while it runs: a shower's WATER_*_flow, the fountain's WATER_*_sheet, the waterfall's foam. */
  shown: Map<string, Object3D[]>;
  /** The clips groups play: the door's act_door_open, the jacuzzi's ambient loop, the dog's one-shot act_dog_happy. */
  clips: { group: string; kind: string; clip: string }[];
  /**
   * The party group's LED strips, the light they cast and the disco ball's mirror tiles (M_party_led, GLOW_party,
   * M_disco), whose colour applyParty cycles.
   */
  party: MeshStandardMaterial[];
}

/** Materials of the party's lights: what the karaoke's party mode cycles through the hues, the disco ball's tiles too. */
const PARTY_LIGHTS = /^(M_party_led|GLOW_party|M_disco)$/;
/** One turn through the hues of the party's LEDs takes this many seconds (interaction spec §3.2, villa v2 spec §12). */
export const PARTY_PERIOD = 6;

/** The hue (0..1) the party's LEDs show `time` seconds into the shared clock: one turn every PARTY_PERIOD seconds. */
export function partyHue(time: number): number {
  return (((time / PARTY_PERIOD) % 1) + 1) % 1;
}

/**
 * While the party is `on`, gives its LEDs, the light they cast and the disco ball's tiles the colour of the moment
 * (partyHue at `time`, fully saturated): the ball, a night light of the party group, glows with the strips and its facets
 * catch the light as it turns; off, they keep the colour they had, which the night factor and the toggle have dimmed away
 * anyway.
 */
export function applyParty(
  model: Pick<InteractionModel, 'party'>,
  on: boolean,
  time: number,
): void {
  if (!on) return;
  const hue = partyHue(time);
  for (const material of model.party) material.emissive.setHSL(hue, 1, 0.55);
}

/** Nodes a toggle shows and hides: falling WATER_ and the *_foam at its foot; the fountain's basin keeps its water. */
const SHOWN = /^(WATER_.+_(flow|sheet)|.+_foam)$/;

function nodeName(node: Object3D): string {
  return typeof node.userData.name === 'string' ? node.userData.name : node.name;
}

function materialsOf(object: Object3D): Material[] {
  const mesh = object as Mesh;
  if (!mesh.isMesh) return [];
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * Reads the interact groups of a prepared module (after prepareModule, whose night-material clones give every screen
 * and lamp a material of its own) and sets it up for 'auto': the falling water of the showers starts hidden.
 */
export function prepareInteractions(root: Object3D, prepared: PreparedModule): InteractionModel {
  const groups = collectGroups(root);
  const nightMaterials = new Set<Material>(prepared.nightMaterials);
  const nightLights = new Set<Object3D>(prepared.nightLights);
  const glowing: InteractionModel['glowing'] = new Map();
  const party: MeshStandardMaterial[] = [];
  root.traverse((object) => {
    const node = interactiveNode(object);
    if (!node) return;
    const group = node.userData.interact as string;
    if (!groups.has(group) || !GLOW_KINDS.has(groupKind(group))) return;
    if (nightLights.has(object)) glowing.set(object as PointLight | SpotLight, group);
    for (const material of materialsOf(object)) {
      if (!nightMaterials.has(material)) continue;
      glowing.set(material, group);
      if (groupKind(group) === 'party' && PARTY_LIGHTS.test(material.name))
        party.push(material as MeshStandardMaterial);
    }
  });
  const shown: InteractionModel['shown'] = new Map();
  const clips: InteractionModel['clips'] = [];
  for (const group of groups.values()) {
    const water = group.nodes.filter((node) => SHOWN.test(nodeName(node)));
    if (water.length) shown.set(group.id, water);
    for (const node of water) node.visible = isOn(group.kind, 'auto', 0);
    if (group.clip) clips.push({ group: group.id, kind: group.kind, clip: group.clip });
  }
  return { groups, glowing, shown, clips, party };
}

/**
 * Lights, screens and water for the current toggles. Groups on auto, and everything outside a group, follow the night
 * factor exactly as before (ModuleInstance), so with no toggles at all (the wallpaper) nothing changes.
 */
export function applyToggles(
  model: InteractionModel,
  prepared: PreparedModule,
  toggles: Record<string, ToggleState>,
  nightFactor: number,
): void {
  const factor = (item: Material | PointLight | SpotLight) => {
    const group = model.glowing.get(item);
    return group === undefined
      ? nightFactor
      : glowFactor(toggles[group], nightFactor, groupKind(group));
  };
  for (const material of prepared.nightMaterials) {
    if (material.userData.glow) {
      // a light pool (GLOW_*): drawn additively, so its opacity is how much light it adds; hidden, it costs no draw call
      const f = factor(material);
      material.opacity = f;
      material.visible = f > 0;
    } else {
      material.emissiveIntensity = (material.userData.baseEmissive as number) * factor(material);
    }
  }
  for (const light of prepared.nightLights) {
    const f = factor(light);
    // userData.lit, what the toggles give it, which a light the cut turned off (cutaway applyCut: the house's under the
    // basement's cut) gets back when the cut lets it light again
    light.userData.lit = (light.userData.baseIntensity as number) * f;
    light.intensity = light.userData.cutDark ? 0 : light.userData.lit;
    light.visible = f > 0; // a light count change recompiles shaders: at dusk and dawn, or on a click
  }
  for (const [id, nodes] of model.shown) {
    const on = isOn(model.groups.get(id)!.kind, toggles[id], nightFactor);
    for (const node of nodes) node.visible = on;
  }
}

/**
 * Plays a group's clip for its state. An act_ clip runs once, forwards to turn on (the door slides open) and backwards
 * from wherever it is to turn off; while it was never turned on it does not start at all. An ambient_ loop (the
 * jacuzzi's bubbles) pauses while off.
 */
export function driveClip(action: AnimationAction, on: boolean): void {
  if (!action.getClip().name.startsWith('act_')) {
    action.paused = !on;
    return;
  }
  if (!on && !action.isScheduled()) return;
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.enabled = true;
  action.paused = false;
  action.timeScale = on ? 1 : -1;
  action.play();
}

/**
 * The action of a one-shot clip (the dog's act_dog_happy, interact/toggles playsOnce) on `mixer`: the clip made additive
 * against its first frame, its rest pose, so it plays on top of the ambient loops that move the same nodes (the tail
 * wags fast over its slow wag, the body hops while it breathes). It works on a copy (AnimationClip.clone copies its
 * tracks' values), as makeClipAdditive rewrites them in place and the GLB's clip is shared by every clone of the module.
 */
export function oneShot(mixer: AnimationMixer, clip: AnimationClip): AnimationAction {
  return mixer.clipAction(AnimationUtils.makeClipAdditive(clip.clone()));
}

/**
 * Plays a one-shot action once from its start and lets it go when it ends: its clip ends where it begins, at rest, so
 * the nodes are left as the ambient loops have them. While an earlier click's run still plays it does nothing, so a
 * second click does not snap the dog back to its start mid-hop.
 */
export function playOnce(action: AnimationAction): void {
  if (action.isRunning()) return;
  action.reset();
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = false;
  action.play();
}
