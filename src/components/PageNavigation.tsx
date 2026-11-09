import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { MODULE_LABELS, type ActiveTab, type PageEntry } from '../lib/moduleNavigation';

type LocalBack = { id: string; label: string; onBack: () => void; priority: number; disabled: boolean; pageKey: string };
const RegisterBack = createContext<((entry: Omit<LocalBack, 'pageKey'>) => () => void) | null>(null);
const CurrentBack = createContext<LocalBack | undefined>(undefined);
const StatusHeight = createContext(0);

/** Wrap the shared shell once. Inner pages can declare a more specific return target. */
export function PageNavigationProvider({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const [entries, setEntries] = useState<LocalBack[]>([]);
  const [statusHeight, setStatusHeight] = useState(0);
  useLayoutEffect(() => {
    const banner = document.querySelector<HTMLElement>('[data-page-status-banner]');
    const measure = () => setStatusHeight(banner?.getBoundingClientRect().height || 0);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (banner) observer?.observe(banner);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const register = useCallback((entry: Omit<LocalBack, 'pageKey'>) => {
    setEntries(previous => [...previous.filter(item => item.id !== entry.id), { ...entry, pageKey }]);
    return () => setEntries(previous => previous.filter(item => item.id !== entry.id));
  }, [pageKey]);
  const current = useMemo(() => entries.filter(entry => entry.pageKey === pageKey).sort((a, b) => a.priority - b.priority).at(-1), [entries, pageKey]);
  return <RegisterBack.Provider value={register}><CurrentBack.Provider value={current}><StatusHeight.Provider value={statusHeight}>{children}</StatusHeight.Provider></CurrentBack.Provider></RegisterBack.Provider>;
}

/** Declare this in a nested detail/form so shared Back closes it before leaving its module. */
export function usePageBack(label: string, onBack: () => void, enabled = true, priority = 10, disabled = false) {
  const register = useContext(RegisterBack), id = useId(), handler = useRef(onBack);
  handler.current = onBack;
  useEffect(() => enabled && register ? register({ id, label, priority, disabled, onBack: () => handler.current() }) : undefined, [register, id, label, enabled, priority, disabled]);
}

export function PageNavigationBar({ current, previous, onBack, onHome }: { current: ActiveTab; previous: ActiveTab; onBack: () => void; onHome: () => void }) {
  const local = useContext(CurrentBack), statusHeight = useContext(StatusHeight);
  if (current === 'dashboard' && !local) return null;
  const target = local?.label || MODULE_LABELS[previous];
  return <nav aria-label="Navegación de página" style={{ top: `calc(4rem + ${statusHeight}px)` }} className="sticky z-20 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-lg">
    <button type="button" aria-label={`Volver a ${target}`} title={`Volver a ${target}`} disabled={local?.disabled} onClick={local?.onBack || onBack} className="inline-flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-cyan-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-50">
      <ArrowLeft size={18} className="shrink-0" /><span>Volver</span><span className="hidden min-w-0 truncate text-slate-300 sm:inline">a {target}</span>
    </button>
    <button type="button" onClick={onHome} aria-label="Ir al tablero principal" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg border border-slate-600 px-3 text-sm font-semibold text-slate-100 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-300"><LayoutDashboard size={18} aria-hidden="true" />Tablero principal</button>
  </nav>;
}

/** Mount inside Suspense so returning restores position after the destination actually loads. */
export function PageScrollRestoration({ page, revision }: { page: PageEntry; revision: number }) {
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('main.app-content')?.focus({ preventScroll: true });
      window.scrollTo({ top: page.scrollY, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [page.tab, page.scrollY, revision]);
  return null;
}
