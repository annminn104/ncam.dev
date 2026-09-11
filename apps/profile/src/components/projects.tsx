import { ArrowUpRight } from 'lucide-react';
import { type CSSProperties, type ReactNode } from 'react';
import { projects, type ProjectEntry } from '@ncam/project-registry';
import { gsap, useGsap, useRevealChildren } from '../lib/gsap';
import { SectionHead } from './section-head';

function ProjectCard({ project }: { project: ProjectEntry }) {
  const live = project.status === 'live';
  const content: ReactNode = (
    <>
      <span className="pcard__spot" aria-hidden="true" />
      <div className="pcard__media">
        {project.thumbnail ? (
          <img
            className="pcard__img"
            src={project.thumbnail}
            alt={`${project.name} preview`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="pcard__img pcard__img--swatch" />
        )}
        <span className="pcard__shine" aria-hidden="true" />
      </div>
      <div className="pcard__body">
        <p className="pcard__meta">
          <span className="pcard__status">{live ? 'mounted at runtime' : 'coming soon'}</span>
          <span>remote · {project.remote}</span>
        </p>
        <h3 className="pcard__name">{project.name}</h3>
        <p className="pcard__tagline">{project.tagline}</p>
        <p className="pcard__desc">{project.description}</p>
        <span className="pcard__cta">
          {live ? 'Open project' : 'In progress'}
          <ArrowUpRight size={16} aria-hidden="true" />
        </span>
      </div>
    </>
  );

  const style = { '--accent-p': project.accent } as CSSProperties;
  // Plain anchors: the remote has no router. The host intercepts clicks on
  // `/projects/*` links and performs a client-side navigation.
  return live ? (
    <a href={`/projects/${project.id}`} className="pcard" style={style}>
      {content}
    </a>
  ) : (
    <div className="pcard pcard--soon" style={style} aria-disabled="true">
      {content}
    </div>
  );
}

/**
 * The registry gallery as vertical cards. Cards stagger in on scroll; on a fine
 * pointer each card tilts in 3D toward the cursor (GSAP quickTo) while a
 * spotlight in the project's accent colour follows the pointer (`--mx/--my`).
 */
export function Projects() {
  const gridRef = useRevealChildren<HTMLDivElement>({ y: 48, stagger: 0.1 });

  useGsap(({ finePointer }) => {
    const grid = gridRef.current;
    if (!grid || !finePointer) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>('.pcard'));
    const cleanups = cards.map((card) => {
      gsap.set(card, { transformPerspective: 900 });
      const tiltX = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      const tiltY = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });

      const onMove = (event: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        tiltX((0.5 - py) * 10);
        tiltY((px - 0.5) * 12);
      };
      const onLeave = () => {
        tiltX(0);
        tiltY(0);
      };
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerleave', onLeave);
      return () => {
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerleave', onLeave);
      };
    });
    return () => cleanups.forEach((fn) => fn());
  });

  return (
    <section id="projects" className="sec projects" aria-labelledby="projects-title">
      <div className="sec__inner">
        <SectionHead
          label={`Projects · ${projects.length} remotes`}
          title={
            <span id="projects-title">
              Independent apps, <em>one host</em>
            </span>
          }
          lead="Each project is its own Vite build, deployed on its own, and mounted into this page at runtime through Module Federation. Open one — the host fetches its remoteEntry and renders it in place."
        />
        <div ref={gridRef} className="pcard-grid">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  );
}
