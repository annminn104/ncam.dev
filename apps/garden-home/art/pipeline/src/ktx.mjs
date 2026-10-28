import { spawnSync } from 'node:child_process';

/** Installed KTX-Software version as [major, minor, patch], or null when `ktx` is missing. */
export function ktxVersion() {
  const result = spawnSync('ktx', ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(`${result.stdout}${result.stderr}`);
  return match ? match.slice(1).map(Number) : null;
}

/** gltf-transform 4.5 needs KTX-Software >= 4.4.0. */
export function isKtxSupported(version) {
  if (!version) return false;
  const [major, minor] = version;
  return major > 4 || (major === 4 && minor >= 4);
}
