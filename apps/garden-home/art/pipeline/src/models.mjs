/**
 * Generator steps behind `pnpm --filter @ncam/garden-home art:models` (glass villa spec §8.4, villa v2 parts 2 to 4). site.blend links the house,
 * the pool, the garden modules, the pond's and the carport's, so the placeholder script (yard, site, broken fixture)
 * runs last; the yard's lawn has the koi pond's hole and the basement's pit. Without force every script keeps existing
 * files. `only` names the modules to build (house, pool, the garden's fence, garden_paths, flower_beds, veg_garden and
 * bbq_area, the pond's koi_pond and tea_garden, the carport, the kennel, the basement under the house, villa v2 spec
 * §12, and the interior, the house's curtains and accessories) and the placeholder parts (yard, site, broken): the
 * garden can be rebuilt without regenerating the house.
 */
export const GENERATORS = [
  ['house', 'houses/build_house.py'],
  ['pool', 'houses/build_pool.py'],
  ['fence', 'garden/build_fence.py'],
  ['garden_paths', 'garden/build_paths.py'],
  ['flower_beds', 'garden/build_beds.py'],
  ['veg_garden', 'garden/build_veg.py'],
  ['bbq_area', 'garden/build_bbq.py'],
  ['koi_pond', 'pond/build_koi.py'],
  ['tea_garden', 'pond/build_tea.py'],
  ['carport', 'carport/build_carport.py'],
  ['kennel', 'carport/build_kennel.py'],
  ['basement', 'basement/build_basement.py'],
  ['interior', 'interior/build_interior.py'],
];
export const PLACEHOLDER_PARTS = ['yard', 'site', 'broken'];

export function modelSteps(blenderDir, force, only = null) {
  const flag = force ? ['--force'] : [];
  const known = [...GENERATORS.map(([name]) => name), ...PLACEHOLDER_PARTS];
  // `--only` with nothing after it would build nothing and still exit 0, which reads like success.
  if (only !== null && only.length === 0)
    throw new Error(`--only needs at least one model step: some of ${known.join(', ')}`);
  const unknown = (only ?? []).filter((name) => !known.includes(name));
  if (unknown.length)
    throw new Error(
      `unknown model step(s) ${unknown.join(', ')}: expected some of ${known.join(', ')}`,
    );
  const wanted = (name) => only === null || only.includes(name);
  const steps = GENERATORS.filter(([name]) => wanted(name)).map(([, script]) => ({
    script,
    args: [...flag],
  }));
  const parts = PLACEHOLDER_PARTS.filter(wanted);
  if (parts.length) {
    const subset = only === null ? [] : ['--only', ...parts];
    steps.push({
      script: 'dev/make_placeholders.py',
      args: ['--root', blenderDir, ...flag, ...subset],
    });
  }
  return steps;
}
