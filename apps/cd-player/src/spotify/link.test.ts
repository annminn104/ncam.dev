import { describe, expect, it } from 'vitest';
import { linkErrorMessage, parseSpotifyLink } from './link';

const ID = '37i9dQZEVXbMDoHDwVN2tF';
const ok = (type: 'playlist' | 'album', id = ID) => ({ ok: true, ref: { type, id } });

describe('parseSpotifyLink', () => {
  it('reads the default share link with its query string', () => {
    expect(
      parseSpotifyLink(`https://open.spotify.com/playlist/${ID}?si=96RqA-F0RCW66YzTjyQcow`),
    ).toEqual(ok('playlist'));
  });

  it('reads localised, embed and scheme-less links', () => {
    expect(parseSpotifyLink(`https://open.spotify.com/intl-vi/album/${ID}`)).toEqual(ok('album'));
    expect(parseSpotifyLink(`https://open.spotify.com/embed/playlist/${ID}`)).toEqual(
      ok('playlist'),
    );
    expect(parseSpotifyLink(`open.spotify.com/album/${ID}/`)).toEqual(ok('album'));
  });

  it('reads spotify: URIs and a bare id (a playlist)', () => {
    expect(parseSpotifyLink(`spotify:album:${ID}`)).toEqual(ok('album'));
    expect(parseSpotifyLink(`  ${ID}  `)).toEqual(ok('playlist'));
  });

  it('refuses tracks, artists and episodes as unsupported', () => {
    expect(parseSpotifyLink(`https://open.spotify.com/track/${ID}`)).toEqual({
      ok: false,
      reason: 'unsupported',
    });
    expect(parseSpotifyLink(`spotify:artist:${ID}`)).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('refuses everything else as invalid or empty', () => {
    expect(parseSpotifyLink('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseSpotifyLink('   ')).toEqual({ ok: false, reason: 'empty' });
    for (const input of [
      'hello',
      `https://example.com/playlist/${ID}`,
      'https://open.spotify.com/playlist/short',
    ]) {
      expect(parseSpotifyLink(input), input).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('has a message for every failure', () => {
    for (const reason of ['empty', 'unsupported', 'invalid'] as const) {
      expect(linkErrorMessage(reason)).toMatch(/\w/);
    }
  });
});
