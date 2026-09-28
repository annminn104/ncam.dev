/** Query strings for Strapi's REST API — only parameters `rest.strictParams` accepts. */

const LIST_FIELDS = [
  'title',
  'slug',
  'excerpt',
  'readingTime',
  'publishedAt',
  'updatedAt',
] as const;
const INDEX_FIELDS = ['title', 'slug', 'excerpt', 'publishedAt', 'updatedAt'] as const;
const MEDIA_FIELDS = ['url', 'alternativeText', 'width', 'height'] as const;

/** Strapi's `rest.maxLimit` (apps/strapi/config/api.ts): the most one page can hold. */
const MAX_PAGE_SIZE = 100;

/** Newest first, one page of up to 100 cards, cover + tag names only. */
export function buildListQuery(): string {
  const params = new URLSearchParams();
  params.set('sort', 'publishedAt:desc');
  params.set('pagination[pageSize]', String(MAX_PAGE_SIZE));
  LIST_FIELDS.forEach((field, index) => params.set(`fields[${index}]`, field));
  MEDIA_FIELDS.forEach((field, index) => params.set(`populate[cover][fields][${index}]`, field));
  params.set('populate[tags][fields][0]', 'name');
  params.set('populate[tags][fields][1]', 'slug');
  return params.toString();
}

/**
 * One page (1-based) of the article index, newest first: the fields a sitemap,
 * a feed and llms.txt read, plus the SEO overrides that decide whether a post
 * belongs in them (no media, no other relations).
 */
export function buildIndexQuery(page: number): string {
  const params = new URLSearchParams();
  params.set('sort', 'publishedAt:desc');
  params.set('pagination[page]', String(page));
  params.set('pagination[pageSize]', String(MAX_PAGE_SIZE));
  INDEX_FIELDS.forEach((field, index) => params.set(`fields[${index}]`, field));
  params.set('populate[seo][fields][0]', 'canonicalURL');
  params.set('populate[seo][fields][1]', 'metaRobots');
  return params.toString();
}

/** One article by slug with everything the article page needs (body included by default). */
export function buildBySlugQuery(slug: string): string {
  const params = new URLSearchParams();
  params.set('filters[slug][$eq]', slug);
  params.set('populate[cover]', 'true');
  params.set('populate[tags]', 'true');
  params.set('populate[seo][populate]', 'ogImage');
  return params.toString();
}
