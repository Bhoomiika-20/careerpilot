import { useEffect, useState } from 'react';
import { LoaderCircle, AlertCircle, X, ExternalLink } from 'lucide-react';
import { api, errorText } from '../services/api';
export function useData(path) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [version, setVersion] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(''); api.get(path).then(r => active && setData(r.data)).catch(e => active && setError(errorText(e))).finally(() => active && setLoading(false)); return () => { active = false; }; }, [path, version]);
  return { data, setData, error, loading, reload: () => setVersion(v => v + 1) };
}
export function Loading() { return <div className="loading"><LoaderCircle className="spin" size={22}/> Loading your workspace…</div>; }
export function ErrorBox({ error }) { return error ? <div role="alert" className="error"><AlertCircle size={18}/><span>{error}</span></div> : null; }
export function Empty({ title, children }) { return <div className="empty"><h3>{title}</h3><p>{children}</p></div>; }
export function PageHeader({ title, subtitle, children }) { return <header className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{children}</header>; }
export function Badge({ children, tone = '' }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function DemoBadge() { return <Badge tone="demo">Demo opportunity</Badge>; }
export function Modal({ title, children, close }) { useEffect(() => { const fn = e => e.key === 'Escape' && close(); document.addEventListener('keydown', fn); return () => document.removeEventListener('keydown', fn); }, [close]); return <div className="modal-backdrop" onClick={close}><section role="dialog" aria-modal="true" aria-label={title} className="modal" onClick={e => e.stopPropagation()}><div className="row spread"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X/></button></div>{children}</section></div>; }
export function SafeLink({ url, children }) { return /^https?:\/\//i.test(url || '') ? <a className="text-link" href={url} target="_blank" rel="noreferrer">{children}<ExternalLink size={14}/></a> : null; }
export function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
export function useAction() { const [error, setError] = useState(''), [busy, setBusy] = useState(false); const act = async fn => { setError(''); setBusy(true); try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }; return { error, busy, act, setError }; }
