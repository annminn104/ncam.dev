/**
 * Lighthouse CI for every page type, against the production build that
 * scripts/lighthouse/serve.mjs serves (host, remotes, stand-in CMS). The
 * default is Lighthouse's mobile emulation; LH_FORM_FACTOR=desktop switches to
 * its desktop preset. Each page runs three times and is judged on its median
 * run, so one noisy run can neither pass nor fail it.
 *
 * Throttling is DevTools' (the network and CPU profile applied in the browser,
 * metrics as measured), not Lighthouse's default simulation. The simulation
 * replays the unthrottled load and treats whatever finished before first paint
 * as needed for it; served from localhost, every script, font and preload has
 * finished by then, so all of the hydration JavaScript lands on the simulated
 * LCP, which no network the site is served over would do.
 *
 *   pnpm build && pnpm lighthouse
 *   LH_FORM_FACTOR=desktop pnpm lighthouse
 */
const { READY, auditedPaths, ports } = require('./scripts/lighthouse/config.cjs');

const formFactor = process.env.LH_FORM_FACTOR === 'desktop' ? 'desktop' : 'mobile';
const origin = `http://localhost:${ports().host}`;
/** One report folder per form factor and shard (see LH_SHARD in scripts/lighthouse/config.cjs). */
const shardSuffix = process.env.LH_SHARD ? `-${process.env.LH_SHARD.split('/')[0]}` : '';

/**
 * The desktop preset's link (40 ms, 10 Mbps, no CPU slowdown), applied in the
 * browser. The preset itself only simulates it and leaves DevTools throttling
 * at 0, which on localhost is no throttling at all. Latency and throughput use
 * Lighthouse's own DevTools factors (× 3.75, × 0.9), as its mobile profile does.
 */
const DESKTOP_THROTTLING = {
  rttMs: 40,
  throughputKbps: 10 * 1024,
  requestLatencyMs: 40 * 3.75,
  downloadThroughputKbps: 10 * 1024 * 0.9,
  uploadThroughputKbps: 10 * 1024 * 0.9,
  cpuSlowdownMultiplier: 1,
};

/** Every category at 100, on the median of the runs. */
const perfect = ['error', { minScore: 1, aggregationMethod: 'median-run' }];

module.exports = {
  ci: {
    collect: {
      url: auditedPaths().map((path) => origin + path),
      startServerCommand: 'node scripts/lighthouse/serve.mjs',
      startServerReadyPattern: READY,
      startServerReadyTimeout: 300_000,
      numberOfRuns: 3,
      settings: {
        ...(formFactor === 'desktop' ? { preset: 'desktop', throttling: DESKTOP_THROTTLING } : {}),
        throttlingMethod: 'devtools',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        chromeFlags: '--headless=new --no-first-run',
      },
    },
    assert: {
      assertions: {
        'categories:performance': perfect,
        'categories:accessibility': perfect,
        'categories:best-practices': perfect,
        'categories:seo': perfect,
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: `.lighthouseci/${formFactor}${shardSuffix}`,
    },
  },
};
