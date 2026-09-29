import handler, { createServerEntry } from '@tanstack/react-start/server-entry';
import { lowerModulePreloadsStream } from './lib/low-priority-preloads';

/**
 * TanStack Start's own handler, with its HTML streamed through
 * lowerModulePreloadsStream() (see lib/low-priority-preloads.ts): preloads at
 * low priority, and none at all on a project page, whose first screen is the
 * remote's. Everything else (server routes' XML and text, server functions,
 * redirects) passes as it came.
 */
export default createServerEntry({
  async fetch(request) {
    const response = await handler.fetch(request);
    const type = response.headers.get('content-type') ?? '';
    if (!response.body || !type.includes('text/html')) return response;
    const headers = new Headers(response.headers);
    // The transform changes the length.
    headers.delete('content-length');
    const mode = new URL(request.url).pathname.startsWith('/projects/') ? 'drop' : 'lower';
    const body = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(lowerModulePreloadsStream(mode))
      .pipeThrough(new TextEncoderStream());
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
