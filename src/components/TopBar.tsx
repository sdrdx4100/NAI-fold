import type { LayoutMode } from '../hooks/useFoldLayout';
import { isMock } from '../lib/api';
import { imageModel } from '../lib/models';
import { useImages } from '../store/images';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { IconButton } from './ui';

export function TopBar({ mode }: { mode: LayoutMode }) {
  const generating = useImages((s) => s.generating);
  const count = useImages((s) => s.images.length);
  const setSideOpen = useUI((s) => s.setSideOpen);
  const openModal = useUI((s) => s.openModal);
  const api = useSettings((s) => s.api);
  const sub = useSettings((s) => s.subscription);
  const model = useSettings((s) => s.imageGen.model);
  const ui = useSettings((s) => s.ui);
  const setUI = useSettings((s) => s.setUI);
  const mock = isMock(api);

  return (
    <header className="topbar">
      <div className="title-btn" style={{ cursor: 'default' }}>
        <span className="title">NAI Fold</span>
        <span className="subtitle">{generating ? '生成中…' : `${imageModel(model).name} · ${count}枚`}</span>
      </div>
      <span className={`anlas${mock ? ' mock' : ''}`} title="Anlas">
        {mock ? 'MOCK' : sub ? `◆ ${sub.anlas.toLocaleString()}` : '◆ —'}
      </span>
      {(mode === 'dual' || mode === 'dual-v') && <IconButton icon="swap" label="左右を入れ替え" onClick={() => setUI({ swapPanes: !ui.swapPanes })} />}
      {mode === 'single' && <IconButton icon="sliders" label="プロンプト・設定" onClick={() => setSideOpen(true)} />}
      <IconButton icon="gear" label="設定" onClick={() => openModal('settings')} />
    </header>
  );
}
