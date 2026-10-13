import { describe, expect, it } from 'vitest';
import { parseCaptureArgs } from './capture-args.mjs';

const FIGURES = ['holy-order'];

describe('parseCaptureArgs', () => {
  it('takes no argument as the lobby previews', () => {
    expect(parseCaptureArgs([], FIGURES)).toEqual({ review: false, preset: null });
  });

  it('reads --review, for the default figure set or a named one', () => {
    expect(parseCaptureArgs(['--review'], FIGURES)).toEqual({ review: true, preset: 'holy-order' });
    expect(parseCaptureArgs(['--review', 'dark-court'], ['holy-order', 'dark-court'])).toEqual({
      review: true,
      preset: 'dark-court',
    });
  });

  it('drops the leading -- that pnpm hands on in `pnpm capture:presets -- --review`', () => {
    expect(parseCaptureArgs(['--', '--review', 'holy-order'], FIGURES)).toEqual({
      review: true,
      preset: 'holy-order',
    });
    expect(parseCaptureArgs(['--', '--', '--review'], FIGURES).review).toBe(true);
    expect(parseCaptureArgs(['--'], FIGURES)).toEqual({ review: false, preset: null });
  });

  it('stops on a mode it does not know, rather than rewriting the lobby previews', () => {
    for (const argv of [['--reviw'], ['review'], ['holy-order'], ['--help'], ['--', '-x']]) {
      expect(() => parseCaptureArgs(argv, FIGURES), argv.join(' ')).toThrow(/unknown argument/);
    }
  });

  it('stops on a review set that is not a figure preset', () => {
    for (const preset of ['holy-ordr', 'treasures', '--', '']) {
      expect(() => parseCaptureArgs(['--review', preset], FIGURES), preset).toThrow(
        /not a figure preset/,
      );
    }
  });

  it('stops on arguments after the review set', () => {
    expect(() => parseCaptureArgs(['--review', 'holy-order', 'more'], FIGURES)).toThrow(
      /unexpected argument "more"/,
    );
  });
});
