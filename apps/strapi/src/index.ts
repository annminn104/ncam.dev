import type { Core } from '@strapi/strapi';
import { ensurePublicReadPermissions } from './lib/public-permissions';

export default {
  register() {},

  /** Runs after every plugin has bootstrapped, on each start (develop, start, Docker). */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensurePublicReadPermissions(strapi);
  },
};
