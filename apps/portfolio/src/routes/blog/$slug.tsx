import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { BlocksRenderer, type BlocksContent } from '@strapi/blocks-react-renderer';
import type { ComponentProps } from 'react';
import type { BlogPost } from '@ncam/cms';
import { getBlogPost } from '../../functions/blog.functions';

const SITE_URL = 'https://ncam.dev';

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }): Promise<BlogPost> => {
    const post = await getBlogPost({ data: params.slug });
    if (!post) throw notFound();
    return post;
  },
  staleTime: 60_000,
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: 'Post not found — ncam.dev' }, { name: 'robots', content: 'noindex' }],
      };
    }
    const { seo, slug, publishedAt } = loaderData;
    const title = `${seo.title} · ncam.dev`;
    const url = `${SITE_URL}/blog/${slug}`;
    return {
      meta: [
        { title },
        { name: 'description', content: seo.description },
        { name: 'robots', content: 'index,follow' },
        { property: 'og:type', content: 'article' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: seo.description },
        { property: 'og:url', content: url },
        { property: 'article:published_time', content: publishedAt },
        ...(seo.image
          ? [
              { property: 'og:image', content: seo.image.url },
              { name: 'twitter:image', content: seo.image.url },
            ]
          : []),
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: seo.description },
      ],
      links: [{ rel: 'canonical', href: url }],
    };
  },
  component: BlogPostPage,
});

type BlocksOverrides = NonNullable<ComponentProps<typeof BlocksRenderer>['blocks']>;

/** Only two overrides: images are already absolute (mapper), links open safely. */
const blocks: BlocksOverrides = {
  image: ({ image }) => (
    <figure className="article__figure">
      <img
        src={image.url}
        alt={image.alternativeText ?? ''}
        width={image.width}
        height={image.height}
        loading="lazy"
      />
      {image.caption ? <figcaption>{image.caption}</figcaption> : null}
    </figure>
  ),
  link: ({ url, children }) => {
    const external = /^https?:\/\//i.test(url) && !url.startsWith(SITE_URL);
    return external ? (
      <a href={url} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    ) : (
      <a href={url}>{children}</a>
    );
  },
};

function BlogPostPage() {
  const post = Route.useLoaderData();
  const url = `${SITE_URL}/blog/${post.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    url,
    ...(post.cover ? { image: post.cover.url } : {}),
    author: { '@type': 'Person', name: 'Minh Nguyen', url: `${SITE_URL}/` },
    keywords: post.tags.join(', '),
  };

  return (
    <div className="stage blog">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link to="/blog" className="stage__back">
        <span aria-hidden="true">←</span> Blog
      </Link>
      <article className="article">
        <header className="article__head">
          <p className="article__meta">
            <time dateTime={post.publishedAt}>{post.dateLabel}</time>
            <span>{post.readingLabel} read</span>
          </p>
          <h1 className="article__title">{post.title}</h1>
          <p className="article__excerpt">{post.excerpt}</p>
          {post.tags.length > 0 ? (
            <ul className="article__tags" aria-label="Topics">
              {post.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : null}
          {post.cover ? (
            <img
              className="article__cover"
              src={post.cover.url}
              alt={post.cover.alt}
              width={post.cover.width ?? undefined}
              height={post.cover.height ?? undefined}
            />
          ) : null}
        </header>
        <div className="article__body">
          {Array.isArray(post.body) ? (
            <BlocksRenderer content={post.body as BlocksContent} blocks={blocks} />
          ) : null}
        </div>
      </article>
    </div>
  );
}
