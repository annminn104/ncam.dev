import { describe, expect, it } from 'vitest';
import { originOf, rebaseCssUrls } from './css';

describe('originOf()', () => {
  it('names the origin a module was fetched from', () => {
    expect(originOf('https://ncam-viktor.vercel.app/assets/ssr-Ab12.js')).toBe(
      'https://ncam-viktor.vercel.app',
    );
    expect(originOf('http://localhost:9004/assets/ssr.js')).toBe('http://localhost:9004');
  });

  it('has none for a file on disk or a string that is no URL', () => {
    expect(originOf('file:///srv/app/dist/ssr.js')).toBe('');
    expect(originOf('not a url')).toBe('');
  });
});

describe('rebaseCssUrls()', () => {
  const origin = 'https://ncam-bali.vercel.app';

  it('points root-relative urls at the origin, quoted or not', () => {
    const css =
      "@font-face{src:url(/assets/a.woff2) format('woff2')}" +
      '.b{background:url("/assets/b.png")}' +
      ".c{background:url('/assets/c.png')}";
    expect(rebaseCssUrls(css, origin)).toBe(
      `@font-face{src:url(${origin}/assets/a.woff2) format('woff2')}` +
        `.b{background:url("${origin}/assets/b.png")}` +
        `.c{background:url('${origin}/assets/c.png')}`,
    );
  });

  it('leaves absolute, protocol-relative and data: urls alone', () => {
    const css =
      '.a{background:url(https://cdn.example/a.png)}' +
      '.b{background:url(//cdn.example/b.png)}' +
      '.c{background:url(data:image/png;base64,AAAA)}';
    expect(rebaseCssUrls(css, origin)).toBe(css);
  });

  it('changes nothing without an origin', () => {
    const css = '.a{background:url(/assets/a.png)}';
    expect(rebaseCssUrls(css, '')).toBe(css);
  });
});
