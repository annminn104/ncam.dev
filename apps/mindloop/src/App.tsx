import { useEffect } from 'react';
import { createLogger } from '@ncam/logger';
import { MotionEnabledContext } from './lib/motion';
import { Navbar } from './components/sections/navbar';
import { Hero } from './components/sections/hero';
import { SearchChanged } from './components/sections/search-changed';
import { Mission } from './components/sections/mission';
import { Solution } from './components/sections/solution';
import { CTA } from './components/sections/cta';
import { Footer } from './components/sections/footer';

const log = createLogger({ scope: 'mindloop' });

/**
 * `animate` is false on the SSR / hydrate path so content renders visible and
 * static (identical markup server & client). The CSR mount path leaves it true
 * to play the entrance animations.
 */
export default function App({ animate = true }: { animate?: boolean }) {
  useEffect(() => {
    log.info('mindloop.mounted');
  }, []);
  return (
    <MotionEnabledContext.Provider value={animate}>
      <div
        data-mindloop-root
        className="min-h-screen bg-background font-sans text-foreground antialiased"
      >
        {/* Without JS, framer-motion's entrance styles (opacity:0) never animate in;
            reveal that content so the page is readable and crawlable regardless. */}
        <noscript
          dangerouslySetInnerHTML={{
            __html:
              '<style>[data-mindloop-root] [style*="opacity"]{opacity:1!important;transform:none!important}</style>',
          }}
        />
        <Navbar />
        <Hero />
        <SearchChanged />
        <Mission />
        <Solution />
        <CTA />
        <Footer />
      </div>
    </MotionEnabledContext.Provider>
  );
}
