import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';
import { DEFAULT_COLLECTION, sameCollection, SPOTIFY_ID } from './routes';

describe('presets', () => {
  it('lists twelve playlists, the page’s default first', () => {
    expect(PRESETS).toHaveLength(12);
    expect(PRESETS.every((preset) => preset.ref.type === 'playlist')).toBe(true);
    expect(sameCollection(PRESETS[0].ref, DEFAULT_COLLECTION)).toBe(true);
  });

  it('gives each a Spotify id of its own, a name and a tag', () => {
    const ids = PRESETS.map((preset) => preset.ref.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of PRESETS) {
      expect(preset.ref.id).toMatch(SPOTIFY_ID);
      expect(preset.name.trim()).not.toBe('');
      expect(preset.tag.trim()).not.toBe('');
    }
  });

  it('takes every cover from Spotify’s own image hosts, over https', () => {
    for (const preset of PRESETS) {
      const url = new URL(preset.cover);
      expect(url.protocol, preset.name).toBe('https:');
      expect(['i.scdn.co', 'charts-images.scdn.co'], preset.name).toContain(url.hostname);
    }
  });
});
