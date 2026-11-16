import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { MODULE_LABELS, type ActiveTab, type PageEntry } from '../lib/moduleNavigation';

type LocalBack = { id: string; label: string; onBack: () => void; priority: number; disabled: boolean; pageKey: string };
const RegisterBack = createContext<((entry: Omit<LocalBack, 'pageKey'>) => () => void) | null>(null);
const CurrentBack = createContext<LocalBack | undefined>(undefined);

/** Wrap the shared shell once. Inner pages can declare a more specific return target. */
export function PageNavigationProvider({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const [entries, setEntries] = useState<LocalBack[]>([]);
  const register = useCallback((entry: Omit<LocalBack, 'pageKey'>) => {
    setEntries(previous => [...previous.filter(item => item.id !== entry.id), { ...entry, pageKey }]);
    return () => setEntries(previous => previous.filter(item => item.id !== entry.id));
  }, [pageKey]);
  const current = useMemo(() => entries.filter(entry => entry.pageKey === pageKey).sort((a, b) => a.priority - b.priority).at(-1), [entries, pageKey]);
  return <RegisterBack.Provider value={register}><CurrentBack.Provider value={current}>{children}</CurrentBack.Provider></RegisterBack.Provider>;
}

/** Declare this in a nested detail/form so shared Back closes it before leaving its module. */
export function usePageBack(label: string, onBack: () => void, enabled = true, priority = 10, disabled = false) {
  const register = useContext(RegisterBack), id = useId(), handler = useRef(onBack);
  handler.current = onBack;
  useEffect(() => enabled && register ? register({ id, label, priority, disabled, onBack: () => handler.current() }) : undefined, [register, id, label, enabled, priority, disabled]);
}

export function PageNavigationBar({current,previous,onBack,onHome,children}:{current:ActiveTab;previous:ActiveTab;onBack:()=>void;onHome:()=>void;children?:React.ReactNode}){
 const local=useContext(CurrentBack);if(current==='dashboard'&&!local)return null;
 const target=local?.label||MODULE_LABELS[previous];
 return <div className="app-page-toolbar"><nav aria-label="Navegación de página" className="app-page-back"><button type="button" aria-label={`Volver a ${target}`} title={`Volver a ${target}`} disabled={local?.disabled} onClick={local?.onBack||onBack}><ArrowLeft size={18}/><span className="hidden sm:inline">Volver</span></button><button type="button" onClick={onHome} aria-label="Ir al tablero principal" title="Tablero principal"><LayoutDashboard size={18}/></button></nav>{children}</div>;
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
