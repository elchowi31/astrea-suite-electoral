import type { DhondtSimulationParty } from '../types';
import type { ElectionParameters } from './electoralSimulation';
export const ASI_CLOSED_EXAMPLE: ElectionParameters = {
  census: 10000,
  turnout: 100,
  nullPct: 0,
  unmarkedPct: 0,
  blankPct: 4,
  seats: 11,
  level: 'Concejo Municipal',
  parties: [
    {
      id: 'ejemplo-asi',
      name: 'ASI · supuesto de lista cerrada',
      votes: 1400,
      color: '#22c55e',
      listKind: 'closed',
      isUserParty: true,
      candidatesCount: 11,
      candidateVotes: Array.from({ length: 11 }, (_, index) => ({
        id: `asi-${index + 1}`,
        name: `Aspirante ASI ${index + 1} · ejemplo`,
        position: index + 1,
        votes: 0,
      })),
    },
    ...[2600, 2300, 1800, 900, 600].map((votes, index) => ({
      id: `ejemplo-${index}`,
      name: `Lista de ejemplo ${String.fromCharCode(65 + index)}`,
      votes,
      color: ['#38bdf8', '#a78bfa', '#fb7185', '#f59e0b', '#14b8a6'][index],
      listKind: 'open' as const,
      candidatesCount: 11,
    })),
  ],
};
export function listMembers(party: DhondtSimulationParty, seats: number) {
  const members = [...(party.candidateVotes || [])].sort((a, b) =>
    party.listKind === 'closed'
      ? a.position - b.position
      : b.votes - a.votes || a.position - b.position,
  );
  const tie =
    party.listKind !== 'closed' &&
    seats > 0 &&
    !!members[seats] &&
    members[seats - 1]?.votes === members[seats]?.votes &&
    members.some((member) => member.votes > 0);
  // When no candidate has preference votes, the registered order remains unchanged.
  return {
    members: tie ? [] : members.slice(0, seats),
    pendingTie: tie,
    missingNames: Math.max(0, seats - members.length),
  };
}
export function parseListMembers(text: string, party: DhondtSimulationParty) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length > 100) throw Error('Máximo 100 aspirantes por lista.');
  const members = rows.map((line, index) => {
    const [name, raw] = line.split('|').map((value) => value.trim()),
      votes = party.listKind === 'closed' ? 0 : Number(raw || 0);
    if (!name || name.length > 160 || !Number.isSafeInteger(votes) || votes < 0)
      throw Error(`Revise el nombre o votos de la fila ${index + 1}.`);
    return {
      id: `${party.id}-aspirante-${index + 1}`,
      name,
      position: index + 1,
      votes,
    };
  });
  if (
    party.listKind !== 'closed' &&
    members.reduce((sum, row) => sum + row.votes, 0) > party.votes
  )
    throw Error(
      'Los votos individuales no pueden superar el total de votos de la lista.',
    );
  return members;
}
