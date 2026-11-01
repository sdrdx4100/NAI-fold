export type Origin = 'prompt' | 'user' | 'ai' | 'edit';

export interface Segment {
  text: string;
  origin: Origin;
}

export interface LoreEntry {
  id: string;
  displayName: string;
  text: string;
  keys: string[];
  enabled: boolean;
  alwaysOn: boolean;
  /** How many characters from the end of the story are scanned for keys. */
  searchRange: number;
  /** Higher = placed earlier and kept first when trimming. */
  priority: number;
  caseSensitive: boolean;
  category: string;
}

export type TextEndpoint = 'native' | 'openai';

export interface TextGenSettings {
  model: string;
  endpoint: TextEndpoint;
  temperature: number;
  max_length: number;
  min_length: number;
  top_k: number;
  top_p: number;
  top_a: number;
  min_p: number;
  typical_p: number;
  tail_free_sampling: number;
  repetition_penalty: number;
  repetition_penalty_range: number;
  repetition_penalty_slope: number;
  repetition_penalty_frequency: number;
  repetition_penalty_presence: number;
  phrase_rep_pen: 'off' | 'very_light' | 'light' | 'medium' | 'aggressive' | 'very_aggressive';
  stop_sequences: string[];
  banned_strings: string[];
  /** Total context budget in tokens (including the output). */
  context_limit: number;
}

export interface StoryContextSettings {
  authorsNoteDepth: number; // newlines from the end
  attgEnabled: boolean;
  attg: { author: string; title: string; tags: string; genre: string };
  style: string; // e.g. "[ S: 4 ]"
  trimTrailingSpaces: boolean;
}

export interface HistoryNode {
  id: string;
  parentId: string | null;
  childIds: string[];
  segments: Segment[];
  kind: 'root' | 'gen' | 'edit' | 'retry';
  at: number;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  segments: Segment[];
  memory: string;
  authorsNote: string;
  lorebook: LoreEntry[];
  gen: TextGenSettings;
  ctx: StoryContextSettings;
  history: { nodes: Record<string, HistoryNode>; currentId: string };
}

export interface StoryMeta {
  id: string;
  title: string;
  description: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  preview: string;
  chars: number;
}

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
  ucPreset: number; // 0 heavy, 1 light, 2 human focus / furry, 3 none (model-dependent)
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
  storyId: string | null;
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

export interface Subscription {
  tier: number;
  tierName: string;
  active: boolean;
  anlas: number;
  expiresAt?: number;
}
