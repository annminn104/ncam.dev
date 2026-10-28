import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { PerspectiveCamera } from 'three';
import type { Align } from '../params';
import { viewOffsetFor } from './framing';

/** Inside <Canvas>: slides the picture to ?align= (wallpaper default: right) and keeps it there on every resize. */
export function ViewFraming({ align }: { align: Align }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const offset = viewOffsetFor(align, width, height);
    // Both update the projection matrix; R3F's own resize keeps the view, whose ratios stay right for any size.
    if (offset)
      camera.setViewOffset(
        offset.fullWidth,
        offset.fullHeight,
        offset.x,
        offset.y,
        offset.width,
        offset.height,
      );
    else camera.clearViewOffset();
    invalidate();
  }, [align, camera, width, height, invalidate]);
  return null;
}
