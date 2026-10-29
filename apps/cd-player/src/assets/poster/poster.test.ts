import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CAPTURE } from '../../capture';
import { poster } from './index';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const SHAPES = ['landscape', 'portrait'] as const;
const WIDTHS = { landscape: [1280, 1920, 2560], portrait: [480, 750, 1080] } as const;

const fileOf = (url: string) => url.slice(url.lastIndexOf('/') + 1);

/** A srcset's entries: the file each names and the width it declares. */
function entries(srcset: string): { file: string; width: number }[] {
  return srcset.split(', ').map((entry) => {
    const [url, descriptor] = entry.split(' ');
    return { file: fileOf(url), width: Number.parseInt(descriptor, 10) };
  });
}

async function read(file: string) {
  const { width = 0, height = 0, hasAlpha = false } = await sharp(DIR + file).metadata();
  return { width, height, hasAlpha };
}

describe('poster', () => {
  it('lists each shape at three widths, smallest first', () => {
    for (const shape of SHAPES) {
      expect(entries(poster[shape].avif)).toEqual(
        WIDTHS[shape].map((width) => ({ file: `${shape}-${width}.avif`, width })),
      );
    }
  });

  it('falls back to one WebP per shape', () => {
    expect(fileOf(poster.landscape.fallback)).toBe('landscape-1920.webp');
    expect(fileOf(poster.portrait.fallback)).toBe('portrait-750.webp');
  });

  it("declares the capture's own size: its CSS viewport times its scale", () => {
    for (const shape of SHAPES) {
      const { viewport, scale } = CAPTURE[shape];
      expect(poster[shape].width).toBe(Math.round(viewport.width * scale));
      expect(poster[shape].height).toBe(Math.round(viewport.height * scale));
    }
  });

  it('holds the files it names, at the widths it gives and with alpha', async () => {
    for (const shape of SHAPES) {
      const { width, height, avif, fallback } = poster[shape];
      const named = [...entries(avif), { file: fileOf(fallback), width: 0 }];
      for (const { file, width: declared } of named) {
        const picture = await read(file);
        expect(picture.hasAlpha, file).toBe(true);
        if (declared) expect(picture.width, file).toBe(declared);
        expect(picture.width / picture.height, file).toBeCloseTo(width / height, 2);
      }
      // The largest file is the capture itself, whose size the `<img>` declares.
      const largest = await read(entries(avif).at(-1)?.file ?? '');
      expect([largest.width, largest.height], shape).toEqual([width, height]);
    }
  });
});
