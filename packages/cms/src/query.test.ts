import { describe, expect, it } from 'vitest';
import { buildBySlugQuery, buildIndexQuery, buildListQuery } from './query';

function params(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query));
}

describe('buildListQuery', () => {
  it('asks only for the card fields, newest first, one page of 100', () => {
    expect(params(buildListQuery())).toEqual({
      sort: 'publishedAt:desc',
      'pagination[pageSize]': '100',
      'fields[0]': 'title',
      'fields[1]': 'slug',
      'fields[2]': 'excerpt',
      'fields[3]': 'readingTime',
      'fields[4]': 'publishedAt',
      'fields[5]': 'updatedAt',
      'populate[cover][fields][0]': 'url',
      'populate[cover][fields][1]': 'alternativeText',
      'populate[cover][fields][2]': 'width',
      'populate[cover][fields][3]': 'height',
      'populate[tags][fields][0]': 'name',
      'populate[tags][fields][1]': 'slug',
    });
  });

  it('encodes brackets so the string is URL-safe', () => {
    expect(buildListQuery()).not.toContain('[');
    expect(buildListQuery()).toContain('pagination%5BpageSize%5D=100');
  });
});

describe('buildIndexQuery', () => {
  it('asks for one page of index fields, newest first, and populates nothing', () => {
    expect(params(buildIndexQuery(1))).toEqual({
      sort: 'publishedAt:desc',
      'pagination[page]': '1',
      'pagination[pageSize]': '100',
      'fields[0]': 'title',
      'fields[1]': 'slug',
      'fields[2]': 'excerpt',
      'fields[3]': 'publishedAt',
      'fields[4]': 'updatedAt',
    });
  });

  it('carries the requested page', () => {
    expect(params(buildIndexQuery(3))['pagination[page]']).toBe('3');
  });
});

describe('buildBySlugQuery', () => {
  it('filters by exact slug and populates cover, tags and seo.ogImage', () => {
    expect(params(buildBySlugQuery('hello-world'))).toEqual({
      'filters[slug][$eq]': 'hello-world',
      'populate[cover]': 'true',
      'populate[tags]': 'true',
      'populate[seo][populate]': 'ogImage',
    });
  });

  it('encodes the slug', () => {
    expect(params(buildBySlugQuery('a b&c'))['filters[slug][$eq]']).toBe('a b&c');
    expect(buildBySlugQuery('a b&c')).toContain('a+b%26c');
  });
});
