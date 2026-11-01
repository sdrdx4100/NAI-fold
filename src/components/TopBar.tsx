import type { LayoutMode } from '../hooks/useFoldLayout';
import { isMock } from '../lib/api';
import { useSettings } from '../store/settings';
import { useStories } from '../store/stories';
import { useUI } from '../store/ui';
import { Icon } from './Icon';
import { IconButton } from './ui';

export function TopBar({ mode }: { mode: LayoutMode }) {
  const story = useStories((s) => s.current);
  const generating = useStories((s) => s.generating);
  const mainMode = useUI((s) => s.mode);
  const setMode = useUI((s) => s.setMode);
  const setLibraryOpen = useUI((s) => s.setLibraryOpen);
  const setSideOpen = useUI((s) => s.setSideOpen);
  const setSideTab = useUI((s) => s.setSideTab);
  const openModal = useUI((s) => s.openModal);
  const api = useSettings((s) => s.api);
  const sub = useSettings((s) => s.subscription);
  const ui = useSettings((s) => s.ui);
  const setUI = useSettings((s) => s.setUI);
  const mock = isMock(api);

  return (
    <header className="topbar">
      {mode !== 'triple' && <IconButton icon="menu" label="ライブラリ" onClick={() => setLibraryOpen(true)} />}
      {mode === 'triple' && <span className="brand">NAI Fold</span>}
      <button
        className="title-btn"
        onClick={() => {
          setSideTab('story');
          if (mode === 'single') setSideOpen(true);
        }}
        aria-label="ストーリー設定を開く"
      >
        <span className="title">{mainMode === 'image' ? 'イメージスタジオ' : (story?.title ?? 'NAI Fold')}</span>
        <span className="subtitle">
          {generating ? '生成中…' : mainMode === 'image' ? 'Image Generation' : story ? `${story.gen.model}` : 'ストーリーを作成してください'}
        </span>
      </button>
      <div className="segmented" role="group" aria-label="モード">
        <button aria-pressed={mainMode === 'story'} onClick={() => setMode('story')}>
          <Icon name="feather" size={15} />
          <span className="lbl">文章</span>
        </button>
        <button
          aria-pressed={mainMode === 'image'}
          onClick={() => {
            setMode('image');
            if (mode !== 'single') setSideTab('image');
          }}
        >
          <Icon name="image" size={15} />
          <span className="lbl">画像</span>
        </button>
      </div>
      {mode !== 'single' && (
        <span className={`anlas${mock ? ' mock' : ''}`} title="Anlas">
          {mock ? 'MOCK' : sub ? `◆ ${sub.anlas.toLocaleString()}` : '◆ —'}
        </span>
      )}
      {(mode === 'dual' || mode === 'dual-v') && <IconButton icon="swap" label="左右を入れ替え" onClick={() => setUI({ swapPanes: !ui.swapPanes })} />}
      {mode === 'single' && <IconButton icon="sliders" label="パネル" onClick={() => setSideOpen(true)} />}
      <IconButton icon="gear" label="設定" onClick={() => openModal('settings')} />
    </header>
  );
}
