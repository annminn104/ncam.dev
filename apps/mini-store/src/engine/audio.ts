// Two-tone "ding-dong" door chime synthesised with WebAudio (created lazily on the first user gesture).
let actx: AudioContext | null = null;

export function chime(): void {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    actx = actx || new Ctor();
    const ctx = actx,
      t0 = ctx.currentTime;
    for (const [f, d] of [
      [659.25, 0],
      [523.25, 0.42],
    ]) {
      const o = ctx.createOscillator(),
        o2 = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      o2.type = 'sine';
      o2.frequency.value = f * 2.01;
      g.gain.setValueAtTime(0, t0 + d);
      g.gain.linearRampToValueAtTime(0.18, t0 + d + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + d + 1.2);
      o.connect(g);
      o2.connect(g);
      g.connect(ctx.destination);
      o.start(t0 + d);
      o2.start(t0 + d);
      o.stop(t0 + d + 1.3);
      o2.stop(t0 + d + 1.3);
    }
  } catch {
    /* audio is optional */
  }
}
