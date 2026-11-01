import { create } from 'zustand';
import type { ApiConfig } from '../lib/api';
import { providerFor } from '../lib/api';
import { dbGet, dbPut } from '../lib/db';
import { DEFAULT_IMAGE_GEN } from '../lib/models';
import type { ImageGenSettings, PromptPreset, Subscription } from '../lib/types';
import { debounce } from '../lib/util';

export type Theme = 'nai' | 'midnight' | 'paper' | 'sepia';
export type LayoutPref = 'auto' | 'single' | 'dual' | 'dual-v' | 'triple';

export interface UISettings {
  theme: Theme;
  layout: LayoutPref;
  swapPanes: boolean;
  splitRatio: number;
  haptics: boolean;
}

export interface SettingsState {
  loaded: boolean;
  api: ApiConfig;
  ui: UISettings;
  imageGen: ImageGenSettings;
  promptPresets: PromptPreset[];
  subscription: Subscription | null;
  load: () => Promise<void>;
  setApi: (p: Partial<ApiConfig>) => void;
  setUI: (p: Partial<UISettings>) => void;
  setImageGen: (p: Partial<ImageGenSettings>) => void;
  savePromptPreset: (p: PromptPreset) => void;
  deletePromptPreset: (id: string) => void;
  refreshSubscription: () => Promise<Subscription | null>;
}

export const DEFAULT_API: ApiConfig = {
  token: '',
  mock: true,
  apiBase: 'https://api.novelai.net',
  imageBase: 'https://image.novelai.net',
};

export const DEFAULT_UI: UISettings = {
  theme: 'nai',
  layout: 'auto',
  swapPanes: false,
  splitRatio: 0.5,
  haptics: true,
};

const persist = debounce((s: SettingsState) => {
  void dbPut('kv', 'settings', {
    api: s.api,
    ui: s.ui,
    imageGen: s.imageGen,
    promptPresets: s.promptPresets,
    subscription: s.subscription,
  });
}, 300);

export const useSettings = create<SettingsState>((set, get) => {
  const update = (p: Partial<SettingsState>) => {
    set(p);
    persist(get());
  };
  return {
    loaded: false,
    api: DEFAULT_API,
    ui: DEFAULT_UI,
    imageGen: DEFAULT_IMAGE_GEN,
    promptPresets: [],
    subscription: null,
    load: async () => {
      const saved = await dbGet<Partial<SettingsState>>('kv', 'settings');
      set({
        loaded: true,
        api: { ...DEFAULT_API, ...saved?.api },
        ui: { ...DEFAULT_UI, ...saved?.ui },
        imageGen: { ...DEFAULT_IMAGE_GEN, ...saved?.imageGen },
        promptPresets: saved?.promptPresets ?? [],
        subscription: saved?.subscription ?? null,
      });
    },
    setApi: (p) => update({ api: { ...get().api, ...p } }),
    setUI: (p) => update({ ui: { ...get().ui, ...p } }),
    setImageGen: (p) => update({ imageGen: { ...get().imageGen, ...p } }),
    savePromptPreset: (p) => update({ promptPresets: [...get().promptPresets.filter((x) => x.id !== p.id), p] }),
    deletePromptPreset: (id) => update({ promptPresets: get().promptPresets.filter((x) => x.id !== id) }),
    refreshSubscription: async () => {
      const cfg = get().api;
      const sub = await providerFor(cfg).getSubscription(cfg);
      update({ subscription: sub });
      return sub;
    },
  };
});
