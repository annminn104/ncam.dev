import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const BUILD = join(REPO, 'pipeline/build.mjs');
const ASSETS = join(REPO, '../public/assets');
const GARDEN = ['bbq_area', 'fence', 'flower_beds', 'garden_paths', 'veg_garden'];
const POND = ['koi_pond', 'tea_garden']; // part 3: the koi pond and the tea corner, in place of the placeholder pond
const CARPORT = ['carport', 'kennel']; // part 4: the carport with its two cars, the dog's corner with the Akita
const BASEMENT = ['basement']; // villa v2 spec §12 "Tầng hầm": the basement under the tall house, a module of its own
const INTERIOR = ['interior']; // §12 "Rèm và phụ kiện": the house's curtains and accessories, a module of its own

describe('pnpm --filter @ncam/garden-home art:assets', () => {
  it('--check validates every module without writing', () => {
    const result = spawnSync(process.execPath, [BUILD, '--check'], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    for (const id of [...POND, ...CARPORT, ...BASEMENT, ...INTERIOR])
      expect(result.stdout).toContain(`contract ${id}: ok`);
    expect(result.stdout).not.toContain('contract pond: ok');
    expect(result.stdout).toContain('contract yard: ok');
    expect(result.stdout).toContain('contract house: ok');
    expect(result.stdout).toContain('contract pool: ok');
    for (const id of GARDEN) expect(result.stdout).toContain(`contract ${id}: ok`);
    expect(result.stdout).toContain('contract: all modules ok');
  }, 120_000);

  it('builds both tiers and scene.json from the placeholder site', () => {
    const result = spawnSync(process.execPath, [BUILD], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const scene = JSON.parse(readFileSync(join(ASSETS, 'scene.json'), 'utf8'));
    expect(scene.version).toBe(1);
    expect(scene.slots.map((s) => s.id)).toEqual([
      'basement_01',
      'bbq_area_01',
      'carport_01',
      'fence_01',
      'flower_beds_01',
      'garden_paths_01',
      'house_01',
      'interior_01',
      'kennel_01',
      'koi_pond_01',
      'pool_01',
      'tea_garden_01',
      'veg_garden_01',
      'yard_01',
    ]);
    // the basement and the interior stand in the house's slot (villa v2 spec §12 "Tầng hầm", "Rèm và phụ kiện")
    const slot = (id) => scene.slots.find((s) => s.id === id);
    for (const id of ['basement_01', 'interior_01']) {
      expect(slot(id).position).toEqual(slot('house_01').position);
      expect(slot(id).rotation).toEqual(slot('house_01').rotation);
    }
    expect(Object.keys(scene.modules).sort()).toEqual(
      [...GARDEN, ...POND, ...CARPORT, ...BASEMENT, ...INTERIOR, 'house', 'pool', 'yard'].sort(),
    );
    expect(scene.modules.yard.footprint).toEqual([54, 46]); // the floating island under the 48 x 40 m yard
    expect(scene.modules.house.footprint).toEqual([23, 15]); // the tall house, villa v2 spec §12
    // the garden (part 2): spread over the island like the yard, or the size of its zone
    for (const id of ['fence', 'garden_paths', 'flower_beds'])
      expect(scene.modules[id].footprint).toEqual([54, 46]);
    expect(scene.modules.veg_garden.footprint).toEqual([8, 8]);
    expect(scene.modules.bbq_area.footprint).toEqual([8, 6]);
    for (const id of GARDEN) expect(scene.modules[id].role).toBe('prop');
    // the pond's modules fill their zones
    expect(scene.modules.koi_pond.footprint).toEqual([11, 8]);
    expect(scene.modules.tea_garden.footprint).toEqual([6, 3.5]);
    for (const id of POND) expect(scene.modules[id].role).toBe('prop');
    // the carport and the dog's corner fill their zones too
    expect(scene.modules.carport.footprint).toEqual([8, 7]);
    expect(scene.modules.kennel.footprint).toEqual([3, 3]);
    for (const id of CARPORT) expect(scene.modules[id].role).toBe('prop');
    // the basement shares the house's footprint, a prop for the triangle budget the house keeps
    expect(scene.modules.basement.footprint).toEqual([23, 15]);
    expect(scene.modules.basement.role).toBe('prop');
    // so does the interior
    expect(scene.modules.interior.footprint).toEqual([23, 15]);
    expect(scene.modules.interior.role).toBe('prop');
    for (const tier of ['high', 'medium'])
      expect(existsSync(join(ASSETS, 'modules', `pond.${tier}.glb`))).toBe(false);
    for (const id of [
      ...GARDEN,
      ...POND,
      ...CARPORT,
      ...BASEMENT,
      ...INTERIOR,
      'house',
      'pool',
      'yard',
    ]) {
      for (const tier of ['high', 'medium']) {
        expect(existsSync(join(ASSETS, 'modules', `${id}.${tier}.glb`))).toBe(true);
      }
    }
  }, 300_000);
});
