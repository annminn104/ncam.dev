import { describe, expect, it } from 'vitest';
import { renderEnv } from './setup-env.mjs';

const template = [
  '# Server',
  'HOST=0.0.0.0',
  'PORT=1337',
  'PUBLIC_URL=',
  '',
  'APP_KEYS=',
  'API_TOKEN_SALT=',
  'ADMIN_JWT_SECRET=',
  'TRANSFER_TOKEN_SALT=',
  'JWT_SECRET=',
  'ENCRYPTION_KEY=',
  'DATABASE_CLIENT=sqlite',
  'DATABASE_HOST=',
  'DATABASE_PASSWORD=',
  'POSTGRES_PASSWORD=',
].join('\n');

function counter(): () => string {
  let n = 0;
  return () => `secret${++n}`;
}

function parse(env: string): Record<string, string> {
  const entries = env
    .split('\n')
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const eq = line.indexOf('=');
      return [line.slice(0, eq), line.slice(eq + 1)] as const;
    });
  return Object.fromEntries(entries);
}

const SECRETS = [
  'API_TOKEN_SALT',
  'ADMIN_JWT_SECRET',
  'TRANSFER_TOKEN_SALT',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
];

describe('renderEnv', () => {
  it('fills every empty secret and leaves other lines untouched', () => {
    const out = parse(renderEnv(template, counter()));
    expect(out.HOST).toBe('0.0.0.0');
    expect(out.PORT).toBe('1337');
    expect(out.DATABASE_CLIENT).toBe('sqlite');
    for (const key of SECRETS) expect(out[key]).toMatch(/^secret\d+$/);
    // deliberately environment-specific, must stay empty
    expect(out.PUBLIC_URL).toBe('');
    expect(out.DATABASE_HOST).toBe('');
  });

  it('gives APP_KEYS four distinct comma-separated secrets', () => {
    const keys = parse(renderEnv(template, counter())).APP_KEYS.split(',');
    expect(keys).toHaveLength(4);
    expect(new Set(keys).size).toBe(4);
  });

  it('shares one password between DATABASE_PASSWORD and POSTGRES_PASSWORD', () => {
    const out = parse(renderEnv(template, counter()));
    expect(out.DATABASE_PASSWORD).toMatch(/^secret\d+$/);
    expect(out.POSTGRES_PASSWORD).toBe(out.DATABASE_PASSWORD);
  });

  it('keeps comments and blank lines, and is a no-op on an already filled file', () => {
    const once = renderEnv(template, counter());
    expect(once.startsWith('# Server\n')).toBe(true);
    expect(once).toContain('\n\n');
    expect(renderEnv(once, counter())).toBe(once);
  });
});
