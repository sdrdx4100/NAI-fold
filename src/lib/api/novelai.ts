import { unzipSync } from 'fflate';
import { imageModel, QUALITY_TAGS, TIER_NAMES, UC_PRESET_TEXT } from '../models';
import type { Subscription } from '../types';
import { blobToBase64 } from '../util';
import { ApiError, type ApiConfig, type ImageRequest, type ImageResult, type Provider } from './types';

const join = (base: string, path: string) => base.replace(/\/+$/, '') + path;

function headers(cfg: ApiConfig, accept = 'application/json'): HeadersInit {
  if (!cfg.token) throw new ApiError('APIトークンが設定されていません。設定から入力するか、モックモードを使用してください。', 401);
  return { Authorization: `Bearer ${cfg.token.trim()}`, 'Content-Type': 'application/json', Accept: accept };
}

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  let msg = `${res.status} ${res.statusText}`;
  try {
    const t = await res.text();
    try {
      const j = JSON.parse(t);
      msg = j.message || j.error || msg;
    } catch {
      if (t) msg = t.slice(0, 300);
    }
  } catch {
    /* ignore */
  }
  const friendly: Record<number, string> = {
    401: '認証に失敗しました（トークンを確認してください）',
    402: 'Anlas またはサブスクリプションが不足しています',
    429: 'リクエストが多すぎます。少し待ってから再試行してください',
    500: 'サーバーエラーが発生しました',
  };
  throw new ApiError(`${friendly[res.status] ?? 'APIエラー'}: ${msg}`, res.status);
}

// ---------- image ----------

export function buildImagePayload(req: ImageRequest, baseImageB64?: string) {
  const s = req.settings;
  const info = imageModel(s.model);
  const prompt = s.qualityToggle ? s.prompt + (QUALITY_TAGS[s.model] ?? '') : s.prompt;
  const presetUc = UC_PRESET_TEXT[s.ucPreset] ?? '';
  const negative = [presetUc, s.negative].filter((x) => x.trim()).join(', ');
  const chars = s.characters.filter((c) => c.enabled && c.prompt.trim());

  const parameters: Record<string, unknown> = {
    // The official web client sends 4 for V5; the server was observed to accept 0–4 identically.
    params_version: info.v5 ? 4 : 3,
    width: s.width,
    height: s.height,
    scale: s.scale,
    sampler: s.sampler,
    steps: s.steps,
    n_samples: s.n_samples,
    ucPreset: s.ucPreset,
    qualityToggle: s.qualityToggle,
    seed: req.seed,
    negative_prompt: negative,
    cfg_rescale: s.cfg_rescale,
    noise_schedule: s.noise_schedule,
    dynamic_thresholding: false,
    legacy: false,
    add_original_image: true,
    deliberate_euler_ancestral_bug: false,
    prefer_brownian: true,
  };

  if (info.v4) {
    parameters.uncond_scale = 1;
    parameters.prompt = prompt;
    parameters.autoSmea = false;
    parameters.skip_cfg_above_sigma = s.variety ? 19 : null;
    parameters.use_coords = s.useCoords;
    parameters.legacy_v3_extend = false;
    parameters.characterPrompts = chars.map((c) => ({ prompt: c.prompt, uc: c.uc, center: { x: c.x, y: c.y }, enabled: true }));
    parameters.v4_prompt = {
      caption: { base_caption: prompt, char_captions: chars.map((c) => ({ char_caption: c.prompt, centers: [{ x: c.x, y: c.y }] })) },
      use_coords: s.useCoords,
      use_order: true,
    };
    parameters.v4_negative_prompt = {
      caption: { base_caption: negative, char_captions: chars.map((c) => ({ char_caption: c.uc, centers: [{ x: c.x, y: c.y }] })) },
      legacy_uc: false,
    };
  } else {
    parameters.sm = s.sm;
    parameters.sm_dyn = s.sm && s.sm_dyn;
  }

  let action = 'generate';
  if (baseImageB64) {
    action = 'img2img';
    parameters.image = baseImageB64;
    parameters.strength = s.strength;
    parameters.noise = s.noise;
    parameters.extra_noise_seed = req.seed;
  }

  return { input: prompt, model: s.model, action, parameters };
}

async function generateImages(cfg: ApiConfig, req: ImageRequest): Promise<ImageResult> {
  const base = req.baseImage ? await blobToBase64(req.baseImage) : undefined;
  req.onProgress?.(0.05);
  const res = await check(
    await fetch(join(cfg.imageBase, '/ai/generate-image'), {
      method: 'POST',
      headers: headers(cfg, 'application/zip'),
      body: JSON.stringify(buildImagePayload(req, base)),
      signal: req.signal,
    }),
  );
  req.onProgress?.(0.8);
  const buf = new Uint8Array(await res.arrayBuffer());
  const images = extractImages(buf);
  if (!images.length) throw new ApiError('画像データを受信できませんでした');
  req.onProgress?.(1);
  return { images, seed: req.seed };
}

export function extractImages(buf: Uint8Array): Blob[] {
  // zip magic "PK"
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = unzipSync(buf);
    return Object.keys(files)
      .sort()
      .filter((n) => /\.(png|webp|jpe?g)$/i.test(n))
      .map((n) => new Blob([files[n] as Uint8Array<ArrayBuffer>], { type: n.endsWith('.webp') ? 'image/webp' : n.match(/jpe?g$/) ? 'image/jpeg' : 'image/png' }));
  }
  // raw PNG
  if (buf[0] === 0x89 && buf[1] === 0x50) return [new Blob([buf as Uint8Array<ArrayBuffer>], { type: 'image/png' })];
  return [];
}

// ---------- user ----------

async function getSubscription(cfg: ApiConfig): Promise<Subscription> {
  const res = await check(await fetch(join(cfg.apiBase, '/user/subscription'), { headers: headers(cfg) }));
  const j = await res.json();
  const steps = j.trainingStepsLeft ?? {};
  return {
    tier: j.tier ?? 0,
    tierName: TIER_NAMES[j.tier] ?? `Tier ${j.tier}`,
    active: !!j.active,
    anlas: (steps.fixedTrainingStepsLeft ?? 0) + (steps.purchasedTrainingSteps ?? 0),
    expiresAt: j.expiresAt ? j.expiresAt * 1000 : undefined,
  };
}

export const novelaiProvider: Provider = { generateImages, getSubscription };
