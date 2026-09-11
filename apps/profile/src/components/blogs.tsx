import { ArrowUpRight } from 'lucide-react';
import { posts, type Post } from '../data/profile';
import { useRevealChildren } from '../lib/gsap';
import { SectionHead } from './section-head';

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

export function Blogs() {
  const [featured, ...rest] = posts;
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
          lead="Long-form write-ups on micro-frontends, SSR and motion — the things this site is made of. First posts land soon; titles below are the drafts in progress."
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
