import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runBlender } from '../src/blender.mjs';
import { isKtxSupported, ktxVersion } from '../src/ktx.mjs';
import { createIO, optimizeModule, textureSizeFor } from '../src/optimize.mjs';

const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));

describe('textureSizeFor', () => {
  it('uses the role ceiling for high and half of it for medium', () => {
    expect(textureSizeFor('hero', 'high')).toBe(2048);
    expect(textureSizeFor('hero', 'medium')).toBe(1024);
    expect(textureSizeFor('prop', 'high')).toBe(1024);
    expect(textureSizeFor('prop', 'medium')).toBe(512);
    expect(() => textureSizeFor('giant', 'high')).toThrow(/unknown role/);
  });
});

describe('optimizeModule (Blender + KTX-Software)', () => {
  let tmp;
  let io;

  beforeAll(async () => {
    if (!isKtxSupported(ktxVersion())) {
      throw new Error(
        'KTX-Software >= 4.4.0 not found: install it before running this test (see plan "Chuẩn bị")',
      );
    }
    tmp = mkdtempSync(join(tmpdir(), 'garden-opt-'));
    for (const id of ['yard', 'koi_pond', 'house']) {
      const { code, stderr } = await runBlender({
        blend: join(REPO, 'blender/modules', `${id}.blend`),
        script: 'export_module.py',
        args: ['--out-dir', tmp],
        scriptsDir: join(REPO, 'blender/scripts'),
      });
      if (code !== 0) throw new Error(stderr.slice(-2000));
    }
    io = await createIO();
  }, 180_000);

  afterAll(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it("keeps hotspot extras, wind COLOR_0, the koi's loops and fish numbers", async () => {
    const output = join(tmp, 'koi_pond.medium.glb');
    await optimizeModule({
      input: join(tmp, 'koi_pond.raw.glb'),
      output,
      role: 'prop',
      tier: 'medium',
    });
    const root = (await io.read(output)).getRoot();
    expect(root.listExtensionsUsed().map((e) => e.extensionName)).toContain(
      'EXT_meshopt_compression',
    );
    const hotspot = root.listNodes().find((n) => n.getName() === 'HS_pond');
    expect(hotspot?.getExtras()).toEqual({ action: 'focus', label: 'Ao cá', radius: 4.5 });
    const colored = root
      .listMeshes()
      .filter((m) => m.listPrimitives().some((p) => p.getAttribute('COLOR_0')));
    expect(colored.map((m) => m.getName()).sort()).toEqual(['Lotus', 'Rockery']);
    const koi = root.listNodes().find((n) => n.getName() === 'Koi');
    expect(koi.getExtras().koi.length % 12).toBe(0); // the loops the website swims the fish along
    const numbers = koi
      .getMesh()
      .listPrimitives()
      .map((p) => p.getAttribute('TEXCOORD_1'));
    expect(numbers.every((a) => a !== null && a.getNormalized())).toBe(true); // quantized, read back as 0..1
  }, 120_000);

  it("keeps ambient clips (the jacuzzi's bubbles)", async () => {
    const output = join(tmp, 'house.medium.glb');
    await optimizeModule({
      input: join(tmp, 'house.raw.glb'),
      output,
      role: 'hero',
      tier: 'medium',
    });
    const root = (await io.read(output)).getRoot();
    expect(
      root
        .listAnimations()
        .map((a) => a.getName())
        .sort(),
    ).toEqual([
      'act_ac_bedroom2',
      'act_ac_bedroom3',
      'act_ac_master',
      'act_door_open',
      'ambient_jacuzzi',
    ]);
  }, 180_000);

  it('compresses textures to KTX2 and halves them for medium', async () => {
    for (const [tier, size] of [
      ['high', 1024],
      ['medium', 512],
    ]) {
      const output = join(tmp, `yard.${tier}.glb`);
      await optimizeModule({ input: join(tmp, 'yard.raw.glb'), output, role: 'prop', tier });
      const root = (await io.read(output)).getRoot();
      expect(root.listExtensionsUsed().map((e) => e.extensionName)).toContain('KHR_texture_basisu');
      const textures = root.listTextures();
      expect(textures.length).toBeGreaterThan(0);
      for (const texture of textures) {
        expect(texture.getMimeType()).toBe('image/ktx2');
        expect(texture.getSize()).toEqual([size, size]);
      }
      const bulb = root.listNodes().find((n) => n.getName() === 'Lamp_bulb');
      expect(bulb?.getExtras()).toEqual({ night_light: true });
    }
  }, 180_000);
});
