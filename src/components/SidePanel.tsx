import { useEffect, useRef } from 'react';
import { useStories } from '../store/stories';
import { useUI, type SideTab } from '../store/ui';
import { ContextTab } from './ContextTab';
import { GenTab } from './GenTab';
import { Icon } from './Icon';
import { ImageControls } from './ImageControls';
import { LibraryPanel } from './LibraryPanel';
import { LoreTab } from './LoreTab';
import { StoryTab } from './StoryTab';
import { IconButton } from './ui';

export function SidePanel({ withLibrary, onClose }: { withLibrary?: boolean; onClose?: () => void }) {
  const tab = useUI((s) => s.sideTab);
  const setTab = useUI((s) => s.setSideTab);
  const loreCount = useStories((s) => s.current?.lorebook.length ?? 0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const tabs: { id: SideTab; label: string; icon: string; count?: number }[] = [
    ...(withLibrary ? [{ id: 'library' as SideTab, label: 'ライブラリ', icon: 'book' }] : []),
    { id: 'story', label: 'ストーリー', icon: 'feather' },
    { id: 'lore', label: 'ロアブック', icon: 'globe', count: loreCount },
    { id: 'gen', label: '生成設定', icon: 'sliders' },
    { id: 'context', label: 'コンテキスト', icon: 'eye' },
    { id: 'image', label: '画像生成', icon: 'image' },
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : 'story';

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [active]);

  return (
    <>
      <div className="row" style={{ background: 'var(--bg1)' }}>
        <div className="tabs side-tabs grow" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={15} />
              {t.label}
              {t.count ? <span className="count">{t.count}</span> : null}
            </button>
          ))}
        </div>
        {onClose && <IconButton icon="x" label="閉じる" onClick={onClose} />}
      </div>
      <div className="tab-body" ref={bodyRef} role="tabpanel">
        {active === 'library' && <LibraryPanel showHead={false} />}
        {active === 'story' && <StoryTab />}
        {active === 'lore' && <LoreTab />}
        {active === 'gen' && <GenTab />}
        {active === 'context' && <ContextTab />}
        {active === 'image' && <ImageControls />}
      </div>
    </>
  );
}
