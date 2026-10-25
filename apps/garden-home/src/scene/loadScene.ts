import { z } from 'zod';
import { type SceneConfig, sceneSchema } from './schema';

/** scene.json beside the modules in public/assets, resolved against the remote's origin (lib/asset-url). */
export const SCENE_PATH = 'assets/scene.json';
export const SCENE_URL = `/${SCENE_PATH}`;

export class SceneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneError';
  }
}

export function parseScene(json: unknown): SceneConfig {
  const result = sceneSchema.safeParse(json);
  if (!result.success)
    throw new SceneError(`scene.json is invalid:\n${z.prettifyError(result.error)}`);
  return result.data;
}

export async function loadScene(
  url: string = SCENE_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<SceneConfig> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new SceneError(`scene.json fetch failed: ${String(error)}`);
  }
  if (!response.ok) throw new SceneError(`scene.json fetch failed: HTTP ${response.status}`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new SceneError('scene.json is not valid JSON');
  }
  return parseScene(json);
}

/**
 * Module paths in scene.json are relative to scene.json itself. An absolute sceneUrl (the remote's
 * origin, which the host page does not share) gives absolute module URLs; a root-relative one,
 * root-relative URLs.
 */
export function moduleUrl(src: string, sceneUrl: string = SCENE_URL): string {
  const url = new URL(src, new URL(sceneUrl, 'http://local'));
  return url.origin === 'http://local' ? url.pathname : url.href;
}
