import { useMemo, useState } from 'react';
import { activeLoreEntries } from '../lib/context';
import { estimateTokens } from '../lib/tokens';
import type { LoreEntry } from '../lib/types';
import { downloadBlob, pickFile, safeFilename } from '../lib/util';
import { newLoreEntry, useStories } from '../store/stories';
import { toast, useUI } from '../store/ui';
import { Icon } from './Icon';
import { Field, IconButton, Slider, Toggle } from './ui';

function KeyInput({ keys, onChange }: { keys: string[]; onChange: (k: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft
      .split(/[,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) onChange([...new Set([...keys, ...parts])]);
    setDraft('');
  };
  return (
    <div className="key-input">
      {keys.map((k) => (
        <span key={k} className="chip">
          {k}
          <button aria-label={`${k} を削除`} onClick={() => onChange(keys.filter((x) => x !== k))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={keys.length ? '' : 'キーワード（Enterで追加、/正規表現/ も可）'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ',') && !e.nativeEvent.isComposing) {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && keys.length) onChange(keys.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}

export function LoreTab() {
  const story = useStories((s) => s.current);
  const upsert = useStories((s) => s.upsertLore);
  const remove = useStories((s) => s.removeLore);
  const update = useStories((s) => s.update);
  const selected = useUI((s) => s.loreSelected);
  const setSelected = useUI((s) => s.setLoreSelected);
  const [q, setQ] = useState('');

  const active = useMemo(() => new Set(story ? activeLoreEntries(story).map((e) => e.id) : []), [story]);
  if (!story) return <div className="empty">ストーリーを選択してください。</div>;

  const entry = story.lorebook.find((e) => e.id === selected) ?? null;
  const list = story.lorebook.filter((e) => !q || (e.displayName + e.keys.join(' ') + e.text).toLowerCase().includes(q.toLowerCase()));

  const set = (p: Partial<LoreEntry>) => entry && upsert({ ...entry, ...p });

  if (entry) {
    return (
      <div>
        <div className="panel-head">
          <IconButton icon="undo" label="一覧に戻る" onClick={() => setSelected(null)} />
          <h2 style={{ fontSize: 15 }}>{entry.displayName || '無題のエントリ'}</h2>
          <span className={`chip${active.has(entry.id) ? ' on' : ''}`}>{active.has(entry.id) ? '有効化中' : '待機'}</span>
          <IconButton
            icon="trash"
            label="削除"
            onClick={() => {
              if (confirm(`「${entry.displayName || '無題'}」を削除しますか？`)) {
                remove(entry.id);
                setSelected(null);
              }
            }}
          />
        </div>
        <div style={{ padding: 16 }}>
          <Field label="表示名">
            <input className="input" value={entry.displayName} onChange={(e) => set({ displayName: e.target.value })} placeholder="例：リナ" />
          </Field>
          <Field label="本文" hint={`≈${estimateTokens(entry.text, story.gen.model)} tok`}>
            <textarea className="textarea" rows={7} value={entry.text} onChange={(e) => set({ text: e.target.value })} placeholder="キーワードが本文に現れたときにコンテキストへ挿入される設定文" />
          </Field>
          <Field label="アクティベーションキー">
            <KeyInput keys={entry.keys} onChange={(keys) => set({ keys })} />
          </Field>
          <Toggle label="有効" checked={entry.enabled} onChange={(v) => set({ enabled: v })} />
          <Toggle label="常時有効" desc="キーに関係なく常に挿入" checked={entry.alwaysOn} onChange={(v) => set({ alwaysOn: v })} />
          <Toggle label="大文字小文字を区別" checked={entry.caseSensitive} onChange={(v) => set({ caseSensitive: v })} />
          <Slider name="検索範囲（文字）" value={entry.searchRange} min={100} max={20000} step={100} onChange={(v) => set({ searchRange: v })} />
          <Slider name="優先度" value={entry.priority} min={-10} max={10} step={1} desc="高いほど先に挿入され、トリミングされにくくなります" onChange={(v) => set({ priority: v })} />
          <Field label="カテゴリ">
            <input className="input" value={entry.category} onChange={(e) => set({ category: e.target.value })} placeholder="キャラクター / 場所 / 用語 …" />
          </Field>
        </div>
      </div>
    );
  }

  const categories = [...new Set(story.lorebook.map((e) => e.category || '未分類'))];

  return (
    <div>
      <div className="lib-search">
        <input className="input" placeholder="ロアブックを検索" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn primary"
          onClick={() => {
            const e = newLoreEntry({ displayName: '新しいエントリ' });
            upsert(e);
            setSelected(e.id);
          }}
        >
          <Icon name="plus" size={16} />
          追加
        </button>
      </div>
      {list.length === 0 && (
        <div className="empty">
          ロアブックは空です。
          <br />
          キャラクターや場所の設定を登録すると、本文に名前が出たときだけ自動で挿入されます。
        </div>
      )}
      <div className="lore-list">
        {categories.map((cat) => {
          const items = list.filter((e) => (e.category || '未分類') === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              {categories.length > 1 && <div className="label" style={{ padding: '8px 10px 4px' }}>{cat}</div>}
              {items.map((e) => (
                <button key={e.id} className="lore-item" onClick={() => setSelected(e.id)}>
                  <span className={`dot${active.has(e.id) ? ' on' : ''}`} title={active.has(e.id) ? '有効化中' : ''} />
                  <span className="grow">
                    <div className="name" style={{ opacity: e.enabled ? 1 : 0.5 }}>
                      {e.displayName || '無題'} {e.alwaysOn && <span className="chip">常時</span>}
                    </div>
                    <div className="keys">{e.keys.length ? e.keys.join(', ') : 'キーなし'}</div>
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="row" style={{ padding: '4px 16px 16px' }}>
        <button
          className="btn small"
          onClick={() => downloadBlob(new Blob([JSON.stringify({ lorebookVersion: 1, entries: story.lorebook }, null, 2)], { type: 'application/json' }), `${safeFilename(story.title)}.lorebook.json`)}
        >
          <Icon name="download" size={14} />
          書き出し
        </button>
        <button
          className="btn small"
          onClick={async () => {
            const f = await pickFile('.json,.lorebook,application/json');
            if (!f) return;
            try {
              const j = JSON.parse(await f.text());
              const raw: Partial<LoreEntry & { contextConfig?: unknown }>[] = j.entries ?? j;
              const entries = raw.map((e) => newLoreEntry({ ...e, id: undefined as never, keys: e.keys ?? [], displayName: e.displayName ?? '', text: e.text ?? '' }));
              update({ lorebook: [...story.lorebook, ...entries] });
              toast(`${entries.length}件のエントリを読み込みました`, 'success');
            } catch (e) {
              toast(`読み込み失敗: ${(e as Error).message}`, 'error');
            }
          }}
        >
          <Icon name="upload" size={14} />
          読み込み
        </button>
      </div>
    </div>
  );
}
