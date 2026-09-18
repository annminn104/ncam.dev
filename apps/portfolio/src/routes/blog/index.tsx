import { createFileRoute, Link } from '@tanstack/react-router';
import type { BlogPost } from '@ncam/cms';
import { createLogger } from '@ncam/logger';
import { getBlogPosts } from '../../functions/blog.functions';

const log = createLogger({ scope: 'portfolio' });
const SITE_URL = 'https://ncam.dev';
const TITLE = 'Blog — ncam.dev';
const DESCRIPTION =
  'Long-form write-ups on micro-frontends, SSR and motion — the things this site is made of.';

interface LoaderData {
  posts: BlogPost[];
  /** True when the CMS could not be reached (renders a softer empty state). */
  unavailable: boolean;
}

export const Route = createFileRoute('/blog/')({
  loader: async (): Promise<LoaderData> => {
    try {
      return { posts: await getBlogPosts(), unavailable: false };
    } catch (error) {
      log.warn('blog.index-unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { posts: [], unavailable: true };
    }
  },
  staleTime: 60_000,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'index,follow' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: `${SITE_URL}/blog` },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}/blog` }],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { posts, unavailable } = Route.useLoaderData();
  return (
    <div className="stage blogpage">
      <Link to="/" className="stage__back">
        <span aria-hidden="true">←</span> Home
      </Link>
      <header className="blogpage__head">
        <p className="blogpage__label">Blog</p>
        <h1 className="blogpage__title">Notes from the build</h1>
        <p className="blogpage__lead">{DESCRIPTION}</p>
      </header>
      {posts.length === 0 ? (
        <p className="blogpage__empty" role="status">
          {unavailable
            ? 'The blog is taking a short break — please try again in a minute.'
            : 'Nothing published yet.'}
        </p>
      ) : (
        <ul className="blogpage__list">
          {posts.map((post) => (
            <li key={post.id}>
              <Link to="/blog/$slug" params={{ slug: post.slug }} className="blog-card">
                <p className="blog-card__meta">
                  <time dateTime={post.publishedAt}>{post.dateLabel}</time>
                  <span>{post.readingLabel} read</span>
                </p>
                <h2 className="blog-card__title">{post.title}</h2>
                <p className="blog-card__excerpt">{post.excerpt}</p>
                {post.tags.length > 0 ? (
                  <ul className="blog-card__tags" aria-label="Topics">
                    {post.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
