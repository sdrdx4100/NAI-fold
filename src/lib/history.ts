import type { HistoryNode, Segment, Story } from './types';
import { uid } from './util';

const MAX_NODES = 160;

export function newHistory(segments: Segment[]): Story['history'] {
  const id = uid();
  return { nodes: { [id]: { id, parentId: null, childIds: [], segments: clone(segments), kind: 'root', at: Date.now() } }, currentId: id };
}

const clone = (s: Segment[]) => s.map((x) => ({ ...x }));

const sameSegments = (a: Segment[], b: Segment[]) =>
  a.length === b.length && a.every((s, i) => s.text === b[i].text && s.origin === b[i].origin);

/** Push a new node as child of current. Returns new history. */
export function pushNode(h: Story['history'], segments: Segment[], kind: HistoryNode['kind'], parentOverride?: string): Story['history'] {
  const parentId = parentOverride ?? h.currentId;
  const parent = h.nodes[parentId];
  if (parent && kind === 'edit' && sameSegments(parent.segments, segments)) return h;
  const id = uid();
  const nodes = { ...h.nodes };
  nodes[id] = { id, parentId, childIds: [], segments: clone(segments), kind, at: Date.now() };
  if (parent) nodes[parentId] = { ...parent, childIds: [...parent.childIds, id] };
  return prune({ nodes, currentId: id });
}

function prune(h: Story['history']): Story['history'] {
  const ids = Object.keys(h.nodes);
  if (ids.length <= MAX_NODES) return h;
  // find the chain from current to root; drop the oldest root, re-rooting at its child on our path
  const nodes = { ...h.nodes };
  const path: string[] = [];
  let cur: string | null = h.currentId;
  while (cur) {
    path.unshift(cur);
    cur = nodes[cur]?.parentId ?? null;
  }
  while (Object.keys(nodes).length > MAX_NODES && path.length > 1) {
    const root = path.shift()!;
    const keep = path[0];
    const drop = (id: string) => {
      const n = nodes[id];
      if (!n) return;
      n.childIds.forEach((c) => c !== keep && drop(c));
      delete nodes[id];
    };
    nodes[root].childIds.filter((c) => c !== keep).forEach(drop);
    delete nodes[root];
    nodes[keep] = { ...nodes[keep], parentId: null, kind: 'root' };
  }
  return { nodes, currentId: h.currentId };
}

export const canUndo = (h: Story['history']) => !!h.nodes[h.currentId]?.parentId;
export const redoChildren = (h: Story['history']) => (h.nodes[h.currentId]?.childIds ?? []).map((id) => h.nodes[id]).filter(Boolean);

export function undo(h: Story['history']): Story['history'] | null {
  const p = h.nodes[h.currentId]?.parentId;
  return p ? { ...h, currentId: p } : null;
}

export function redo(h: Story['history'], childId?: string): Story['history'] | null {
  const kids = h.nodes[h.currentId]?.childIds ?? [];
  if (!kids.length) return null;
  const id = childId && kids.includes(childId) ? childId : kids[kids.length - 1];
  return { ...h, currentId: id };
}

export const currentSegments = (h: Story['history']) => clone(h.nodes[h.currentId]?.segments ?? []);
