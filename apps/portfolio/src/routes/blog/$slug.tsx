import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { BlocksRenderer, type BlocksContent } from '@strapi/blocks-react-renderer';
import type { ComponentProps } from 'react';
import type { BlogPost } from '@ncam/cms';
import { getBlogPost } from '../../functions/blog.functions';
import { blogPostHead, blogPostJsonLd, jsonLdScript } from '../../lib/blog-seo';
import { highlightCode } from '../../lib/highlight';
import { ThemeToggle } from '../../components/theme-toggle';

import { SITE_ORIGIN, SITE_URL } from '../../lib/site';

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** Parse a CMS-authored link against the site; null when unparsable or not an allowed scheme. */
function resolveLink(url: string): URL | null {
  try {
    const parsed = new URL(url, SITE_URL);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }): Promise<BlogPost> => {
    const post = await getBlogPost({ data: params.slug });
    if (!post) throw notFound();
    return post;
  },
  staleTime: 60_000,
  head: ({ loaderData }) =>
    loaderData
      ? blogPostHead(loaderData)
      : { meta: [{ title: 'Post not found — ncam.dev' }, { name: 'robots', content: 'noindex' }] },
  component: BlogPostPage,
});

type BlocksOverrides = NonNullable<ComponentProps<typeof BlocksRenderer>['blocks']>;

/** Images are already absolute (mapper), links pass a scheme allow-list, code is highlighted. */
const blocks: BlocksOverrides = {
  code: (props) => {
    // The renderer spreads every node property onto the override, so `language`
    // arrives even though its published `CodeBlockNode` type omits the field.
    // `plainText` is optional in the renderer's prop type (an empty code block).
    const text = props.plainText ?? '';
    const { language } = props as { language?: string | null };
    const { html, language: label } = highlightCode(text, language);
    return (
      <pre data-language={label ?? undefined}>
        {html ? (
          // `hljs` HTML-escapes the source it is given, so the only markup in
          // `html` is the <span class="hljs-*"> wrappers it emits itself.
          <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code>{text}</code>
        )}
      </pre>
    );
  },
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
    const target = resolveLink(url);
    if (!target) return <span>{children}</span>;
    const offSite = target.protocol.startsWith('http') && target.origin !== SITE_ORIGIN;
    return offSite ? (
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

  return (
    <div className="stage blogpage blogpage--article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(blogPostJsonLd(post)) }}
      />
      <Link to="/blog" className="stage__back">
        <span aria-hidden="true">←</span> Blog
      </Link>
      <ThemeToggle className="theme-toggle--floating" />
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
