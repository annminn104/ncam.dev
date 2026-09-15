/** Strapi 5 REST shapes for `api::article.article` (only the fields the site reads). */
export interface StrapiMedia {
  url: string;
  alternativeText: string | null;
  width: number | null;
  height: number | null;
}

export interface StrapiTag {
  name: string;
  slug: string;
}

export interface StrapiSeo {
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiMedia | null;
}

export interface StrapiArticle {
  documentId: string;
  title: string;
  slug: string;
  excerpt: string;
  readingTime: number | null;
  publishedAt: string;
  cover: StrapiMedia | null;
  tags: StrapiTag[] | null;
  seo: StrapiSeo | null;
  /** Strapi Blocks JSON — only requested by the by-slug query. */
  body?: unknown;
}

export interface StrapiList<T> {
  data: T[];
  meta: {
    pagination: { page: number; pageSize: number; pageCount: number; total: number };
  };
}

/** Image ready for an `<img>`: absolute URL, alt text resolved. */
export interface BlogImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/** View-model shared by the portfolio host and the profile remote. Plain JSON, no Dates. */
export interface BlogPost {
  /** Strapi documentId. */
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** ISO timestamp. */
  publishedAt: string;
  /** "Sep 15, 2026" — computed server-side (en-US, UTC). */
  dateLabel: string;
  /** Minutes, ≥ 1. */
  readingTime: number;
  /** "9 min". */
  readingLabel: string;
  tags: string[];
  cover: BlogImage | null;
  /** Blocks JSON with absolute image URLs, or null when not fetched. */
  body: unknown | null;
  seo: { title: string; description: string; image: BlogImage | null };
}
