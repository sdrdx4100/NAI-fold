import { useMemo, useState } from 'react';
import { segmentsText } from '../lib/segments';
import type { Story } from '../lib/types';
import { downloadBlob, formatDate, pickFile, safeFilename } from '../lib/util';
import { dbGet } from '../lib/db';
import { useStories } from '../store/stories';
import { useUI } from '../store/ui';
import { Icon } from './Icon';
import { IconButton } from './ui';

export function LibraryPanel({ onPicked, showHead = true }: { onPicked?: () => void; showHead?: boolean }) {
  const metas = useStories((s) => s.metas);
  const currentId = useStories((s) => s.current?.id);
  const open = useStories((s) => s.open);
  const create = useStories((s) => s.create);
  const remove = useStories((s) => s.remove);
  const duplicate = useStories((s) => s.duplicate);
  const importStory = useStories((s) => s.importStory);
  const update = useStories((s) => s.update);
  const setMode = useUI((s) => s.setMode);
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const list = useMemo(() => {
    const ql = q.toLowerCase();
    return metas
      .filter((m) => (!favOnly || m.favorite) && (!q || (m.title + m.description + m.tags.join(' ') + m.preview).toLowerCase().includes(ql)))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
  }, [metas, q, favOnly]);

  const exportStory = async (id: string, kind: 'json' | 'txt') => {
    const s = id === currentId ? useStories.getState().current : await dbGet<Story>('stories', id);
    if (!s) return;
    if (kind === 'json') downloadBlob(new Blob([JSON.stringify({ naiFoldVersion: 1, ...s, history: undefined }, null, 2)], { type: 'application/json' }), `${safeFilename(s.title)}.naifold.json`);
    else downloadBlob(new Blob([segmentsText(s.segments)], { type: 'text/plain' }), `${safeFilename(s.title)}.txt`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {showHead && (
        <div className="panel-head">
          <h2>ライブラリ</h2>
          <IconButton
            icon="upload"
            label="インポート"
            onClick={async () => {
              const f = await pickFile('.json,.txt,application/json,text/plain');
              if (!f) return;
              const t = await f.text();
              let raw: unknown = t;
              if (f.name.endsWith('.json')) {
                try {
                  raw = JSON.parse(t);
                } catch {
                  /* treat as text */
                }
              }
              const s = await importStory(raw);
              if (s && f.name.endsWith('.txt')) update({ title: f.name.replace(/\.txt$/, '') });
              onPicked?.();
            }}
          />
          <IconButton icon="star" label="お気に入りのみ" active={favOnly} onClick={() => setFavOnly((v) => !v)} />
        </div>
      )}
      <div className="lib-search">
        <input className="input" type="search" placeholder="ストーリーを検索" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="lib-list">
        {list.length === 0 && <div className="empty">{metas.length ? '一致するストーリーはありません' : 'ストーリーはまだありません'}</div>}
        {list.map((m) => (
          <div key={m.id} style={{ position: 'relative' }}>
            <button
              className={`story-card${m.id === currentId ? ' active' : ''}`}
              onClick={() => {
                void open(m.id);
                setMode('story');
                onPicked?.();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuFor(m.id);
              }}
            >
              <div className="t">
                {m.favorite && <Icon name="star" size={13} filled style={{ color: 'var(--accent)', flex: 'none' }} />}
                <span>{m.title || '無題'}</span>
              </div>
              <div className="p">{m.description || m.preview || '（本文なし）'}</div>
              <div className="m">
                <span>{formatDate(m.updatedAt)}</span>
                <span>{m.chars.toLocaleString()}字</span>
                {m.tags.slice(0, 3).map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            </button>
            <button className="icon-btn" style={{ position: 'absolute', right: 4, top: 6, width: 32, height: 32 }} aria-label="メニュー" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}>
              <Icon name="more" size={18} />
            </button>
            {menuFor === m.id && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenuFor(null)} />
                <div className="popover" style={{ top: 40, bottom: 'auto', left: 'auto', right: 6, width: 220 }}>
                  <button
                    className="item"
                    onClick={async () => {
                      setMenuFor(null);
                      if (m.id !== currentId) await open(m.id);
                      update({ favorite: !m.favorite });
                    }}
                  >
                    {m.favorite ? 'お気に入り解除' : 'お気に入りに追加'}
                  </button>
                  <button className="item" onClick={() => (setMenuFor(null), void duplicate(m.id))}>
                    複製
                  </button>
                  <button className="item" onClick={() => (setMenuFor(null), void exportStory(m.id, 'json'))}>
                    書き出し（JSON・設定込み）
                  </button>
                  <button className="item" onClick={() => (setMenuFor(null), void exportStory(m.id, 'txt'))}>
                    書き出し（テキスト）
                  </button>
                  <button
                    className="item"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => {
                      setMenuFor(null);
                      if (confirm(`「${m.title}」を削除しますか？この操作は取り消せません。`)) void remove(m.id);
                    }}
                  >
                    削除
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="lib-foot">
        <button
          className="btn primary block"
          onClick={() => {
            void create();
            setMode('story');
            onPicked?.();
          }}
        >
          <Icon name="plus" size={16} /> 新しいストーリー
        </button>
      </div>
    </div>
  );
}
