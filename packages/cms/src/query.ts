/** Query strings for Strapi's REST API — only parameters `rest.strictParams` accepts. */

const LIST_FIELDS = ['title', 'slug', 'excerpt', 'readingTime', 'publishedAt'] as const;
const MEDIA_FIELDS = ['url', 'alternativeText', 'width', 'height'] as const;

/** Newest first, one page of up to 100 cards, cover + tag names only. */
export function buildListQuery(): string {
  const params = new URLSearchParams();
  params.set('sort', 'publishedAt:desc');
  params.set('pagination[pageSize]', '100');
  LIST_FIELDS.forEach((field, index) => params.set(`fields[${index}]`, field));
  MEDIA_FIELDS.forEach((field, index) => params.set(`populate[cover][fields][${index}]`, field));
  params.set('populate[tags][fields][0]', 'name');
  params.set('populate[tags][fields][1]', 'slug');
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
