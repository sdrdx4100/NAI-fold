import { useImageUrl } from '../hooks/useImageUrl';
import { IMAGE_MODELS, NOISE_SCHEDULES, SAMPLERS, SIZE_PRESETS, UC_PRESETS, estimateAnlas, imageModel } from '../lib/models';
import type { CharacterPrompt, ImageGenSettings } from '../lib/types';
import { PresetSection } from './PresetSection';
import { pickFile, randomSeed, uid } from '../lib/util';
import { useImages } from '../store/images';
import { useSettings } from '../store/settings';
import { Icon } from './Icon';
import { Field, Section, Slider, Toggle } from './ui';

const POS = [0.1, 0.3, 0.5, 0.7, 0.9];

function CharacterCard({ c, idx, onChange, onRemove, useCoords }: { c: CharacterPrompt; idx: number; onChange: (c: CharacterPrompt) => void; onRemove: () => void; useCoords: boolean }) {
  return (
    <div className="char-card">
      <div className="row" style={{ marginBottom: 8 }}>
        <b style={{ fontSize: 13, color: 'var(--accent)' }}>キャラクター {idx + 1}</b>
        <span className="grow" />
        <label className="switch" title="有効">
          <input type="checkbox" checked={c.enabled} onChange={(e) => onChange({ ...c, enabled: e.target.checked })} />
          <span />
        </label>
        <button className="icon-btn" aria-label="削除" onClick={onRemove}>
          <Icon name="trash" size={16} />
        </button>
      </div>
      <textarea className="textarea" rows={2} style={{ minHeight: 60 }} value={c.prompt} placeholder="girl, silver hair, red eyes, cloak" onChange={(e) => onChange({ ...c, prompt: e.target.value })} />
      <input className="input" style={{ marginTop: 6 }} value={c.uc} placeholder="除外（このキャラのみ）" onChange={(e) => onChange({ ...c, uc: e.target.value })} />
      {useCoords && (
        <div className="row" style={{ marginTop: 8 }}>
          <span className="hint">位置</span>
          <div className="pos-grid">
            {POS.map((y) =>
              POS.map((x) => (
                <button key={`${x}-${y}`} className={Math.abs(c.x - x) < 0.01 && Math.abs(c.y - y) < 0.01 ? 'on' : ''} aria-label={`位置 ${x},${y}`} onClick={() => onChange({ ...c, x, y })} />
              )),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ImageControls() {
  const s = useSettings((st) => st.imageGen);
  const set = useSettings((st) => st.setImageGen);
  const sub = useSettings((st) => st.subscription);
  const generating = useImages((st) => st.generating);
  const generate = useImages((st) => st.generate);
  const stop = useImages((st) => st.stop);
  const addUpload = useImages((st) => st.addUpload);
  const baseUrl = useImageUrl(s.baseImageId);
  const info = imageModel(s.model);
  const cost = estimateAnlas(s, sub?.tier ?? 0);

  const setChar = (i: number, c: CharacterPrompt) => set({ characters: s.characters.map((x, j) => (j === i ? c : x)) });

  const ratioLabel = (w: number, h: number) => `${w}×${h}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ flex: 1 }}>
        <Section title="プロンプト">
          <Field label="モデル">
            <select className="select" value={s.model} onChange={(e) => set({ model: e.target.value })}>
              {IMAGE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="プロンプト" hint={<span className="kbd">Ctrl+Enter で生成</span>}>
            <textarea
              className="textarea"
              rows={5}
              value={s.prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void generate();
                }
              }}
              placeholder={info.v5 ? '1girl, solo, ... / 日本語の文章でもOK（例：雨の夜、ネオン街に立つ少女）' : '1girl, solo, ...'}
            />
          </Field>
          <Field label="除外したい要素 Undesired Content">
            <textarea className="textarea" rows={2} style={{ minHeight: 60 }} value={s.negative} onChange={(e) => set({ negative: e.target.value })} placeholder="blurry, lowres, ..." />
          </Field>
          <div className="grid2">
            <Field label="UCプリセット">
              <select className="select" value={s.ucPreset} onChange={(e) => set({ ucPreset: Number(e.target.value) })}>
                {UC_PRESETS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <div style={{ paddingTop: 14 }}>
              {info.v5 ? (
                <p className="hint" style={{ margin: '8px 0 0' }}>
                  V5は品質タグの自動追加なし（公式のタグ文字列が未公開のため）
                </p>
              ) : (
                <Toggle label="品質タグ" checked={s.qualityToggle} onChange={(v) => set({ qualityToggle: v })} />
              )}
            </div>
          </div>
        </Section>

        <PresetSection />

        {info.v4 && (
          <Section title={`キャラクター (${s.characters.length}/${info.maxCharacters})`} defaultOpen={s.characters.length > 0}>
            <Toggle label="位置を指定" desc="オフでAIにおまかせ" checked={s.useCoords} onChange={(v) => set({ useCoords: v })} />
            {s.characters.map((c, i) => (
              <CharacterCard key={c.id} c={c} idx={i} useCoords={s.useCoords} onChange={(nc) => setChar(i, nc)} onRemove={() => set({ characters: s.characters.filter((x) => x.id !== c.id) })} />
            ))}
            <button
              className="btn small"
              disabled={s.characters.length >= info.maxCharacters}
              onClick={() => set({ characters: [...s.characters, { id: uid(), prompt: '', uc: '', x: 0.5, y: 0.5, enabled: true }] })}
            >
              <Icon name="user" size={14} />
              キャラクターを追加
            </button>
          </Section>
        )}

        <Section title="画像設定">
          <div className="size-grid">
            {SIZE_PRESETS.map((p) => (
              <button key={p.name} className={`chip${s.width === p.w && s.height === p.h ? ' on' : ''}`} style={{ padding: '5px 10px' }} onClick={() => set({ width: p.w, height: p.h })}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginBottom: 14 }}>
            <input className="input" type="number" step={64} min={64} max={2048} value={s.width} aria-label="幅" onChange={(e) => set({ width: Math.round(Number(e.target.value) / 64) * 64 || 64 })} />
            <button className="icon-btn" aria-label="縦横入れ替え" onClick={() => set({ width: s.height, height: s.width })}>
              <Icon name="swap" size={18} />
            </button>
            <input className="input" type="number" step={64} min={64} max={2048} value={s.height} aria-label="高さ" onChange={(e) => set({ height: Math.round(Number(e.target.value) / 64) * 64 || 64 })} />
          </div>
          <Slider name="ステップ" value={s.steps} min={1} max={50} step={1} onChange={(v) => set({ steps: Math.round(v) })} />
          <Slider name="プロンプト忠実度 Guidance" value={s.scale} min={0} max={10} step={0.1} onChange={(v) => set({ scale: v })} />
          <Slider name="枚数" value={s.n_samples} min={1} max={4} step={1} onChange={(v) => set({ n_samples: Math.round(v) })} />
          <Field label="シード" hint={s.seed === null ? 'ランダム' : ''}>
            <div className="row">
              <input
                className="input"
                inputMode="numeric"
                placeholder="ランダム"
                value={s.seed ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  set({ seed: v ? Math.min(4294967295, Number(v)) : null });
                }}
              />
              <button className="icon-btn" aria-label="ランダムシードを設定" onClick={() => set({ seed: randomSeed() })}>
                <Icon name="dice" size={18} />
              </button>
              <button className="icon-btn" aria-label="シードをクリア" onClick={() => set({ seed: null })} disabled={s.seed === null}>
                <Icon name="x" size={18} />
              </button>
            </div>
          </Field>
        </Section>

        <Section title="画像から生成 img2img" defaultOpen={!!s.baseImageId}>
          {s.baseImageId && baseUrl ? (
            <>
              <div className="base-image">
                <img src={baseUrl} alt="ベース画像" />
                <div className="grow hint">この画像をベースに生成します</div>
                <button className="btn small" onClick={() => set({ baseImageId: null })}>
                  解除
                </button>
              </div>
              <Slider name="強度 Strength" value={s.strength} min={0.01} max={0.99} step={0.01} desc="高いほど元画像から離れます" onChange={(v) => set({ strength: v })} />
              <Slider name="ノイズ Noise" value={s.noise} min={0} max={0.99} step={0.01} onChange={(v) => set({ noise: v })} />
            </>
          ) : (
            <div className="row wrap">
              <span className="hint grow">ギャラリーの「ベースに使う」か、画像をアップロード</span>
              <button
                className="btn small"
                onClick={async () => {
                  const f = await pickFile('image/*');
                  if (!f) return;
                  const bmp = await createImageBitmap(f);
                  const img = await addUpload(f, bmp.width, bmp.height);
                  const w = Math.max(64, Math.round(bmp.width / 64) * 64);
                  const h = Math.max(64, Math.round(bmp.height / 64) * 64);
                  const k = Math.min(1, Math.sqrt((1216 * 832) / (w * h)));
                  set({ baseImageId: img.id, width: Math.round((w * k) / 64) * 64, height: Math.round((h * k) / 64) * 64 });
                }}
              >
                <Icon name="upload" size={14} /> アップロード
              </button>
            </div>
          )}
        </Section>

        <Section title="詳細設定" defaultOpen={false}>
          <Field label="サンプラー">
            <select className="select" value={s.sampler} onChange={(e) => set({ sampler: e.target.value })}>
              {SAMPLERS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ノイズスケジュール">
            <select className="select" value={s.noise_schedule} onChange={(e) => set({ noise_schedule: e.target.value })}>
              {NOISE_SCHEDULES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Slider name="CFG Rescale" value={s.cfg_rescale} min={0} max={1} step={0.02} onChange={(v) => set({ cfg_rescale: v })} />
          {info.v4 ? (
            <Toggle label="Variety+" desc="高シグマでCFGをスキップし多様性を上げる" checked={s.variety} onChange={(v) => set({ variety: v })} />
          ) : (
            <>
              <Toggle label="SMEA" checked={s.sm} onChange={(v) => set({ sm: v })} />
              <Toggle label="DYN" checked={s.sm_dyn} onChange={(v) => set({ sm_dyn: v })} />
            </>
          )}
        </Section>
      </div>
      <GenerateFooter cost={cost} generating={generating} onGenerate={() => void generate()} onStop={stop} size={ratioLabel(s.width, s.height)} settings={s} />
    </div>
  );
}

function GenerateFooter({ cost, generating, onGenerate, onStop, size, settings }: { cost: number; generating: boolean; onGenerate: () => void; onStop: () => void; size: string; settings: ImageGenSettings }) {
  const mock = useSettings((st) => st.api.mock || !st.api.token);
  return (
    <div className="gen-footer">
      <div className="cost grow">
        {size} · {settings.steps}step · {settings.n_samples}枚
        <br />
        {mock ? <span style={{ color: 'var(--info)' }}>モック（無料）</span> : cost === 0 ? <span style={{ color: 'var(--ok)' }}>無料（Opus）</span> : <>推定 {cost} Anlas</>}
      </div>
      {generating ? (
        <button className="send-btn stop" onClick={onStop}>
          <Icon name="stop" size={18} filled /> 停止
        </button>
      ) : (
        <button className="send-btn" onClick={onGenerate}>
          <Icon name="brush" size={18} /> 生成
        </button>
      )}
    </div>
  );
}
