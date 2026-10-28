import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CollectionRef } from '../routes';
import { PlayerEngine, type EngineDeps, type EngineSnapshot, type InitialData } from './engine';

/** One engine per mounted App; it follows the route's collection. `deps` are read once. */
export function usePlayerEngine(
  deps: EngineDeps,
  initial: InitialData | null,
  ref: CollectionRef,
): { engine: PlayerEngine; snapshot: EngineSnapshot } {
  const [engine] = useState(() => new PlayerEngine(deps, initial));
  useEffect(() => engine.attach(), [engine]);
  const { type, id } = ref;
  useEffect(() => {
    engine.open({ type, id });
  }, [engine, type, id]);
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  return { engine, snapshot };
}
