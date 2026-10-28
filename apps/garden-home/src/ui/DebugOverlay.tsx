import { useFrame } from '@react-three/fiber';
import { useEffect, useState } from 'react';

export const renderStats = { frames: 0 };

/** Inside <Canvas>: counts rendered frames. */
export function FrameCounter() {
  useFrame(() => {
    renderStats.frames += 1;
  });
  return null;
}

/** ?debug=1 overlay: rendered fps and a visibility log, to check risk R1 inside Plash. */
export function DebugOverlay() {
  const [text, setText] = useState('fps …');
  useEffect(() => {
    const log: string[] = [];
    const onVisibility = () => {
      log.push(`${new Date().toLocaleTimeString()} ${document.visibilityState}`);
      if (log.length > 6) log.shift();
    };
    document.addEventListener('visibilitychange', onVisibility);
    let lastFrames = renderStats.frames;
    const id = window.setInterval(() => {
      const fps = renderStats.frames - lastFrames;
      lastFrames = renderStats.frames;
      setText([`fps ${fps}`, `visibility ${document.visibilityState}`, ...log].join('\n'));
    }, 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(id);
    };
  }, []);
  return <div className="debug">{text}</div>;
}
