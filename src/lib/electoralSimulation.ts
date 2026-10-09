import type { DhondtSimulationParty, DhondtSimulationResult, DhondtQuotientStep, ElectoralLevel } from '../types';

export interface ElectionParameters {
  census: number;
  turnout: number;
  nullPct: number;
  unmarkedPct: number;
  blankPct: number;
  seats: number;
  level: ElectoralLevel;
  parties: DhondtSimulationParty[];
}

export function distributeVotes(parties: DhondtSimulationParty[], budget: number): DhondtSimulationParty[] {
  if (!parties.length) return [];
  const total = parties.reduce((sum, party) => sum + party.votes, 0);
  const shares = parties.map((party, index) => {
    const exact = Math.max(0, Math.floor(budget)) * (total > 0 ? party.votes / total : 1 / parties.length);
    return { index, votes: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remaining = Math.max(0, Math.floor(budget)) - shares.reduce((sum, row) => sum + row.votes, 0);
  [...shares].sort((a, b) => b.fraction - a.fraction || a.index - b.index).forEach(row => {
    if (remaining-- > 0) shares[row.index].votes++;
  });
  return parties.map((party, index) => ({ ...party, votes: shares[index].votes, candidateVotes: undefined }));
}

export function getVoteBudget(census: number, turnout: number, nullPct: number, unmarkedPct: number, blankPct: number) {
  const voters = Math.round(census * turnout / 100);
  return Math.max(0, voters - Math.round(voters * nullPct / 100) - Math.round(voters * unmarkedPct / 100) - Math.round(voters * blankPct / 100));
}

export function simulateElection(input: ElectionParameters): { result: DhondtSimulationResult; issues: string[] } {
  const { census, turnout, nullPct, unmarkedPct, blankPct, seats, level, parties } = input;
  const issues: string[] = [];
  const isSingle = level === 'Alcaldía' || level === 'Gobernación' || seats === 1;
  const totalVoters = Math.round(census * turnout / 100);
  const nullVotes = Math.round(totalVoters * nullPct / 100);
  const unmarkedVotes = Math.round(totalVoters * unmarkedPct / 100);
  const blankVotes = Math.round(totalVoters * blankPct / 100);
  const totalValidVotes = Math.max(0, totalVoters - nullVotes - unmarkedVotes);
  const budget = Math.max(0, totalValidVotes - blankVotes);
  const sum = parties.reduce((acc, party) => acc + party.votes, 0);
  if (!Number.isSafeInteger(census) || census <= 0) issues.push('Ingrese un censo positivo para el ámbito de esta elección.');
  if (!Number.isInteger(seats) || seats < 1 || seats > 100 || (isSingle && seats !== 1)) issues.push('Revise el número de cargos o curules.');
  if ([turnout, nullPct, unmarkedPct, blankPct].some(value => !Number.isFinite(value) || value < 0 || value > 100) || nullPct + unmarkedPct + blankPct > 100) issues.push('Los porcentajes deben estar entre 0 y 100 y los tipos de voto no pueden sumar más del 100%.');
  if (!parties.length || parties.some(party => !Number.isSafeInteger(party.votes) || party.votes < 0) || new Set(parties.map(party => party.id)).size !== parties.length) issues.push('Revise las listas, sus identificadores y sus votos.');
  if (sum !== budget) issues.push(`Las listas suman ${sum.toLocaleString('es-CO')} votos; deben sumar ${budget.toLocaleString('es-CO')}. Ajuste los votos o use «Ajustar al total».`);
  if (!totalValidVotes) issues.push('No hay votos válidos para repartir.');
  if (!isSingle && parties.some(party => party.candidatesCount !== undefined && (!Number.isInteger(party.candidatesCount) || party.candidatesCount < 1))) issues.push('Revise el número de candidatos habilitados de cada lista.');
  if (blankVotes > totalValidVotes / 2) issues.push('El voto en blanco supera la mitad de los votos válidos; este escenario requiere evaluar la repetición electoral.');
  const quotient = seats > 0 ? totalValidVotes / seats : 0;
  const thresholdExact = isSingle ? 0 : level === 'Senado de la República' ? totalValidVotes * 0.03 : quotient * (seats === 2 ? 0.3 : 0.5);
  const thresholdVotes = isSingle ? 0 : Math.floor(thresholdExact) + 1;
  const passed = parties.filter(party => party.votes > 0 && (isSingle || party.votes >= thresholdVotes));
  const failed = parties.filter(party => !passed.includes(party));
  const steps: DhondtQuotientStep[] = [];
  if (!issues.length && passed.length) {
    if (isSingle) {
      const sorted = [...passed].sort((a, b) => b.votes - a.votes);
      if (sorted[0].votes === sorted[1]?.votes) issues.push('Hay empate en el primer lugar; la simulación no decide el desempate.');
      else steps.push({ partyId: sorted[0].id, partyName: sorted[0].name, partyColor: sorted[0].color, divisor: 1, quotient: sorted[0].votes, isSeatWinner: true, seatWonNumber: 1 });
    } else if (seats === 2) {
      // Cociente y mayores residuos para la excepción constitucional de dos curules.
      const base = passed.map(party => ({ party, seats: Math.floor(party.votes / quotient), remainder: party.votes % quotient }));
      let remaining = seats - base.reduce((acc, row) => acc + row.seats, 0);
      const sorted = [...base].sort((a, b) => b.remainder - a.remainder);
      if (remaining > 0 && remaining < sorted.length && sorted[remaining - 1].remainder === sorted[remaining].remainder) issues.push('Hay empate en los residuos que definen la última curul.');
      sorted.forEach(row => { if (remaining-- > 0) row.seats++; });
      let number = 1;
      base.forEach(({ party, seats: count }) => { for (let i = 0; i < count; i++) steps.push({ partyId: party.id, partyName: party.name, partyColor: party.color, divisor: i + 1, quotient, isSeatWinner: true, seatWonNumber: number++ }); });
    } else {
      passed.forEach(party => {
        const limit = Math.min(seats, party.candidatesCount ?? seats);
        for (let divisor = 1; divisor <= limit; divisor++) steps.push({ partyId: party.id, partyName: party.name, partyColor: party.color, divisor, quotient: party.votes / divisor, isSeatWinner: false });
      });
      steps.sort((a, b) => b.quotient - a.quotient);
      if (steps.length < seats) issues.push('Las listas habilitadas no permiten cubrir todas las curules.');
      if (steps[seats - 1] && steps[seats] && steps[seats - 1].quotient === steps[seats].quotient) issues.push('Hay empate en el corte de la última curul; se requiere el procedimiento oficial de desempate.');
      else steps.slice(0, seats).forEach((step, index) => { step.isSeatWinner = true; step.seatWonNumber = index + 1; });
    }
  }
  if (!issues.length && !passed.length) issues.push('Ninguna lista supera el umbral; se requiere revisar el escenario y la regla aplicable.');
  if (!issues.length && steps.filter(step => step.isSeatWinner).length !== seats) issues.push('El modelo no logró cubrir todas las curules con las listas habilitadas.');
  if (issues.length) steps.forEach(step => { step.isSeatWinner = false; step.seatWonNumber = undefined; });
  const winning = steps.filter(step => step.isSeatWinner);
  const cifraRepartidora = !isSingle && seats > 2 && winning.length ? winning[winning.length - 1].quotient : 0;
  const allocationsByParty = parties.map(party => {
    const won = winning.filter(step => step.partyId === party.id);
    return { partyId: party.id, partyName: party.name, partyColor: party.color, isUserParty: !!party.isUserParty, totalVotes: party.votes,
      votePercentage: totalValidVotes ? Number((party.votes / totalValidVotes * 100).toFixed(2)) : 0,
      seatsWon: won.length, seatNumbersWon: won.map(step => step.seatWonNumber!), votesPerSeat: won.length ? Math.round(party.votes / won.length) : 0,
      surplusVotes: cifraRepartidora ? party.votes - cifraRepartidora * won.length : 0, passedThreshold: passed.includes(party) };
  });
  const user = allocationsByParty.find(party => party.isUserParty);
  return { issues, result: { totalCensus: census, totalVoters, turnoutPercentage: turnout, blankVotes, nullVotes, unmarkedVotes, totalValidVotes,
    thresholdPercentage: totalValidVotes ? thresholdVotes / totalValidVotes * 100 : 0, thresholdVotes, quotient, seatsInContest: seats,
    electoralThresholdPassedParties: passed, electoralThresholdFailedParties: failed, allocationsByParty, dhondtMatrix: steps, cifraRepartidora,
    userPartySeats: user?.seatsWon ?? 0,
    userPartyMarginForNextSeat: 0, userPartySafetyMargin: 0 } };
}
