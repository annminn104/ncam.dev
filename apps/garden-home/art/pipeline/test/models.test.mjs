import { describe, expect, it } from 'vitest';
import { modelSteps } from '../src/models.mjs';

const GARDEN = [
  'garden/build_fence.py',
  'garden/build_paths.py',
  'garden/build_beds.py',
  'garden/build_veg.py',
  'garden/build_bbq.py',
  'pond/build_koi.py',
  'pond/build_tea.py',
  'carport/build_carport.py',
  'carport/build_kennel.py',
  'basement/build_basement.py',
  'interior/build_interior.py',
];

describe('modelSteps', () => {
  it('builds house, pool and the garden modules before the site that links them', () => {
    expect(modelSteps('/repo/blender', false).map((s) => s.script)).toEqual([
      'houses/build_house.py',
      'houses/build_pool.py',
      ...GARDEN,
      'dev/make_placeholders.py',
    ]);
  });

  it('keeps existing files unless forced', () => {
    expect(modelSteps('/repo/blender', false).map((s) => s.args)).toEqual([
      [],
      [],
      ...GARDEN.map(() => []),
      ['--root', '/repo/blender'],
    ]);
    expect(modelSteps('/repo/blender', true).map((s) => s.args)).toEqual([
      ['--force'],
      ['--force'],
      ...GARDEN.map(() => ['--force']),
      ['--root', '/repo/blender', '--force'],
    ]);
  });

  it('runs only the steps it is told to, in their order', () => {
    expect(
      modelSteps('/repo/blender', true, ['fence', 'site']).map((s) => [s.script, s.args]),
    ).toEqual([
      ['garden/build_fence.py', ['--force']],
      ['dev/make_placeholders.py', ['--root', '/repo/blender', '--force', '--only', 'site']],
    ]);
  });

  it('refuses names it does not know', () => {
    expect(() => modelSteps('/repo/blender', true, ['fence', 'gazebo'])).toThrow(
      /unknown model step\(s\) gazebo/,
    );
  });

  it('builds the koi pond and the tea corner (part 3) and no longer the placeholder pond', () => {
    expect(
      modelSteps('/repo/blender', true, ['koi_pond', 'tea_garden', 'yard', 'site']).map((s) => [
        s.script,
        s.args,
      ]),
    ).toEqual([
      ['pond/build_koi.py', ['--force']],
      ['pond/build_tea.py', ['--force']],
      [
        'dev/make_placeholders.py',
        ['--root', '/repo/blender', '--force', '--only', 'yard', 'site'],
      ],
    ]);
    expect(() => modelSteps('/repo/blender', true, ['pond'])).toThrow(
      /unknown model step\(s\) pond/,
    );
  });

  it('builds the carport and the kennel (part 4) before the site that links them', () => {
    expect(
      modelSteps('/repo/blender', true, ['carport', 'kennel', 'site']).map((s) => [
        s.script,
        s.args,
      ]),
    ).toEqual([
      ['carport/build_carport.py', ['--force']],
      ['carport/build_kennel.py', ['--force']],
      ['dev/make_placeholders.py', ['--root', '/repo/blender', '--force', '--only', 'site']],
    ]);
  });

  it('builds the basement under the house (art/README.md, Basement) before the yard holed for it and the site', () => {
    expect(
      modelSteps('/repo/blender', true, ['basement', 'house', 'yard', 'site']).map((s) => [
        s.script,
        s.args,
      ]),
    ).toEqual([
      ['houses/build_house.py', ['--force']],
      ['basement/build_basement.py', ['--force']],
      [
        'dev/make_placeholders.py',
        ['--root', '/repo/blender', '--force', '--only', 'yard', 'site'],
      ],
    ]);
  });

  it('builds the interior (art/README.md, Interior) with the house before the site that links them', () => {
    expect(
      modelSteps('/repo/blender', true, ['interior', 'house', 'site']).map((s) => [
        s.script,
        s.args,
      ]),
    ).toEqual([
      ['houses/build_house.py', ['--force']],
      ['interior/build_interior.py', ['--force']],
      ['dev/make_placeholders.py', ['--root', '/repo/blender', '--force', '--only', 'site']],
    ]);
  });

  it('refuses --only without a name instead of building nothing', () => {
    expect(() => modelSteps('/repo/blender', true, [])).toThrow(
      /--only needs at least one model step: some of house, pool, fence/,
    );
  });
});
