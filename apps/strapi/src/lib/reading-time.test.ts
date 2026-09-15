import { describe, expect, it } from 'vitest';
import { WORDS_PER_MINUTE, countWords, estimateReadingTime } from './reading-time';

const text = (value: string) => ({ type: 'text', text: value });
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children });
const words = (count: number) => Array.from({ length: count }, (_, i) => `w${i}`).join(' ');

describe('countWords', () => {
  it('counts words in headings, paragraphs, links, lists and quotes', () => {
    const blocks = [
      { type: 'heading', level: 2, children: [text('Two words')] },
      paragraph(text('one two'), {
        type: 'link',
        url: 'https://ncam.dev',
        children: [text('three')],
      }),
      {
        type: 'list',
        format: 'unordered',
        children: [{ type: 'list-item', children: [text('four five')] }],
      },
      { type: 'quote', children: [text('six')] },
    ];
    expect(countWords(blocks)).toBe(8);
  });

  it('ignores nodes without text leaves (images, empty code blocks)', () => {
    const blocks = [
      { type: 'image', image: { url: '/uploads/a.png', alternativeText: 'not counted words' } },
      { type: 'code', children: [] },
    ];
    expect(countWords(blocks)).toBe(0);
  });

  it('treats any whitespace run as one separator', () => {
    expect(countWords([paragraph(text('  a \n b\t c  '))])).toBe(3);
  });

  it('returns 0 for anything that is not a blocks tree', () => {
    expect(countWords(undefined)).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords('plain string')).toBe(0);
    expect(countWords(42)).toBe(0);
  });
});

describe('estimateReadingTime', () => {
  it('is never below one minute', () => {
    expect(estimateReadingTime(undefined)).toBe(1);
    expect(estimateReadingTime([])).toBe(1);
    expect(estimateReadingTime([paragraph(text('short'))])).toBe(1);
  });

  it('rounds up at the 200 words-per-minute boundary', () => {
    expect(WORDS_PER_MINUTE).toBe(200);
    expect(estimateReadingTime([paragraph(text(words(199)))])).toBe(1);
    expect(estimateReadingTime([paragraph(text(words(200)))])).toBe(1);
    expect(estimateReadingTime([paragraph(text(words(201)))])).toBe(2);
    expect(estimateReadingTime([paragraph(text(words(1000)))])).toBe(5);
  });
});
