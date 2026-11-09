import { useCallback, useState } from 'react';
import { initialModuleTrail, openModule, previousModule, resetModuleScope, type ActiveTab, type ModuleTrail } from './moduleNavigation';

type Destination = ActiveTab | ((previous: ActiveTab) => ActiveTab);
type NavigationSession = { viewer: string | null; scope: string; trail: ModuleTrail; revision: number };
/** One navigation entry point for menus, dashboard cards and cross-module links. */
export function useModuleNavigation(viewer: string | null, workspace: string | undefined) {
  const scope = JSON.stringify([viewer, workspace || '']);
  const [session, setSession] = useState<NavigationSession>(() => ({ viewer, scope, trail: initialModuleTrail(), revision: 0 }));
  let active = session;
  if (session.scope !== scope) {
    active = { viewer, scope, trail: resetModuleScope(session.trail, !!viewer && session.viewer === viewer, !!viewer), revision: session.revision + 1 };
    // Reset before rendering children so another account never inherits this trail.
    setSession(active);
  }
  const navigate = useCallback((destination: Destination) => {
    // Capture before callers close menus or move the viewport; React may queue the update.
    const scrollY = window.scrollY;
    setSession(current => {
      if (current.scope !== scope) return current;
      const tab = typeof destination === 'function' ? destination(current.trail.current.tab) : destination;
      const trail = openModule(current.trail, tab, scrollY);
      return trail === current.trail ? current : { ...current, trail, revision: current.revision + 1 };
    });
  }, [scope]);
  const back = useCallback(() => setSession(current => current.scope !== scope ? current : { ...current, trail: previousModule(current.trail), revision: current.revision + 1 }), [scope]);
  const home = useCallback(() => setSession(current => current.scope !== scope ? current : { ...current, trail: initialModuleTrail(), revision: current.revision + 1 }), [scope]);
  return { activeTab: active.trail.current.tab, currentPage: active.trail.current, previousPage: active.trail.previous.at(-1)?.tab || 'dashboard' as ActiveTab, revision: active.revision, navigate, back, home, scope };
}
