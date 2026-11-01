export interface CharacterPrompt {
  id: string;
  prompt: string;
  uc: string;
  x: number; // 0..1
  y: number; // 0..1
  enabled: boolean;
}

export interface ImageGenSettings {
  model: string;
  prompt: string;
  negative: string;
  qualityToggle: boolean;
  ucPreset: number; // 0 heavy, 1 light, 2 human focus, 3 none
  width: number;
  height: number;
  steps: number;
  scale: number;
  cfg_rescale: number;
  sampler: string;
  noise_schedule: string;
  seed: number | null; // null = random
  n_samples: number;
  sm: boolean;
  sm_dyn: boolean;
  characters: CharacterPrompt[];
  useCoords: boolean;
  variety: boolean;
  // img2img
  baseImageId: string | null;
  strength: number;
  noise: number;
}

export interface GeneratedImage {
  id: string;
  createdAt: number;
  seed: number;
  width: number;
  height: number;
  prompt: string;
  negative: string;
  model: string;
  settings: ImageGenSettings;
  favorite: boolean;
  mock: boolean;
}

export interface PromptPreset {
  id: string;
  name: string;
  prompt: string;
  negative: string;
  characters: CharacterPrompt[];
}

export interface Subscription {
  tier: number;
  tierName: string;
  active: boolean;
  anlas: number;
  expiresAt?: number;
}
