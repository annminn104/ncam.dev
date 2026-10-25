/**
 * The `assetBase` a project remote's server render is handed, by MF remote name.
 *
 * Only TOONHUB gets one: its server render reads no other source for the origin
 * its images live on (apps/toonhub/src/ssr.ts). Every other remote names its
 * files from the URL the host's loader fetched it from, and its client entries
 * do the same, since `ProjectStage` sends them no `assetBase` either. A remote
 * that honours the option (chess) would otherwise resolve its server markup
 * against TOONHUB's origin while its hydrate resolves against its own.
 */
export function ssrAssetBase(remote: string): string | undefined {
  return remote === 'toonhub' ? import.meta.env.VITE_TOONHUB_ORIGIN : undefined;
}
