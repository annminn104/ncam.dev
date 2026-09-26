import { describe, expect, it } from 'vitest';
import { getProject, projects } from './index';

describe('project-registry', () => {
  it('exposes the live projects in gallery order', () => {
    expect(projects.map((p) => p.id)).toEqual([
      'toonhub',
      'mindloop',
      'immersive-ocean',
      'viktor',
      'bali',
      'holodex',
    ]);
  });

  it('getProject() finds by id and returns undefined for unknown ids', () => {
    expect(getProject('mindloop')?.remote).toBe('mindloop');
    // route id is kebab-case, but the MF remote name must be a valid identifier
    expect(getProject('immersive-ocean')?.remote).toBe('immersive_ocean');
    expect(getProject('does-not-exist')).toBeUndefined();
  });

  it('every entry has the fields the host + SEO rely on', () => {
    for (const p of projects) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.remote).toBeTruthy();
      expect(p.module).toBe('./mount');
      expect(p.accent).toMatch(/^#[0-9a-f]{6}$/i);
      // capture-thumbnails.mjs picks the encoder from this extension
      expect(p.thumbnail).toMatch(/^\/thumbnails\/.+\.(jpg|png)$/);
      expect(['live', 'coming-soon']).toContain(p.status);
    }
  });

  it('marks only route-aware remotes, defaulting the rest to not-route-aware', () => {
    // The host's splat route answers 200 at any depth, so this flag is what
    // keeps /projects/<id>/anything out of the index for the remotes that
    // render a single page. Absent must mean no.
    expect(getProject('holodex')?.routeAware).toBe(true);
    for (const p of projects.filter((p) => p.id !== 'holodex')) {
      expect(p.routeAware).toBeUndefined();
    }
  });

  it('ids are unique', () => {
    const ids = projects.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
