import { estimateTokens, trimEndToTokens, trimStartToTokens } from './tokens';
import type { LoreEntry, Story } from './types';
import { segmentsText } from './segments';

export interface ContextPart {
  kind: 'attg' | 'memory' | 'lore' | 'story' | 'an';
  label: string;
  text: string;
  tokens: number;
  trimmed?: boolean;
}

export interface BuiltContext {
  text: string;
  parts: ContextPart[];
  tokens: number;
  budget: number;
  activeLore: LoreEntry[];
}

function keyMatches(key: string, haystack: string, caseSensitive: boolean): boolean {
  const k = key.trim();
  if (!k) return false;
  const re = /^\/(.+)\/([a-z]*)$/.exec(k);
  if (re) {
    try {
      const flags = re[2].includes('i') || !caseSensitive ? re[2].replace('i', '') + 'i' : re[2];
      return new RegExp(re[1], flags.replace(/g/g, '')).test(haystack);
    } catch {
      return false;
    }
  }
  return caseSensitive ? haystack.includes(k) : haystack.toLowerCase().includes(k.toLowerCase());
}

export function activeLoreEntries(story: Pick<Story, 'lorebook' | 'segments'>, extraText = ''): LoreEntry[] {
  const full = segmentsText(story.segments) + extraText;
  return story.lorebook
    .filter((e) => {
      if (!e.enabled || !e.text.trim()) return false;
      if (e.alwaysOn) return true;
      const hay = full.slice(-Math.max(1, e.searchRange));
      return e.keys.some((k) => keyMatches(k, hay, e.caseSensitive));
    })
    .sort((a, b) => b.priority - a.priority);
}

export function attgLine(story: Story): string {
  if (!story.ctx.attgEnabled) return '';
  const { author, title, tags, genre } = story.ctx.attg;
  const bits = [
    author && `Author: ${author}`,
    title && `Title: ${title}`,
    tags && `Tags: ${tags}`,
    genre && `Genre: ${genre}`,
  ].filter(Boolean);
  const lines: string[] = [];
  if (bits.length) lines.push(`[ ${bits.join('; ')} ]`);
  if (story.ctx.style.trim()) lines.push(story.ctx.style.trim());
  return lines.join('\n');
}

/**
 * Builds the model context the same way the official editor does conceptually:
 *   ATTG → Memory → Lorebook (by priority) → Story (trimmed from the top) with Author's Note injected near the end.
 */
export function buildContext(story: Story): BuiltContext {
  const model = story.gen.model;
  const budget = Math.max(256, story.gen.context_limit - story.gen.max_length);
  const parts: ContextPart[] = [];
  let used = 0;

  const attg = attgLine(story);
  if (attg) {
    const t = estimateTokens(attg, model);
    parts.push({ kind: 'attg', label: 'ATTG / Style', text: attg, tokens: t });
    used += t;
  }

  const memory = story.memory.trim();
  if (memory) {
    const text = trimEndToTokens(memory, Math.floor(budget * 0.4), model);
    const t = estimateTokens(text, model);
    parts.push({ kind: 'memory', label: 'メモリー', text, tokens: t, trimmed: text !== memory });
    used += t;
  }

  const an = story.authorsNote.trim();
  const anTokens = an ? estimateTokens(an, model) : 0;
  used += anTokens;

  const activeLore = activeLoreEntries(story);
  const loreBudget = Math.floor(budget * 0.35);
  let loreUsed = 0;
  for (const e of activeLore) {
    const text = e.text.trim();
    const t = estimateTokens(text, model);
    if (loreUsed + t > loreBudget) {
      const room = loreBudget - loreUsed;
      if (room > 40) {
        const cut = trimEndToTokens(text, room, model);
        const ct = estimateTokens(cut, model);
        parts.push({ kind: 'lore', label: `ロア: ${e.displayName || e.keys[0] || '無題'}`, text: cut, tokens: ct, trimmed: true });
        loreUsed += ct;
      }
      break;
    }
    parts.push({ kind: 'lore', label: `ロア: ${e.displayName || e.keys[0] || '無題'}`, text, tokens: t });
    loreUsed += t;
  }
  used += loreUsed;

  let storyText = segmentsText(story.segments);
  if (story.ctx.trimTrailingSpaces) storyText = storyText.replace(/[ \t]+$/, '');
  const storyBudget = Math.max(0, budget - used);
  const trimmedStory = trimStartToTokens(storyText, storyBudget, model);

  // inject author's note N newlines from the end
  let storyWithAn = trimmedStory;
  if (an) {
    const lines = trimmedStory.split('\n');
    const depth = Math.max(0, Math.min(lines.length, story.ctx.authorsNoteDepth));
    const idx = lines.length - depth;
    lines.splice(idx, 0, an);
    storyWithAn = lines.join('\n');
  }

  const storyTokens = estimateTokens(trimmedStory, model);
  parts.push({ kind: 'story', label: 'ストーリー', text: trimmedStory, tokens: storyTokens, trimmed: trimmedStory !== storyText });
  if (an) parts.push({ kind: 'an', label: `作者の注釈 (深さ ${story.ctx.authorsNoteDepth})`, text: an, tokens: anTokens });

  const header = parts.filter((p) => p.kind === 'attg' || p.kind === 'memory' || p.kind === 'lore').map((p) => p.text);
  const text = [...header, storyWithAn].filter((s) => s.length > 0).join('\n');
  return { text, parts, tokens: estimateTokens(text, model), budget, activeLore };
}
