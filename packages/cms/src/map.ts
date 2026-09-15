import type { BlogImage, BlogPost, StrapiArticle, StrapiMedia } from './types';

export interface MapOptions {
  /** Origin the browser can reach for `/uploads/…` (Strapi returns relative URLs). */
  mediaBase: string;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Absolute URLs pass through; relative upload paths resolve against the media base. */
export function resolveMediaUrl(url: string, mediaBase: string): string {
  return new URL(url, mediaBase).href;
}

/** "Sep 15, 2026" in UTC so server and client never disagree; '' for garbage input. */
export function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

function mapImage(
  media: StrapiMedia | null | undefined,
  fallbackAlt: string,
  mediaBase: string,
): BlogImage | null {
  if (!media?.url) return null;
  return {
    url: resolveMediaUrl(media.url, mediaBase),
    alt: media.alternativeText ?? fallbackAlt,
    width: media.width ?? null,
    height: media.height ?? null,
  };
}

/**
 * Returns a copy of a Blocks tree in which every `image` node carries an absolute URL.
 * Other nodes are copied unchanged; non-object input is returned as is.
 */
export function absolutizeBlockImages(blocks: unknown, mediaBase: string): unknown {
  if (Array.isArray(blocks)) return blocks.map((node) => absolutizeBlockImages(node, mediaBase));
  if (blocks === null || typeof blocks !== 'object') return blocks;

  const node = blocks as Record<string, unknown>;
  const next: Record<string, unknown> = { ...node };
  if (node.type === 'image' && node.image && typeof node.image === 'object') {
    const image = node.image as Record<string, unknown>;
    if (typeof image.url === 'string') {
      next.image = { ...image, url: resolveMediaUrl(image.url, mediaBase) };
    }
  }
  if (Array.isArray(node.children)) {
    next.children = absolutizeBlockImages(node.children, mediaBase);
  }
  return next;
}

/** Strapi article → site view-model. Total: missing relations never throw. */
export function mapArticle(raw: StrapiArticle, { mediaBase }: MapOptions): BlogPost {
  const readingTime = Math.max(1, Math.round(raw.readingTime ?? 1));
  const cover = mapImage(raw.cover, raw.title, mediaBase);
  const ogImage = mapImage(raw.seo?.ogImage, raw.title, mediaBase);
  return {
    id: raw.documentId,
    slug: raw.slug,
    title: raw.title,
    excerpt: raw.excerpt,
    publishedAt: raw.publishedAt,
    dateLabel: formatDateLabel(raw.publishedAt),
    readingTime,
    readingLabel: `${readingTime} min`,
    tags: (raw.tags ?? []).map((tag) => tag.name),
    cover,
    body: raw.body ? absolutizeBlockImages(raw.body, mediaBase) : null,
    seo: {
      title: raw.seo?.metaTitle ?? raw.title,
      description: raw.seo?.metaDescription ?? raw.excerpt,
      image: ogImage ?? cover,
    },
  };
}
