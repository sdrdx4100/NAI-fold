import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useFoldLayout } from '../hooks/useFoldLayout';
import { isMock } from '../lib/api';
import { clamp } from '../lib/util';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { ImageControls } from './ImageControls';
import { GalleryGrid, ImageStudio } from './ImageStudio';
import { SettingsModal } from './SettingsModal';
import { Toasts } from './Toasts';
import { TopBar } from './TopBar';
import { IconButton } from './ui';

function ControlsPane({ onClose }: { onClose?: () => void }) {
  return (
    <>
      <div className="panel-head">
        <h2>プロンプト・生成設定</h2>
        {onClose && <IconButton icon="x" label="閉じる" onClick={onClose} />}
      </div>
      <div className="tab-body">
        <ImageControls />
      </div>
    </>
  );
}

export function Shell() {
  const ui = useSettings((s) => s.ui);
  const setUI = useSettings((s) => s.setUI);
  const api = useSettings((s) => s.api);
  const fold = useFoldLayout(ui.layout);
  const sideOpen = useUI((s) => s.sideOpen);
  const modal = useUI((s) => s.modal);
  const setSideOpen = useUI((s) => s.setSideOpen);
  const openModal = useUI((s) => s.openModal);
  const wsRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [mockHidden, setMockHidden] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = ui.theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#13152c');
  }, [ui.theme]);

  // the controls sheet only exists in the single (cover screen) layout
  useEffect(() => {
    if (fold.mode !== 'single') setSideOpen(false);
  }, [fold.mode, setSideOpen]);

  // Android back button closes overlays first
  useEffect(() => {
    if (!sideOpen && !modal) return;
    history.pushState({ overlay: true }, '');
    const onPop = () => {
      setSideOpen(false);
      openModal(null);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (history.state?.overlay) history.back();
    };
  }, [sideOpen, modal, setSideOpen, openModal]);

  const vertical = fold.mode === 'dual-v';
  const hingeLocked = !!fold.hinge;

  const onGutterDown = useCallback(
    (e: React.PointerEvent) => {
      if (hingeLocked) return;
      const ws = wsRef.current;
      if (!ws) return;
      (e.target as Element).setPointerCapture(e.pointerId);
      setDragging(true);
      const rect = ws.getBoundingClientRect();
      const move = (ev: PointerEvent) => {
        const r = vertical ? (ev.clientY - rect.top) / rect.height : (ev.clientX - rect.left) / rect.width;
        setUI({ splitRatio: clamp(r, 0.28, 0.72) });
      };
      const up = () => {
        setDragging(false);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [hingeLocked, vertical, setUI],
  );

  let style: CSSProperties = {};
  if (fold.mode === 'dual' || fold.mode === 'dual-v') {
    if (fold.hinge && 'x' in fold.hinge) style = { ['--split' as string]: `${fold.hinge.x}px`, ['--gutter' as string]: `${fold.hinge.width}px` };
    else if (fold.hinge && 'y' in fold.hinge)
      style = { ['--split' as string]: `${fold.hinge.y - (wsRef.current?.getBoundingClientRect().top ?? 0)}px`, ['--gutter' as string]: `${fold.hinge.height}px` };
    else style = { ['--split' as string]: `calc(${ui.splitRatio * 100}% - 5px)` };
  }

  let panes: ReactNode;
  if (fold.mode === 'single') {
    panes = (
      <section className="pane main">
        <ImageStudio compact />
      </section>
    );
  } else if (fold.mode === 'triple') {
    panes = (
      <>
        <aside className="pane library">
          <div className="panel-head">
            <h2>ギャラリー</h2>
          </div>
          <GalleryGrid />
        </aside>
        <section className="pane main">
          <ImageStudio showStrip={false} />
        </section>
        <aside className="pane side">
          <ControlsPane />
        </aside>
      </>
    );
  } else {
    const a = (
      <section className="pane main" key="main">
        <ImageStudio />
      </section>
    );
    const b = (
      <aside className="pane side" key="side">
        <ControlsPane />
      </aside>
    );
    const gutter = (
      <div
        key="gutter"
        className={`gutter${hingeLocked ? ' hinge' : ' draggable'}${dragging ? ' dragging' : ''}`}
        onPointerDown={onGutterDown}
        onDoubleClick={() => setUI({ splitRatio: 0.5 })}
        role="separator"
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        aria-label="ペインの境界（ドラッグで調整）"
      >
        {!hingeLocked && <span className="grip" />}
      </div>
    );
    panes = ui.swapPanes ? [b, gutter, a] : [a, gutter, b];
  }

  return (
    <div className="app">
      <TopBar mode={fold.mode} />
      {isMock(api) && !mockHidden && (
        <div className="mock-banner" role="status">
          <span>モックモード：APIトークン未設定のため疑似生成で動作中</span>
          <button onClick={() => openModal('settings')}>トークンを設定</button>
          <button style={{ marginLeft: 8 }} aria-label="閉じる" onClick={() => setMockHidden(true)}>
            ×
          </button>
        </div>
      )}
      <div ref={wsRef} className={`workspace ${fold.mode}`} style={style} data-layout={fold.mode}>
        {panes}
      </div>

      {sideOpen && fold.mode === 'single' && (
        <>
          <div className="scrim" onClick={() => setSideOpen(false)} />
          <aside className="drawer right">
            <ControlsPane onClose={() => setSideOpen(false)} />
          </aside>
        </>
      )}
      {modal === 'settings' && <SettingsModal fold={fold} />}
      <Toasts />
    </div>
  );
}
