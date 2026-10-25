import { createContext } from 'react';

export type Quality = 'high' | 'low';

/** Lowered by drei's PerformanceMonitor: fewer particles, no reflector, dpr 1. */
export const QualityContext = createContext<Quality>('high');
