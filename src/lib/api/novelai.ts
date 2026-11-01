import { unzipSync } from 'fflate';
import { imageModel, QUALITY_TAGS, TIER_NAMES, UC_PRESET_TEXT } from '../models';
import type { Subscription, TextGenSettings } from '../types';
import { blobToBase64 } from '../util';
import { readSSE } from './sse';
import { ApiError, type ApiConfig, type ImageRequest, type ImageResult, type Provider, type TextRequest } from './types';

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

// ---------- text ----------

function nativeParameters(s: TextGenSettings) {
  const p: Record<string, unknown> = {
    use_string: true,
    temperature: s.temperature,
    max_length: s.max_length,
    min_length: Math.min(s.min_length, s.max_length),
    top_k: s.top_k,
    top_p: s.top_p,
    top_a: s.top_a,
    min_p: s.min_p,
    typical_p: s.typical_p,
    tail_free_sampling: s.tail_free_sampling,
    repetition_penalty: s.repetition_penalty,
    repetition_penalty_range: s.repetition_penalty_range,
    repetition_penalty_slope: s.repetition_penalty_slope,
    repetition_penalty_frequency: s.repetition_penalty_frequency,
    repetition_penalty_presence: s.repetition_penalty_presence,
    phrase_rep_pen: s.phrase_rep_pen,
    generate_until_sentence: true,
    return_full_text: false,
    prefix: 'vanilla',
  };
  if (s.stop_sequences.length) p.stop_sequences = s.stop_sequences;
  if (s.banned_strings.length) p.bad_words_ids = []; // token ids are model specific; strings are filtered client-side
  return p;
}

function openaiBody(s: TextGenSettings, prompt: string, stream: boolean) {
  const body: Record<string, unknown> = {
    model: s.model,
    prompt,
    max_tokens: s.max_length,
    min_tokens: s.min_length,
    temperature: s.temperature,
    top_p: s.top_p,
    min_p: s.min_p,
    frequency_penalty: s.repetition_penalty_frequency,
    presence_penalty: s.repetition_penalty_presence,
    repetition_penalty: s.repetition_penalty,
    stream,
  };
  if (s.top_k > 0) body.top_k = s.top_k;
  if (s.stop_sequences.length) body.stop = s.stop_sequences.slice(0, 4);
  return body;
}

async function generateText(cfg: ApiConfig, req: TextRequest): Promise<string> {
  const s = req.settings;
  const stream = cfg.stream && !!req.onToken;
  let out = '';
  const emit = (t: string) => {
    if (!t) return;
    out += t;
    req.onToken?.(t);
  };

  if (s.endpoint === 'openai') {
    const res = await check(
      await fetch(join(cfg.textBase, '/oa/v1/completions'), {
        method: 'POST',
        headers: headers(cfg, stream ? 'text/event-stream' : 'application/json'),
        body: JSON.stringify(openaiBody(s, req.context, stream)),
        signal: req.signal,
      }),
    );
    if (stream && res.body) {
      for await (const ev of readSSE(res.body, req.signal)) {
        if (!ev.data || ev.data === '[DONE]') continue;
        try {
          const j = JSON.parse(ev.data);
          emit(j.choices?.[0]?.text ?? j.choices?.[0]?.delta?.content ?? '');
        } catch {
          /* keep-alive */
        }
      }
    } else {
      const j = await res.json();
      emit(j.choices?.[0]?.text ?? '');
    }
    return out;
  }

  const body = JSON.stringify({ input: req.context, model: s.model, parameters: nativeParameters(s) });
  const res = await check(
    await fetch(join(cfg.textBase, stream ? '/ai/generate-stream' : '/ai/generate'), {
      method: 'POST',
      headers: headers(cfg, stream ? 'text/event-stream' : 'application/json'),
      body,
      signal: req.signal,
    }),
  );
  if (stream && res.body) {
    for await (const ev of readSSE(res.body, req.signal)) {
      if (!ev.data) continue;
      try {
        const j = JSON.parse(ev.data);
        if (j.error) throw new ApiError(String(j.error));
        emit(j.token ?? '');
      } catch (e) {
        if (e instanceof ApiError) throw e;
      }
    }
  } else {
    const j = await res.json();
    emit(j.output ?? '');
  }
  return out;
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
    params_version: 3,
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

export const novelaiProvider: Provider = { generateText, generateImages, getSubscription };
