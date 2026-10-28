/** True at most `fps` times per second for rAF timestamps (ms). Half a ms of slack absorbs rAF jitter. */
export function createFrameGate(fps: number): (nowMs: number) => boolean {
  const interval = 1000 / fps;
  let last = Number.NEGATIVE_INFINITY;
  return (nowMs) => {
    if (nowMs - last < interval - 0.5) return false;
    last = nowMs;
    return true;
  };
}
