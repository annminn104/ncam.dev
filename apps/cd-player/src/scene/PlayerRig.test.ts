import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The rig's hooks run in R3F's frame loop, which a node test cannot drive: these read the source,
// as useSceneTextures.test.ts reads its own.
const source = readFileSync(new URL('./PlayerRig.tsx', import.meta.url), 'utf8');

/** The source of the component `name`, up to the next top-level function. */
function body(name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`no ${name}`);
  const ends = [
    source.indexOf('\nfunction ', start + 1),
    source.indexOf('\nexport function ', start + 1),
  ];
  const end = Math.min(...ends.filter((at) => at > 0), source.length);
  return source.slice(start, end);
}
const calls = (hook: string) => source.split(`${hook}(`).length - 1;

describe('PlayerRig', () => {
  it('mounts the VU strip, the display’s prints and the knob for a CD player only', () => {
    for (const hook of ['useVu', 'useSceneTextures', 'useKnob']) {
      expect(calls(hook), hook).toBe(1);
      expect(body('CdPlayerParts'), hook).toContain(`${hook}(`);
    }
  });

  it('prints a turntable’s plate in its own parts, and gives both kinds the keys', () => {
    expect(calls('useCardPrint')).toBe(1);
    expect(body('TurntableParts')).toContain('useCardPrint(');
    expect(body('CdPlayerParts')).toContain('useControls(');
    expect(body('TurntableParts')).toContain('useControls(');
  });

  it('drags a turntable’s arm in its own parts, and lights the ring for every model', () => {
    expect(calls('useArmDrag')).toBe(1);
    expect(body('TurntableParts')).toContain('useArmDrag(');
    expect(calls('useJogRing')).toBe(1);
    expect(body('PlayerRig')).toContain('useJogRing(');
  });

  it('picks the parts by the media of the model on show', () => {
    expect(body('PlayerRig')).toMatch(/if \(isCdRig\(rig\)\) return <CdPlayerParts/);
    expect(body('PlayerRig')).toMatch(/if \(isTurntableRig\(rig\)\) return <TurntableParts/);
  });
});
