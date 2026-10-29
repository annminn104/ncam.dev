import { describe, expect, it, vi } from 'vitest';
import { copyText } from './LinkBar';

describe('copyText (Share)', () => {
  it('copies the text', async () => {
    const writeText = vi.fn(async () => {});
    await expect(copyText('https://ncam.dev/x', { writeText })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://ncam.dev/x');
  });

  it('answers false, never a rejection, when the clipboard refuses or is missing', async () => {
    const writeText = vi.fn(() =>
      Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
    );
    await expect(copyText('https://ncam.dev/x', { writeText })).resolves.toBe(false);
    // A page on plain http has no navigator.clipboard.
    await expect(copyText('https://ncam.dev/x', undefined)).resolves.toBe(false);
  });
});
