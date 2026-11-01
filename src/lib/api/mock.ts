import type { Subscription } from '../types';
import { sleep } from '../util';
import type { ApiConfig, ImageRequest, ImageResult, Provider } from './types';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h % 360}, ${s}%, ${l}%, ${a})`;
}

async function renderMockImage(w: number, h: number, seed: number, prompt: string): Promise<Blob> {
  // render at reduced resolution for speed, keep aspect ratio
  const scale = Math.min(1, 768 / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(cw, ch) : Object.assign(document.createElement('canvas'), { width: cw, height: ch });
  const g = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const rnd = mulberry32(seed);
  const hue = Math.floor(rnd() * 360);
  const night = /night|夜|dark|star/i.test(prompt) || rnd() < 0.4;

  const sky = g.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0, hsl(hue + 220, 55, night ? 10 : 55));
  sky.addColorStop(0.55, hsl(hue + 260, 50, night ? 22 : 72));
  sky.addColorStop(1, hsl(hue + 320, 60, night ? 30 : 82));
  g.fillStyle = sky;
  g.fillRect(0, 0, cw, ch);

  if (night) {
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(255,255,240,${0.3 + rnd() * 0.7})`;
      g.fillRect(rnd() * cw, rnd() * ch * 0.6, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
    }
  }
  // moon / sun
  const mx = cw * (0.2 + rnd() * 0.6);
  const my = ch * (0.12 + rnd() * 0.2);
  const mr = Math.min(cw, ch) * (0.07 + rnd() * 0.06);
  const glow = g.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 4);
  glow.addColorStop(0, night ? 'rgba(255,250,220,0.9)' : 'rgba(255,240,200,1)');
  glow.addColorStop(0.25, night ? 'rgba(255,250,220,0.25)' : 'rgba(255,220,160,0.5)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, cw, ch);
  g.fillStyle = night ? '#fffbe6' : '#fff2cf';
  g.beginPath();
  g.arc(mx, my, mr, 0, Math.PI * 2);
  g.fill();

  // layered hills / city
  for (let layer = 0; layer < 4; layer++) {
    const base = ch * (0.55 + layer * 0.12);
    g.fillStyle = hsl(hue + 240 + layer * 12, 35, (night ? 8 : 35) + layer * (night ? 4 : -6));
    g.beginPath();
    g.moveTo(0, ch);
    let x = 0;
    while (x <= cw) {
      const bh = (rnd() * 0.18 + 0.02) * ch * (1 - layer * 0.15);
      const bw = cw * (0.04 + rnd() * 0.08);
      g.lineTo(x, base - bh);
      g.lineTo(x + bw, base - bh);
      if (night && layer > 0)
        for (let k = 0; k < 4; k++) {
          g.fillRect(x + rnd() * bw, base - bh + rnd() * bh, 2, 3);
        }
      x += bw;
    }
    g.lineTo(cw, ch);
    g.closePath();
    g.fill();
  }

  // figure silhouette
  const fx = cw * (0.35 + rnd() * 0.3);
  const fy = ch * 0.92;
  const fh = ch * 0.42;
  g.fillStyle = hsl(hue + 250, 30, night ? 4 : 14);
  g.beginPath();
  g.ellipse(fx, fy - fh * 0.88, fh * 0.085, fh * 0.1, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(fx - fh * 0.12, fy);
  g.quadraticCurveTo(fx - fh * 0.16, fy - fh * 0.5, fx - fh * 0.06, fy - fh * 0.76);
  g.lineTo(fx + fh * 0.06, fy - fh * 0.76);
  g.quadraticCurveTo(fx + fh * 0.18, fy - fh * 0.45, fx + fh * 0.14, fy);
  g.closePath();
  g.fill();

  // rain
  if (/rain|雨/i.test(prompt)) {
    g.strokeStyle = 'rgba(200,220,255,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < 220; i++) {
      const x = rnd() * cw;
      const y = rnd() * ch;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 4, y + 14);
      g.stroke();
    }
  }

  // label
  g.fillStyle = 'rgba(14,15,33,0.55)';
  g.fillRect(0, ch - 34, cw, 34);
  g.fillStyle = '#f5f3c2';
  g.font = `600 ${Math.max(11, Math.round(cw / 42))}px sans-serif`;
  g.fillText(`MOCK · seed ${seed}`, 10, ch - 13);

  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/png' });
  return new Promise((res) => (canvas as HTMLCanvasElement).toBlob((b) => res(b!), 'image/png'));
}

async function generateImages(_cfg: ApiConfig, req: ImageRequest): Promise<ImageResult> {
  const s = req.settings;
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await sleep(70 + s.steps * 2, req.signal);
    req.onProgress?.(i / (steps + 1));
  }
  const images: Blob[] = [];
  for (let i = 0; i < s.n_samples; i++) images.push(await renderMockImage(s.width, s.height, req.seed + i, s.prompt));
  req.onProgress?.(1);
  return { images, seed: req.seed };
}

async function getSubscription(): Promise<Subscription> {
  await sleep(200);
  return { tier: 3, tierName: 'Opus (Mock)', active: true, anlas: 10000 };
}

export const mockProvider: Provider = { generateImages, getSubscription };
