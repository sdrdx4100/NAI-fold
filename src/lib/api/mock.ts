import type { Subscription } from '../types';
import { sleep } from '../util';
import type { ApiConfig, ImageRequest, ImageResult, Provider, TextRequest } from './types';

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

const JA = {
  open: ['ふと', 'その時、', '静かに', 'やがて', '不意に', 'しばらくして、', '気づけば', '遠くで', 'ゆっくりと', '夜の底で、'],
  subj: ['風が', '雨音が', '月明かりが', '鐘の音が', '誰かの足音が', '古い扉が', '灯りが', '影が', '鼓動が', '記憶が'],
  verb: ['揺れた。', '響いた。', '消えていった。', '近づいてくる。', '胸の奥をかすめた。', '静寂を破った。', '名前を呼んだ気がした。', '形を変えた。', '震えた。', '確かにそこにあった。'],
  talk: ['「行こう。まだ間に合う」', '「……本当に、それでいいの？」', '「待って。何か聞こえる」', '「約束、覚えてる？」', '「ここから先は、ひとりじゃない」', '「大丈夫。きっと、うまくいく」'],
  act: ['は息を呑んだ。', 'は小さく頷いた。', 'は振り返らなかった。', 'は拳を握りしめた。', 'は微笑んだ。', 'は窓の外を見つめた。', 'はそっと手を伸ばした。'],
  names: ['彼女', '彼', '少女', '旅人', '私'],
};

const EN = {
  open: ['Then,', 'Slowly,', 'Without warning,', 'For a moment,', 'Somewhere far away,', 'At last,', 'In the silence,', 'Just as the light faded,'],
  subj: ['the wind', 'a distant bell', 'the old door', 'the lantern', 'a shadow', 'her heartbeat', 'the rain', 'an unfamiliar voice'],
  verb: ['stirred.', 'echoed through the hall.', 'trembled.', 'drew closer.', 'seemed to whisper a name.', 'broke the stillness.', 'was gone.'],
  talk: ['"We should go. There is still time."', '"Are you sure about this?"', '"Wait—do you hear that?"', '"You remember the promise, don\'t you?"', '"Whatever happens, I\'m with you."'],
  act: [' held her breath.', ' nodded slowly.', ' did not look back.', ' clenched a fist.', ' smiled faintly.', ' reached out.'],
  names: ['She', 'He', 'The traveler', 'I'],
};

const TAG_POOL = [
  '1girl', 'solo', 'long hair', 'looking at viewer', 'night', 'city', 'rain', 'umbrella', 'smile', 'school uniform', 'forest',
  'sunset', 'wind', 'from side', 'upper body', 'cinematic lighting', 'depth of field', 'starry sky', 'window', 'indoors', 'lantern',
];

function detectNames(ctx: string, ja: boolean): string[] {
  const found = new Set<string>();
  if (ja) {
    for (const m of ctx.matchAll(/([゠-ヿ]{2,8}|[一-鿿]{1,3}(?:さん|くん|ちゃん|様))/g)) found.add(m[1]);
  } else {
    for (const m of ctx.matchAll(/\b([A-Z][a-z]{2,12})\b/g)) if (!['The', 'Then', 'She', 'He', 'And', 'But', 'Author', 'Title', 'Tags', 'Genre'].includes(m[1])) found.add(m[1]);
  }
  return [...found].slice(-6);
}

export function mockContinuation(ctx: string, maxTokens: number, rnd: () => number): string {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  if (/\[\s*TAGS\s*\]\s*$/.test(ctx.trimEnd())) {
    const n = 6 + Math.floor(rnd() * 6);
    const tags = new Set<string>();
    while (tags.size < n) tags.add(pick(TAG_POOL));
    return ' ' + [...tags].join(', ');
  }
  const tail = ctx.slice(-2000);
  const ja = (tail.match(/[぀-ヿ一-鿿]/g)?.length ?? 0) > tail.length * 0.15;
  const bank = ja ? JA : EN;
  const names = detectNames(tail, ja);
  const who = () => (names.length && rnd() < 0.6 ? pick(names) : pick(bank.names));
  const targetChars = ja ? maxTokens * 1.1 : maxTokens * 3.6;
  let out = '';
  const needsSpace = !ja && tail.length > 0 && !/\s$/.test(tail);
  while (out.length < targetChars) {
    const r = rnd();
    let s: string;
    if (r < 0.35) s = `${pick(bank.open)}${ja ? '' : ' '}${pick(bank.subj)}${ja ? '' : ' '}${pick(bank.verb)}`;
    else if (r < 0.6) s = `${who()}${pick(bank.act)}`;
    else if (r < 0.8) s = pick(bank.talk);
    else s = `${pick(bank.subj)}${ja ? '' : ' '}${pick(bank.verb)}`;
    if (!ja) s = s.charAt(0).toUpperCase() + s.slice(1);
    const sep = out.length === 0 ? (needsSpace ? ' ' : '') : rnd() < 0.25 ? '\n' : ja ? '' : ' ';
    out += sep + s;
  }
  return out;
}

async function generateText(_cfg: ApiConfig, req: TextRequest): Promise<string> {
  const rnd = mulberry32((Date.now() ^ req.context.length) >>> 0);
  const full = mockContinuation(req.context, req.settings.max_length, rnd);
  await sleep(250 + rnd() * 250, req.signal);
  let out = '';
  // stream in small, irregular chunks to feel like real tokens
  let i = 0;
  while (i < full.length) {
    const n = 1 + Math.floor(rnd() * 4);
    const chunk = full.slice(i, i + n);
    i += n;
    out += chunk;
    req.onToken?.(chunk);
    await sleep(18 + rnd() * 30, req.signal);
  }
  return out;
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

export const mockProvider: Provider = { generateText, generateImages, getSubscription };
