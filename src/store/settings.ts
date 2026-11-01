import { create } from 'zustand';
import type { ApiConfig } from '../lib/api';
import { providerFor } from '../lib/api';
import { dbGet, dbPut } from '../lib/db';
import { DEFAULT_IMAGE_GEN, DEFAULT_TEXT_GEN, type TextPreset } from '../lib/models';
import type { ImageGenSettings, Subscription, TextGenSettings } from '../lib/types';
import { debounce } from '../lib/util';

export type Theme = 'nai' | 'midnight' | 'paper' | 'sepia';
export type LayoutPref = 'auto' | 'single' | 'dual' | 'dual-v' | 'triple';

export interface UISettings {
  theme: Theme;
  editorFont: 'serif' | 'sans' | 'mono';
  fontSize: number;
  lineHeight: number;
  highlight: boolean;
  layout: LayoutPref;
  inputBox: boolean;
  swapPanes: boolean;
  splitRatio: number;
  haptics: boolean;
  sendOnEnter: boolean;
  showTokens: boolean;
}

export interface SettingsState {
  loaded: boolean;
  api: ApiConfig;
  ui: UISettings;
  presets: TextPreset[];
  defaultGen: TextGenSettings;
  imageGen: ImageGenSettings;
  subscription: Subscription | null;
  load: () => Promise<void>;
  setApi: (p: Partial<ApiConfig>) => void;
  setUI: (p: Partial<UISettings>) => void;
  setImageGen: (p: Partial<ImageGenSettings>) => void;
  setDefaultGen: (p: Partial<TextGenSettings>) => void;
  savePreset: (p: TextPreset) => void;
  deletePreset: (id: string) => void;
  refreshSubscription: () => Promise<Subscription | null>;
}

export const DEFAULT_API: ApiConfig = {
  token: '',
  mock: true,
  apiBase: 'https://api.novelai.net',
  textBase: 'https://text.novelai.net',
  imageBase: 'https://image.novelai.net',
  stream: true,
};

export const DEFAULT_UI: UISettings = {
  theme: 'nai',
  editorFont: 'serif',
  fontSize: 17,
  lineHeight: 1.85,
  highlight: true,
  layout: 'auto',
  inputBox: false,
  swapPanes: false,
  splitRatio: 0.5,
  haptics: true,
  sendOnEnter: false,
  showTokens: true,
};

const persist = debounce((s: SettingsState) => {
  void dbPut('kv', 'settings', {
    api: s.api,
    ui: s.ui,
    presets: s.presets,
    defaultGen: s.defaultGen,
    imageGen: s.imageGen,
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
    presets: [],
    defaultGen: DEFAULT_TEXT_GEN,
    imageGen: DEFAULT_IMAGE_GEN,
    subscription: null,
    load: async () => {
      const saved = await dbGet<Partial<SettingsState>>('kv', 'settings');
      set({
        loaded: true,
        api: { ...DEFAULT_API, ...saved?.api },
        ui: { ...DEFAULT_UI, ...saved?.ui },
        presets: saved?.presets ?? [],
        defaultGen: { ...DEFAULT_TEXT_GEN, ...saved?.defaultGen },
        imageGen: { ...DEFAULT_IMAGE_GEN, ...saved?.imageGen },
        subscription: saved?.subscription ?? null,
      });
    },
    setApi: (p) => update({ api: { ...get().api, ...p } }),
    setUI: (p) => update({ ui: { ...get().ui, ...p } }),
    setImageGen: (p) => update({ imageGen: { ...get().imageGen, ...p } }),
    setDefaultGen: (p) => update({ defaultGen: { ...get().defaultGen, ...p } }),
    savePreset: (p) => update({ presets: [...get().presets.filter((x) => x.id !== p.id), p] }),
    deletePreset: (id) => update({ presets: get().presets.filter((x) => x.id !== id) }),
    refreshSubscription: async () => {
      const cfg = get().api;
      const sub = await providerFor(cfg).getSubscription(cfg);
      update({ subscription: sub });
      return sub;
    },
  };
});
