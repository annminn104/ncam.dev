import { createFileRoute, Link } from '@tanstack/react-router';
import type { BlogPost } from '@ncam/cms';
import { createLogger } from '@ncam/logger';
import { getBlogPosts } from '../../functions/blog.functions';
import { ThemeToggle } from '../../components/theme-toggle';
import { BLOG_DESCRIPTION, blogIndexHead, blogIndexJsonLd, jsonLdScript } from '../../lib/blog-seo';

const log = createLogger({ scope: 'portfolio' });

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
  head: () => blogIndexHead(),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { posts, unavailable } = Route.useLoaderData();
  return (
    <div className="stage blogpage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(blogIndexJsonLd(posts)) }}
      />
      <Link to="/" className="stage__back">
        <span aria-hidden="true">←</span> Home
      </Link>
      <ThemeToggle className="theme-toggle--floating" />
      <header className="blogpage__head">
        <p className="blogpage__label">Blog</p>
        <h1 className="blogpage__title">Notes from the build</h1>
        <p className="blogpage__lead">{BLOG_DESCRIPTION}</p>
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
