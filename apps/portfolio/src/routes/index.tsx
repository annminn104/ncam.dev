import { createFileRoute, Link } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { projects, type ProjectEntry } from '@ncam/project-registry';

const SITE_URL = 'https://ncam.dev';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'ncam.dev',
      url: `${SITE_URL}/`,
      description:
        'Personal portfolio of Nguyen Cao Anh Minh — projects built as independent micro-frontends.',
    },
    {
      '@type': 'Person',
      name: 'Nguyen Cao Anh Minh',
      url: `${SITE_URL}/`,
      jobTitle: 'Frontend Engineer',
    },
  ],
};

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { name: 'robots', content: 'index,follow' },
      { property: 'og:url', content: `${SITE_URL}/` },
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}/` }],
  }),
  component: GalleryPage,
});

function Card({ project }: { project: ProjectEntry }) {
  const live = project.status === 'live';
  return (
    <article
      className={`card ${live ? 'card--live' : 'card--soon'}`}
      style={{ '--accent': project.accent } as CSSProperties}
    >
      {project.thumbnail ? (
        <img
          className="card__thumb"
          src={project.thumbnail}
          alt={`${project.name} preview`}
          height={200}
          loading="lazy"
        />
      ) : (
        <div className="card__swatch" />
      )}
      <div className="card__body">
        <span className="card__status">{live ? 'Live' : 'Coming soon'}</span>
        <h2 className="card__name">{project.name}</h2>
        <p className="card__tagline">{project.tagline}</p>
        <p className="card__desc">{project.description}</p>
        <span className="card__cta">
          {live ? 'Open project' : 'In progress'}
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </article>
  );
}

function GalleryPage() {
  return (
    <div className="shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="shell__header">
        <span className="shell__eyebrow">Portfolio · Micro-frontends</span>
        <h1 className="shell__title">ncam.dev</h1>
        <p className="shell__lead">
          Personal portfolio — each project is an independent app, mounted at runtime via Module
          Federation.
        </p>
      </header>

      <main className="projects-grid">
        {projects.map((project) =>
          project.status === 'live' ? (
            <Link
              key={project.id}
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="card-link"
            >
              <Card project={project} />
            </Link>
          ) : (
            <div key={project.id} className="card-link card-link--soon">
              <Card project={project} />
            </div>
          ),
        )}
      </main>

      <footer className="shell__footer">
        Built with Turborepo · TanStack Start · Module Federation
      </footer>
    </div>
  );
}
