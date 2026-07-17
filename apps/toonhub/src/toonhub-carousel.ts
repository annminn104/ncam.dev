import { createLogger, type Logger, type LogLevel } from '@ncam/logger';
import type { ToonHubAudioConfig, ToonHubConfig, ToonHubLoggingConfig } from './data/toonhub';

/**
 * TOONHUB carousel controller.
 *
 * Framework-free. One instance per `[data-toonhub-root]` element. All DOM
 * behaviour (navigation, autoplay, swipe, keyboard, wheel, pointer parallax,
 * character tilt, cursor glow, easter egg, reduced-motion handling and
 * cleanup) lives here. Configuration is read from the serialized `data-config`
 * attribute so multiple independent instances can coexist on one page.
 */

type Direction = 'next' | 'prev';

/** Where a navigation was triggered from — surfaced in the action log. */
type NavSource = 'button' | 'keyboard' | 'swipe' | 'wheel' | 'progress' | 'autoplay' | 'api';

const DEFAULT_LOGGING: ToonHubLoggingConfig = {
  enabled: false,
  console: true,
  events: true,
  level: 'info',
  prefix: '[TOONHUB]',
};

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

type LogFn = (action: string, detail?: Record<string, unknown>, level?: LogLevel) => void;

const MIDI_A4 = 69;
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - MIDI_A4) / 12);
}

/**
 * Self-contained background-music engine. When `cfg.src` is set it plays that
 * audio file; otherwise it synthesises a gentle ambient loop with the Web Audio
 * API (a sustained pad chord + a soft music-box arpeggio) whose key follows the
 * active figurine. No external libraries. Playback is user-initiated to satisfy
 * browser autoplay policies.
 */
class ToonHubAudioEngine {
  private readonly cfg: ToonHubAudioConfig;
  private readonly log: LogFn;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private pad: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;
  private audioEl: HTMLAudioElement | null = null;

  private arpTimer: number | null = null;
  private arpStep = 0;
  private index = 0;
  private started = false;
  private muted = true;

  // Four moods, cycled for extra slides.
  private static readonly ROOTS = [57, 60, 62, 65]; // A3, C4, D4, F4
  private static readonly PAD = [0, 4, 7]; // major triad
  private static readonly SCALE = [0, 2, 4, 7, 9]; // major pentatonic
  private static readonly PATTERN = [0, 2, 4, 2, 1, 3, 4, 3];

  constructor(cfg: ToonHubAudioConfig, log: LogFn) {
    this.cfg = cfg;
    this.log = log;
  }

  private useElement(): boolean {
    return this.cfg.src.trim().length > 0;
  }

  private createContext(): AudioContext | null {
    const w = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    return Ctor ? new Ctor() : null;
  }

  /** Called from a user gesture. Builds the graph once, then unmutes. */
  play(index: number): void {
    this.index = index;
    this.muted = false;
    if (this.useElement()) this.playElement();
    else this.playSynth();
    this.log('music', { state: 'play', mode: this.useElement() ? 'file' : 'synth' });
  }

  private playElement(): void {
    if (!this.audioEl) {
      const el = new Audio(this.cfg.src);
      el.loop = this.cfg.loop;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      this.audioEl = el;
    }
    this.audioEl.volume = this.cfg.volume;
    void this.audioEl.play().catch(() => this.log('music', { state: 'blocked' }, 'warn'));
    this.started = true;
  }

  private playSynth(): void {
    if (!this.ctx) this.ctx = this.createContext();
    const ctx = this.ctx;
    if (!ctx) return;
    void ctx.resume();

    if (!this.started) {
      this.buildSynthGraph(ctx);
      this.started = true;
      this.arpTimer = window.setInterval(() => this.tickArp(), 420);
    }
    this.rampMaster(this.cfg.volume);
    this.retune();
  }

  private buildSynthGraph(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.6;
    filter.connect(master);

    const padGain = ctx.createGain();
    padGain.gain.value = 0.5;
    padGain.connect(filter);

    this.pad = this.currentPadMidi().map((midi, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = midiToFreq(midi);
      osc.detune.value = (i - 1) * 4;
      osc.connect(padGain);
      osc.start();
      return osc;
    });

    // Slow lowpass movement for a living pad.
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 350;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    this.master = master;
    this.lfo = lfo;
  }

  private currentRoot(): number {
    return ToonHubAudioEngine.ROOTS[this.index % ToonHubAudioEngine.ROOTS.length];
  }

  private currentPadMidi(): number[] {
    const root = this.currentRoot();
    return ToonHubAudioEngine.PAD.map((off) => root + off);
  }

  private retune(): void {
    if (!this.ctx || this.pad.length === 0) return;
    const t = this.ctx.currentTime;
    const midis = this.currentPadMidi();
    this.pad.forEach((osc, i) => {
      const target = midiToFreq(midis[i] ?? midis[0]);
      osc.frequency.cancelScheduledValues(t);
      osc.frequency.setValueAtTime(osc.frequency.value, t);
      osc.frequency.exponentialRampToValueAtTime(target, t + 0.6);
    });
  }

  private tickArp(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const pattern = ToonHubAudioEngine.PATTERN;
    const scale = ToonHubAudioEngine.SCALE;
    const degree = scale[pattern[this.arpStep % pattern.length] % scale.length];
    this.arpStep += 1;
    this.pluck(midiToFreq(this.currentRoot() + 12 + degree), 0.16, 0.5);
  }

  private chime(): void {
    this.pluck(midiToFreq(this.currentRoot() + 24), 0.2, 0.9);
  }

  private pluck(freq: number, peak: number, dur: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private rampMaster(target: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(target, t + 0.4);
  }

  mute(): void {
    this.muted = true;
    if (this.useElement()) this.audioEl?.pause();
    else this.rampMaster(0);
    this.log('music', { state: 'mute' });
  }

  setSlide(index: number): void {
    this.index = index;
    if (this.muted || !this.started || this.useElement()) return;
    this.retune();
    if (this.cfg.navChime) this.chime();
  }

  setSuspended(suspend: boolean): void {
    if (this.muted || !this.started) return;
    if (this.useElement()) {
      if (suspend) this.audioEl?.pause();
      else void this.audioEl?.play().catch(() => undefined);
      return;
    }
    if (!this.ctx) return;
    if (suspend) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  destroy(): void {
    if (this.arpTimer !== null) window.clearInterval(this.arpTimer);
    this.arpTimer = null;
    this.pad.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    });
    this.pad = [];
    try {
      this.lfo?.stop();
    } catch {
      /* already stopped */
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
      this.audioEl = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.master = null;
    this.lfo = null;
    this.started = false;
  }
}

class ToonHubCarousel {
  private readonly root: HTMLElement;
  private readonly config: ToonHubConfig;
  private readonly count: number;
  private readonly totalLabel: string;
  private readonly logging: ToonHubLoggingConfig;
  private readonly logger: Logger;
  private readonly ac = new AbortController();

  private activeIndex = 0;
  private isAnimating = false;
  private isMobile = false;
  private reducedMotion = false;
  private isMuted = true;
  private isAutoplayEnabled = true;
  private destroyed = false;

  // Autoplay / pause bookkeeping.
  private hovering = false;
  private pointerHeld = false;
  private focusWithin = false;
  private tabHidden = false;
  private isInView = true;
  private autoplayRunning = false;
  private autoplayRemaining = 0;
  private autoplayStartedAt = 0;

  // Pointer state.
  private pointerX = 0.5;
  private pointerY = 0.5;
  private cursorX = 0;
  private cursorY = 0;
  private rect: DOMRect | null = null;
  private rafId: number | null = null;

  // Drag state.
  private isPointerDown = false;
  private isDragging = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private dragDelta = 0;
  private activePointerId = -1;

  // Easter egg.
  private brandClicks = 0;
  private lastBrandClick = 0;
  private partyActive = false;

  // Timers / observers.
  private autoplayTimer: number | null = null;
  private lockTimer: number | null = null;
  private navTimer: number | null = null;
  private wheelTimer: number | null = null;
  private wheelLocked = false;
  private partyTimer: number | null = null;
  private partyInterval: number | null = null;
  private io: IntersectionObserver | null = null;
  private mobileMql: MediaQueryList | null = null;
  private motionMql: MediaQueryList | null = null;

  // Cached DOM references.
  private items: HTMLElement[] = [];
  private progressSegs: HTMLElement[] = [];
  private centerEl: HTMLElement | null = null;
  private counterEl: HTMLElement | null = null;
  private metadataEl: HTMLElement | null = null;
  private editionEl: HTMLElement | null = null;
  private nameEl: HTMLElement | null = null;
  private categoryEl: HTMLElement | null = null;
  private liveRegion: HTMLElement | null = null;
  private cursorGlowEl: HTMLElement | null = null;
  private muteBtn: HTMLElement | null = null;
  private autoplayBtn: HTMLElement | null = null;
  private audio: ToonHubAudioEngine | null = null;

  constructor(root: HTMLElement, config: ToonHubConfig) {
    this.root = root;
    this.config = config;
    this.count = config.items.length;
    this.totalLabel = String(this.count).padStart(2, '0');
    this.logging = { ...DEFAULT_LOGGING, ...(config.logging ?? {}) };
    // Delegate emission to the shared @ncam/logger. Keeps the 'toonhub:action'
    // event name; disabling logging turns off both sinks.
    this.logger = createLogger({
      scope: config.id,
      level: this.logging.level,
      console: this.logging.enabled && this.logging.console,
      events: this.logging.enabled && this.logging.events,
      eventName: 'toonhub:action',
      prefix: this.logging.prefix,
    });
  }

  /**
   * Structured action logger. `action` is the log message; `detail` (plus the
   * active slide id/index/name) is the record data. Emission (console +
   * `toonhub:action` CustomEvent) is handled by @ncam/logger.
   */
  private log(
    action: string,
    detail: Record<string, unknown> = {},
    level: LogLevel = 'info',
  ): void {
    if (!this.logging.enabled) return;
    this.logger.log(level, action, {
      id: this.config.id,
      index: this.activeIndex,
      name: this.config.items[this.activeIndex]?.name,
      ...detail,
    });
  }

  init(): void {
    if (this.destroyed) return;

    this.items = Array.from(this.root.querySelectorAll<HTMLElement>('[data-toonhub-item]'));
    this.progressSegs = Array.from(this.root.querySelectorAll<HTMLElement>('[data-progress]'));
    this.counterEl = this.root.querySelector<HTMLElement>('[data-counter]');
    this.metadataEl = this.root.querySelector<HTMLElement>('[data-metadata]');
    this.editionEl = this.root.querySelector<HTMLElement>('[data-metadata-edition]');
    this.nameEl = this.root.querySelector<HTMLElement>('[data-metadata-name]');
    this.categoryEl = this.root.querySelector<HTMLElement>('[data-metadata-category]');
    this.liveRegion = this.root.querySelector<HTMLElement>('[data-live-region]');
    this.cursorGlowEl = this.root.querySelector<HTMLElement>('[data-cursor-glow]');
    this.muteBtn = this.root.querySelector<HTMLElement>('[data-action="mute"]');
    this.autoplayBtn = this.root.querySelector<HTMLElement>('[data-action="autoplay"]');

    const start = Number(this.root.dataset.startIndex ?? this.config.initialIndex);
    this.activeIndex = Number.isFinite(start)
      ? ((start % this.count) + this.count) % this.count
      : 0;

    this.isMuted = true;
    this.isAutoplayEnabled = this.config.features.autoplay;
    this.autoplayRemaining = this.config.timing.autoplayMs;

    if (this.config.audio?.enabled) {
      this.audio = new ToonHubAudioEngine(this.config.audio, (a, d, l) => this.log(a, d, l));
    }

    this.setupMedia();
    this.updateRect();
    this.render();
    this.updateMuteButton();
    this.updateAutoplayButton();
    this.updateAutoplay();
    this.setupObserver();
    this.attachListeners();
    this.runEntry();

    this.log('init', {
      index: this.activeIndex,
      count: this.count,
      reducedMotion: this.reducedMotion,
      isMobile: this.isMobile,
    });
  }

  destroy(): void {
    this.log('destroy', {}, 'debug');
    this.destroyed = true;
    this.ac.abort();
    this.io?.disconnect();
    this.mobileMql?.removeEventListener('change', this.onMobileChange);
    this.motionMql?.removeEventListener('change', this.onMotionChange);
    this.clearTimer(this.autoplayTimer);
    this.clearTimer(this.lockTimer);
    this.clearTimer(this.navTimer);
    this.clearTimer(this.wheelTimer);
    this.clearTimer(this.partyTimer);
    if (this.partyInterval !== null) window.clearInterval(this.partyInterval);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.audio?.destroy();
    this.audio = null;
    delete this.root.dataset.initialized;
  }

  private clearTimer(id: number | null): void {
    if (id !== null) window.clearTimeout(id);
  }

  /* --------------------------- media / observers --------------------------- */

  private setupMedia(): void {
    this.mobileMql = window.matchMedia(`(max-width:${this.config.responsive.mobileBreakpoint}px)`);
    this.isMobile = this.mobileMql.matches;
    this.mobileMql.addEventListener('change', this.onMobileChange);

    this.motionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionMql.matches;
    this.motionMql.addEventListener('change', this.onMotionChange);

    if (this.reducedMotion) {
      this.root.style.setProperty('--toonhub-transition', '150ms');
    }
  }

  private onMobileChange = (event: MediaQueryListEvent): void => {
    this.isMobile = event.matches;
    if (this.isMobile) this.resetPointerVars();
    this.updateAutoplay();
  };

  private onMotionChange = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    if (this.reducedMotion) {
      this.root.style.setProperty('--toonhub-transition', '150ms');
      this.resetPointerVars();
      if (this.cursorGlowEl) delete this.cursorGlowEl.dataset.visible;
    } else {
      this.root.style.setProperty('--toonhub-transition', `${this.config.timing.transitionMs}ms`);
    }
    this.updateAutoplay();
  };

  private setupObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.isInView = true;
      return;
    }
    this.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.isInView = entry.isIntersecting && entry.intersectionRatio >= 0.4;
        }
        this.updateAutoplay();
      },
      { threshold: [0, 0.4, 0.75] },
    );
    this.io.observe(this.root);
  }

  /* --------------------------- listeners --------------------------- */

  private attachListeners(): void {
    const { signal } = this.ac;
    const root = this.root;
    const features = this.config.features;

    root.addEventListener('click', this.onClick, { signal });
    root.addEventListener('pointermove', this.onPointerMove, { signal });
    root.addEventListener('mouseenter', this.onMouseEnter, { signal });
    root.addEventListener('mouseleave', this.onMouseLeave, { signal });
    root.addEventListener('focusin', this.onFocusIn, { signal });
    root.addEventListener('focusout', this.onFocusOut, { signal });

    if (features.swipe) {
      root.addEventListener('pointerdown', this.onPointerDown, { signal });
      root.addEventListener('pointerup', this.onPointerUp, { signal });
      root.addEventListener('pointercancel', this.onPointerUp, { signal });
    }
    if (features.keyboard) {
      root.addEventListener('keydown', this.onKeyDown, { signal });
    }
    if (features.wheel) {
      root.addEventListener('wheel', this.onWheel, { passive: false, signal });
    }

    document.addEventListener('visibilitychange', this.onVisibilityChange, { signal });
    window.addEventListener('resize', this.onResize, { signal });
    window.addEventListener('scroll', this.onScroll, { passive: true, signal });
  }

  private onResize = (): void => {
    this.updateRect();
  };

  private onScroll = (): void => {
    this.updateRect();
  };

  private updateRect(): void {
    this.rect = this.root.getBoundingClientRect();
  }

  /* --------------------------- navigation --------------------------- */

  private commit(newIndex: number, source: NavSource): void {
    if (this.isAnimating || this.count <= 1) return;
    if (newIndex === this.activeIndex) return;

    const from = this.activeIndex;
    const direction: Direction = newIndex === (from + 1) % this.count ? 'next' : 'prev';
    this.activeIndex = newIndex;
    this.isAnimating = true;
    this.root.dataset.locked = 'true';
    this.root.dataset.navigating = 'true';

    this.render();
    this.log('navigate', {
      from,
      to: newIndex,
      direction,
      source,
      name: this.config.items[newIndex]?.name,
    });
    this.audio?.setSlide(newIndex);
    this.resetAutoplay();

    this.clearTimer(this.lockTimer);
    this.clearTimer(this.navTimer);
    const duration = this.config.timing.transitionMs;
    this.lockTimer = window.setTimeout(() => {
      this.isAnimating = false;
      delete this.root.dataset.locked;
    }, duration);
    this.navTimer = window.setTimeout(() => {
      delete this.root.dataset.navigating;
    }, duration);
  }

  go(direction: Direction, source: NavSource = 'api'): void {
    if (this.isAnimating || this.count <= 1) return;
    const next =
      direction === 'next'
        ? (this.activeIndex + 1) % this.count
        : (this.activeIndex + this.count - 1) % this.count;
    this.commit(next, source);
  }

  goTo(index: number, source: NavSource = 'api'): void {
    if (this.isAnimating || this.count <= 1) return;
    if (!Number.isFinite(index)) return;
    const normalized = ((index % this.count) + this.count) % this.count;
    this.commit(normalized, source);
  }

  /* --------------------------- single render pass --------------------------- */

  private render(): void {
    const active = this.activeIndex;
    const left = (active + this.count - 1) % this.count;
    const right = (active + 1) % this.count;
    const back = (active + 2) % this.count;

    this.items.forEach((el, i) => {
      let role = 'hidden';
      if (i === active) role = 'center';
      else if (i === left) role = 'left';
      else if (i === right) role = 'right';
      else if (i === back) role = 'back';

      el.dataset.role = role;
      el.setAttribute('aria-hidden', role === 'center' ? 'false' : 'true');
      el.style.removeProperty('--drag-x');
      el.style.removeProperty('--tilt-x');
      el.style.removeProperty('--tilt-y');
    });

    this.centerEl = this.items[active] ?? null;

    const item = this.config.items[active];
    this.root.style.setProperty('--toonhub-bg', item.bg);
    this.root.style.setProperty('--toonhub-panel', item.panel);

    if (this.counterEl) {
      this.counterEl.textContent = `${item.edition} / ${this.totalLabel}`;
    }

    this.updateMetadata();

    this.progressSegs.forEach((seg, i) => {
      seg.dataset.active = i === active ? 'true' : 'false';
    });

    this.announce();
  }

  private updateMetadata(): void {
    if (!this.metadataEl) return;
    const item = this.config.items[this.activeIndex];
    // Retrigger the fade by removing then re-adding after a forced reflow.
    this.metadataEl.removeAttribute('data-fade');
    if (this.editionEl) this.editionEl.textContent = item.edition;
    if (this.nameEl) this.nameEl.textContent = item.name.toUpperCase();
    if (this.categoryEl) this.categoryEl.textContent = item.category.toUpperCase();
    void this.metadataEl.offsetWidth;
    this.metadataEl.setAttribute('data-fade', 'true');
  }

  private announce(): void {
    if (!this.liveRegion) return;
    const item = this.config.items[this.activeIndex];
    this.liveRegion.textContent = this.config.accessibility.slideAnnouncementTemplate
      .replace('{current}', String(this.activeIndex + 1))
      .replace('{total}', String(this.count))
      .replace('{name}', item.name);
  }

  /* --------------------------- autoplay --------------------------- */

  private shouldAutoplay(): boolean {
    return (
      this.config.features.autoplay &&
      this.isAutoplayEnabled &&
      !this.reducedMotion &&
      !this.hovering &&
      !this.pointerHeld &&
      !this.focusWithin &&
      !this.tabHidden &&
      this.isInView &&
      this.count > 1
    );
  }

  private updateAutoplay(): void {
    const animationOn =
      this.config.features.autoplay && this.isAutoplayEnabled && !this.reducedMotion;
    this.root.dataset.autoplayOn = animationOn ? 'true' : 'false';

    const paused = !this.shouldAutoplay();
    this.root.style.setProperty('--toon-progress-play', paused ? 'paused' : 'running');

    if (this.shouldAutoplay()) this.resumeAutoplay();
    else this.pauseAutoplay();
  }

  private resumeAutoplay(): void {
    if (this.autoplayRunning) return;
    if (this.autoplayRemaining <= 0) this.autoplayRemaining = this.config.timing.autoplayMs;
    this.autoplayRunning = true;
    this.autoplayStartedAt = performance.now();
    this.autoplayTimer = window.setTimeout(this.onAutoplayTick, this.autoplayRemaining);
    this.log('autoplay-resume', { remainingMs: Math.round(this.autoplayRemaining) }, 'debug');
  }

  private pauseAutoplay(): void {
    if (!this.autoplayRunning) return;
    this.clearTimer(this.autoplayTimer);
    this.autoplayTimer = null;
    this.autoplayRunning = false;
    this.autoplayRemaining = Math.max(
      0,
      this.autoplayRemaining - (performance.now() - this.autoplayStartedAt),
    );
    this.log('autoplay-pause', { remainingMs: Math.round(this.autoplayRemaining) }, 'debug');
  }

  private resetAutoplay(): void {
    this.clearTimer(this.autoplayTimer);
    this.autoplayTimer = null;
    this.autoplayRunning = false;
    this.autoplayRemaining = this.config.timing.autoplayMs;
    this.updateAutoplay();
  }

  private onAutoplayTick = (): void => {
    this.autoplayRunning = false;
    this.go('next', 'autoplay');
  };

  /* --------------------------- pointer / parallax / tilt --------------------------- */

  private parallaxActive(): boolean {
    return this.config.features.pointerParallax && !this.isMobile && !this.reducedMotion;
  }

  private tiltActive(): boolean {
    return !this.isMobile && !this.reducedMotion;
  }

  private cursorGlowActive(): boolean {
    return this.config.features.cursorGlow && !this.isMobile && !this.reducedMotion;
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (this.isPointerDown) {
      this.handleDragMove(event);
      if (this.isDragging) return;
    }
    if (this.reducedMotion || this.isMobile || event.pointerType === 'touch') return;
    if (!this.rect) return;

    this.pointerX = clamp((event.clientX - this.rect.left) / this.rect.width, 0, 1);
    this.pointerY = clamp((event.clientY - this.rect.top) / this.rect.height, 0, 1);
    this.cursorX = event.clientX - this.rect.left;
    this.cursorY = event.clientY - this.rect.top;
    this.schedulePointerFrame();
  };

  private schedulePointerFrame(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(this.applyPointerFrame);
  }

  private applyPointerFrame = (): void => {
    this.rafId = null;
    const px = this.pointerX;
    const py = this.pointerY;

    if (this.parallaxActive()) {
      this.root.style.setProperty('--pointer-x', px.toFixed(4));
      this.root.style.setProperty('--pointer-y', py.toFixed(4));
      this.root.style.setProperty('--ghost-parallax', `${((px - 0.5) * 40).toFixed(2)}px`);
    }
    if (this.tiltActive() && this.centerEl) {
      this.centerEl.style.setProperty('--tilt-x', `${((px - 0.5) * 4).toFixed(3)}deg`);
      this.centerEl.style.setProperty('--tilt-y', `${((0.5 - py) * 3).toFixed(3)}deg`);
    }
    if (this.cursorGlowActive()) {
      this.root.style.setProperty('--cursor-x', `${this.cursorX.toFixed(1)}px`);
      this.root.style.setProperty('--cursor-y', `${this.cursorY.toFixed(1)}px`);
    }
  };

  private resetPointerVars(): void {
    this.root.style.setProperty('--pointer-x', '0.5');
    this.root.style.setProperty('--pointer-y', '0.5');
    this.root.style.setProperty('--ghost-parallax', '0px');
    if (this.centerEl) {
      this.centerEl.style.removeProperty('--tilt-x');
      this.centerEl.style.removeProperty('--tilt-y');
    }
  }

  /* --------------------------- swipe / drag --------------------------- */

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.config.features.swipe || this.isAnimating) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    this.isPointerDown = true;
    this.isDragging = false;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
    this.dragDelta = 0;
    this.activePointerId = event.pointerId;
    this.pointerHeld = true;
    this.updateAutoplay();
  };

  private handleDragMove(event: PointerEvent): void {
    const dx = event.clientX - this.pointerStartX;
    const dy = event.clientY - this.pointerStartY;

    if (!this.isDragging) {
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        this.isDragging = true;
        this.root.dataset.dragging = 'true';
        try {
          this.root.setPointerCapture(this.activePointerId);
        } catch {
          /* pointer capture is best-effort */
        }
      } else if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        // Vertical intent: let the page scroll, stop tracking this gesture.
        this.isPointerDown = false;
        this.pointerHeld = false;
        this.updateAutoplay();
        return;
      } else {
        return;
      }
    }

    this.dragDelta = dx;
    const capped = clamp(dx * 0.6, -120, 120);
    this.centerEl?.style.setProperty('--drag-x', `${capped}px`);
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.isPointerDown) return;
    const wasDragging = this.isDragging;
    const dx = this.dragDelta;

    this.isPointerDown = false;
    this.isDragging = false;
    this.pointerHeld = false;
    try {
      if (this.root.hasPointerCapture(event.pointerId)) {
        this.root.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* ignore */
    }
    delete this.root.dataset.dragging;
    this.centerEl?.style.removeProperty('--drag-x');

    if (wasDragging && Math.abs(dx) >= this.config.responsive.dragThreshold) {
      this.log('swipe', { deltaX: Math.round(dx) }, 'debug');
      this.go(dx < 0 ? 'next' : 'prev', 'swipe');
    } else {
      this.updateAutoplay();
    }
    this.dragDelta = 0;
  };

  /* --------------------------- hover / focus / visibility --------------------------- */

  private onMouseEnter = (): void => {
    this.hovering = true;
    this.updateAutoplay();
    if (this.cursorGlowActive() && this.cursorGlowEl) {
      this.cursorGlowEl.dataset.visible = 'true';
    }
  };

  private onMouseLeave = (): void => {
    this.hovering = false;
    this.updateAutoplay();
    if (this.cursorGlowEl) delete this.cursorGlowEl.dataset.visible;
  };

  private onFocusIn = (): void => {
    this.focusWithin = true;
    this.updateAutoplay();
  };

  private onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    if (!this.root.contains(next)) {
      this.focusWithin = false;
      this.updateAutoplay();
    }
  };

  private onVisibilityChange = (): void => {
    this.tabHidden = document.hidden;
    this.updateAutoplay();
    this.audio?.setSuspended(document.hidden);
  };

  /* --------------------------- keyboard --------------------------- */

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.config.features.keyboard) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return;
    }

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.go('prev', 'keyboard');
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.go('next', 'keyboard');
        break;
      case 'Home':
        event.preventDefault();
        this.goTo(0, 'keyboard');
        break;
      case 'End':
        event.preventDefault();
        this.goTo(this.count - 1, 'keyboard');
        break;
      case ' ':
      case 'Spacebar':
        // Leave Space to its native meaning when a button/link is focused.
        if (tag === 'BUTTON' || tag === 'A') return;
        event.preventDefault();
        this.toggleAutoplay();
        break;
      default:
    }
  };

  /* --------------------------- wheel --------------------------- */

  private onWheel = (event: WheelEvent): void => {
    if (!this.config.features.wheel || this.isMobile || this.reducedMotion) return;
    if (!this.isInView || this.isAnimating || this.wheelLocked) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < this.config.responsive.wheelThreshold) return;

    event.preventDefault();
    this.wheelLocked = true;
    this.clearTimer(this.wheelTimer);
    this.wheelTimer = window.setTimeout(() => {
      this.wheelLocked = false;
    }, this.config.timing.transitionMs + 250);

    this.go(delta > 0 ? 'next' : 'prev', 'wheel');
  };

  /* --------------------------- click delegation --------------------------- */

  private onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (actionEl) {
      switch (actionEl.dataset.action) {
        case 'next':
          this.go('next', 'button');
          return;
        case 'prev':
          this.go('prev', 'button');
          return;
        case 'mute':
          this.toggleMute();
          return;
        case 'autoplay':
          this.toggleAutoplay();
          return;
        default:
          return;
      }
    }

    const seg = target.closest<HTMLElement>('[data-progress]');
    if (seg) {
      this.goTo(Number(seg.dataset.index), 'progress');
      return;
    }

    if (target.closest('[data-brand]')) {
      this.handleBrandClick();
    }
  };

  /* --------------------------- toggles --------------------------- */

  private toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.updateMuteButton();
    if (this.audio) {
      if (this.isMuted) this.audio.mute();
      else this.audio.play(this.activeIndex); // first unmute is the user gesture that starts audio
    }
    this.log('mute-toggle', { muted: this.isMuted });
  }

  private updateMuteButton(): void {
    if (!this.muteBtn) return;
    this.muteBtn.dataset.state = this.isMuted ? 'muted' : 'unmuted';
    this.muteBtn.setAttribute(
      'aria-label',
      this.isMuted ? this.config.accessibility.unmuteLabel : this.config.accessibility.muteLabel,
    );
    this.muteBtn.setAttribute('aria-pressed', this.isMuted ? 'true' : 'false');
  }

  private toggleAutoplay(): void {
    this.isAutoplayEnabled = !this.isAutoplayEnabled;
    this.updateAutoplayButton();
    this.resetAutoplay();
    this.log('autoplay-toggle', { enabled: this.isAutoplayEnabled });
  }

  private updateAutoplayButton(): void {
    if (!this.autoplayBtn) return;
    const playing = this.isAutoplayEnabled;
    this.autoplayBtn.dataset.state = playing ? 'playing' : 'paused';
    this.autoplayBtn.setAttribute(
      'aria-label',
      playing
        ? this.config.accessibility.autoplayPauseLabel
        : this.config.accessibility.autoplayPlayLabel,
    );
    this.autoplayBtn.setAttribute('aria-pressed', playing ? 'false' : 'true');
  }

  /* --------------------------- easter egg --------------------------- */

  private handleBrandClick(): void {
    if (!this.config.features.easterEgg) return;
    const now = performance.now();
    if (now - this.lastBrandClick > 600) this.brandClicks = 0;
    this.lastBrandClick = now;
    this.brandClicks += 1;
    if (this.brandClicks >= 5) {
      this.brandClicks = 0;
      this.startParty();
    }
  }

  private startParty(): void {
    if (this.partyActive || this.reducedMotion) return;
    this.partyActive = true;
    this.root.dataset.party = 'true';
    this.log('easter-egg', { state: 'start', durationMs: this.config.timing.easterEggDurationMs });

    const duration = this.config.timing.easterEggDurationMs;
    const step = Math.max(300, Math.floor(duration / this.count));
    const originalIndex = this.activeIndex;
    let tick = 0;

    this.partyInterval = window.setInterval(() => {
      tick += 1;
      const item = this.config.items[(originalIndex + tick) % this.count];
      this.root.style.setProperty('--toonhub-bg', item.bg);
      this.root.style.setProperty('--toonhub-panel', item.panel);
    }, step);

    this.partyTimer = window.setTimeout(() => this.stopParty(), duration);
  }

  private stopParty(): void {
    if (this.partyInterval !== null) {
      window.clearInterval(this.partyInterval);
      this.partyInterval = null;
    }
    this.clearTimer(this.partyTimer);
    this.partyTimer = null;
    this.partyActive = false;
    delete this.root.dataset.party;

    // Restore the colours of whatever slide is currently active.
    const item = this.config.items[this.activeIndex];
    this.root.style.setProperty('--toonhub-bg', item.bg);
    this.root.style.setProperty('--toonhub-panel', item.panel);
    this.log('easter-egg', { state: 'end' });
  }

  /* --------------------------- entry --------------------------- */

  private runEntry(): void {
    if (this.reducedMotion) return; // stay visible, no motion
    this.root.dataset.js = 'true';
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!this.destroyed) this.root.dataset.entered = 'true';
      }),
    );
  }
}

export { ToonHubCarousel };
