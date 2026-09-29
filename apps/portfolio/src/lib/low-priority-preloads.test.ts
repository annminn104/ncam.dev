import { describe, expect, it } from 'vitest';
import {
  lowerModulePreloads,
  lowerModulePreloadsStream,
  rewriteModulePreloads,
  type PreloadMode,
} from './low-priority-preloads';

const LINK = '<link rel="modulepreload" href="/assets/index.js"/>';
const LOW = '<link rel="modulepreload" fetchpriority="low" href="/assets/index.js"/>';

/** Runs `chunks` through the stream and joins what comes out. */
async function streamed(chunks: string[], mode: PreloadMode = 'lower'): Promise<string> {
  const source = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  let out = '';
  const reader = source.pipeThrough(lowerModulePreloadsStream(mode)).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out += value;
  }
}

describe('lowerModulePreloads', () => {
  it('puts every modulepreload link at low priority and leaves the rest alone', () => {
    const html = `<head>${LINK}${LINK}<link rel="stylesheet" href="/a.css"/></head>`;
    expect(lowerModulePreloads(html)).toBe(
      `<head>${LOW}${LOW}<link rel="stylesheet" href="/a.css"/></head>`,
    );
  });
});

describe('lowerModulePreloadsStream', () => {
  it('matches the one-shot result however the tag is split across chunks', async () => {
    const html = `<!DOCTYPE html><html><head>${LINK}<title>x</title>${LINK}</head><body></body></html>`;
    const expected = lowerModulePreloads(html);
    // Every split point, so a tag cut anywhere is still found.
    for (let at = 1; at < html.length; at++) {
      expect(await streamed([html.slice(0, at), html.slice(at)])).toBe(expected);
    }
  });

  it('passes a document without preloads through unchanged', async () => {
    expect(await streamed(['<p>no links', ' here</p>'])).toBe('<p>no links here</p>');
  });
});

describe('dropping the preloads (a project page)', () => {
  const html = `<!DOCTYPE html><html><head>${LINK}<title>x</title>${LINK}</head><body><img src="/a.webp"/></body></html>`;
  const expected =
    '<!DOCTYPE html><html><head><title>x</title></head><body><img src="/a.webp"/></body></html>';

  it('removes every modulepreload link and nothing else', () => {
    expect(rewriteModulePreloads(html, 'drop')).toBe(expected);
  });

  it('removes them however a tag is split across chunks', async () => {
    for (let at = 1; at < html.length; at++) {
      expect(await streamed([html.slice(0, at), html.slice(at)], 'drop')).toBe(expected);
    }
  });
});
