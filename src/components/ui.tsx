import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { topic, TOPICS } from '../lib/learn';

// ---------------- 路由（hash，Android 返回鍵可用） ----------------
export interface Route { page: string; arg?: string }
export function parseHash(): Route {
  const [page, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  return { page: page || 'market', arg: rest.join('/') || undefined };
}
export function go(page: string, arg?: string) {
  location.hash = `#/${page}${arg ? '/' + encodeURIComponent(arg) : ''}`;
}
export function useRoute() {
  const [r, setR] = useState(parseHash());
  useEffect(() => {
    const f = () => { setR(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

// ---------------- 全域 UI：說明視窗、提示訊息 ----------------
interface Toast { id: number; text: string; kind: 'ok' | 'err' | 'info' }
interface UiCtx { help: (id: string) => void; toast: (text: string, kind?: Toast['kind']) => void }
const Ctx = createContext<UiCtx>({ help: () => {}, toast: () => {} });
export const useUi = () => useContext(Ctx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [helpId, setHelpId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = (text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 5000 : 3000);
  };
  return (
    <Ctx.Provider value={{ help: setHelpId, toast }}>
      {children}
      {helpId && <HelpModal id={helpId} onClose={() => setHelpId(null)} onGo={setHelpId} />}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function TopicView({ id, onGo }: { id: string; onGo?: (id: string) => void }) {
  const t = topic(id);
  if (!t) return null;
  const related = TOPICS.filter((x) => x.cat === t.cat && x.id !== t.id).slice(0, 4);
  return (
    <div className="topic">
      <p className="lead">{t.short}</p>
      {t.formula && <pre className="formula">{t.formula}</pre>}
      {t.body.map((b, i) => <p key={i}>{b}</p>)}
      {t.tips?.map((b, i) => <p key={i} className="tip">💡 {b}</p>)}
      {onGo && related.length > 0 && (
        <div className="related">
          相關：{related.map((r) => <button key={r.id} className="link" onClick={() => onGo(r.id)}>{r.title}</button>)}
        </div>
      )}
    </div>
  );
}

function HelpModal({ id, onClose, onGo }: { id: string; onClose: () => void; onGo: (id: string) => void }) {
  const t = topic(id);
  return (
    <Modal title={t?.title || ''} onClose={onClose}>
      <TopicView id={id} onGo={onGo} />
    </Modal>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="關閉">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** 小問號：點了打開學習主題 */
export function Help({ id }: { id: string }) {
  const { help } = useUi();
  return (
    <button className="help" onClick={(e) => { e.stopPropagation(); help(id); }} title="這是什麼？">?</button>
  );
}

export function Stat({ label, value, help, className }: { label: string; value: ReactNode; help?: string; className?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}{help && <Help id={help} />}</div>
      <div className={`stat-value ${className || ''}`}>{value}</div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, small }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; small?: boolean;
}) {
  return (
    <div className={`seg ${small ? 'small' : ''}`}>
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}
