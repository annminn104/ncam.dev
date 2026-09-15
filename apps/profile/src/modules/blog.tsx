import { Blogs, type BlogSectionProps } from '../components/blogs';
import { createClientModule, renderSection, type SectionModule } from '../lib/section-module';

// The lazy react-dom/server import stays in this entry file on purpose (chunk
// cycle otherwise — see lib/section-module.tsx).
export const ssr: SectionModule<BlogSectionProps>['ssr'] = async (props) => {
  const { renderToString } = await import('react-dom/server');
  return renderSection(renderToString, Blogs, props);
};
export const { hydrate, mount } = createClientModule<BlogSectionProps>(Blogs);
