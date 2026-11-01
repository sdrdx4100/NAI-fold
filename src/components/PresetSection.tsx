import { uid } from '../lib/util';
import { useSettings } from '../store/settings';
import { toast } from '../store/ui';
import { Icon } from './Icon';
import { Section } from './ui';

/** Saved prompts: one tap to restore prompt, negative and character prompts. */
export function PresetSection() {
  const presets = useSettings((s) => s.promptPresets);
  const save = useSettings((s) => s.savePromptPreset);
  const del = useSettings((s) => s.deletePromptPreset);
  const setImageGen = useSettings((s) => s.setImageGen);

  return (
    <Section title={`保存したプロンプト (${presets.length})`} defaultOpen={false}>
      {presets.length === 0 && <p className="hint" style={{ marginTop: 0 }}>よく使うプロンプトを保存して、ワンタップで呼び出せます。</p>}
      <div className="row wrap" style={{ marginBottom: 10 }}>
        {presets.map((p) => (
          <span key={p.id} className="row" style={{ gap: 2 }}>
            <button
              className="chip"
              style={{ padding: '5px 10px', fontSize: 12.5 }}
              title={p.prompt}
              onClick={() => {
                setImageGen({ prompt: p.prompt, negative: p.negative, characters: p.characters.map((c) => ({ ...c, id: uid() })) });
                toast(`「${p.name}」を読み込みました`);
              }}
            >
              {p.name}
            </button>
            <button className="chip" aria-label={`${p.name} を削除`} onClick={() => confirm(`「${p.name}」を削除しますか？`) && del(p.id)}>
              ×
            </button>
          </span>
        ))}
      </div>
      <button
        className="btn small"
        onClick={() => {
          const s = useSettings.getState().imageGen;
          const name = prompt('名前を付けて保存', s.prompt.split(',').slice(0, 3).join(',').trim());
          if (!name) return;
          save({ id: uid(), name, prompt: s.prompt, negative: s.negative, characters: s.characters });
          toast('プロンプトを保存しました', 'success');
        }}
      >
        <Icon name="plus" size={14} /> 現在のプロンプトを保存
      </button>
    </Section>
  );
}
