import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';

// Canonical TanStack Start client entry. StartClient resolves the router itself
// (via getRouter from src/router.tsx) — it takes no props.
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
