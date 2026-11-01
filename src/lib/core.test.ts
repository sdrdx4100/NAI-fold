import { describe, expect, it } from 'vitest';
import { buildImagePayload, extractImages } from './api/novelai';
import { mockContinuation, mulberry32 } from './api/mock';
import { parseEvent } from './api/sse';
import { activeLoreEntries, buildContext } from './context';
import { canUndo, currentSegments, newHistory, pushNode, redo, redoChildren, undo } from './history';
import { DEFAULT_IMAGE_GEN, DEFAULT_TEXT_GEN, estimateAnlas } from './models';
import { applyTextChange, diffRange, segmentsText, spliceSegments } from './segments';
import { estimateTokens, trimStartToTokens } from './tokens';
import type { Story } from './types';
import { zipSync } from 'fflate';

const story = (p: Partial<Story> = {}): Story => ({
  id: 's',
  title: 't',
  description: '',
  tags: [],
  favorite: false,
  createdAt: 0,
  updatedAt: 0,
  segments: [{ text: 'Hello', origin: 'prompt' }],
  memory: '',
  authorsNote: '',
  lorebook: [],
  gen: { ...DEFAULT_TEXT_GEN },
  ctx: { authorsNoteDepth: 1, attgEnabled: false, attg: { author: '', title: '', tags: '', genre: '' }, style: '', trimTrailingSpaces: true },
  history: newHistory([]),
  ...p,
});

describe('segments', () => {
  it('diffs a single range', () => {
    expect(diffRange('abcdef', 'abXYef')).toEqual({ start: 2, endA: 4, insert: 'XY' });
    expect(diffRange('same', 'same')).toBeNull();
  });
  it('keeps origins of untouched text and tags edits', () => {
    const segs = [
      { text: 'User. ', origin: 'prompt' as const },
      { text: 'AI text.', origin: 'ai' as const },
    ];
    const edited = applyTextChange(segs, 'User. AI EDIT text.');
    expect(segmentsText(edited)).toBe('User. AI EDIT text.');
    expect(edited.map((s) => s.origin)).toEqual(['prompt', 'ai', 'edit', 'ai']);
    const appended = applyTextChange(segs, 'User. AI text. More');
    expect(appended[appended.length - 1]).toEqual({ text: ' More', origin: 'user' });
  });
  it('splices deletions across segments', () => {
    const out = spliceSegments(
      [
        { text: 'aaa', origin: 'user' },
        { text: 'bbb', origin: 'ai' },
      ],
      2,
      4,
      '',
      'edit',
    );
    expect(out).toEqual([
      { text: 'aa', origin: 'user' },
      { text: 'bb', origin: 'ai' },
    ]);
  });
});

describe('history', () => {
  it('supports undo/redo with branches', () => {
    let h = newHistory([{ text: 'a', origin: 'prompt' }]);
    const root = h.currentId;
    h = pushNode(h, [{ text: 'ab', origin: 'ai' }], 'gen');
    h = pushNode(h, [{ text: 'ac', origin: 'ai' }], 'retry', root);
    expect(canUndo(h)).toBe(true);
    h = undo(h)!;
    expect(h.currentId).toBe(root);
    expect(redoChildren(h)).toHaveLength(2);
    const first = redoChildren(h)[0].id;
    h = redo(h, first)!;
    expect(segmentsText(currentSegments(h))).toBe('ab');
  });
  it('skips no-op edits', () => {
    const h = newHistory([{ text: 'a', origin: 'prompt' }]);
    expect(pushNode(h, [{ text: 'a', origin: 'prompt' }], 'edit')).toBe(h);
  });
  it('prunes old nodes', () => {
    let h = newHistory([]);
    for (let i = 0; i < 300; i++) h = pushNode(h, [{ text: String(i), origin: 'ai' }], 'gen');
    expect(Object.keys(h.nodes).length).toBeLessThanOrEqual(160);
    expect(segmentsText(currentSegments(h))).toBe('299');
  });
});

describe('context', () => {
  it('orders memory, lore, story and injects author note', () => {
    const s = story({
      memory: 'MEM',
      authorsNote: '[AN]',
      segments: [{ text: 'line1\nline2 Rina\nline3', origin: 'prompt' }],
      lorebook: [
        { id: '1', displayName: 'Rina', text: 'LORE-RINA', keys: ['rina'], enabled: true, alwaysOn: false, searchRange: 1000, priority: 0, caseSensitive: false, category: '' },
        { id: '2', displayName: 'X', text: 'LORE-X', keys: ['/zzz/'], enabled: true, alwaysOn: false, searchRange: 1000, priority: 0, caseSensitive: false, category: '' },
      ],
    });
    expect(activeLoreEntries(s).map((e) => e.id)).toEqual(['1']);
    const c = buildContext(s);
    expect(c.text).toBe('MEM\nLORE-RINA\nline1\nline2 Rina\n[AN]\nline3');
  });
  it('trims story from the top to fit the budget', () => {
    const long = 'word '.repeat(20000);
    const c = buildContext(story({ segments: [{ text: long, origin: 'ai' }], gen: { ...DEFAULT_TEXT_GEN, context_limit: 1024, max_length: 100 } }));
    expect(c.tokens).toBeLessThanOrEqual(c.budget + 5);
    expect(c.parts.find((p) => p.kind === 'story')?.trimmed).toBe(true);
  });
  it('estimates tokens for CJK and latin', () => {
    expect(estimateTokens('こんにちは')).toBe(6);
    expect(estimateTokens('hello world!', 'x')).toBe(4);
    expect(estimateTokens(trimStartToTokens('あ'.repeat(1000), 100))).toBeLessThanOrEqual(100);
  });
});

describe('api', () => {
  it('parses SSE events', () => {
    expect(parseEvent('event: newToken\ndata: {"token":"hi"}')).toEqual({ event: 'newToken', data: '{"token":"hi"}' });
  });
  it('builds a V4 image payload with characters', () => {
    const p = buildImagePayload({
      seed: 42,
      settings: { ...DEFAULT_IMAGE_GEN, characters: [{ id: 'c', prompt: 'girl', uc: 'bad', x: 0.3, y: 0.5, enabled: true }], useCoords: true },
    });
    const params = p.parameters as Record<string, any>;
    expect(p.model).toBe('nai-diffusion-4-5-full');
    expect(p.action).toBe('generate');
    expect(params.seed).toBe(42);
    expect(params.v4_prompt.caption.char_captions[0]).toEqual({ char_caption: 'girl', centers: [{ x: 0.3, y: 0.5 }] });
    expect(params.v4_prompt.use_coords).toBe(true);
    expect(p.input).toContain('very aesthetic');
  });
  it('builds img2img payload', () => {
    const p = buildImagePayload({ seed: 1, settings: { ...DEFAULT_IMAGE_GEN, model: 'nai-diffusion-3', baseImageId: 'x' } }, 'BASE64');
    expect(p.action).toBe('img2img');
    expect((p.parameters as Record<string, unknown>).image).toBe('BASE64');
    expect((p.parameters as Record<string, unknown>).sm).toBe(false);
  });
  it('extracts images from a zip', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const zip = zipSync({ 'image_0.png': png, 'image_1.png': png });
    expect(extractImages(zip)).toHaveLength(2);
    expect(extractImages(png)).toHaveLength(1);
  });
  it('estimates anlas with opus free tier', () => {
    expect(estimateAnlas({ ...DEFAULT_IMAGE_GEN, n_samples: 1 }, 3)).toBe(0);
    expect(estimateAnlas({ ...DEFAULT_IMAGE_GEN, n_samples: 1 }, 1)).toBeGreaterThan(0);
  });
  it('mock produces tags when asked', () => {
    const out = mockContinuation('scene\n[TAGS]', 50, mulberry32(1));
    expect(out.split(',').length).toBeGreaterThan(4);
    expect(mockContinuation('これは日本語の文章です。', 40, mulberry32(2))).toMatch(/[぀-ヿ]/);
  });
});
