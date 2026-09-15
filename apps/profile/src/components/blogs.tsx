import { ArrowUpRight } from 'lucide-react';
import type { BlogPost } from '@ncam/cms';
import { posts as placeholderPosts, type Post } from '../data/profile';
import { useRevealChildren } from '../lib/gsap';
import { SectionHead } from './section-head';

/** Props the portfolio host passes in (server-fetched from Strapi). Empty → placeholders. */
export interface BlogSectionProps {
  posts?: BlogPost[];
}

const LEAD_LIVE =
  'Long-form write-ups on micro-frontends, SSR and motion — the things this site is made of.';
const LEAD_DRAFTS = `${LEAD_LIVE} First posts land soon; titles below are the drafts in progress.`;

/** A published post → the card shape the placeholders already use. */
function toCard(post: BlogPost): Post {
  return {
    id: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.dateLabel,
    readingTime: post.readingLabel,
    tags: post.tags,
    href: `/blog/${post.slug}`,
  };
}

function PostCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  const className = `post${featured ? ' post--featured' : ''}`;
  const body = (
    <>
      <p className="post__meta">
        <span>{post.date}</span>
        <span>{post.readingTime} read</span>
      </p>
      <h3 className="post__title">{post.title}</h3>
      <p className="post__excerpt">{post.excerpt}</p>
      <ul className="post__tags" aria-label="Topics">
        {post.tags.map((tag) => (
          <li key={tag} className="chip">
            {tag}
          </li>
        ))}
      </ul>
      <p className="post__state">
        {post.href ? (
          <>
            Read the post <ArrowUpRight size={14} aria-hidden="true" />
          </>
        ) : (
          'Publishing soon'
        )}
      </p>
    </>
  );
  return post.href ? (
    <a href={post.href} className={className}>
      {body}
    </a>
  ) : (
    <article className={className}>{body}</article>
  );
}

export function Blogs({ posts }: BlogSectionProps = {}) {
  const live = posts !== undefined && posts.length > 0;
  const cards = live ? posts.map(toCard) : placeholderPosts;
  const [featured, ...rest] = cards;
  const gridRef = useRevealChildren<HTMLDivElement>({ y: 36, stagger: 0.12 });

  return (
    <section id="blog" className="sec blog" aria-labelledby="blog-title">
      <div className="sec__inner">
        <SectionHead
          label="Blog"
          title={
            <span id="blog-title">
              Notes from the <em>build</em>
            </span>
          }
          lead={live ? LEAD_LIVE : LEAD_DRAFTS}
        />
        <div ref={gridRef} className="blog__grid">
          <PostCard post={featured} featured />
          <div className="blog__list">
            {rest.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
