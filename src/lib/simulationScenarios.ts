import { CESAR_MUNICIPALITIES } from '../data/geography';
import type { ElectionParameters } from './electoralSimulation';
import { validateRows, type StatisticalRow } from './statisticalData';

export interface SimulatorSnapshot {
  version: 1;
  tenantId: string;
  municipality: string;
  referenceYear: number;
  parameters: ElectionParameters;
  base: ElectionParameters;
  censusOrigin: string;
  historicalOrigin: string;
  imported: StatisticalRow[];
}
export interface SavedScenario { id: string; name: string; savedAt: string; snapshot: SimulatorSnapshot }

export function validateSnapshot(input: unknown, tenantId: string): SimulatorSnapshot {
  const snapshot = input as SimulatorSnapshot;
  if (!snapshot || snapshot.version !== 1 || snapshot.tenantId !== tenantId || !CESAR_MUNICIPALITIES.includes(snapshot.municipality as any) || !Number.isInteger(snapshot.referenceYear) || snapshot.referenceYear < 2000 || snapshot.referenceYear > 2042) throw new Error('Escenario incompatible o perteneciente a otra organización.');
  const levels = ['Concejo Municipal', 'Alcaldía', 'Gobernación', 'Asamblea / Diputación', 'Cámara de Representantes', 'Senado de la República'];
  for (const parameters of [snapshot.parameters, snapshot.base]) {
    if (!parameters || !levels.includes(parameters.level) || !Number.isSafeInteger(parameters.census) || parameters.census < 0 || !Number.isInteger(parameters.seats) || parameters.seats < 1 || parameters.seats > 100) throw new Error('Parámetros del escenario inválidos.');
    if ([parameters.turnout, parameters.nullPct, parameters.unmarkedPct, parameters.blankPct].some(value => !Number.isFinite(value) || value < 0 || value > 100) || parameters.nullPct + parameters.unmarkedPct + parameters.blankPct > 100) throw new Error('Porcentajes del escenario inválidos.');
    if (!Array.isArray(parameters.parties) || !parameters.parties.length || parameters.parties.length > 100 || new Set(parameters.parties.map(party => party.id)).size !== parameters.parties.length) throw new Error('Listas del escenario inválidas.');
    if (parameters.parties.some(party => !party || typeof party.id !== 'string' || !party.id || typeof party.name !== 'string' || !party.name.trim() || party.name.length > 200 || !Number.isSafeInteger(party.votes) || party.votes < 0 || !/^#[0-9a-f]{6}$/i.test(party.color) || (party.candidatesCount !== undefined && (!Number.isInteger(party.candidatesCount) || party.candidatesCount < 1 || party.candidatesCount > 100)))) throw new Error('Votos o datos de listas inválidos.');
  }
  if ([snapshot.censusOrigin, snapshot.historicalOrigin].some(value => typeof value !== 'string' || value.length > 500)) throw new Error('Referencias del escenario inválidas.');
  return { ...snapshot, imported: validateRows(snapshot.imported) };
}

export function buildScenario(base: ElectionParameters, mode: 'base' | 'conservador' | 'optimista'): ElectionParameters {
  // Called from the saved baseline every time; repeated clicks never compound.
  const turnout = Math.max(0, Math.min(100, base.turnout + (mode === 'optimista' ? 5 : mode === 'conservador' ? -5 : 0)));
  const multiplier = mode === 'optimista' ? 1.25 : mode === 'conservador' ? 0.85 : 1;
  return { ...base, turnout, parties: base.parties.map(party => ({ ...party, votes: party.votes * (party.isUserParty ? multiplier : 1) })) };
}
