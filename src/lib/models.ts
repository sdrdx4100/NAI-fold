import type { ImageGenSettings } from './types';

export const IMAGE_MODELS = [
  { id: 'nai-diffusion-4-5-full', name: 'NAI Diffusion V4.5 Full', v4: true, furry: false },
  { id: 'nai-diffusion-4-5-curated', name: 'NAI Diffusion V4.5 Curated', v4: true, furry: false },
  { id: 'nai-diffusion-4-full', name: 'NAI Diffusion V4 Full', v4: true, furry: false },
  { id: 'nai-diffusion-4-curated-preview', name: 'NAI Diffusion V4 Curated', v4: true, furry: false },
  { id: 'nai-diffusion-3', name: 'NAI Diffusion Anime V3', v4: false, furry: false },
  { id: 'nai-diffusion-furry-3', name: 'NAI Diffusion Furry V3', v4: false, furry: true },
];

export const imageModel = (id: string) => IMAGE_MODELS.find((m) => m.id === id) ?? IMAGE_MODELS[0];

export const SAMPLERS = [
  { id: 'k_euler_ancestral', name: 'Euler Ancestral' },
  { id: 'k_euler', name: 'Euler' },
  { id: 'k_dpmpp_2s_ancestral', name: 'DPM++ 2S Ancestral' },
  { id: 'k_dpmpp_2m_sde', name: 'DPM++ 2M SDE' },
  { id: 'k_dpmpp_2m', name: 'DPM++ 2M' },
  { id: 'k_dpmpp_sde', name: 'DPM++ SDE' },
];

export const NOISE_SCHEDULES = ['karras', 'exponential', 'polyexponential', 'native'];

export const UC_PRESETS = [
  { id: 0, name: 'Heavy' },
  { id: 1, name: 'Light' },
  { id: 2, name: 'Human Focus' },
  { id: 3, name: 'None' },
];

export const QUALITY_TAGS: Record<string, string> = {
  'nai-diffusion-4-5-full': ', location, very aesthetic, masterpiece, no text',
  'nai-diffusion-4-5-curated': ', location, masterpiece, no text, -0.8::feet::, rating:general',
  'nai-diffusion-4-full': ', no text, best quality, very aesthetic, absurdres',
  'nai-diffusion-4-curated-preview': ', rating:general, amazing quality, very aesthetic, absurdres',
  'nai-diffusion-3': ', best quality, amazing quality, very aesthetic, absurdres',
  'nai-diffusion-furry-3': ', {best quality}, {amazing quality}',
};

export const UC_PRESET_TEXT: Record<number, string> = {
  0: 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page',
  1: 'lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page',
  2: 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy',
  3: '',
};

export const SIZE_PRESETS = [
  { name: '縦 Portrait', w: 832, h: 1216 },
  { name: '横 Landscape', w: 1216, h: 832 },
  { name: '正方形 Square', w: 1024, h: 1024 },
  { name: '縦 小', w: 512, h: 768 },
  { name: '横 小', w: 768, h: 512 },
  { name: '壁紙 Wallpaper', w: 1472, h: 832 },
  { name: '折りたたみ 内側', w: 1088, h: 1344 },
];

export const DEFAULT_IMAGE_GEN: ImageGenSettings = {
  model: 'nai-diffusion-4-5-full',
  prompt: '1girl, solo, standing, city at night, neon lights, rain, looking at viewer',
  negative: '',
  qualityToggle: true,
  ucPreset: 0,
  width: 832,
  height: 1216,
  steps: 28,
  scale: 5,
  cfg_rescale: 0,
  sampler: 'k_euler_ancestral',
  noise_schedule: 'karras',
  seed: null,
  n_samples: 1,
  sm: false,
  sm_dyn: false,
  characters: [],
  useCoords: false,
  variety: false,
  baseImageId: null,
  strength: 0.7,
  noise: 0,
};

export const TIER_NAMES = ['Paper', 'Tablet', 'Scroll', 'Opus'];

/** Rough Anlas estimate mirroring the public pricing curve. Opus gets small single images free. */
export function estimateAnlas(s: ImageGenSettings, tier: number): number {
  const pixels = s.width * s.height;
  const steps = s.steps;
  let per = Math.ceil(2.951823174884865e-6 * pixels + 5.753298233447344e-7 * pixels * steps);
  if (s.sm) per = Math.ceil(per * (s.sm_dyn ? 1.4 : 1.2));
  if (s.baseImageId) per = Math.ceil(per * s.strength);
  per = Math.max(2, per);
  const freeEligible = tier >= 3 && pixels <= 1024 * 1024 && steps <= 28;
  const billed = freeEligible ? s.n_samples - 1 : s.n_samples;
  return Math.max(0, per * billed);
}
