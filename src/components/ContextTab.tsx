import { useMemo } from 'react';
import { buildContext } from '../lib/context';
import { useStories } from '../store/stories';
import { toast } from '../store/ui';
import { Icon } from './Icon';

export function ContextTab() {
  const story = useStories((s) => s.current);
  const ctx = useMemo(() => (story ? buildContext(story) : null), [story]);
  if (!story || !ctx) return <div className="empty">ストーリーを選択してください。</div>;
  const total = Math.max(ctx.budget, ctx.tokens);
  const groups = (['attg', 'memory', 'lore', 'story', 'an'] as const).map((k) => ({ k, t: ctx.parts.filter((p) => p.kind === k).reduce((a, p) => a + p.tokens, 0) }));
  const names = { attg: 'ATTG', memory: 'メモリー', lore: 'ロア', story: '本文', an: '注釈' };

  return (
    <div style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="label">次の送信で使われるコンテキスト</div>
        <span className="hint">
          ≈{ctx.tokens.toLocaleString()} / {ctx.budget.toLocaleString()} tok
        </span>
      </div>
      <div className="ctx-bar">
        {groups.map((g) => g.t > 0 && <div key={g.k} className={`k-${g.k}`} style={{ width: `${(g.t / total) * 100}%`, background: 'var(--k)' }} title={`${names[g.k]} ${g.t}`} />)}
      </div>
      <div className="row wrap" style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-3)' }}>
        {groups.map((g) => (
          <span key={g.k} className={`row k-${g.k}`} style={{ gap: 4 }}>
            <i className="legend-dot" /> {names[g.k]} {g.t}
          </span>
        ))}
      </div>
      {ctx.parts.map((p, i) => (
        <div key={i} className={`ctx-part k-${p.kind}`}>
          <header>
            <span>
              {p.label}
              {p.trimmed ? '（トリミング済み）' : ''}
            </span>
            <span>≈{p.tokens}</span>
          </header>
          <pre>{p.kind === 'story' && p.text.length > 1200 ? '…' + p.text.slice(-1200) : p.text || '（空）'}</pre>
        </div>
      ))}
      <button
        className="btn small"
        onClick={() => {
          void navigator.clipboard?.writeText(ctx.text).then(() => toast('コンテキストをコピーしました', 'success'));
        }}
      >
        <Icon name="copy" size={14} /> 全文をコピー
      </button>
      <p className="hint" style={{ marginTop: 12 }}>
        トークン数は推定値です。実際の値はモデルのトークナイザーにより異なります。
      </p>
    </div>
  );
}
