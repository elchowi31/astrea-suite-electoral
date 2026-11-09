/** Every application module belongs here and inherits the shared page navigation. */
export const MODULE_LABELS = {
  dashboard: 'Tablero principal', campaign_structure: 'Equipo y comités', hierarchy_pyramid: 'Base territorial',
  leaders: 'Líderes y metas', map: 'Mapa territorial', routes: 'Recorridos y seguimiento', device: 'Mi dispositivo',
  transport: 'Transporte', rewards: 'Recompensas', data_imports: 'Bases de datos', resources: 'Solicitudes y jornadas',
  passengers: 'Pasajeros y eventos', reward_draws: 'Sorteos gratuitos', users: 'Usuarios y accesos',
  finances: 'Finanzas y aportes', costs_report: 'Control de gastos', candidates: 'Candidaturas',
  districts: 'Territorios y censo', proposals: 'Programa y propuestas', workspace: 'Google Workspace',
  drive: 'Archivo documental', tenants: 'Organizaciones', zone_projections: 'Proyección territorial',
  simulator: 'Simulador electoral', ai: 'Asistente de análisis', login: 'Mi cuenta',
} as const;
export type ActiveTab = keyof typeof MODULE_LABELS;
export type PageEntry = { tab: ActiveTab; scrollY: number };
export type ModuleTrail = { current: PageEntry; previous: PageEntry[] };
export const MAX_PREVIOUS_PAGES = 40;
export const initialModuleTrail = (tab: ActiveTab = 'dashboard'): ModuleTrail => ({ current: { tab, scrollY: 0 }, previous: [] });
const position = (scrollY: number) => Number.isFinite(scrollY) ? Math.max(0, Math.round(scrollY)) : 0;
export function openModule(trail: ModuleTrail, tab: ActiveTab, scrollY: number): ModuleTrail {
  if (tab === 'dashboard') return initialModuleTrail();
  if (tab === trail.current.tab) return trail;
  return { current: { tab, scrollY: 0 }, previous: [...trail.previous, { tab: trail.current.tab, scrollY: position(scrollY) }].slice(-MAX_PREVIOUS_PAGES) };
}
export function previousModule(trail: ModuleTrail): ModuleTrail {
  const previous = trail.previous.at(-1);
  return previous ? { current: previous, previous: trail.previous.slice(0, -1) } : initialModuleTrail();
}
export function resetModuleScope(trail: ModuleTrail, sameViewer: boolean, authenticated: boolean): ModuleTrail {
  return initialModuleTrail(authenticated ? (sameViewer ? trail.current.tab : 'dashboard') : 'login');
}
