import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from './api/mock';
import { buildImagePayload, extractImages } from './api/novelai';
import { DEFAULT_IMAGE_GEN, QUALITY_TAGS, UC_PRESET_TEXT, estimateAnlas } from './models';

describe('image payload', () => {
  it('builds a V4 payload with characters and coordinates', () => {
    const p = buildImagePayload({
      seed: 42,
      settings: { ...DEFAULT_IMAGE_GEN, characters: [{ id: 'c', prompt: 'girl', uc: 'bad', x: 0.3, y: 0.5, enabled: true }], useCoords: true },
    });
    const params = p.parameters as Record<string, any>;
    expect(p.model).toBe('nai-diffusion-4-5-full');
    expect(p.action).toBe('generate');
    expect(params.seed).toBe(42);
    expect(params.v4_prompt.caption.char_captions[0]).toEqual({ char_caption: 'girl', centers: [{ x: 0.3, y: 0.5 }] });
    expect(params.v4_negative_prompt.caption.char_captions[0].char_caption).toBe('bad');
    expect(params.v4_prompt.use_coords).toBe(true);
    expect(params.characterPrompts).toHaveLength(1);
  });

  it('appends quality tags and UC preset', () => {
    const p = buildImagePayload({ seed: 1, settings: { ...DEFAULT_IMAGE_GEN, prompt: 'cat', negative: 'dog', ucPreset: 1 } });
    expect(p.input).toBe('cat' + QUALITY_TAGS['nai-diffusion-4-5-full']);
    expect((p.parameters as Record<string, unknown>).negative_prompt).toBe(`${UC_PRESET_TEXT[1]}, dog`);
    const raw = buildImagePayload({ seed: 1, settings: { ...DEFAULT_IMAGE_GEN, prompt: 'cat', qualityToggle: false, ucPreset: 3 } });
    expect(raw.input).toBe('cat');
  });

  it('skips disabled or empty characters', () => {
    const p = buildImagePayload({
      seed: 1,
      settings: {
        ...DEFAULT_IMAGE_GEN,
        characters: [
          { id: 'a', prompt: 'x', uc: '', x: 0.5, y: 0.5, enabled: false },
          { id: 'b', prompt: '  ', uc: '', x: 0.5, y: 0.5, enabled: true },
        ],
      },
    });
    expect((p.parameters as Record<string, any>).v4_prompt.caption.char_captions).toHaveLength(0);
  });

  it('builds a V3 img2img payload', () => {
    const p = buildImagePayload({ seed: 1, settings: { ...DEFAULT_IMAGE_GEN, model: 'nai-diffusion-3', baseImageId: 'x', sm: true } }, 'BASE64');
    const params = p.parameters as Record<string, unknown>;
    expect(p.action).toBe('img2img');
    expect(params.image).toBe('BASE64');
    expect(params.strength).toBe(DEFAULT_IMAGE_GEN.strength);
    expect(params.sm).toBe(true);
    expect(params.v4_prompt).toBeUndefined();
  });
});

describe('response handling', () => {
  it('extracts images from a zip or raw png', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const zip = zipSync({ 'image_1.png': png, 'image_0.png': png, 'meta.txt': new Uint8Array([1]) });
    expect(extractImages(zip)).toHaveLength(2);
    expect(extractImages(png)).toHaveLength(1);
    expect(extractImages(new Uint8Array([1, 2, 3]))).toHaveLength(0);
  });
});

describe('anlas estimate', () => {
  it('is free for a small single Opus image and costs otherwise', () => {
    expect(estimateAnlas({ ...DEFAULT_IMAGE_GEN, n_samples: 1 }, 3)).toBe(0);
    expect(estimateAnlas({ ...DEFAULT_IMAGE_GEN, n_samples: 1 }, 1)).toBeGreaterThan(0);
    expect(estimateAnlas({ ...DEFAULT_IMAGE_GEN, n_samples: 4 }, 3)).toBeGreaterThan(0);
    expect(estimateAnlas({ ...DEFAULT_IMAGE_GEN, steps: 40 }, 3)).toBeGreaterThan(0);
  });
});

describe('mock', () => {
  it('seeded PRNG is deterministic', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
