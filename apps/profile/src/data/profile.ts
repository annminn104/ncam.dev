/**
 * Content for the ncam.dev home-page sections. Components are presentational;
 * edit content here only. (Section ids / order / colours live in the HOST:
 * apps/portfolio/src/data/sections.ts — the shell owns navigation.)
 *
 * Still placeholder: `profile.email` (no personal address supplied yet) and the
 * blog posts (drafts, rendered as "publishing soon"). Everything else is real.
 */

export type SocialKind = 'linkedin' | 'github' | 'facebook';

export interface Social {
  kind: SocialKind;
  label: string;
  handle: string;
  href: string;
}

export const profile = {
  /** Preferred first name. */
  displayName: 'Matthew',
  name: 'Minh Nguyen',
  fullName: 'Nguyen Cao Anh Minh',
  /** Rendered as two display lines in the hero. */
  nameLines: ['Matthew', 'Minh Nguyen'] as const,
  handle: 'ncam',
  role: 'Frontend Developer',
  roleLine: 'Software Engineer · Frontend Developer',
  roleAccent: 'React, Next.js, Remix and Angular',
  location: 'Vietnam · UTC+7',
  status: 'Frontend Engineer at NAVER Vietnam',
  intro:
    'Detail-oriented Frontend Developer with 5 years of experience building responsive, high-performance web applications.',
  summary: [
    'I’m a detail-oriented Frontend Developer with 5 years of experience building responsive, high-performance web applications. I specialize in React, Next.js, Remix, and Angular, with a strong focus on scalable architecture, accessibility, performance, and polished user experiences.',
    'I’ve worked across enterprise platforms, real-time operations, creative microsites, and global brand experiences, combining technical expertise with a strong eye for design and usability.',
    'I enjoy solving complex frontend challenges, building maintainable systems, and turning ideas into fast, intuitive digital experiences.',
  ],
  skillsSummary: [
    'React',
    'Next.js',
    'Remix',
    'Angular',
    'TypeScript',
    'Tailwind CSS',
    'GSAP',
    'Micro Frontends',
  ],
  /** PLACEHOLDER — replace with the real contact address. */
  email: 'hello@ncam.dev',
  phone: '(+84) 374 742 756',
  phoneHref: 'tel:+84374742756',
  socials: [
    {
      kind: 'linkedin',
      label: 'LinkedIn',
      handle: 'in/nguyencaoanhminh',
      href: 'https://www.linkedin.com/in/nguyencaoanhminh',
    },
    {
      kind: 'github',
      label: 'GitHub',
      handle: '@annminn104',
      href: 'https://github.com/annminn104',
    },
    {
      kind: 'facebook',
      label: 'Facebook',
      handle: 'Minhmin0507',
      href: 'https://www.facebook.com/Minhmin0507',
    },
  ] satisfies Social[],
  siteUrl: 'https://ncam.dev',
  repoUrl: 'https://github.com/annminn104/ncam.dev',
};

export interface StackCategory {
  title: string;
  keys: string[];
}

export const stackCategories: StackCategory[] = [
  {
    title: 'Languages & Frameworks',
    keys: [
      'HTML5',
      'CSS3',
      'JavaScript',
      'TypeScript',
      'React',
      'Next.js',
      'Remix',
      'Angular',
      'GraphQL',
      'Redux',
      'Zustand',
    ],
  },
  {
    title: 'UI & Styling',
    keys: [
      'Tailwind CSS',
      'Bootstrap',
      'React Bootstrap',
      'Chakra UI',
      'Ant Design',
      'MUI',
      'shadcn/ui',
      'Radix UI',
      'Angular Material',
      'NG-ZORRO',
      'Styled Components',
    ],
  },
  {
    title: 'Animation & Interaction',
    keys: ['GSAP', 'Framer Motion', 'AOS', 'Owl Carousel'],
  },
  {
    title: 'Headless CMS',
    keys: ['Hygraph', 'Strapi', 'Directus', 'Payload CMS', 'Storyblok'],
  },
  {
    title: 'Testing & API Tools',
    keys: ['Jest', 'Cypress', 'React Testing Library', 'Postman'],
  },
  {
    title: 'Backend & Database',
    keys: ['Node.js', 'Express.js', 'NestJS', 'MongoDB', 'Firebase'],
  },
  {
    title: 'DevOps & Infrastructure',
    keys: ['Docker', 'Nginx', 'GitHub Actions', 'Jenkins', 'CI/CD'],
  },
  {
    title: 'Architecture',
    keys: ['Monorepo', 'Turborepo', 'Nx', 'Micro Frontends', 'Service Workers', 'OAuth 2.0'],
  },
  {
    title: 'Development Tools',
    keys: ['Git', 'GitHub', 'Figma', 'Adobe Photoshop'],
  },
  {
    title: 'Web & Performance',
    keys: ['SEO', 'Web Accessibility', 'Responsive Design', 'Web Performance', 'Core Web Vitals'],
  },
];

/** Three marquee rows; each is duplicated at render for a seamless loop. */
export const marqueeRows: string[][] = [
  ['React', 'Next.js', 'Remix', 'Angular', 'TypeScript', 'GraphQL', 'Redux', 'Zustand'],
  [
    'Tailwind CSS',
    'shadcn/ui',
    'Radix UI',
    'MUI',
    'Ant Design',
    'Chakra UI',
    'GSAP',
    'Framer Motion',
  ],
  [
    'Node.js',
    'NestJS',
    'MongoDB',
    'Docker',
    'Nginx',
    'GitHub Actions',
    'Turborepo',
    'Micro Frontends',
    'Cypress',
    'Jest',
  ],
];

export interface ExperienceStack {
  title: string;
  keys: string;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  /** Display period. */
  period: string;
  /** Start year, shown in the sticky rail. */
  year: string;
  /** Team / unit / place — shown under the period. */
  location?: string;
  summary?: string;
  bullets: string[];
  stack: ExperienceStack[];
}

export const experiences: Experience[] = [
  {
    id: 'naver',
    company: 'NAVER Vietnam',
    role: 'Frontend Engineer',
    period: '04/2026 — Present',
    year: '2026',
    location: 'NPay team',
    summary: 'NPay team — financial chart SDK built on ChartIQ and custom Canvas 2D charts.',
    bullets: [
      'Upgraded the ChartIQ version for the PC chart: new vendor bundle, DOM sanitising, licence entitlement fixes, RC/release channels and a major SDK release',
      'Built a family of Canvas 2D charts: stock, virtual-asset (crypto), exchange-rate, market-index, weekly loan-trend, real-estate price and comparison charts',
      'Migrated the legacy PC chart from webpack 4 to 5; added unit, Storybook interaction and browser tests with Vitest and Playwright',
      'Ran CI/CD and security: Docker-based Storybook deploys, changeset checks for publishable packages, BuildKit secrets, dependency/CVE fixes and consumer smoke-test harnesses for npm releases',
    ],
    stack: [
      { title: 'Core', keys: 'TypeScript, React 18, Canvas 2D, ChartIQ, date-fns' },
      {
        title: 'Tooling',
        keys: 'pnpm workspace + Turbo, Vite 8, tsdown, webpack 5, Storybook 10, Biome, Changesets',
      },
      { title: 'Quality & delivery', keys: 'Vitest 4, Playwright, GitHub Actions, Docker' },
    ],
  },
  {
    id: 'gearment',
    company: 'Gearment',
    role: 'Frontend Developer',
    period: '08/2024 — 04/2026',
    year: '2024',
    summary:
      'Marketing site and admin system for a print-on-demand platform, built with Remix and a Directus headless CMS.',
    bullets: [
      'Maintained a landing website using Remix and Directus CMS (headless CMS)',
      'Optimized website performance and SEO for improved user experience and search engine rankings',
      'Refactored and structured code to ensure reusable components, enhancing maintainability and scalability',
      'Integrated APIs using ConnectRPC for seamless communication between frontend and backend services',
      'Implemented authentication with Facebook and Google login for user convenience',
      'Contributed to key modules including orders, stores, studios, members and logs, ensuring smooth functionality and efficient workflow for the admin system',
    ],
    stack: [
      { title: 'Languages', keys: 'React 18, Remix, HTML, SCSS, JavaScript, TypeScript' },
      { title: 'UI', keys: 'shadcn/ui, Radix UI, Tailwind CSS' },
      {
        title: 'Other',
        keys: 'Directus CMS, Turbo, Zustand, React Query, ConnectRPC, GitHub Actions, Framer Motion',
      },
    ],
  },
  {
    id: 'sanbul',
    company: 'Sanbul Solutions',
    role: 'Frontend Developer',
    period: '03/2023 — 08/2024',
    year: '2023',
    summary:
      'A monorepo web platform from management pages to user-facing pages, built with Next.js 13 on Atomic Design principles.',
    bullets: [
      'Created and assigned tasks using Jira',
      'Developed the source code structure following Atomic Design principles',
      'Established a process for code pushing and committing using Husky, commitlint and GitHub Actions',
      'Implemented the website interface from design specifications, from management pages to user pages, using Turbo (Vercel) for monorepos',
      'Configured Socket connections with the backend and developed Service Workers',
      'Configured Storybook for documenting components and wrote comprehensive README files',
      'Created Dockerfile and Nginx configurations and deployed the website',
      'Maintained the codebase: reviews, clean-ups and refactors',
      'Integrated OAuth login with Google, Facebook, Naver and KakaoTalk',
    ],
    stack: [
      { title: 'Languages', keys: 'React 18, Next.js 13, HTML, SCSS, JavaScript, TypeScript' },
      { title: 'UI', keys: 'Ant Design, MUI' },
      {
        title: 'Other',
        keys: 'Vite, Redux Toolkit, TanStack Query, Storybook 7, Styled Components, Socket.io, Service Workers, Docker, Nginx, GitHub Actions, Jest',
      },
    ],
  },
  {
    id: 'amit',
    company: 'Amit Group JSC · TotallyAwesome',
    role: 'Frontend Developer',
    period: '06/2020 — 03/2023',
    year: '2020',
    summary:
      'Creative micro-sites and brand campaign experiences for global clients — motion, analytics and deployment, with Angular and Next.js.',
    bullets: [
      'Developed and programmed web interfaces for campaign micro-sites',
      'Implemented motion effects and animations',
      'Triggered and tracked events with Google Analytics',
      'Deployed applications with PM2 or Docker',
      'Coordinated with backend developers on API integration',
      'Analysed stakeholder problems and proposed solutions',
    ],
    stack: [
      {
        title: 'Languages',
        keys: 'Angular 12/13, Next.js 10/12, HTML, SCSS, JavaScript, TypeScript',
      },
      {
        title: 'UI',
        keys: 'Ant Design, NG-ZORRO, Angular Material, Chart.js, Bootstrap 5, Animate.css, Owl Carousel, GSAP, MUI, AOS, tsParticles',
      },
    ],
  },
];

export interface Post {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  readingTime: string;
  tags: string[];
  /** Optional link — posts without one render as upcoming. */
  href?: string;
}

/** Draft titles — placeholders until the first posts are published. */
export const posts: Post[] = [
  {
    id: 'federating-react-19',
    title: 'Federating React 19 without sharing React',
    excerpt:
      'Why every remote on this site bundles its own React, how the SSR contract works, and the version-mismatch bugs that made me stop sharing singletons.',
    date: 'Draft',
    readingTime: '9 min',
    tags: ['Module Federation', 'React'],
  },
  {
    id: 'canvas-charts',
    title: 'Drawing 50,000 candles: Canvas 2D charts that stay smooth',
    excerpt:
      'Session models, precision, gap data and tooltip layers — lessons from building financial charts on top of ChartIQ and raw canvas.',
    date: 'Draft',
    readingTime: '8 min',
    tags: ['Canvas', 'Performance'],
  },
  {
    id: 'gsap-strict-mode',
    title: 'GSAP in StrictMode: fromTo or bust',
    excerpt:
      'Double-invoked effects, invisible grids and orphaned ScrollTriggers — the rules I follow so scroll animations survive React 19.',
    date: 'Draft',
    readingTime: '5 min',
    tags: ['GSAP', 'React'],
  },
  {
    id: 'reduced-motion',
    title: 'Motion that respects prefers-reduced-motion',
    excerpt:
      'Designing animation systems where the reduced-motion path is a first-class layout, not an afterthought.',
    date: 'Draft',
    readingTime: '6 min',
    tags: ['Accessibility', 'Motion'],
  },
];

export const contact = {
  title: ['Let’s build', 'something', 'people', 'remember.'] as const,
  accentWordIndex: 3,
  lead: 'Frontend roles, product collaborations, or a conversation about charts, motion and micro-frontends. Email, phone or LinkedIn all work — I reply within two working days.',
  currently: 'Frontend Engineer at NAVER Vietnam. Always happy to talk frontend architecture.',
  responseNote: 'Based in Vietnam (UTC+7) · English and Vietnamese',
};
