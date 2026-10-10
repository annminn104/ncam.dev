import { BlurPass } from '@react-three/drei/materials/BlurPass.js';
import { MeshReflectorMaterial } from '@react-three/drei/materials/MeshReflectorMaterial.js';
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { useEffect, useMemo, type RefObject } from 'react';
import {
  DepthFormat,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  PerspectiveCamera,
  Plane,
  UnsignedShortType,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Mesh,
} from 'three';

const RESOLUTION = 512;

/**
 * The lake's mirror, attached as its mesh's material: drei's MeshReflectorMaterial and its blur
 * pass, the very material and render passes drei's `<MeshReflectorMaterial>` component runs
 * (`resolution 512, mirror 1, mixStrength 3, mixBlur 0.8, blur [200, 80]`), driven here instead.
 * drei's component makes two half-float render targets, a depth texture and a blur pass with two
 * more targets, and never frees them: ~10 MB of GPU memory that outlived every drop to the plain
 * lake on a weak GPU. Unmounting this frees all of it.
 *
 * drei's mirror normal is the mesh's local +z: rotate the mesh, never its plane geometry.
 */
export function LakeMirror({ mesh }: { mesh: RefObject<Mesh | null> }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const mirror = useMemo(() => {
    const parameters = { minFilter: LinearFilter, magFilter: LinearFilter, type: HalfFloatType };
    const fbo1 = new WebGLRenderTarget(RESOLUTION, RESOLUTION, parameters);
    fbo1.depthBuffer = true;
    fbo1.depthTexture = new DepthTexture(RESOLUTION, RESOLUTION);
    fbo1.depthTexture.format = DepthFormat;
    fbo1.depthTexture.type = UnsignedShortType;
    const fbo2 = new WebGLRenderTarget(RESOLUTION, RESOLUTION, parameters);
    const blur = new BlurPass({
      gl,
      resolution: RESOLUTION,
      width: 200,
      height: 80,
      minDepthThreshold: 0.9,
      maxDepthThreshold: 1,
      depthScale: 0,
      depthToBlurRatioBias: 0.25,
    });
    const textureMatrix = new Matrix4();
    // drei multiplies the reflection into the albedo, then lights it: a neutral grey keeps the
    // sky's own colours (a blue one squared the blue). Its own uniforms only after construction:
    // the base class's setValues runs before they exist.
    const material = new MeshReflectorMaterial({ color: '#8a909c', roughness: 0.6, metalness: 0 });
    material.mirror = 1;
    material.mixStrength = 3;
    material.mixBlur = 0.8;
    material.hasBlur = true;
    material.tDiffuse = fbo1.texture;
    material.tDepth = fbo1.depthTexture;
    material.tDiffuseBlur = fbo2.texture;
    material.textureMatrix = textureMatrix;
    material.defines = { ...material.defines, USE_BLUR: '' };
    return {
      fbo1,
      fbo2,
      blur,
      material,
      textureMatrix,
      virtualCamera: new PerspectiveCamera(),
      plane: new Plane(),
      normal: new Vector3(),
      reflectorPosition: new Vector3(),
      cameraPosition: new Vector3(),
      rotation: new Matrix4(),
      lookAt: new Vector3(),
      clipPlane: new Vector4(),
      view: new Vector3(),
      target: new Vector3(),
      q: new Vector4(),
    };
  }, [gl]);

  useEffect(
    () => () => {
      mirror.fbo1.dispose(); // and its depth texture
      mirror.fbo2.dispose();
      mirror.blur.renderTargetA.dispose();
      mirror.blur.renderTargetB.dispose();
      mirror.blur.convolutionMaterial.dispose();
      mirror.blur.screen.geometry.dispose();
      mirror.material.dispose();
    },
    [mirror],
  );

  useFrame(() => {
    const parent = mesh.current;
    if (!parent) return;
    parent.visible = false;
    const xr = gl.xr.enabled;
    const shadows = gl.shadowMap.autoUpdate;
    aim(parent, camera, mirror);
    gl.xr.enabled = false;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(mirror.fbo1);
    gl.state.buffers.depth.setMask(true);
    if (!gl.autoClear) gl.clear();
    gl.render(scene, mirror.virtualCamera);
    mirror.blur.render(gl, mirror.fbo1, mirror.fbo2);
    gl.xr.enabled = xr;
    gl.shadowMap.autoUpdate = shadows;
    parent.visible = true;
    gl.setRenderTarget(null);
  });

  return <primitive object={mirror.material} attach="material" />;
}

/**
 * drei's MeshReflectorMaterial `beforeRender`, unchanged: the camera mirrored in the mesh's
 * plane, the texture matrix that maps the mirror onto it, and an oblique near plane at the
 * water, so nothing under it shows in the reflection. Leaves the virtual camera as it was when
 * the camera is behind the mirror.
 */
function aim(
  parent: Mesh,
  camera: RootState['camera'],
  m: {
    textureMatrix: Matrix4;
    virtualCamera: PerspectiveCamera;
    plane: Plane;
    normal: Vector3;
    reflectorPosition: Vector3;
    cameraPosition: Vector3;
    rotation: Matrix4;
    lookAt: Vector3;
    clipPlane: Vector4;
    view: Vector3;
    target: Vector3;
    q: Vector4;
  },
): void {
  const { normal, reflectorPosition, cameraPosition, rotation, lookAt, view, target } = m;
  const { virtualCamera, textureMatrix, plane, clipPlane, q } = m;
  reflectorPosition.setFromMatrixPosition(parent.matrixWorld);
  cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  rotation.extractRotation(parent.matrixWorld);
  normal.set(0, 0, 1).applyMatrix4(rotation);
  view.subVectors(reflectorPosition, cameraPosition);
  // The camera is behind the mirror: nothing to reflect.
  if (view.dot(normal) > 0) return;
  view.reflect(normal).negate().add(reflectorPosition);
  rotation.extractRotation(camera.matrixWorld);
  lookAt.set(0, 0, -1).applyMatrix4(rotation).add(cameraPosition);
  target.subVectors(reflectorPosition, lookAt).reflect(normal).negate().add(reflectorPosition);
  virtualCamera.position.copy(view);
  virtualCamera.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
  virtualCamera.lookAt(target);
  virtualCamera.far = camera.far; // WebGLBackground reads it
  virtualCamera.updateMatrixWorld();
  virtualCamera.projectionMatrix.copy(camera.projectionMatrix);

  textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);
  textureMatrix.multiply(virtualCamera.projectionMatrix);
  textureMatrix.multiply(virtualCamera.matrixWorldInverse);
  textureMatrix.multiply(parent.matrixWorld);

  // Oblique near plane at the mirror (Lengyel, http://www.terathon.com/code/oblique.html).
  plane.setFromNormalAndCoplanarPoint(normal, reflectorPosition);
  plane.applyMatrix4(virtualCamera.matrixWorldInverse);
  clipPlane.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
  const e = virtualCamera.projectionMatrix.elements;
  q.x = (Math.sign(clipPlane.x) + e[8]) / e[0];
  q.y = (Math.sign(clipPlane.y) + e[9]) / e[5];
  q.z = -1.0;
  q.w = (1.0 + e[10]) / e[14];
  clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));
  e[2] = clipPlane.x;
  e[6] = clipPlane.y;
  e[10] = clipPlane.z + 1.0;
  e[14] = clipPlane.w;
}
