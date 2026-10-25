import { Canvas, type RootState } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import { CameraRig } from '../camera/CameraRig';
import { houseBounds } from '../camera/orbit';
import { MODULES_GROUP, OrbitRig } from '../camera/OrbitRig';
import { ViewFraming } from '../camera/ViewFraming';
import type { Params } from '../params';
import type { RuntimeConfig } from '../runtime';
import { InteractionLayer } from '../interact/Interaction';
import { useAppStore } from '../state/store';
import { ClockSystem } from '../systems/Clock';
import { TimeOfDay } from '../systems/DayNight';
import { SkyEnvironment } from '../systems/Environment';
import { FrameLimiter } from '../systems/FrameLimiter';
import { Sky } from '../systems/Sky';
import { backdropStyle, showsSky, useBackdrop } from '../ui/backdrop';
import { FrameCounter } from '../ui/DebugOverlay';
import { CUTAWAY_MODULES } from './cutaway';
import { moduleUrl } from './loadScene';
import { ModuleBoundary } from './ModuleBoundary';
import { ModuleInstance } from './ModuleInstance';
import { ReadyProbe } from './ReadyProbe';
import type { SceneConfig } from './schema';

interface Props {
  config: SceneConfig;
  sceneUrl: string;
  runtime: RuntimeConfig;
  params: Params;
  onFatal: (error: Error) => void;
  onReady: () => void;
}

const CONTEXT_RESTORE_MS = 3000;
/** The module the camera keeps out of and whose focus the dollhouse cut measures from (interaction spec §2). */
const HOUSE_MODULE = 'house';

export function SceneRoot({ config, sceneUrl, runtime, params, onFatal, onReady }: Props) {
  const markSlotSettled = useAppStore((s) => s.markSlotSettled);
  const backdrop = useBackdrop(params.bg);
  const sky = showsSky(backdrop);
  const site = runtime.route === 'site';
  const house = useMemo(
    () => config.slots.find((slot) => slot.module === HOUSE_MODULE) ?? null,
    [config],
  );
  // what the site camera keeps out of, and the house focus its dollhouse cut measures from
  const houseBox = useMemo(
    () => (house ? houseBounds(house, config.modules[house.module].footprint) : null),
    [house, config],
  );

  // three calls preventDefault on contextlost, so the browser may restore; give it 3 s.
  const handleCreated = ({ gl }: RootState) => {
    // Per-material clipping planes cut the house on the site route; the wallpaper never clips.
    gl.localClippingEnabled = site;
    let timer = 0;
    gl.domElement.addEventListener('webglcontextlost', () => {
      timer = window.setTimeout(() => onFatal(new Error('WebGL context lost')), CONTEXT_RESTORE_MS);
    });
    gl.domElement.addEventListener('webglcontextrestored', () => window.clearTimeout(timer));
  };

  return (
    <Canvas
      dpr={runtime.dpr}
      shadows="percentage"
      frameloop="demand"
      camera={{ near: 0.1, far: 500 }}
      // A transparent canvas: with ?bg= the photo behind it shows wherever the sky dome is left out.
      gl={{ alpha: true }}
      style={!sky && params.bg ? backdropStyle(params.bg) : undefined}
      onCreated={handleCreated}
    >
      <FrameLimiter fps={runtime.fps} />
      {params.debug && <FrameCounter />}
      {sky && <Sky />}
      {/* Reflections keep following the sky gradient, photo or not. */}
      <SkyEnvironment />
      <TimeOfDay
        sky={config.sky}
        override={params.t}
        shadowMapSize={runtime.shadowMapSize}
        shadowAutoUpdate={runtime.shadowAutoUpdate}
        fog={sky}
      />
      <ClockSystem />
      {site ? (
        <OrbitRig pose={config.camera.idle} house={houseBox} />
      ) : (
        <CameraRig pose={config.camera.idle} />
      )}
      <ViewFraming align={runtime.align} />
      {site && <InteractionLayer />}
      {/* The site camera picks the point under the cursor from the modules alone (OrbitRig). */}
      <group name={MODULES_GROUP}>
        {config.slots.map((slot) => (
          <ModuleBoundary key={slot.id} slotId={slot.id} onFailed={markSlotSettled}>
            <Suspense fallback={null}>
              <group position={slot.position} quaternion={slot.rotation} scale={slot.scale}>
                <ModuleInstance
                  slotId={slot.id}
                  module={slot.module}
                  src={moduleUrl(config.modules[slot.module].src[runtime.quality], sceneUrl)}
                  cutaway={site && Object.hasOwn(CUTAWAY_MODULES, slot.module)}
                  baseY={slot.position[1]}
                  interactive={site}
                />
              </group>
            </Suspense>
          </ModuleBoundary>
        ))}
      </group>
      <ReadyProbe total={config.slots.length} onReady={onReady} />
    </Canvas>
  );
}
