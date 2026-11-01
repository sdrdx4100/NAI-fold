import { estimateTokens } from '../lib/tokens';
import { useStories } from '../store/stories';
import { Field, Section, Slider, Toggle } from './ui';

export function StoryTab() {
  const story = useStories((s) => s.current);
  const update = useStories((s) => s.update);
  if (!story) return <div className="empty">ストーリーを選択または作成してください。</div>;
  const model = story.gen.model;
  const ctx = story.ctx;
  const setCtx = (p: Partial<typeof ctx>) => update({ ctx: { ...ctx, ...p } });

  return (
    <div>
      <Section title="メモリー Memory">
        <Field label="常にコンテキストの先頭に挿入されます" hint={`≈${estimateTokens(story.memory, model)} tok`}>
          <textarea
            className="textarea"
            rows={6}
            value={story.memory}
            placeholder="例：主人公は見習い魔術師のリナ。舞台は王都アルセリア。文体は三人称、落ち着いた語り口。"
            onChange={(e) => update({ memory: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="作者の注釈 Author's Note">
        <Field label="本文の末尾付近に挿入され、直近の展開を強く方向づけます" hint={`≈${estimateTokens(story.authorsNote, model)} tok`}>
          <textarea
            className="textarea"
            rows={3}
            value={story.authorsNote}
            placeholder="例：[ 緊張感のある場面。短い文で、テンポよく。 ]"
            onChange={(e) => update({ authorsNote: e.target.value })}
          />
        </Field>
        <Slider name="挿入位置（末尾からの行数）" value={ctx.authorsNoteDepth} min={0} max={12} step={1} onChange={(v) => setCtx({ authorsNoteDepth: v })} />
      </Section>

      <Section title="ATTG / スタイル" defaultOpen={false}>
        <Toggle label="ATTG を挿入" desc="[ Author; Title; Tags; Genre ] 形式でメモリー前に追加" checked={ctx.attgEnabled} onChange={(v) => setCtx({ attgEnabled: v })} />
        <div className="grid2">
          <Field label="作者 Author">
            <input className="input" value={ctx.attg.author} onChange={(e) => setCtx({ attg: { ...ctx.attg, author: e.target.value } })} />
          </Field>
          <Field label="タイトル Title">
            <input className="input" value={ctx.attg.title} placeholder={story.title} onChange={(e) => setCtx({ attg: { ...ctx.attg, title: e.target.value } })} />
          </Field>
        </div>
        <Field label="タグ Tags">
          <input className="input" value={ctx.attg.tags} placeholder="魔法, 冒険, 成長" onChange={(e) => setCtx({ attg: { ...ctx.attg, tags: e.target.value } })} />
        </Field>
        <Field label="ジャンル Genre">
          <input className="input" value={ctx.attg.genre} placeholder="ファンタジー" onChange={(e) => setCtx({ attg: { ...ctx.attg, genre: e.target.value } })} />
        </Field>
        <Field label="スタイル行" hint="例: [ S: 4 ]">
          <input className="input" value={ctx.style} onChange={(e) => setCtx({ style: e.target.value })} />
        </Field>
      </Section>

      <Section title="ストーリー情報" defaultOpen={false}>
        <Field label="タイトル">
          <input className="input" value={story.title} onChange={(e) => update({ title: e.target.value })} />
        </Field>
        <Field label="説明">
          <textarea className="textarea" rows={3} value={story.description} onChange={(e) => update({ description: e.target.value })} />
        </Field>
        <Field label="タグ" hint="カンマ区切り">
          <input
            className="input"
            defaultValue={story.tags.join(', ')}
            key={story.id}
            onBlur={(e) =>
              update({
                tags: e.target.value
                  .split(/[,、]/)
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
        <Toggle label="末尾の空白を除去" desc="生成前にコンテキスト末尾のスペースを削除" checked={ctx.trimTrailingSpaces} onChange={(v) => setCtx({ trimTrailingSpaces: v })} />
      </Section>
    </div>
  );
}
