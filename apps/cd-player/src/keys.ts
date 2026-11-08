/**
 * What a key does on the page (App's key handler, which keeps the browser's own keys to it: never
 * with Ctrl, ⌘ or Alt, never while typing or on a focused control, and a held key is one press).
 * Space, N and P play; +, - and 0 work the camera (src/camera-channel.ts). Three-free.
 */
export type KeyCommand = 'toggle' | 'next' | 'prev' | 'zoom-in' | 'zoom-out' | 'reset';

/** Space by its place on the keyboard; the rest by what they type (= is + without Shift). */
export function keyCommand(event: Pick<KeyboardEvent, 'key' | 'code'>): KeyCommand | null {
  if (event.code === 'Space') return 'toggle';
  switch (event.key) {
    case 'n':
    case 'N':
      return 'next';
    case 'p':
    case 'P':
      return 'prev';
    case '+':
    case '=':
      return 'zoom-in';
    case '-':
    case '_':
      return 'zoom-out';
    case '0':
      return 'reset';
    default:
      return null;
  }
}
