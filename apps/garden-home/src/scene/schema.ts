import { z } from 'zod';

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const quat = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');

const cameraPose = z.object({ position: vec3, rotation: quat, fov: z.number().positive() });

/** scene.json v1. */
export const sceneSchema = z
  .object({
    version: z.literal(1),
    generatedAt: z.string(),
    modules: z.record(
      z.string(),
      z.object({
        src: z.object({ high: z.string(), medium: z.string() }),
        footprint: z.tuple([z.number().positive(), z.number().positive()]),
        role: z.enum(['hero', 'prop']),
      }),
    ),
    slots: z.array(
      z.object({ id: z.string(), module: z.string(), position: vec3, rotation: quat, scale: vec3 }),
    ),
    camera: z.object({ idle: cameraPose, stops: z.array(cameraPose.extend({ id: z.string() })) }),
    sky: z.object({ sunrise: hhmm, sunset: hhmm }),
  })
  .superRefine((scene, ctx) => {
    scene.slots.forEach((slot, index) => {
      if (!Object.hasOwn(scene.modules, slot.module)) {
        ctx.addIssue({
          code: 'custom',
          path: ['slots', index, 'module'],
          message: `unknown module '${slot.module}'`,
        });
      }
    });
  });

export type SceneConfig = z.infer<typeof sceneSchema>;
export type Slot = SceneConfig['slots'][number];
export type CameraPose = SceneConfig['camera']['idle'];
export type SkyConfig = SceneConfig['sky'];
