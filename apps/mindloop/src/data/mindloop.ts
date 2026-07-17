/**
 * Mindloop — single source of truth for page content.
 *
 * Mirrors toonhub's `data/toonhub.ts` convention: every editable string,
 * list and media URL lives here so `App.tsx` stays presentational.
 */

export type SocialKind = 'instagram' | 'linkedin' | 'twitter';
export type PlatformKind = 'chatgpt' | 'perplexity' | 'google';

export interface PlatformItem {
  kind: PlatformKind;
  name: string;
  desc: string;
}

export interface FeatureItem {
  title: string;
  desc: string;
}

export interface RevealParagraphContent {
  /** Words rendered in the foreground colour instead of the muted subtitle. */
  highlight?: string[];
  text: string;
  /** Smaller secondary paragraph styling. */
  secondary?: boolean;
}

export interface MindloopConfig {
  brand: string;
  videos: {
    hero: string;
    mission: string;
    solution: string;
    ctaHls: string;
  };
  nav: {
    links: string[];
    socials: SocialKind[];
  };
  hero: {
    subscribers: string;
    subtitle: string;
    emailPlaceholder: string;
    submitLabel: string;
  };
  search: {
    platforms: PlatformItem[];
    subtitle: string;
    footnote: string;
  };
  mission: RevealParagraphContent[];
  solution: {
    label: string;
    features: FeatureItem[];
  };
  cta: {
    subtitle: string;
    primaryLabel: string;
    secondaryLabel: string;
  };
  footer: {
    copyright: string;
    links: string[];
  };
}

export const mindloopConfig: MindloopConfig = {
  brand: 'Mindloop',
  videos: {
    hero: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4',
    mission:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_132944_a0d124bb-eaa1-4082-aa30-2310efb42b4b.mp4',
    solution:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_125119_8e5ae31c-0021-4396-bc08-f7aebeb877a2.mp4',
    ctaHls: 'https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8',
  },
  nav: {
    links: ['Home', 'How It Works', 'Philosophy', 'Use Cases'],
    socials: ['instagram', 'linkedin', 'twitter'],
  },
  hero: {
    subscribers: '7,000+ people already subscribed',
    subtitle:
      'Join our feed for meaningful updates, news around technology and a shared journey toward depth and direction.',
    emailPlaceholder: 'Enter your email',
    submitLabel: 'SUBSCRIBE',
  },
  search: {
    platforms: [
      { kind: 'chatgpt', name: 'ChatGPT', desc: 'Millions ask it for recommendations every day.' },
      {
        kind: 'perplexity',
        name: 'Perplexity',
        desc: 'Answers sourced from the open web, in real time.',
      },
      {
        kind: 'google',
        name: 'Google AI',
        desc: 'AI overviews now sit above the classic results.',
      },
    ],
    subtitle:
      'The way people discover ideas is being rewritten by AI. The question is whether your voice is part of the answer.',
    footnote: "If you don't answer the questions, someone else will.",
  },
  mission: [
    {
      highlight: ['curiosity', 'meets', 'clarity'],
      text: "We're building a space where curiosity meets clarity — where readers find depth, writers find reach, and every newsletter becomes a conversation worth having.",
    },
    {
      secondary: true,
      text: 'A platform where content, community, and insight flow together — with less noise, less friction, and more meaning for everyone involved.',
    },
  ],
  solution: {
    label: 'Solution',
    features: [
      {
        title: 'Curated Feed',
        desc: 'A calm, algorithm-light stream of writing worth your attention.',
      },
      {
        title: 'Writer Tools',
        desc: 'Draft, schedule, and publish with a focused, distraction-free editor.',
      },
      {
        title: 'Community',
        desc: 'Conversations that go deeper than likes — replies that matter.',
      },
      { title: 'Distribution', desc: 'Reach the right readers across web, email, and AI answers.' },
    ],
  },
  cta: {
    subtitle:
      'Join a community building the next chapter of meaningful content — one newsletter at a time.',
    primaryLabel: 'Subscribe Now',
    secondaryLabel: 'Start Writing',
  },
  footer: {
    copyright: '© 2026 Mindloop. All rights reserved.',
    links: ['Privacy', 'Terms', 'Contact'],
  },
};

export default mindloopConfig;
