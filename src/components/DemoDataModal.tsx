import React, { useEffect, useState } from 'react';
import { X, Download, Upload, Sparkles, Database } from 'lucide-react';
import { applyDemoPackages, buildDemoPackages, CESAR_MUNICIPALITIES, readDemoPackage, type DemoPackage } from '../data/demoPackages';
import type { DemoBundle } from '../data/demoSeed';

interface Props {
  tenantId: string;
  tenantName: string;
  municipality: string;
  allowDepartment: boolean;
  canManage: boolean;
  realCount: number;
  bundle: DemoBundle | null;
  onClose: () => void;
  onAudit: () => void;
  onSave: (bundle: DemoBundle) => Promise<void>;
  onDelete: () => Promise<void>;
}
export function DemoDataModal(props: Props) {
  const [scope, setScope] = useState(props.municipality || (props.allowDepartment ? 'Cesar' : ''));
  const [packages, setPackages] = useState<DemoPackage[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const disabled = busy || !props.canManage || props.realCount > 0 || !scope;
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) props.onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [busy, props.onClose]);
  const run = async (items: DemoPackage[]) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const next = applyDemoPackages(items, props.tenantId, scope, props.bundle);
      await props.onSave(next);
      setMessage(`Guardado · ${next.expenses.length} gastos · ${next.voters.length} personas ficticias`);
      setPackages([]);
    } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible guardar.'); }
    finally { setBusy(false); }
  };
  const upload = async (files: FileList | null) => {
    setError(''); setMessage(''); setPackages([]);
    if (!files?.length) return;
    setBusy(true);
    try {
      if (files.length > 2 || Array.from(files).some(f => f.size > 2_000_000)) throw new Error('Seleccione hasta dos paquetes JSON de máximo 2 MB cada uno.');
      const parsed = await Promise.all(Array.from(files).map(async f => readDemoPackage(JSON.parse(await f.text()))));
      if (new Set(parsed.map(p => p.packageId)).size !== parsed.length) throw new Error('Seleccione un solo archivo de cada paquete.');
      applyDemoPackages(parsed, props.tenantId, scope, props.bundle);
      setPackages(parsed);
    } catch (e) { setError(e instanceof Error ? e.message : 'Archivo no válido.'); }
    finally { setBusy(false); }
  };
  const download = (p: DemoPackage) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `astrea-demo-${p.packageId}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onClick={() => !busy && props.onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="demo-data-title" className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 text-slate-200 shadow-2xl" onClick={e => e.stopPropagation()}>
      <header className="flex items-center justify-between gap-2"><div><h2 id="demo-data-title" className="font-bold">Datos · {props.tenantName}</h2><p className="text-xs text-slate-400">{props.realCount ? `${props.realCount} registros reales` : 'Sin registros reales'}{props.bundle ? ' · Demo guardada' : ''}</p></div><button autoFocus disabled={busy} onClick={props.onClose} aria-label="Cerrar datos" className="p-2"><X className="h-5 w-5" /></button></header>
      <label className="grid gap-1 text-xs">Ámbito de la demostración<select disabled={busy || !!props.municipality} value={scope} onChange={e => { setScope(e.target.value); setPackages([]); }} className="min-h-11 rounded-lg border border-slate-700 bg-slate-950 px-3"><option value="">Seleccione municipio</option>{props.allowDepartment && <option value="Cesar">Cesar · 25 municipios</option>}{CESAR_MUNICIPALITIES.map(m => <option key={m}>{m}</option>)}</select></label>
      <button disabled={disabled} onClick={() => run(buildDemoPackages())} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 font-bold text-white disabled:opacity-40"><Sparkles className="h-4 w-4" />{busy ? 'Procesando…' : props.bundle ? 'Regenerar datos simulados' : 'Simular todos los datos'}</button>
      <p className="text-xs text-amber-200">Personas, costos y censo electoral ficticios. Uso exclusivo de demostración.</p>
      {props.realCount > 0 && <p className="text-xs text-slate-400">La simulación está deshabilitada porque ya existen registros reales.</p>}
      {!props.canManage && <p className="text-xs text-slate-400">Solo un administrador puede guardar la demostración.</p>}
      <div className="grid gap-2 sm:grid-cols-2">{buildDemoPackages().map(p => <button key={p.packageId} onClick={() => download(p)} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs"><Download className="h-4 w-4" />{p.packageId === 'costos' ? 'Costos · JSON' : 'Capital humano · JSON'}</button>)}</div>
      <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs ${disabled ? 'opacity-40' : ''}`}><Upload className="h-4 w-4" />Importar paquetes demo<input aria-label="Importar paquetes demo" type="file" accept=".json,application/json" multiple disabled={disabled} className="min-w-0 flex-1 text-xs" onChange={e => { void upload(e.target.files); e.target.value = ''; }} /></label>
      {packages.length > 0 && <div className="rounded-lg border border-cyan-900 p-3 text-xs"><p>{packages.map(p => p.packageId).join(' + ')} · Solo {scope}</p><button disabled={disabled} onClick={() => run(packages)} className="mt-2 min-h-10 rounded-lg bg-emerald-700 px-4 font-bold">Guardar demo en Firestore</button></div>}
      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}{message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
      <footer className="flex items-center justify-between border-t border-slate-800 pt-3"><button disabled={busy} onClick={props.onAudit} className="flex min-h-10 items-center gap-2 text-xs text-cyan-300"><Database className="h-4 w-4" />Estado de conexión</button>{props.bundle && props.canManage && <button disabled={busy} className="min-h-10 text-xs text-rose-300" onClick={async () => { setBusy(true); setError(''); try { await props.onDelete(); setMessage('Demo eliminada.'); } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar.'); } finally { setBusy(false); } }}>Eliminar demo</button>}</footer>
    </section>
  </div>;
}
