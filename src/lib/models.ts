import type { ImageGenSettings, TextEndpoint, TextGenSettings } from './types';

export interface TextModelInfo {
  id: string;
  name: string;
  description: string;
  endpoint: TextEndpoint;
  maxContext: number;
}

export const TEXT_MODELS: TextModelInfo[] = [
  { id: 'glm-4-6', name: 'GLM 4.6', description: '最新・大規模。長文脈と指示追従に強い', endpoint: 'openai', maxContext: 28000 },
  { id: 'llama-3-erato-v1', name: 'Erato', description: 'Llama 3 70B ベースのストーリー特化', endpoint: 'native', maxContext: 8192 },
  { id: 'kayra-v1', name: 'Kayra', description: '独自13Bモデル。軽快で安定', endpoint: 'native', maxContext: 8192 },
  { id: 'clio-v1', name: 'Clio', description: '旧世代の高速モデル', endpoint: 'native', maxContext: 8192 },
];

export const textModel = (id: string): TextModelInfo =>
  TEXT_MODELS.find((m) => m.id === id) ?? { id, name: id, description: 'カスタムモデル', endpoint: 'native', maxContext: 8192 };

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

export const PHRASE_REP_PEN = ['off', 'very_light', 'light', 'medium', 'aggressive', 'very_aggressive'] as const;

export const DEFAULT_TEXT_GEN: TextGenSettings = {
  model: 'glm-4-6',
  endpoint: 'openai',
  temperature: 1.0,
  max_length: 120,
  min_length: 1,
  top_k: 0,
  top_p: 0.95,
  top_a: 0,
  min_p: 0.05,
  typical_p: 1,
  tail_free_sampling: 1,
  repetition_penalty: 1.05,
  repetition_penalty_range: 2048,
  repetition_penalty_slope: 0,
  repetition_penalty_frequency: 0,
  repetition_penalty_presence: 0,
  phrase_rep_pen: 'off',
  stop_sequences: [],
  banned_strings: [],
  context_limit: 8192,
};

export interface TextPreset {
  id: string;
  name: string;
  builtin?: boolean;
  settings: Partial<TextGenSettings>;
}

export const BUILTIN_PRESETS: TextPreset[] = [
  {
    id: 'balanced',
    name: 'バランス Balanced',
    builtin: true,
    settings: { temperature: 1.0, top_p: 0.95, top_k: 0, min_p: 0.05, repetition_penalty: 1.05, phrase_rep_pen: 'off' },
  },
  {
    id: 'creative',
    name: '創造的 Creative',
    builtin: true,
    settings: { temperature: 1.25, top_p: 0.98, top_k: 0, min_p: 0.03, repetition_penalty: 1.08, phrase_rep_pen: 'light' },
  },
  {
    id: 'coherent',
    name: '堅実 Coherent',
    builtin: true,
    settings: { temperature: 0.8, top_p: 0.9, top_k: 40, min_p: 0.08, repetition_penalty: 1.03, phrase_rep_pen: 'very_light' },
  },
  {
    id: 'wild',
    name: '奔放 Wild',
    builtin: true,
    settings: { temperature: 1.5, top_p: 1, top_k: 0, min_p: 0.02, top_a: 0.1, repetition_penalty: 1.1, phrase_rep_pen: 'medium' },
  },
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
