import type { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackView } from '../bridge';
import {
  CLEARANCE,
  closest,
  discShape,
  glbModel,
  glbOf,
  loadGlb,
  ornamentOf,
  toDisc,
  toRecord,
  toSleeve,
  type DiscShape,
  type Measure,
} from '../testing/clearance';
import { restingPose, type DiscPose, type Pose } from './director';
import { applyPose, rigFor, type Rig } from './rig';
import { emptyShelf, fillShelf, targetOf, type Lineup } from './stage';

/**
 * Luxe's ornament (art/blender/scripts/luxe_ornament.py: every `*_orn_*` node of
 * cd-player-luxe.glb, on the deck, the stand and the ledge) keeps 5 mm or more off every record and
 * sleeve, resting in the rack, on the platter and on the ledge, and at every step of every flight
 * rig.test.ts flies. The record is measured as a solid disc (Ø 300 mm, 1.8 thick) and the sleeve as
 * a box (310 mm square, 3 thick); the ledge's legs and the sleeves lean 15°, so no axis-aligned box
 * would do. The closest today: the ledge legs' vines, which keep to the legs' backs, the sleeve on
 * the ledge leaning 0.4 mm off their fronts.
 *
 * The suitcase's ornament (art/blender/scripts/suitcase_ornament.py: every `*_orn_*` node of
 * cd-player.glb, on the tub, the deck and the lid's lining) keeps 5 mm or more off every disc the
 * same way: resting on the spindle and in the rack, and at every step of every way between the
 * spindle and a slot, between two slots, and out of sight and back. The suitcase is loaded as the
 * page loads it, its rig built from its own nodes, and each disc is measured as a solid disc of the
 * GLB's own disc's radius and faces.
 *
 * Vertex-exact: each ornament vertex is taken into the item's own frame and measured there, the
 * distance brought back to the world's by the item's scale (src/testing/clearance.ts).
 */

/** Steps along each flight (rig.test.ts takes 200). */
const STEPS = 200;

const track = (id: string): TrackView => ({
  id,
  title: id,
  artists: 'A',
  artUrl: null,
  artistUrl: null,
});
const lineup = (current: string | null, ...upcoming: string[]): Lineup => ({
  collection: { name: 'Mix', subtitle: 'Owner', key: 'playlist:mix' },
  current: current === null ? null : track(current),
  upcoming: upcoming.map(track),
});

/** Disc `disc` alone on its way, every other copy out of sight (as rig.test.ts's `only`). */
function only(disc: number, pose: DiscPose): Pose {
  const rest = restingPose(emptyShelf(), false, false);
  return { ...rest, discs: rest.discs.map((_, index) => (index === disc ? pose : null)) };
}

/**
 * cd-player-luxe.glb as the page loads it, with its ornament, and the rig built from its own
 * nodes.
 */
async function luxeSet(): Promise<{ rig: Rig; ornament: Vector3[] }> {
  const root = await loadGlb(glbOf('luxe'));
  const model = glbModel(root, 'luxe');
  return { rig: rigFor(model), ornament: ornamentOf(root) };
}

describe('Luxe’s ornament and its records and sleeves', () => {
  let set: Awaited<ReturnType<typeof luxeSet>>;
  beforeAll(async () => {
    set = await luxeSet();
  });

  it('loads the deck’s, the stand’s and the ledge’s ornament', () => {
    expect(set.ornament.length).toBeGreaterThan(10_000);
  });

  it('keeps 5 mm off every record and sleeve at rest: in the rack, on the platter and on the ledge', () => {
    const { rig, ornament } = set;
    applyPose(
      rig,
      restingPose(fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f'))), true, false),
      0,
    );
    let least = Infinity;
    rig.discs.slice(0, 6).forEach((copy, index) => {
      const record = closest(ornament, copy.object, toRecord);
      const sleeve = closest(ornament, copy.sleeve!.object, toSleeve);
      expect(record, `record ${index}`).toBeGreaterThan(CLEARANCE);
      expect(sleeve, `sleeve ${index}`).toBeGreaterThan(CLEARANCE);
      least = Math.min(least, record, sleeve);
    });
    // It measured something: the ledge's sleeve stands about 5.2 mm off the legs' vines.
    expect(Number.isFinite(least)).toBe(true);
  });

  it('keeps 5 mm off every record and its sleeve at every step of every flight', () => {
    const { rig, ornament } = set;
    const ways: [string, DiscPose['from'], DiscPose['to']][] = [
      ...[0, 1, 2, 3, 4].map((slot): [string, DiscPose['from'], DiscPose['to']] => [
        `slot ${slot} onto the platter`,
        slot,
        'spindle',
      ]),
      ['the platter back into slot 0', 'spindle', 0],
      ...[1, 2, 3, 4].map((slot): [string, DiscPose['from'], DiscPose['to']] => [
        `slot ${slot} down to slot ${slot - 1}`,
        slot,
        slot - 1,
      ]),
      ['the platter out of sight', 'spindle', null],
      ['out of sight onto the platter', null, 'spindle'],
    ];
    for (const [way, from, to] of ways) {
      for (let step = 0; step <= STEPS; step++) {
        const along = step / STEPS;
        applyPose(rig, only(1, { from, to, along }), 0);
        const copy = rig.discs[1];
        if (copy.object.visible) {
          expect(
            closest(ornament, copy.object, toRecord),
            `the record, ${way}, along ${along}`,
          ).toBeGreaterThan(CLEARANCE);
        }
        if (copy.sleeve?.object.visible) {
          expect(
            closest(ornament, copy.sleeve.object, toSleeve),
            `the sleeve, ${way}, along ${along}`,
          ).toBeGreaterThan(CLEARANCE);
        }
      }
    }
  });
});

/**
 * cd-player.glb as the page loads it, with its ornament and its disc measured before the rig takes
 * the disc for its copies, and the rig built from its own nodes.
 */
async function suitcaseSet(): Promise<{ rig: Rig; ornament: Vector3[]; disc: DiscShape }> {
  const root = await loadGlb(glbOf('suitcase'));
  const model = glbModel(root, 'suitcase');
  const ornament = ornamentOf(root);
  const disc = discShape(model.nodes.disc);
  return { rig: rigFor(model), ornament, disc };
}

describe('the suitcase’s ornament and its discs', () => {
  let set: Awaited<ReturnType<typeof suitcaseSet>>;
  let measure: Measure;
  beforeAll(async () => {
    set = await suitcaseSet();
    measure = toDisc(set.disc);
  });

  it('loads the tub’s, the deck’s and the lining’s ornament, and the disc it measures', () => {
    expect(set.ornament.length).toBeGreaterThan(10_000);
    // parts.py's disc: 120 mm across, 1.2 mm of polycarbonate under its 0.8 mm stacking ring.
    expect(set.disc.radius).toBeCloseTo(0.06, 4);
    expect(set.disc.top - set.disc.bottom).toBeCloseTo(0.0014, 4);
  });

  it('keeps 5 mm off every disc at rest: on the spindle and in the rack', () => {
    const { rig } = set;
    applyPose(
      rig,
      restingPose(fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f'))), true, false),
      0,
    );
    let least = Infinity;
    rig.discs.slice(0, 6).forEach((copy, index) => {
      expect(copy.object.visible, `disc ${index}`).toBe(true);
      const distance = closest(set.ornament, copy.object, measure);
      expect(distance, `disc ${index}`).toBeGreaterThan(CLEARANCE);
      least = Math.min(least, distance);
    });
    // It measured something: slot 4's disc stands about 13 mm off the lining's daisy under the strap.
    expect(Number.isFinite(least)).toBe(true);
  });

  it('keeps 5 mm off a disc at every step of every way it flies', () => {
    const { rig } = set;
    const slots = [0, 1, 2, 3, 4] as const;
    const ways: [string, DiscPose['from'], DiscPose['to']][] = [
      ...slots.flatMap((slot): [string, DiscPose['from'], DiscPose['to']][] => [
        [`slot ${slot} onto the spindle`, slot, 'spindle'],
        [`the spindle back into slot ${slot}`, 'spindle', slot],
      ]),
      ...[1, 2, 3, 4].map((slot): [string, DiscPose['from'], DiscPose['to']] => [
        `slot ${slot} down to slot ${slot - 1}`,
        slot,
        slot - 1,
      ]),
      ['the spindle out of sight', 'spindle', null],
      ['out of sight onto the spindle', null, 'spindle'],
    ];
    for (const [way, from, to] of ways) {
      for (let step = 0; step <= STEPS; step++) {
        const along = step / STEPS;
        applyPose(rig, only(1, { from, to, along }), 0);
        const copy = rig.discs[1];
        if (!copy.object.visible) continue;
        expect(
          closest(set.ornament, copy.object, measure),
          `${way}, along ${along}`,
        ).toBeGreaterThan(CLEARANCE);
      }
    }
  });
});
