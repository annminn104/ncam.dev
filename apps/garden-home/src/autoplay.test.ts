import { describe, expect, it } from 'vitest';
import { isSoftwareRenderer, shouldAutoplay } from './autoplay';

describe('isSoftwareRenderer', () => {
  it('names the software rasterisers', () => {
    // Chrome's SwiftShader, as headless Chrome reports it with --enable-unsafe-swiftshader.
    expect(
      isSoftwareRenderer(
        'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)',
      ),
    ).toBe(true);
    expect(isSoftwareRenderer('Google SwiftShader')).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isSoftwareRenderer('Mesa softpipe')).toBe(true);
    expect(isSoftwareRenderer('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)')).toBe(
      true,
    );
  });

  it('passes hardware GPUs', () => {
    expect(
      isSoftwareRenderer('ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)'),
    ).toBe(false);
    expect(
      isSoftwareRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'),
    ).toBe(false);
    expect(isSoftwareRenderer('Adreno (TM) 740')).toBe(false);
    expect(isSoftwareRenderer('Apple GPU')).toBe(false);
  });

  it('trusts the performance-caveat check when the renderer is unknown', () => {
    expect(isSoftwareRenderer(null)).toBe(false);
    expect(isSoftwareRenderer('')).toBe(false);
  });
});

describe('shouldAutoplay', () => {
  it('opens the garden by itself on a hardware GPU', () => {
    expect(shouldAutoplay({ hardwareGpu: true, reducedMotion: false })).toBe(true);
  });

  it('waits for the visitor on a software rasteriser', () => {
    // SwiftShader (the Lighthouse runner, GPU-less machines) spends seconds compiling shaders.
    expect(shouldAutoplay({ hardwareGpu: false, reducedMotion: false })).toBe(false);
  });

  it('waits for the visitor who asked for reduced motion', () => {
    expect(shouldAutoplay({ hardwareGpu: true, reducedMotion: true })).toBe(false);
    expect(shouldAutoplay({ hardwareGpu: false, reducedMotion: true })).toBe(false);
  });
});
