/**
 * Syntax highlighting for CMS-authored code blocks.
 *
 * Synchronous and isomorphic on purpose: the article route is server-rendered,
 * and running the same function on the server and on the client keeps the
 * markup identical, so hydration matches and the first paint is already
 * coloured. Highlighting in the loader instead would push tens of KB of
 * generated markup into every article's loader payload; this way the
 * highlighter is one cached chunk on the article route.
 *
 * Only the languages the blog actually uses are registered — `highlight.js`
 * ships ~190 of them and importing the barrel would pull in all of it.
 */
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

/** Strapi's language labels → the grammar that renders them. */
const ALIASES: Record<string, string> = {
  bash: 'bash',
  css: 'css',
  docker: 'dockerfile',
  dockerfile: 'dockerfile',
  html: 'xml',
  js: 'javascript',
  javascript: 'javascript',
  json: 'json',
  jsonc: 'json',
  jsx: 'javascript',
  markdown: 'markdown',
  md: 'markdown',
  sh: 'bash',
  shell: 'bash',
  sql: 'sql',
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash',
};

export interface HighlightResult {
  /** `hljs` markup, or null when the block should render as plain text. */
  html: string | null;
  /** The grammar actually used, for the `data-language` label. */
  language: string | null;
}

/**
 * Highlight `code` as `language`.
 *
 * An unknown or absent language returns `{ html: null }` rather than falling
 * back to `highlightAuto`. That is deliberate: this blog's unlabelled blocks are
 * ASCII directory trees and Markdown tables (Strapi Blocks has no table node, so
 * tables arrive as code), and auto-detection colours those as if they were
 * source — worse than leaving them plain.
 */
export function highlightCode(code: string, language?: string | null): HighlightResult {
  const requested = language?.trim().toLowerCase();
  const grammar = requested ? ALIASES[requested] : undefined;
  if (!grammar) return { html: null, language: requested || null };
  try {
    // `ignoreIllegals` keeps a snippet that is not a complete program (most blog
    // excerpts) from falling back to unhighlighted output mid-parse.
    const { value } = hljs.highlight(code, { language: grammar, ignoreIllegals: true });
    return { html: value, language: requested ?? grammar };
  } catch {
    return { html: null, language: requested ?? null };
  }
}
