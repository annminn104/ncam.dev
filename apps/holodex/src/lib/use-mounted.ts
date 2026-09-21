import { useEffect, useState } from 'react';

/**
 * False on the server and on the first client render, true afterwards.
 * Anything that reads browser-only state must gate on this so the server
 * markup and the first client render agree.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
