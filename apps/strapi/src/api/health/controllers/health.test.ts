import { describe, expect, it, vi } from 'vitest';
import routes from '../routes/health';
import { checkHealth } from './health';

function fakeContext() {
  const headers: Record<string, string> = {};
  return {
    status: 404,
    body: undefined as unknown,
    headers,
    set(field: string, value: string) {
      headers[field] = value;
    },
  };
}

describe('checkHealth', () => {
  it('answers 200 when the database answers', async () => {
    const ctx = fakeContext();

    await checkHealth(ctx, async () => [{ '?column?': 1 }]);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toMatchObject({ status: 'ok', database: 'ok' });
    expect(ctx.headers['Cache-Control']).toBe('no-store');
  });

  it('answers 503 without the error when the database does not', async () => {
    const ctx = fakeContext();
    const onError = vi.fn();
    const failure = new Error('connect ECONNREFUSED 10.0.0.5:5432');

    await checkHealth(ctx, async () => Promise.reject(failure), onError);

    expect(ctx.status).toBe(503);
    expect(ctx.body).toMatchObject({ status: 'error', database: 'unreachable' });
    expect(JSON.stringify(ctx.body)).not.toContain('ECONNREFUSED');
    expect(onError).toHaveBeenCalledWith(failure);
    expect(ctx.headers['Cache-Control']).toBe('no-store');
  });
});

describe('health route', () => {
  it('is a public GET /health (served as /api/health)', () => {
    expect(routes.routes).toEqual([
      expect.objectContaining({
        method: 'GET',
        path: '/health',
        handler: 'api::health.health.check',
        config: expect.objectContaining({ auth: false }),
      }),
    ]);
  });
});
