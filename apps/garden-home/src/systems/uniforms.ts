/** Uniform objects shared by every patched material; systems mutate `.value` each frame. */
export const globalUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uNight: { value: 0 },
};
