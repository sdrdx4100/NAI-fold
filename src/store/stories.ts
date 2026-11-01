import { create } from 'zustand';
import { providerFor } from '../lib/api';
import { buildContext } from '../lib/context';
import { dbAll, dbDelete, dbGet, dbPut } from '../lib/db';
import { canUndo, currentSegments, newHistory, pushNode, redo as hRedo, undo as hUndo } from '../lib/history';
import { textModel } from '../lib/models';
import { appendSegment, applyTextChange, segmentsText } from '../lib/segments';
import type { LoreEntry, Segment, Story, StoryMeta } from '../lib/types';
import { debounce, haptic, uid } from '../lib/util';
import { useSettings } from './settings';
import { toast } from './ui';

export function newLoreEntry(p: Partial<LoreEntry> = {}): LoreEntry {
  return {
    id: uid(),
    displayName: '',
    text: '',
    keys: [],
    enabled: true,
    alwaysOn: false,
    searchRange: 1000,
    priority: 0,
    caseSensitive: false,
    category: '',
    ...p,
  };
}

export function newStory(p: Partial<Story> = {}): Story {
  const now = Date.now();
  const segments = p.segments ?? [];
  const gen = { ...useSettings.getState().defaultGen };
  return {
    id: uid(),
    title: '新しいストーリー',
    description: '',
    tags: [],
    favorite: false,
    createdAt: now,
    updatedAt: now,
    segments,
    memory: '',
    authorsNote: '',
    lorebook: [],
    gen,
    ctx: { authorsNoteDepth: 3, attgEnabled: false, attg: { author: '', title: '', tags: '', genre: '' }, style: '', trimTrailingSpaces: true },
    history: newHistory(segments),
    ...p,
  };
}

export function toMeta(s: Story): StoryMeta {
  const text = segmentsText(s.segments);
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    tags: s.tags,
    favorite: s.favorite,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    preview: text.slice(-160).replace(/\s+/g, ' ').trim(),
    chars: text.length,
  };
}

/** Fill in fields that may be missing from older/imported data. */
export function migrateStory(raw: Partial<Story>): Story {
  const base = newStory();
  const s: Story = {
    ...base,
    ...raw,
    gen: { ...base.gen, ...raw.gen },
    ctx: { ...base.ctx, ...raw.ctx, attg: { ...base.ctx.attg, ...raw.ctx?.attg } },
    lorebook: (raw.lorebook ?? []).map((e) => newLoreEntry(e)),
    segments: raw.segments ?? [],
  } as Story;
  if (!s.history || !s.history.nodes?.[s.history.currentId]) s.history = newHistory(s.segments);
  return s;
}

interface StoryState {
  loaded: boolean;
  metas: StoryMeta[];
  current: Story | null;
  generating: boolean;
  abort: AbortController | null;
  /** True while the user has typed but not committed to history yet. */
  dirtyEdit: boolean;
  lastError: string | null;
  loadAll: () => Promise<void>;
  create: (p?: Partial<Story>) => Promise<Story>;
  open: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  update: (p: Partial<Story>) => void;
  setText: (text: string) => void;
  commitEdit: () => void;
  appendUserText: (text: string) => void;
  generate: (opts?: { retry?: boolean }) => Promise<void>;
  stop: () => void;
  undo: () => void;
  redo: (childId?: string) => void;
  importStory: (raw: unknown) => Promise<Story | null>;
  // lore helpers
  upsertLore: (e: LoreEntry) => void;
  removeLore: (id: string) => void;
}

const persistStory = debounce((s: Story) => {
  void dbPut('stories', s.id, s);
}, 400);

export const useStories = create<StoryState>((set, get) => {
  const setCurrent = (s: Story, opts: { touch?: boolean } = {}) => {
    const story = opts.touch === false ? s : { ...s, updatedAt: Date.now() };
    const metas = get().metas.map((m) => (m.id === story.id ? toMeta(story) : m));
    set({ current: story, metas });
    persistStory(story);
  };

  const commit = () => {
    const cur = get().current;
    if (!cur || !get().dirtyEdit) return;
    set({ dirtyEdit: false });
    setCurrent({ ...cur, history: pushNode(cur.history, cur.segments, 'edit') });
  };
  const commitLater = debounce(commit, 1200);

  return {
    loaded: false,
    metas: [],
    current: null,
    generating: false,
    abort: null,
    dirtyEdit: false,
    lastError: null,

    loadAll: async () => {
      const all = (await dbAll<Story>('stories')).map(migrateStory);
      const metas = all.map(toMeta).sort((a, b) => b.updatedAt - a.updatedAt);
      set({ metas, loaded: true });
      const lastId = await dbGet<string>('kv', 'lastStory');
      const target = all.find((s) => s.id === lastId) ?? all.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (target) set({ current: target });
    },

    create: async (p) => {
      commit();
      const s = newStory(p);
      await dbPut('stories', s.id, s);
      await dbPut('kv', 'lastStory', s.id);
      set({ current: s, metas: [toMeta(s), ...get().metas] });
      return s;
    },

    open: async (id) => {
      commit();
      const prev = get().current;
      if (prev) persistStory.flush(prev);
      const s = await dbGet<Story>('stories', id);
      if (!s) return;
      await dbPut('kv', 'lastStory', id);
      set({ current: migrateStory(s), dirtyEdit: false });
    },

    remove: async (id) => {
      await dbDelete('stories', id);
      const metas = get().metas.filter((m) => m.id !== id);
      set({ metas });
      if (get().current?.id === id) {
        if (metas[0]) await get().open(metas[0].id);
        else set({ current: null });
      }
    },

    duplicate: async (id) => {
      const s = id === get().current?.id ? get().current : await dbGet<Story>('stories', id);
      if (!s) return;
      const copy = migrateStory({ ...structuredClone(s), id: uid(), title: `${s.title} (コピー)`, createdAt: Date.now(), updatedAt: Date.now() });
      await dbPut('stories', copy.id, copy);
      set({ metas: [toMeta(copy), ...get().metas] });
      toast('ストーリーを複製しました', 'success');
    },

    update: (p) => {
      const cur = get().current;
      if (!cur) return;
      setCurrent({ ...cur, ...p });
    },

    setText: (text) => {
      const cur = get().current;
      if (!cur || get().generating) return;
      const segments = applyTextChange(cur.segments, text);
      if (segments === cur.segments) return;
      set({ dirtyEdit: true });
      setCurrent({ ...cur, segments });
      commitLater();
    },

    commitEdit: commit,

    appendUserText: (text) => {
      const cur = get().current;
      if (!cur || !text) return;
      commit();
      const segments = appendSegment(cur.segments, text, cur.segments.length ? 'user' : 'prompt');
      setCurrent({ ...cur, segments, history: pushNode(cur.history, segments, 'edit') });
    },

    generate: async (opts = {}) => {
      if (get().generating) return;
      commit();
      let cur = get().current;
      if (!cur) cur = await get().create();
      const settings = useSettings.getState();
      const api = settings.api;

      // retry = step back to the parent of the last generation, then generate a sibling
      let parentId = cur.history.currentId;
      if (opts.retry) {
        const node = cur.history.nodes[cur.history.currentId];
        if (node && (node.kind === 'gen' || node.kind === 'retry') && node.parentId) {
          parentId = node.parentId;
          cur = { ...cur, segments: cur.history.nodes[parentId].segments.map((x) => ({ ...x })), history: { ...cur.history, currentId: parentId } };
          setCurrent(cur);
        }
      }

      const story = cur;
      const ctx = buildContext(story);
      const gen = { ...story.gen, endpoint: story.gen.endpoint ?? textModel(story.gen.model).endpoint };
      const ac = new AbortController();
      set({ generating: true, abort: ac, lastError: null });
      if (settings.ui.haptics) haptic(10);

      const baseSegments: Segment[] = story.segments;
      let acc = '';
      const flushStream = () => {
        const c = get().current;
        if (!c || c.id !== story.id) return;
        set({ current: { ...c, segments: appendSegment(baseSegments, acc, 'ai') } });
      };
      let raf = 0;
      try {
        const out = await providerFor(api).generateText(api, {
          context: ctx.text,
          settings: gen,
          signal: ac.signal,
          onToken: (t) => {
            acc += t;
            if (!raf) raf = requestAnimationFrame(() => ((raf = 0), flushStream()));
          },
        });
        acc = out || acc;
      } catch (e) {
        const err = e as Error;
        if (err.name !== 'AbortError') {
          set({ lastError: err.message });
          toast(err.message || '生成に失敗しました', 'error');
        }
      } finally {
        cancelAnimationFrame(raf);
        for (const b of gen.banned_strings) if (b) acc = acc.split(b).join('');
        const c = get().current;
        if (c && c.id === story.id) {
          if (acc) {
            const segments = appendSegment(baseSegments, acc, 'ai');
            setCurrent({ ...c, segments, history: pushNode(c.history, segments, opts.retry ? 'retry' : 'gen', parentId) });
          } else {
            setCurrent({ ...c, segments: baseSegments }, { touch: false });
          }
        }
        set({ generating: false, abort: null });
      }
    },

    stop: () => get().abort?.abort(),

    undo: () => {
      commit();
      const cur = get().current;
      if (!cur || get().generating || !canUndo(cur.history)) return;
      const h = hUndo(cur.history)!;
      setCurrent({ ...cur, history: h, segments: currentSegments(h) });
    },

    redo: (childId) => {
      commit();
      const cur = get().current;
      if (!cur || get().generating) return;
      const h = hRedo(cur.history, childId);
      if (!h) return;
      setCurrent({ ...cur, history: h, segments: currentSegments(h) });
    },

    importStory: async (raw) => {
      try {
        const r = raw as Partial<Story> & { content?: string; text?: string };
        let s: Story;
        if (typeof raw === 'string') {
          s = newStory({ segments: [{ text: raw, origin: 'prompt' }] });
        } else if (r && Array.isArray(r.segments)) {
          s = migrateStory({ ...r, id: uid() });
        } else if (r && (typeof r.text === 'string' || typeof r.content === 'string')) {
          s = newStory({ title: r.title ?? 'インポート', segments: [{ text: (r.text ?? r.content)!, origin: 'prompt' }] });
        } else {
          throw new Error('未対応の形式です');
        }
        s.history = newHistory(s.segments);
        await dbPut('stories', s.id, s);
        set({ metas: [toMeta(s), ...get().metas] });
        await get().open(s.id);
        toast(`「${s.title}」をインポートしました`, 'success');
        return s;
      } catch (e) {
        toast(`インポート失敗: ${(e as Error).message}`, 'error');
        return null;
      }
    },

    upsertLore: (e) => {
      const cur = get().current;
      if (!cur) return;
      const exists = cur.lorebook.some((x) => x.id === e.id);
      setCurrent({ ...cur, lorebook: exists ? cur.lorebook.map((x) => (x.id === e.id ? e : x)) : [...cur.lorebook, e] });
    },
    removeLore: (id) => {
      const cur = get().current;
      if (!cur) return;
      setCurrent({ ...cur, lorebook: cur.lorebook.filter((x) => x.id !== id) });
    },
  };
});

/** Flush pending writes when the app is backgrounded (important on mobile). */
export function flushStories() {
  const s = useStories.getState();
  s.commitEdit();
  if (s.current) persistStory.flush(s.current);
}
