import type { ToonHubConfig } from './data/toonhub';

// Framework-free Lucide icons, inlined as raw SVG at build time.
import arrowLeftIcon from 'lucide-static/icons/arrow-left.svg?raw';
import arrowRightIcon from 'lucide-static/icons/arrow-right.svg?raw';
import volume2Icon from 'lucide-static/icons/volume-2.svg?raw';
import volumeXIcon from 'lucide-static/icons/volume-x.svg?raw';
import pauseIcon from 'lucide-static/icons/pause.svg?raw';
import playIcon from 'lucide-static/icons/play.svg?raw';

/** Escape a value for safe use inside a double-quoted HTML attribute or text. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Particle {
  shape: string;
  style: string;
}

const PARTICLES: Particle[] = [
  {
    shape: 'circle',
    style: 'left:14%;top:26%;--p-size:46px;--p-depth:-34px;--p-dur:15s;--p-delay:-2s;',
  },
  {
    shape: 'ring',
    style: 'left:80%;top:22%;--p-size:70px;--p-depth:-46px;--p-dur:18s;--p-delay:-6s;',
  },
  {
    shape: 'square',
    style: 'left:24%;top:64%;--p-size:34px;--p-depth:-24px;--p-dur:13s;--p-delay:-1s;',
  },
  {
    shape: 'dot',
    style: 'left:68%;top:70%;--p-size:16px;--p-depth:-18px;--p-dur:11s;--p-delay:-4s;',
  },
  {
    shape: 'cross',
    style: 'left:88%;top:58%;--p-size:30px;--p-depth:-30px;--p-dur:16s;--p-delay:-8s;',
  },
  {
    shape: 'circle',
    style: 'left:44%;top:16%;--p-size:22px;--p-depth:-40px;--p-dur:17s;--p-delay:-3s;',
  },
  {
    shape: 'ring',
    style: 'left:8%;top:60%;--p-size:40px;--p-depth:-26px;--p-dur:14s;--p-delay:-5s;',
  },
  {
    shape: 'dot',
    style: 'left:56%;top:82%;--p-size:12px;--p-depth:-20px;--p-dur:12s;--p-delay:-7s;',
  },
];

/** Build the full hero markup for a given config (progressive-enhancement-ready). */
export function renderHeroHTML(config: ToonHubConfig): string {
  const { id, items, copy, features, timing, accessibility } = config;
  const count = items.length;
  const startIndex = count > 0 ? ((config.initialIndex % count) + count) % count : 0;

  const roleFor = (index: number): string => {
    if (count === 0) return 'hidden';
    if (index === startIndex) return 'center';
    if (index === (startIndex + count - 1) % count) return 'left';
    if (index === (startIndex + 1) % count) return 'right';
    if (index === (startIndex + 2) % count) return 'back';
    return 'hidden';
  };

  const active = items[startIndex];
  const totalLabel = String(count).padStart(2, '0');
  const rootStyle =
    `--toonhub-bg:${active.bg};--toonhub-panel:${active.panel};` +
    `--toonhub-transition:${timing.transitionMs}ms;--toon-autoplay:${timing.autoplayMs}ms;` +
    `--toon-entry-delay:${timing.entryDelayMs}ms;`;
  const configJson = esc(JSON.stringify(config));

  const ambient = features.ambientGlow
    ? '<div class="toon-ambient" data-ambient aria-hidden="true"></div>'
    : '';

  const aurora = features.auroraBlobs
    ? '<div class="toon-aurora" data-aurora aria-hidden="true">' +
      '<span class="toon-aurora__blob toon-aurora__blob--1"></span>' +
      '<span class="toon-aurora__blob toon-aurora__blob--2"></span>' +
      '<span class="toon-aurora__blob toon-aurora__blob--3"></span>' +
      '</div>'
    : '';

  const grid = features.halftoneGrid ? '<div class="toon-grid" aria-hidden="true"></div>' : '';

  const particles = features.floatingParticles
    ? '<div class="toon-particles" data-particles aria-hidden="true">' +
      PARTICLES.map(
        (p) =>
          `<span class="toon-particle toon-particle--${p.shape}" style="${p.style}"><span class="toon-particle__inner"></span></span>`,
      ).join('') +
      '</div>'
    : '';

  const cursorGlow = features.cursorGlow
    ? '<div class="toon-cursor-glow" data-cursor-glow aria-hidden="true"></div>'
    : '';

  const brandInner =
    '<span class="toon-brand__dot" aria-hidden="true"></span>' + `<span>${esc(copy.brand)}</span>`;
  const brand = features.easterEgg
    ? `<button type="button" class="toon-brand" data-brand aria-label="${esc(copy.brand)}">${brandInner}</button>`
    : `<div class="toon-brand">${brandInner}</div>`;

  const muteBtn = features.soundToggle
    ? `<button type="button" class="toon-ctrl" data-action="mute" data-state="muted" aria-label="${esc(
        accessibility.unmuteLabel,
      )}" aria-pressed="true">` +
      `<span class="toon-icon" data-icon="unmuted">${volume2Icon}</span>` +
      `<span class="toon-icon" data-icon="muted">${volumeXIcon}</span>` +
      '</button>'
    : '';

  const autoplayBtn = features.autoplayToggle
    ? `<button type="button" class="toon-ctrl" data-action="autoplay" data-state="playing" aria-label="${esc(
        accessibility.autoplayPauseLabel,
      )}" aria-pressed="false">` +
      `<span class="toon-icon" data-icon="playing">${pauseIcon}</span>` +
      `<span class="toon-icon" data-icon="paused">${playIcon}</span>` +
      '</button>'
    : '';

  const controls =
    '<div class="toon-controls">' +
    muteBtn +
    autoplayBtn +
    `<span class="toon-counter" data-counter aria-hidden="true">${esc(active.edition)} / ${totalLabel}</span>` +
    '</div>';

  const slides = items
    .map((item, i) => {
      const role = roleFor(i);
      return (
        `<figure class="toon-item" data-toonhub-item data-index="${i}" data-role="${role}" ` +
        `aria-roledescription="slide" aria-hidden="${role === 'center' ? 'false' : 'true'}" ` +
        `aria-label="${esc(`${item.name}, ${item.category}, edition ${item.edition}`)}">` +
        '<div class="toon-item__tilt">' +
        `<img src="${esc(item.src)}" alt="${esc(item.alt)}" draggable="false" loading="eager" decoding="async" />` +
        '</div></figure>'
      );
    })
    .join('');

  const floor = features.floorShadow
    ? '<div class="toon-floor" data-floor aria-hidden="true"></div>'
    : '';

  const carousel =
    `<div class="toon-carousel" data-carousel role="group" aria-roledescription="carousel" aria-label="${esc(
      accessibility.carouselLabel,
    )}">` +
    slides +
    floor +
    '</div>';

  const nav =
    `<button type="button" class="toon-nav toon-nav--prev" data-action="prev" aria-label="${esc(
      accessibility.previousLabel,
    )}"><span class="toon-icon">${arrowLeftIcon}</span></button>` +
    `<button type="button" class="toon-nav toon-nav--next" data-action="next" aria-label="${esc(
      accessibility.nextLabel,
    )}"><span class="toon-icon">${arrowRightIcon}</span></button>`;

  const content =
    '<div class="toon-content">' +
    `<h1 class="toon-heading">${esc(copy.heading)}</h1>` +
    `<p class="toon-desc">${esc(copy.description)}</p>` +
    '</div>';

  const metadata = features.metadata
    ? '<div class="toon-metadata" data-metadata aria-hidden="true">' +
      '<div class="toon-metadata__row1">' +
      `<span class="toon-metadata__edition" data-metadata-edition>${esc(active.edition)}</span> / ` +
      `<span data-metadata-name>${esc(active.name.toUpperCase())}</span>` +
      '</div>' +
      `<div class="toon-metadata__row2" data-metadata-category>${esc(active.category.toUpperCase())}</div>` +
      '</div>'
    : '';

  const progress = features.progressIndicator
    ? '<div class="toon-progress" data-progress-group>' +
      items
        .map(
          (item, i) =>
            `<button type="button" class="toon-progress__seg" data-progress data-index="${i}" ` +
            `data-active="${i === startIndex ? 'true' : 'false'}" ` +
            `aria-label="${esc(`Show figurine ${i + 1}: ${item.name}`)}">` +
            '<span class="toon-progress__track"><span class="toon-progress__fill" data-progress-fill></span></span>' +
            '</button>',
        )
        .join('') +
      '</div>'
    : '';

  const cta =
    `<a class="toon-cta" href="${esc(copy.ctaHref)}" data-cta aria-label="${esc(accessibility.discoverLabel)}">` +
    `<span class="toon-cta__label">${esc(copy.ctaLabel)}</span>` +
    `<span class="toon-cta__arrow" aria-hidden="true">${arrowRightIcon}</span>` +
    '</a>';

  const sheen = features.lightSweep ? '<div class="toon-sheen" aria-hidden="true"></div>' : '';
  const vignette = features.vignette ? '<div class="toon-vignette" aria-hidden="true"></div>' : '';
  const grain = features.grain ? '<div class="toon-grain" aria-hidden="true"></div>' : '';
  const liveRegion =
    '<div class="toon-sr-only" data-live-region aria-live="polite" role="status"></div>';

  return (
    `<section id="${esc(id)}" class="toonhub-hero" data-toonhub-root data-config="${configJson}" ` +
    `data-start-index="${startIndex}" style="${rootStyle}" aria-roledescription="carousel" ` +
    `aria-label="${esc(accessibility.carouselLabel)}"${features.keyboard ? ' tabindex="0"' : ''}>` +
    ambient +
    aurora +
    grid +
    particles +
    '<div class="toon-ghost" aria-hidden="true">' +
    `<span class="toon-ghost__text">${esc(copy.ghostText)}</span></div>` +
    cursorGlow +
    brand +
    controls +
    carousel +
    nav +
    content +
    metadata +
    progress +
    cta +
    sheen +
    vignette +
    grain +
    liveRegion +
    '</section>'
  );
}
