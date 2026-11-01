import { create } from 'zustand';
import { isMock, providerFor } from '../lib/api';
import { dbAll, dbDelete, dbGet, dbPut } from '../lib/db';
import type { GeneratedImage, ImageGenSettings } from '../lib/types';
import { haptic, randomSeed, uid } from '../lib/util';
import { useSettings } from './settings';
import { toast } from './ui';

interface ImageState {
  loaded: boolean;
  images: GeneratedImage[];
  urls: Record<string, string>;
  selectedId: string | null;
  generating: boolean;
  progress: number;
  abort: AbortController | null;
  load: () => Promise<void>;
  url: (id: string) => Promise<string | null>;
  blob: (id: string) => Promise<Blob | undefined>;
  select: (id: string | null) => void;
  generate: (storyId: string | null, override?: Partial<ImageGenSettings>) => Promise<void>;
  stop: () => void;
  remove: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => void;
  addUpload: (file: Blob, w: number, h: number) => Promise<GeneratedImage>;
}

export const useImages = create<ImageState>((set, get) => ({
  loaded: false,
  images: [],
  urls: {},
  selectedId: null,
  generating: false,
  progress: 0,
  abort: null,

  load: async () => {
    const images = (await dbAll<GeneratedImage>('images')).sort((a, b) => b.createdAt - a.createdAt);
    set({ images, loaded: true, selectedId: images[0]?.id ?? null });
  },

  url: async (id) => {
    const cached = get().urls[id];
    if (cached) return cached;
    const b = await dbGet<Blob>('blobs', id);
    if (!b) return null;
    const u = URL.createObjectURL(b);
    set({ urls: { ...get().urls, [id]: u } });
    return u;
  },

  blob: (id) => dbGet<Blob>('blobs', id),

  select: (selectedId) => set({ selectedId }),

  generate: async (storyId, override) => {
    if (get().generating) return;
    const st = useSettings.getState();
    const settings: ImageGenSettings = { ...st.imageGen, ...override };
    if (!settings.prompt.trim()) {
      toast('プロンプトを入力してください', 'error');
      return;
    }
    const seed = settings.seed ?? randomSeed();
    const ac = new AbortController();
    set({ generating: true, progress: 0.02, abort: ac });
    if (st.ui.haptics) haptic(10);
    try {
      const baseImage = settings.baseImageId ? await dbGet<Blob>('blobs', settings.baseImageId) : null;
      const res = await providerFor(st.api).generateImages(st.api, {
        settings,
        seed,
        baseImage,
        signal: ac.signal,
        onProgress: (p) => set({ progress: p }),
      });
      const created: GeneratedImage[] = [];
      for (let i = 0; i < res.images.length; i++) {
        const img: GeneratedImage = {
          id: uid(),
          storyId,
          createdAt: Date.now() + i,
          seed: res.seed + i,
          width: settings.width,
          height: settings.height,
          prompt: settings.prompt,
          negative: settings.negative,
          model: settings.model,
          settings: { ...settings, seed: res.seed + i },
          favorite: false,
          mock: isMock(st.api),
        };
        await dbPut('blobs', img.id, res.images[i]);
        await dbPut('images', img.id, img);
        created.push(img);
      }
      set({ images: [...created.reverse(), ...get().images], selectedId: created[0]?.id ?? get().selectedId });
      if (!isMock(st.api)) void st.refreshSubscription().catch(() => undefined);
      if (st.ui.haptics) haptic(16);
    } catch (e) {
      const err = e as Error;
      if (err.name !== 'AbortError') toast(err.message || '画像生成に失敗しました', 'error');
    } finally {
      set({ generating: false, progress: 0, abort: null });
    }
  },

  stop: () => get().abort?.abort(),

  remove: async (id) => {
    await dbDelete('images', id);
    await dbDelete('blobs', id);
    const u = get().urls[id];
    if (u) URL.revokeObjectURL(u);
    const images = get().images.filter((i) => i.id !== id);
    const { [id]: _, ...urls } = get().urls;
    void _;
    const sel = get().selectedId === id ? (images[0]?.id ?? null) : get().selectedId;
    set({ images, urls, selectedId: sel });
    if (useSettings.getState().imageGen.baseImageId === id) useSettings.getState().setImageGen({ baseImageId: null });
  },

  toggleFavorite: (id) => {
    const images = get().images.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i));
    set({ images });
    const img = images.find((i) => i.id === id);
    if (img) void dbPut('images', id, img);
  },

  addUpload: async (file, w, h) => {
    const st = useSettings.getState();
    const img: GeneratedImage = {
      id: uid(),
      storyId: null,
      createdAt: Date.now(),
      seed: 0,
      width: w,
      height: h,
      prompt: '(アップロード画像)',
      negative: '',
      model: 'upload',
      settings: { ...st.imageGen },
      favorite: false,
      mock: false,
    };
    await dbPut('blobs', img.id, file);
    await dbPut('images', img.id, img);
    set({ images: [img, ...get().images], selectedId: img.id });
    return img;
  },
}));
