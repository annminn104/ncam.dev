/**
 * What the Lighthouse harness serves and audits, shared by serve.mjs and
 * lighthouserc.cjs so the two can never disagree on a port or a page.
 * CommonJS because Lighthouse CI loads its config with require().
 */

/** Printed by serve.mjs once every server answers; lhci waits for it. */
const READY = 'lighthouse harness ready';

/** Every page type the site has: home, blog, a post, each project stage. */
const AUDITED_PATHS = [
  '/',
  '/blog',
  // scripts/lighthouse/fixtures/articles.json
  '/blog/micro-frontends-without-the-framework-tax',
  '/projects/toonhub',
  '/projects/mindloop',
  '/projects/immersive-ocean',
  '/projects/viktor',
  '/projects/bali',
  '/projects/holodex',
];

/**
 * The pages this run audits: all of them, or with LH_SHARD=<n>/<of> every
 * <of>th one from the <n>th, so CI can spread a form factor over parallel jobs
 * (a page is three runs, each up to Lighthouse's 45 s wait for the load to
 * settle while a remote streams video).
 */
function auditedPaths() {
  const shard = process.env.LH_SHARD;
  if (!shard) return AUDITED_PATHS;
  const match = /^(\d+)\/(\d+)$/.exec(shard);
  const n = match ? Number(match[1]) : 0;
  const of = match ? Number(match[2]) : 0;
  if (n < 1 || n > of) throw new Error(`LH_SHARD must look like 1/3, got "${shard}"`);
  return AUDITED_PATHS.filter((_, index) => index % of === n - 1);
}

/** The .env defaults (host 9000, remotes 9001-9007, CMS 1337), shifted by LH_PORT_OFFSET. */
function ports() {
  const offset = Number(process.env.LH_PORT_OFFSET ?? '0');
  if (!Number.isInteger(offset) || offset < 0)
    throw new Error('LH_PORT_OFFSET must be a whole number');
  return { offset, host: 9000 + offset, cms: 1337 + offset };
}

/** The remotes the host mounts, each on its .env port. */
function remotes() {
  const { offset } = ports();
  return [
    { name: 'toonhub', pkg: '@ncam/toonhub', key: 'TOONHUB', port: 9001 },
    { name: 'mindloop', pkg: '@ncam/mindloop', key: 'MINDLOOP', port: 9002 },
    { name: 'immersive-ocean', pkg: '@ncam/immersive-ocean', key: 'IMMERSIVE_OCEAN', port: 9003 },
    { name: 'viktor', pkg: '@ncam/viktor', key: 'VIKTOR', port: 9004 },
    { name: 'bali', pkg: '@ncam/bali', key: 'BALI', port: 9005 },
    { name: 'profile', pkg: '@ncam/profile', key: 'PROFILE', port: 9006 },
    { name: 'holodex', pkg: '@ncam/holodex', key: 'HOLODEX', port: 9007 },
  ].map((remote) => ({ ...remote, port: remote.port + offset }));
}

module.exports = { READY, AUDITED_PATHS, auditedPaths, ports, remotes };
