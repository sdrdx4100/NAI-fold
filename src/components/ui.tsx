import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Slider(props: {
  name: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  desc?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const { name, value, min, max, step = 0.01, desc, onChange, format } = props;
  const [text, setText] = useState(String(value));
  useEffect(() => setText(format ? format(value) : String(value)), [value, format]);
  const pct = ((value - min) / (max - min)) * 100;
  const id = useId();
  return (
    <div className="slider">
      <div className="top">
        <label className="name" htmlFor={id}>
          {name}
        </label>
        <input
          className="val"
          inputMode="decimal"
          value={text}
          aria-label={`${name} の値`}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = Number(text);
            if (Number.isFinite(n)) onChange(n);
            else setText(String(value));
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        style={{ ['--p' as string]: `${Math.min(100, Math.max(0, pct))}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {desc && <div className="desc">{desc}</div>}
    </div>
  );
}

export function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span className="txt">
        <b>{label}</b>
        {desc && <small>{desc}</small>}
      </span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
    </label>
  );
}

export function Section({ title, children, defaultOpen = true, right }: { title: string; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  return (
    <details className="section" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <span className="row">
          {right}
          <Icon name="chev" size={18} style={{}} />
        </span>
      </summary>
      <div className="body">{children}</div>
    </details>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function IconButton(props: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  badge?: number | string;
  size?: number;
}) {
  return (
    <button className={`icon-btn${props.active ? ' active' : ''}`} onClick={props.onClick} disabled={props.disabled} aria-label={props.label} title={props.label}>
      <Icon name={props.icon} size={props.size ?? 20} />
      {props.badge ? <span className="badge">{props.badge}</span> : null}
    </button>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <div className="scrim" onClick={onClose} />
      <div className="modal">
        <div className="panel-head">
          <h2>{title}</h2>
          <IconButton icon="x" label="閉じる" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Auto-growing textarea bound to a value. */
export function AutoTextarea(props: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; className?: string; mono?: boolean }) {
  return (
    <textarea
      className={`textarea ${props.className ?? ''}`}
      value={props.value}
      rows={props.rows ?? 4}
      placeholder={props.placeholder}
      spellCheck={false}
      style={props.mono ? { fontFamily: 'var(--font-mono)', fontSize: 13 } : undefined}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}
