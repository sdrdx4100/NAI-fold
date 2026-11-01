import { useEffect, useState } from 'react';
import type { LayoutPref } from '../store/settings';

export type LayoutMode = 'single' | 'dual' | 'dual-v' | 'triple';

export interface FoldInfo {
  mode: LayoutMode;
  /** Physical hinge/fold, if the platform reports viewport segments. */
  hinge: { x: number; width: number } | { y: number; height: number } | null;
  posture: 'continuous' | 'folded' | 'unknown';
  width: number;
  height: number;
  source: 'segments' | 'posture' | 'width' | 'manual';
}

interface SegmentLike {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

function readSegments(): SegmentLike[] | null {
  const w = window as unknown as { viewport?: { segments?: SegmentLike[] }; visualViewport?: { segments?: SegmentLike[] } };
  const segs = w.viewport?.segments ?? w.visualViewport?.segments ?? null;
  return segs && segs.length > 1 ? segs : null;
}

function readPosture(): FoldInfo['posture'] {
  const p = (navigator as unknown as { devicePosture?: { type?: string } }).devicePosture?.type;
  return p === 'folded' || p === 'continuous' ? p : 'unknown';
}

/** Breakpoints tuned for Galaxy Z Fold: cover ≈ 344–412px, inner ≈ 673–904px CSS width. */
export const DUAL_MIN = 600;
export const TRIPLE_MIN = 1180;

export function computeLayout(pref: LayoutPref): FoldInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const posture = readPosture();
  const segs = readSegments();
  let hinge: FoldInfo['hinge'] = null;
  if (segs) {
    const [a, b] = segs;
    if (Math.abs(a.top - b.top) < 2) hinge = { x: a.right, width: Math.max(0, b.left - a.right) };
    else hinge = { y: a.bottom, height: Math.max(0, b.top - a.bottom) };
  }

  if (pref !== 'auto') return { mode: pref, hinge, posture, width, height, source: 'manual' };

  if (hinge) return { mode: 'x' in hinge ? 'dual' : 'dual-v', hinge, posture, width, height, source: 'segments' };
  // Half-opened in landscape (tabletop/flex mode): split top/bottom along the fold.
  if (posture === 'folded' && width > height * 1.15 && height >= 360) return { mode: 'dual-v', hinge, posture, width, height, source: 'posture' };
  if (width >= TRIPLE_MIN) return { mode: 'triple', hinge, posture, width, height, source: 'width' };
  if (width >= DUAL_MIN) return { mode: 'dual', hinge, posture, width, height, source: 'width' };
  return { mode: 'single', hinge, posture, width, height, source: 'width' };
}

export function useFoldLayout(pref: LayoutPref): FoldInfo {
  const [info, setInfo] = useState(() => computeLayout(pref));
  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setInfo(computeLayout(pref)));
    };
    update();
    window.addEventListener('resize', update);
    screen.orientation?.addEventListener?.('change', update);
    const dp = (navigator as unknown as { devicePosture?: EventTarget }).devicePosture;
    dp?.addEventListener?.('change', update);
    const vp = (window as unknown as { viewport?: EventTarget }).viewport;
    vp?.addEventListener?.('segmentschange', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      screen.orientation?.removeEventListener?.('change', update);
      dp?.removeEventListener?.('change', update);
      vp?.removeEventListener?.('segmentschange', update);
    };
  }, [pref]);
  return info;
}
