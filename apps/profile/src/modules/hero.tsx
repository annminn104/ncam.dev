import { Hero } from '../components/hero';
import { createClientModule, renderSection, type SectionModule } from '../lib/section-module';

// The lazy react-dom/server import stays in this entry file on purpose (chunk
// cycle otherwise — see lib/section-module.tsx).
export const ssr: SectionModule['ssr'] = async () => {
  const { renderToString } = await import('react-dom/server');
  return renderSection(renderToString, Hero);
};
export const { hydrate, mount } = createClientModule(Hero);
