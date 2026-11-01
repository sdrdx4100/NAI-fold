import type { Origin, Segment } from './types';

export const segmentsText = (segs: Segment[]) => segs.map((s) => s.text).join('');

export function normalize(segs: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segs) {
    if (!s.text) continue;
    const last = out[out.length - 1];
    if (last && last.origin === s.origin) last.text += s.text;
    else out.push({ text: s.text, origin: s.origin });
  }
  return out;
}

/** Replace [start, end) of the concatenated text by `insert`, tagging the inserted text with `origin`. */
export function spliceSegments(segs: Segment[], start: number, end: number, insert: string, origin: Origin): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  let inserted = false;
  for (const s of segs) {
    const sStart = pos;
    const sEnd = pos + s.text.length;
    pos = sEnd;
    if (sEnd <= start) {
      out.push({ ...s });
      continue;
    }
    if (sStart >= end) {
      if (!inserted) {
        out.push({ text: insert, origin });
        inserted = true;
      }
      out.push({ ...s });
      continue;
    }
    // overlap
    const keepBefore = s.text.slice(0, Math.max(0, start - sStart));
    const keepAfter = s.text.slice(Math.max(0, end - sStart));
    if (keepBefore) out.push({ text: keepBefore, origin: s.origin });
    if (!inserted) {
      out.push({ text: insert, origin });
      inserted = true;
    }
    if (keepAfter) out.push({ text: keepAfter, origin: s.origin });
  }
  if (!inserted) out.push({ text: insert, origin });
  return normalize(out);
}

/** Compute the minimal single-range edit transforming `a` into `b`. */
export function diffRange(a: string, b: string): { start: number; endA: number; insert: string } | null {
  if (a === b) return null;
  let p = 0;
  const min = Math.min(a.length, b.length);
  while (p < min && a.charCodeAt(p) === b.charCodeAt(p)) p++;
  let s = 0;
  while (s < min - p && a.charCodeAt(a.length - 1 - s) === b.charCodeAt(b.length - 1 - s)) s++;
  return { start: p, endA: a.length - s, insert: b.slice(p, b.length - s) };
}

/** Apply a free-form text change coming from the editor while preserving origins of untouched text. */
export function applyTextChange(segs: Segment[], next: string): Segment[] {
  const prev = segmentsText(segs);
  const d = diffRange(prev, next);
  if (!d) return segs;
  const atEnd = d.endA === prev.length;
  const origin: Origin = prev.length === 0 ? 'prompt' : atEnd ? 'user' : 'edit';
  return spliceSegments(segs, d.start, d.endA, d.insert, origin);
}

export function appendSegment(segs: Segment[], text: string, origin: Origin): Segment[] {
  return normalize([...segs, { text, origin }]);
}
