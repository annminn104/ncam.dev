import { describe, expect, it } from 'vitest';
import { backdropStyle, showsSky } from './backdrop';

describe('backdrop', () => {
  it('draws the image behind the transparent canvas, covering the screen from its centre', () => {
    expect(backdropStyle('/backgrounds/example.jpg')).toEqual({
      backgroundImage: 'url("/backgrounds/example.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    });
  });

  it('keeps the sky without an image, while it loads and when it fails: it goes only once the photo has decoded', () => {
    expect(showsSky('none')).toBe(true);
    expect(showsSky('loading')).toBe(true); // no navy page behind a transparent canvas while the file is on its way
    expect(showsSky('failed')).toBe(true);
    expect(showsSky('ready')).toBe(false);
  });
});
