#!/usr/bin/env node
// Creates apps/strapi/.env from .env.example with freshly generated secrets.
// Idempotent: does nothing when .env already exists. Node built-ins only.
//   pnpm --filter @ncam/strapi setup:env
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Each gets its own fresh secret. */
export const SECRET_KEYS = [
  'API_TOKEN_SALT',
  'ADMIN_JWT_SECRET',
  'TRANSFER_TOKEN_SALT',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
];

/** Both get the SAME secret so Strapi and the postgres container agree. */
export const PASSWORD_KEYS = ['DATABASE_PASSWORD', 'POSTGRES_PASSWORD'];

export function randomSecret() {
  return randomBytes(32).toString('base64url');
}

/**
 * Returns `template` with every empty secret line (`KEY=`) filled in.
 * Lines that already have a value, comments and blank lines are returned unchanged.
 * @param {string} template contents of .env.example
 * @param {() => string} secret generator (injectable for tests)
 */
export function renderEnv(template, secret) {
  let password;
  return template
    .split('\n')
    .map((line) => {
      const match = /^([A-Z0-9_]+)=$/.exec(line);
      if (!match) return line;
      const key = match[1];
      if (key === 'APP_KEYS') return `${key}=${[secret(), secret(), secret(), secret()].join(',')}`;
      if (SECRET_KEYS.includes(key)) return `${key}=${secret()}`;
      if (PASSWORD_KEYS.includes(key)) {
        password ??= secret();
        return `${key}=${password}`;
      }
      return line;
    })
    .join('\n');
}

export function main() {
  const appDir = path.resolve(import.meta.dirname, '..');
  const target = path.join(appDir, '.env');
  const shown = path.relative(process.cwd(), target) || '.env';
  if (existsSync(target)) {
    console.log(`${shown} exists, nothing to do`);
    return;
  }
  const template = readFileSync(path.join(appDir, '.env.example'), 'utf8');
  writeFileSync(target, renderEnv(template, randomSecret), { mode: 0o600 });
  console.log(`wrote ${shown} with generated secrets (gitignored — never commit it)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
