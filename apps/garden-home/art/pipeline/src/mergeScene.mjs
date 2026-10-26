/** layout.json (Blender) + <id>.meta.json files -> scene.json v1. */
export function mergeScene({ layout, metas, generatedAt }) {
  const modules = {};
  for (const meta of metas) {
    modules[meta.id] = {
      src: { high: `modules/${meta.id}.high.glb`, medium: `modules/${meta.id}.medium.glb` },
      footprint: meta.footprint,
      role: meta.role,
    };
  }
  for (const slot of layout.slots) {
    if (!Object.hasOwn(modules, slot.module))
      throw new Error(`slot '${slot.id}' uses unknown module '${slot.module}'`);
  }
  return {
    version: 1,
    generatedAt,
    modules,
    slots: layout.slots,
    camera: layout.camera,
    sky: layout.sky,
  };
}
