import { useState } from 'react';
import type { FoldInfo } from '../hooks/useFoldLayout';
import { dbAll, dbClear } from '../lib/db';
import type { GeneratedImage } from '../lib/types';
import { downloadBlob, pickFile } from '../lib/util';
import { ensureNotificationPermission, GALLERY_ALBUM, isNative } from '../lib/native';
import { useImages } from '../store/images';
import { useSettings, type LayoutPref, type Theme } from '../store/settings';
import { toast, useUI } from '../store/ui';
import { Icon } from './Icon';
import { Field, Modal, Toggle } from './ui';

const LAYOUTS: { id: LayoutPref; name: string; mini: { cols?: string; rows?: string; n: number } }[] = [
  { id: 'auto', name: '自動', mini: { cols: '1fr 1fr', n: 2 } },
  { id: 'single', name: '1画面', mini: { cols: '1fr', n: 1 } },
  { id: 'dual', name: '左右 2画面', mini: { cols: '1fr 1fr', n: 2 } },
  { id: 'dual-v', name: '上下 2画面', mini: { rows: '1fr 1fr', n: 2 } },
  { id: 'triple', name: '3カラム', mini: { cols: '1fr 2fr 1.3fr', n: 3 } },
];

const THEMES: { id: Theme; name: string; colors: [string, string, string] }[] = [
  { id: 'nai', name: 'ネイビー', colors: ['#0e0f21', '#191b35', '#f5f3c2'] },
  { id: 'midnight', name: 'ミッドナイト', colors: ['#050608', '#12151c', '#9fd0ff'] },
  { id: 'sepia', name: 'セピア', colors: ['#2a2219', '#3a3025', '#f0c27a'] },
  { id: 'paper', name: 'ペーパー', colors: ['#f3f1ea', '#ffffff', '#3c3a8f'] },
];

export function SettingsModal({ fold }: { fold: FoldInfo }) {
  const close = () => useUI.getState().openModal(null);
  const api = useSettings((s) => s.api);
  const ui = useSettings((s) => s.ui);
  const setApi = useSettings((s) => s.setApi);
  const setUI = useSettings((s) => s.setUI);
  const sub = useSettings((s) => s.subscription);
  const refresh = useSettings((s) => s.refreshSubscription);
  const [showToken, setShowToken] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState<'account' | 'display' | 'data'>('account');

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const s = await refresh();
      setStatus({ ok: true, text: `接続OK — ${s?.tierName} · ${s?.anlas.toLocaleString()} Anlas` });
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal title="設定" onClose={close} footer={<button className="btn primary" onClick={close}>完了</button>}>
      <div className="tabs" style={{ margin: '-16px -16px 16px', background: 'transparent' }}>
        {(
          [
            ['account', 'アカウント・API'],
            ['display', '表示・レイアウト'],
            ['data', 'データ'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'account' && (
        <>
          <h3>NovelAI API</h3>
          <Field label="永続APIトークン" hint="NovelAI の アカウント設定 → Get Persistent API Token">
            <div className="row">
              <input
                className="input"
                type={showToken ? 'text' : 'password'}
                autoComplete="off"
                placeholder="pst-xxxxxxxx…"
                value={api.token}
                onChange={(e) => setApi({ token: e.target.value.trim(), mock: e.target.value.trim() ? false : api.mock })}
              />
              <button className="icon-btn" aria-label="表示切替" onClick={() => setShowToken((v) => !v)}>
                <Icon name="eye" size={18} />
              </button>
            </div>
          </Field>
          <p className="hint" style={{ marginTop: -6 }}>
            トークンはこの端末内（IndexedDB）にのみ保存され、NovelAI のAPI以外には送信されません。
          </p>
          <Toggle label="モックモード" desc="APIを呼ばずに疑似的な文章と画像で動作を確認します（トークン未設定時は常に有効）" checked={api.mock || !api.token} onChange={(v) => setApi({ mock: v })} />
          <div className="row" style={{ margin: '8px 0 12px' }}>
            <button className="btn" onClick={test} disabled={testing}>
              <Icon name="key" size={16} />
              {testing ? '確認中…' : '接続テスト'}
            </button>
            {sub && (
              <span className="hint">
                {sub.tierName} · {sub.anlas.toLocaleString()} Anlas
              </span>
            )}
          </div>
          {status && <div className={`status-line ${status.ok ? 'ok' : 'err'}`}>{status.text}</div>}
          <details>
            <summary className="label" style={{ cursor: 'pointer', marginBottom: 10 }}>
              エンドポイント（プロキシ利用時など）
            </summary>
            <Field label="API">
              <input className="input" value={api.apiBase} onChange={(e) => setApi({ apiBase: e.target.value })} />
            </Field>
            <Field label="画像生成">
              <input className="input" value={api.imageBase} onChange={(e) => setApi({ imageBase: e.target.value })} />
            </Field>
          </details>
        </>
      )}

      {tab === 'display' && (
        <>
          <h3>レイアウト</h3>
          <div className="layout-pick">
            {LAYOUTS.map((l) => (
              <button key={l.id} className={ui.layout === l.id ? 'on' : ''} onClick={() => setUI({ layout: l.id })}>
                <span className="mini" style={{ gridTemplateColumns: l.mini.cols, gridTemplateRows: l.mini.rows }}>
                  {Array.from({ length: l.mini.n }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
                {l.name}
              </button>
            ))}
          </div>
          <p className="hint">
            現在: <b>{fold.mode}</b>（{fold.width}×{fold.height}px / 判定: {fold.source}
            {fold.posture !== 'unknown' ? ` / 姿勢: ${fold.posture}` : ''}
            {fold.hinge ? ' / ヒンジ検出' : ''}）
          </p>
          <Toggle label="左右を入れ替え" desc="2画面時、画像ビューアと設定パネルの位置を入れ替えます" checked={ui.swapPanes} onChange={(v) => setUI({ swapPanes: v })} />

          <h3>テーマ</h3>
          <div className="layout-pick">
            {THEMES.map((t) => (
              <button key={t.id} className={ui.theme === t.id ? 'on' : ''} onClick={() => setUI({ theme: t.id })}>
                <span className="mini" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  {t.colors.map((c) => (
                    <i key={c} style={{ background: c, border: '1px solid #8884' }} />
                  ))}
                </span>
                {t.name}
              </button>
            ))}
          </div>

          <h3>アプリ版の機能</h3>
          {isNative() ? (
            <>
              <Toggle
                label="生成した画像を写真に自動保存"
                desc={`生成するたびに Pictures/${GALLERY_ALBUM} に保存します`}
                checked={ui.autoSaveGallery}
                onChange={(v) => setUI({ autoSaveGallery: v })}
              />
              <Toggle
                label="生成完了を通知"
                desc="生成中に別のアプリへ切り替えても、終わったら通知します"
                checked={ui.notifyOnDone}
                onChange={(v) => {
                  setUI({ notifyOnDone: v });
                  if (v)
                    void ensureNotificationPermission().then((ok) => {
                      if (!ok) toast('通知が許可されていません。端末の設定から NAI Fold の通知を許可してください', 'error');
                    });
                }}
              />
            </>
          ) : (
            <p className="hint">写真への直接保存と生成完了の通知は、Android アプリ版（APK）で使えます。</p>
          )}

          <h3>その他</h3>
          <Toggle label="触覚フィードバック" checked={ui.haptics} onChange={(v) => setUI({ haptics: v })} />
        </>
      )}

      {tab === 'data' && (
        <>
          <h3>バックアップ</h3>
          <p className="hint">生成設定と保存したプロンプト（APIトークンを除く）を書き出します。</p>
          <div className="row wrap" style={{ marginBottom: 16 }}>
            <button
              className="btn"
              onClick={() => {
                const st = useSettings.getState();
                const data = { naiFoldBackup: 2, at: Date.now(), ui: st.ui, imageGen: st.imageGen, promptPresets: st.promptPresets };
                void downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `nai-fold-settings-${new Date().toISOString().slice(0, 10)}.json`);
              }}
            >
              <Icon name="download" size={16} /> 設定を書き出し
            </button>
            <button
              className="btn"
              onClick={async () => {
                const f = await pickFile('.json,application/json');
                if (!f) return;
                try {
                  const j = JSON.parse(await f.text());
                  if (!j.naiFoldBackup) throw new Error('バックアップファイルではありません');
                  const st = useSettings.getState();
                  if (j.ui) st.setUI(j.ui);
                  if (j.imageGen) st.setImageGen({ ...j.imageGen, baseImageId: null });
                  for (const p of j.promptPresets ?? []) st.savePromptPreset(p);
                  toast('設定を復元しました', 'success');
                } catch (e) {
                  toast(`復元失敗: ${(e as Error).message}`, 'error');
                }
              }}
            >
              <Icon name="upload" size={16} /> 復元
            </button>
          </div>
          <h3>削除</h3>
          <div className="row wrap">
            <button
              className="btn danger"
              onClick={async () => {
                if (!confirm('生成した画像をすべて削除しますか？')) return;
                const imgs = await dbAll<GeneratedImage>('images');
                await dbClear('images');
                await dbClear('blobs');
                await useImages.getState().load();
                toast(`${imgs.length}枚の画像を削除しました`);
              }}
            >
              画像をすべて削除
            </button>
          </div>
          <h3>このアプリについて</h3>
          <p className="hint">
            NAI Fold は NovelAI の API を利用する非公式クライアントです。NovelAI 公式とは関係ありません。折りたたみスマホの左右2画面を活かし、画像を見ながらプロンプトと設定を同時に操作できるよう設計しています。
          </p>
        </>
      )}
    </Modal>
  );
}
