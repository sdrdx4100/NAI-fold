import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildContext } from '../lib/context';
import { canUndo, redoChildren } from '../lib/history';
import { segmentsText } from '../lib/segments';
import { useSettings } from '../store/settings';
import { useStories } from '../store/stories';
import { Icon } from './Icon';
import { IconButton } from './ui';

const STARTERS = [
  { label: 'ファンタジー', text: '王都の鐘が三度鳴ったとき、見習い魔術師のリナは、禁書庫の扉がわずかに開いていることに気づいた。' },
  { label: 'SF', text: '軌道ステーション〈アマテラス〉の管制AIが沈黙してから、ちょうど七十二時間が経過していた。' },
  { label: 'ミステリー', text: '雨の夜、古い洋館の書斎で見つかったのは、内側から鍵のかかった部屋と、止まったままの柱時計だった。' },
  { label: '日常', text: '春休み最後の日、僕は商店街の外れにある小さな喫茶店で、もう一度だけ彼女に会うことにした。' },
  { label: 'English', text: 'The lighthouse keeper had not seen a ship in eleven years, so when the lamp flickered twice and went dark, she knew something was coming.' },
];

export function StoryEditor() {
  const current = useStories((s) => s.current);
  const generating = useStories((s) => s.generating);
  const setText = useStories((s) => s.setText);
  const commitEdit = useStories((s) => s.commitEdit);
  const generate = useStories((s) => s.generate);
  const create = useStories((s) => s.create);
  const ui = useSettings((s) => s.ui);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const text = useMemo(() => (current ? segmentsText(current.segments) : ''), [current]);

  const resize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    resize();
    if (stickRef.current && generating) {
      const sc = scrollRef.current;
      if (sc) sc.scrollTop = sc.scrollHeight;
    }
  }, [text, resize, generating, ui.fontSize, ui.lineHeight, ui.editorFont]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const ro = new ResizeObserver(() => resize());
    ro.observe(ta.parentElement!);
    return () => ro.disconnect();
  }, [resize]);

  // Jump to the end when a different story is opened.
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    requestAnimationFrame(() => {
      sc.scrollTop = sc.scrollHeight;
      stickRef.current = true;
    });
  }, [current?.id]);

  const onScroll = () => {
    const sc = scrollRef.current;
    if (!sc) return;
    // keep auto-scroll if the user is near the end of the text
    stickRef.current = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 240;
  };

  return (
    <div
      className={`editor-wrap${ui.highlight ? '' : ' hl-off'}`}
      style={{
        ['--editor-font' as string]: ui.editorFont === 'serif' ? 'var(--font-serif)' : ui.editorFont === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
        ['--editor-size' as string]: `${ui.fontSize}px`,
        ['--editor-lh' as string]: String(ui.lineHeight),
      }}
    >
      <div className="editor-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="editor-stack">
          <div className="editor-hl" aria-hidden="true">
            {current?.segments.map((s, i) => (
              <span key={i} className={`seg-${s.origin}`}>
                {s.text}
              </span>
            ))}
            {generating && <span className="caret-gen" />}
            {/* trailing char keeps heights equal when text ends with a newline */}
            {'​'}
          </div>
          <textarea
            ref={taRef}
            className="editor-input"
            value={text}
            readOnly={generating}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="sentences"
            aria-label="ストーリー本文"
            placeholder=""
            onChange={(e) => {
              if (!current) {
                void create().then(() => setText(e.target.value));
                return;
              }
              setText(e.target.value);
            }}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                void generate();
              }
            }}
          />
          {!text && !generating && (
            <div className="empty-story">
              <h3>物語を始めましょう</h3>
              <div>ここに書き出しを入力して「送信」を押すと、AIが続きを書きます。</div>
              <div className="starters">
                {STARTERS.map((s) => (
                  <button
                    key={s.label}
                    className="chip"
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={() => {
                      const go = async () => {
                        if (!useStories.getState().current) await create({ title: s.label });
                        useStories.getState().appendUserText(s.text);
                        taRef.current?.focus();
                      };
                      void go();
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <ActionBar />
    </div>
  );
}

function ActionBar() {
  const current = useStories((s) => s.current);
  const generating = useStories((s) => s.generating);
  const generate = useStories((s) => s.generate);
  const stop = useStories((s) => s.stop);
  const undo = useStories((s) => s.undo);
  const redo = useStories((s) => s.redo);
  const appendUserText = useStories((s) => s.appendUserText);
  const ui = useSettings((s) => s.ui);
  const [menu, setMenu] = useState(false);
  const [input, setInput] = useState('');

  const ctx = useMemo(() => (current && ui.showTokens ? buildContext(current) : null), [current, ui.showTokens]);
  const kids = current ? redoChildren(current.history) : [];
  const chars = current ? segmentsText(current.segments).length : 0;

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        undo();
      } else if ((e.key === 'y' || (e.key === 'z' && e.shiftKey)) && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        redo();
      } else if (e.key === 'r' && e.shiftKey) {
        e.preventDefault();
        void generate({ retry: true });
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [undo, redo, generate]);

  const send = () => {
    if (generating) return stop();
    if (ui.inputBox && input.trim()) {
      const cur = useStories.getState().current;
      const prev = cur ? segmentsText(cur.segments) : '';
      const sep = prev && !/\s$/.test(prev) ? '\n' : '';
      appendUserText(sep + input);
      setInput('');
    }
    void generate();
  };

  const parentLen = current ? segmentsText(current.history.nodes[current.history.currentId]?.segments ?? []).length : 0;

  return (
    <>
      {ui.inputBox && (
        <div className="input-box">
          <textarea
            value={input}
            placeholder="続きを入力…（空のまま送信でAIが続行）"
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (ui.sendOnEnter && !e.shiftKey && !e.nativeEvent.isComposing))) {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>
      )}
      <div className="actionbar">
        <IconButton icon="undo" label="元に戻す" onClick={undo} disabled={!current || generating || !canUndo(current.history)} />
        <div style={{ position: 'relative' }}>
          <IconButton
            icon="redo"
            label={kids.length > 1 ? `やり直し（${kids.length}件の分岐）` : 'やり直し'}
            onClick={() => (kids.length > 1 ? setMenu((v) => !v) : redo())}
            disabled={generating || kids.length === 0}
            badge={kids.length > 1 ? kids.length : undefined}
          />
          {menu && kids.length > 1 && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenu(false)} />
              <div className="popover" role="menu">
                <h4>分岐を選択（{kids.length}件）</h4>
                {[...kids].reverse().map((k, i) => {
                  const t = segmentsText(k.segments).slice(parentLen).trim();
                  return (
                    <button
                      key={k.id}
                      className="item"
                      onClick={() => {
                        redo(k.id);
                        setMenu(false);
                      }}
                    >
                      {t.slice(0, 120) || '（変更なし）'}
                      <small>
                        {i === 0 ? '最新 · ' : ''}
                        {k.kind === 'edit' ? '編集' : k.kind === 'retry' ? 'リトライ' : '生成'} · {new Date(k.at).toLocaleTimeString()}
                      </small>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <IconButton icon="retry" label="リトライ" onClick={() => void generate({ retry: true })} disabled={!current || generating} />
        <div className="meta" aria-live="polite">
          {generating ? (
            <span style={{ color: 'var(--accent)' }}>生成中…</span>
          ) : ctx ? (
            <>
              ≈{ctx.tokens.toLocaleString()} / {ctx.budget.toLocaleString()} tok · {chars.toLocaleString()}字
              {ctx.activeLore.length ? ` · ロア${ctx.activeLore.length}` : ''}
            </>
          ) : (
            `${chars.toLocaleString()}字`
          )}
        </div>
        <button className={`send-btn${generating ? ' stop' : ''}`} onClick={send} aria-label={generating ? '停止' : '送信'}>
          {generating ? <Icon name="stop" size={18} filled /> : <Icon name="send" size={18} />}
          <span>{generating ? '停止' : '送信'}</span>
        </button>
      </div>
    </>
  );
}
