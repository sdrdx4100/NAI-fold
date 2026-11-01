import { BUILTIN_PRESETS, PHRASE_REP_PEN, TEXT_MODELS, textModel } from '../lib/models';
import type { TextGenSettings } from '../lib/types';
import { uid } from '../lib/util';
import { useSettings } from '../store/settings';
import { useStories } from '../store/stories';
import { toast } from '../store/ui';
import { Icon } from './Icon';
import { Field, Section, Slider } from './ui';

export function GenTab() {
  const story = useStories((s) => s.current);
  const update = useStories((s) => s.update);
  const presets = useSettings((s) => s.presets);
  const savePreset = useSettings((s) => s.savePreset);
  const deletePreset = useSettings((s) => s.deletePreset);
  const setDefaultGen = useSettings((s) => s.setDefaultGen);
  if (!story) return <div className="empty">ストーリーを選択してください。</div>;
  const g = story.gen;
  const set = (p: Partial<TextGenSettings>) => update({ gen: { ...g, ...p } });
  const all = [...BUILTIN_PRESETS, ...presets];
  const info = textModel(g.model);

  return (
    <div>
      <Section title="AIモデル">
        <Field label="モデル">
          <select
            className="select"
            value={TEXT_MODELS.some((m) => m.id === g.model) ? g.model : '__custom'}
            onChange={(e) => {
              if (e.target.value === '__custom') return set({ model: prompt('モデルIDを入力', g.model) || g.model });
              const m = textModel(e.target.value);
              set({ model: m.id, endpoint: m.endpoint, context_limit: Math.min(g.context_limit, m.maxContext) || m.maxContext });
            }}
          >
            {TEXT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="__custom">カスタム…</option>
          </select>
        </Field>
        <div className="hint" style={{ marginTop: -8, marginBottom: 12 }}>
          {info.description}
        </div>
        <Field label="エンドポイント">
          <div className="segmented" style={{ alignSelf: 'flex-start' }}>
            <button aria-pressed={g.endpoint === 'openai'} onClick={() => set({ endpoint: 'openai' })}>
              OpenAI互換 /oa/v1
            </button>
            <button aria-pressed={g.endpoint === 'native'} onClick={() => set({ endpoint: 'native' })}>
              ネイティブ /ai/generate
            </button>
          </div>
        </Field>
      </Section>

      <Section title="プリセット">
        <div className="row wrap" style={{ marginBottom: 10 }}>
          {all.map((p) => (
            <span key={p.id} className="row" style={{ gap: 2 }}>
              <button className="chip" style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => (set(p.settings), toast(`プリセット「${p.name}」を適用`))}>
                {p.name}
              </button>
              {!p.builtin && (
                <button className="chip" aria-label={`${p.name} を削除`} onClick={() => confirm(`プリセット「${p.name}」を削除しますか？`) && deletePreset(p.id)}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="row wrap">
          <button
            className="btn small"
            onClick={() => {
              const name = prompt('プリセット名');
              if (!name) return;
              const { model: _m, endpoint: _e, context_limit: _c, ...rest } = g;
              void _m;
              void _e;
              void _c;
              savePreset({ id: uid(), name, settings: rest });
              toast('プリセットを保存しました', 'success');
            }}
          >
            <Icon name="plus" size={14} />
            現在の設定を保存
          </button>
          <button className="btn small" onClick={() => (setDefaultGen(g), toast('新規ストーリーの既定値にしました', 'success'))}>
            既定値に設定
          </button>
        </div>
      </Section>

      <Section title="生成オプション">
        <Slider name="ランダム性 Temperature" value={g.temperature} min={0.1} max={2.5} step={0.01} desc="高いほど意外性が増し、低いほど安定します" onChange={(v) => set({ temperature: v })} />
        <Slider name="出力長 (tokens)" value={g.max_length} min={4} max={g.endpoint === 'openai' ? 600 : 150} step={1} onChange={(v) => set({ max_length: Math.round(v) })} />
        <Slider name="最小出力長" value={g.min_length} min={1} max={g.max_length} step={1} onChange={(v) => set({ min_length: Math.round(v) })} />
        <Slider
          name="コンテキスト上限 (tokens)"
          value={g.context_limit}
          min={1024}
          max={info.maxContext}
          step={256}
          desc={`このモデルの最大 ≈ ${info.maxContext.toLocaleString()}（プランにより異なります）`}
          onChange={(v) => set({ context_limit: Math.round(v) })}
        />
      </Section>

      <Section title="サンプリング" defaultOpen={false}>
        <Slider name="Top-K" value={g.top_k} min={0} max={300} step={1} desc="0 で無効" onChange={(v) => set({ top_k: Math.round(v) })} />
        <Slider name="Top-P (Nucleus)" value={g.top_p} min={0} max={1} step={0.01} onChange={(v) => set({ top_p: v })} />
        <Slider name="Min-P" value={g.min_p} min={0} max={0.5} step={0.005} onChange={(v) => set({ min_p: v })} />
        <Slider name="Top-A" value={g.top_a} min={0} max={1} step={0.01} onChange={(v) => set({ top_a: v })} />
        <Slider name="Typical-P" value={g.typical_p} min={0} max={1} step={0.01} onChange={(v) => set({ typical_p: v })} />
        <Slider name="Tail-Free" value={g.tail_free_sampling} min={0} max={1} step={0.01} onChange={(v) => set({ tail_free_sampling: v })} />
      </Section>

      <Section title="繰り返しペナルティ" defaultOpen={false}>
        <Slider name="Repetition Penalty" value={g.repetition_penalty} min={1} max={2} step={0.005} onChange={(v) => set({ repetition_penalty: v })} />
        <Slider name="範囲 Range" value={g.repetition_penalty_range} min={0} max={8192} step={16} onChange={(v) => set({ repetition_penalty_range: Math.round(v) })} />
        <Slider name="傾斜 Slope" value={g.repetition_penalty_slope} min={0} max={10} step={0.01} onChange={(v) => set({ repetition_penalty_slope: v })} />
        <Slider name="頻度 Frequency" value={g.repetition_penalty_frequency} min={-2} max={2} step={0.01} onChange={(v) => set({ repetition_penalty_frequency: v })} />
        <Slider name="存在 Presence" value={g.repetition_penalty_presence} min={-2} max={2} step={0.01} onChange={(v) => set({ repetition_penalty_presence: v })} />
        <Field label="フレーズ繰り返しペナルティ">
          <select className="select" value={g.phrase_rep_pen} onChange={(e) => set({ phrase_rep_pen: e.target.value as TextGenSettings['phrase_rep_pen'] })}>
            {PHRASE_REP_PEN.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="停止・禁止" defaultOpen={false}>
        <Field label="停止シーケンス" hint="1行に1つ">
          <textarea
            className="textarea"
            rows={3}
            value={g.stop_sequences.join('\n')}
            onChange={(e) => set({ stop_sequences: e.target.value.split('\n').filter((x) => x.length) })}
            placeholder={'***\n[ '}
          />
        </Field>
        <Field label="禁止文字列" hint="出力から除去">
          <textarea className="textarea" rows={3} value={g.banned_strings.join('\n')} onChange={(e) => set({ banned_strings: e.target.value.split('\n').filter((x) => x.length) })} />
        </Field>
      </Section>
    </div>
  );
}
