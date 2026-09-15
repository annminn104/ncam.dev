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
  /** Strapi Blocks JSON (structural node types) — only requested by the by-slug query. */
  body?: BlocksBody | null;
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
  /** Blocks JSON (structural node types) with absolute image URLs, or null when not fetched. */
  body: BlocksBody | null;
  seo: { title: string; description: string; image: BlogImage | null };
}

/** Strapi Blocks rich text — the node shapes the site reads (JSON-safe: TanStack can serialize them). */
export interface TextNode {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}
export interface LinkNode {
  type: 'link';
  url: string;
  children: TextNode[];
}
export type InlineNode = TextNode | LinkNode;
export interface ParagraphNode {
  type: 'paragraph';
  children: InlineNode[];
}
export interface HeadingNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}
export interface QuoteNode {
  type: 'quote';
  children: InlineNode[];
}
export interface CodeNode {
  type: 'code';
  language?: string;
  children: TextNode[];
}
export interface ListItemNode {
  type: 'list-item';
  children: InlineNode[];
}
export interface ListNode {
  type: 'list';
  format: 'ordered' | 'unordered';
  children: Array<ListItemNode | ListNode>;
}
export interface BlocksImage {
  url: string;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
}
export interface ImageNode {
  type: 'image';
  image: BlocksImage;
  children: TextNode[];
}
export type BlockNode = ParagraphNode | HeadingNode | QuoteNode | CodeNode | ListNode | ImageNode;
export type BlocksBody = BlockNode[];
