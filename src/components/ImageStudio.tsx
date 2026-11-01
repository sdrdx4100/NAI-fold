import { useMemo, useRef, useState } from 'react';
import { useImageUrl } from '../hooks/useImageUrl';
import { imageModel } from '../lib/models';
import type { GeneratedImage } from '../lib/types';
import { downloadBlob, safeFilename } from '../lib/util';
import { useImages } from '../store/images';
import { useSettings } from '../store/settings';
import { toast, useUI } from '../store/ui';
import { Icon } from './Icon';
import { IconButton } from './ui';

type Filter = 'all' | 'fav';

function Thumb({ img, selected, onClick }: { img: GeneratedImage; selected: boolean; onClick: () => void }) {
  const url = useImageUrl(img.id);
  return (
    <button className={`thumb${selected ? ' sel' : ''}`} onClick={onClick} aria-label={`画像 seed ${img.seed}`}>
      {url && <img src={url} alt="" loading="lazy" />}
      {img.favorite && <span className="fav">★</span>}
    </button>
  );
}

function useFiltered(filter: Filter) {
  const images = useImages((s) => s.images);
  return useMemo(() => (filter === 'fav' ? images.filter((i) => i.favorite) : images), [images, filter]);
}

function FilterTabs({ filter, setFilter }: { filter: Filter; setFilter: (f: Filter) => void }) {
  const images = useImages((s) => s.images);
  return (
    <div className="tabs" style={{ borderTop: '1px solid var(--line-soft)' }}>
      {(
        [
          ['all', 'すべて', images.length],
          ['fav', 'お気に入り', images.filter((i) => i.favorite).length],
        ] as const
      ).map(([k, label, n]) => (
        <button key={k} aria-selected={filter === k} onClick={() => setFilter(k)}>
          {label} <span className="count">{n}</span>
        </button>
      ))}
    </div>
  );
}

/** Grid of all generated images (left column in the 3-column layout, or the grid view). */
export function GalleryGrid({ onPick }: { onPick?: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const list = useFiltered(filter);
  const selectedId = useImages((s) => s.selectedId);
  const select = useImages((s) => s.select);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <FilterTabs filter={filter} setFilter={setFilter} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {list.length === 0 && <div className="empty">画像はまだありません</div>}
        <div className="gallery-grid">
          {list.map((img) => (
            <Thumb
              key={img.id}
              img={img}
              selected={img.id === selectedId}
              onClick={() => {
                select(img.id);
                onPick?.();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ImageStudio({ compact, showStrip = true }: { compact?: boolean; showStrip?: boolean }) {
  const images = useImages((s) => s.images);
  const selectedId = useImages((s) => s.selectedId);
  const select = useImages((s) => s.select);
  const generating = useImages((s) => s.generating);
  const progress = useImages((s) => s.progress);
  const remove = useImages((s) => s.remove);
  const toggleFavorite = useImages((s) => s.toggleFavorite);
  const generate = useImages((s) => s.generate);
  const stop = useImages((s) => s.stop);
  const setImageGen = useSettings((s) => s.setImageGen);
  const setSideOpen = useUI((s) => s.setSideOpen);
  const view = useUI((s) => s.view);
  const setView = useUI((s) => s.setView);
  const [filter, setFilter] = useState<Filter>('all');
  const [zoom, setZoom] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const list = useFiltered(filter);

  const sel = images.find((i) => i.id === selectedId) ?? list[0] ?? null;
  const url = useImageUrl(sel?.id);

  const step = (d: number) => {
    if (!sel) return;
    const i = list.findIndex((x) => x.id === sel.id);
    const n = list[i + d];
    if (n) select(n.id);
  };

  const footer = compact && (
    <div className="actionbar">
      <button className="btn" onClick={() => setSideOpen(true)}>
        <Icon name="sliders" size={16} /> プロンプト・設定
      </button>
      <span className="grow" />
      {generating ? (
        <button className="send-btn stop" onClick={stop}>
          <Icon name="stop" size={18} filled /> 停止
        </button>
      ) : (
        <button className="send-btn" onClick={() => void generate()}>
          <Icon name="brush" size={18} /> 生成
        </button>
      )}
    </div>
  );

  if (view === 'grid' && showStrip) {
    return (
      <div className="studio">
        <div className="viewer-actions">
          <IconButton icon="image" label="ビューアに戻る" onClick={() => setView('viewer')} />
          <div className="info">ギャラリー（{images.length}枚）</div>
        </div>
        <GalleryGrid onPick={() => setView('viewer')} />
        {footer}
      </div>
    );
  }

  return (
    <div className="studio">
      <div
        className="viewer"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
        }}
      >
        {sel && url ? (
          <img src={url} alt={sel.prompt} onClick={() => setZoom(true)} draggable={false} />
        ) : (
          <div className="placeholder">
            <Icon name="image" size={48} />
            <h3>イメージスタジオ</h3>
            <div>プロンプトを入力して「生成」を押してください。</div>
          </div>
        )}
        {generating && (
          <>
            <div className="gen-overlay">
              <div className="spinner" />
              生成中… {Math.round(progress * 100)}%
            </div>
            <div className="progress">
              <div style={{ width: `${progress * 100}%` }} />
            </div>
          </>
        )}
      </div>

      {sel && (
        <div className="viewer-actions">
          {showStrip && <IconButton icon="layers" label="ギャラリー表示" onClick={() => setView('grid')} />}
          <IconButton icon="star" label={sel.favorite ? 'お気に入り解除' : 'お気に入り'} active={sel.favorite} onClick={() => toggleFavorite(sel.id)} />
          <IconButton
            icon="download"
            label="保存"
            onClick={async () => {
              const b = await useImages.getState().blob(sel.id);
              if (b) void downloadBlob(b, `${safeFilename(sel.prompt.slice(0, 40))}_${sel.seed}.png`);
            }}
          />
          <IconButton
            icon="sliders"
            label="この設定を再利用"
            onClick={() => {
              setImageGen({ ...sel.settings, baseImageId: null });
              toast(`設定を読み込みました（seed ${sel.seed}）`, 'success');
            }}
          />
          <IconButton
            icon="wand"
            label="ベースに使う (img2img)"
            onClick={() => {
              setImageGen({ baseImageId: sel.id, width: sel.width, height: sel.height });
              toast('img2img のベース画像に設定しました');
            }}
          />
          <IconButton icon="copy" label="プロンプトをコピー" onClick={() => void navigator.clipboard?.writeText(sel.prompt).then(() => toast('プロンプトをコピーしました'))} />
          <div className="info" title={sel.prompt}>
            {sel.width}×{sel.height} · seed {sel.seed} · {imageModel(sel.model).name.replace('NAI Diffusion ', '')}
            {sel.mock ? ' · MOCK' : ''}
          </div>
          <IconButton icon="trash" label="削除" onClick={() => confirm('この画像を削除しますか？') && void remove(sel.id)} />
        </div>
      )}

      {showStrip && (
        <>
          <FilterTabs filter={filter} setFilter={setFilter} />
          <div className="strip">
            {list.length === 0 && (
              <span className="hint" style={{ padding: '18px 6px' }}>
                画像はまだありません
              </span>
            )}
            {list.map((img) => (
              <Thumb key={img.id} img={img} selected={img.id === sel?.id} onClick={() => select(img.id)} />
            ))}
          </div>
        </>
      )}

      {footer}

      {zoom && url && (
        <div className="modal-wrap" style={{ padding: 0 }} onClick={() => setZoom(false)}>
          <div className="scrim" style={{ background: 'rgba(0,0,0,.92)' }} />
          <img src={url} alt="" style={{ position: 'relative', zIndex: 51, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', touchAction: 'pinch-zoom' }} />
        </div>
      )}
    </div>
  );
}
