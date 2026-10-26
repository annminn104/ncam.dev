import { describe, expect, it } from 'vitest';
import { standaloneView } from './routes';

describe('standaloneView', () => {
  it('serves the wallpaper at /wallpaper, with or without a trailing slash or a base', () => {
    expect(standaloneView('/wallpaper', '')).toBe('wallpaper');
    expect(standaloneView('/wallpaper/', '?t=21:00')).toBe('wallpaper');
    expect(standaloneView('/garden/wallpaper', '')).toBe('wallpaper');
  });

  it('serves the site everywhere else', () => {
    expect(standaloneView('/', '')).toBe('site');
    expect(standaloneView('/wallpapers', '')).toBe('site');
  });

  it('lets ?capture= win', () => {
    expect(standaloneView('/', '?capture=landscape')).toBe('capture');
    expect(standaloneView('/wallpaper', '?capture=portrait')).toBe('capture');
  });
});
