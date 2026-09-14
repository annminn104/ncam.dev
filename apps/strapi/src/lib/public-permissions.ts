import type { Core } from '@strapi/strapi';

/** Content API actions the anonymous (Public) role must always have. */
export const PUBLIC_READ_ACTIONS = [
  'api::article.article.find',
  'api::article.article.findOne',
  'api::tag.tag.find',
  'api::tag.tag.findOne',
] as const;

const ROLE_UID = 'plugin::users-permissions.role';
const PERMISSION_UID = 'plugin::users-permissions.permission';

/**
 * Grants the Public role every action in PUBLIC_READ_ACTIONS it does not have yet.
 * Never removes or disables anything, so extra grants made in the admin survive.
 * Returns the actions that were added (empty when already up to date).
 */
export async function ensurePublicReadPermissions(strapi: Core.Strapi): Promise<string[]> {
  const publicRole = await strapi.db.query(ROLE_UID).findOne({ where: { type: 'public' } });
  if (!publicRole) {
    strapi.log.warn('[public-permissions] Public role not found, nothing granted');
    return [];
  }

  const existing: Array<{ action: string }> = await strapi.db.query(PERMISSION_UID).findMany({
    where: { role: { id: publicRole.id }, action: { $in: [...PUBLIC_READ_ACTIONS] } },
  });
  const granted = new Set(existing.map((permission) => permission.action));
  const missing = PUBLIC_READ_ACTIONS.filter((action) => !granted.has(action));

  for (const action of missing) {
    await strapi.db.query(PERMISSION_UID).create({ data: { action, role: publicRole.id } });
  }

  if (missing.length > 0) {
    strapi.log.info(`[public-permissions] granted to Public role: ${missing.join(', ')}`);
  }
  return [...missing];
}
