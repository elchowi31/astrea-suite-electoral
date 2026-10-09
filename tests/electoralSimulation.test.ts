import test from 'node:test';
import assert from 'node:assert/strict';
import { distributeVotes, simulateElection, type ElectionParameters } from '../src/lib/electoralSimulation';
import { buildScenario, validateSnapshot } from '../src/lib/simulationScenarios';

const input = (votes = [600, 300, 100]): ElectionParameters => ({ census: 1000, turnout: 100, nullPct: 0, blankPct: 0, unmarkedPct: 0, seats: 3, level: 'Concejo Municipal', parties: votes.map((value, i) => ({ id: String(i), name: `Lista ${i}`, color: '#123456', votes: value, isUserParty: i === 0 })) });
test('voting budget rejects impossible totals and invalid percentages', () => {
  assert.equal(simulateElection(input([601, 300, 100])).result.allocationsByParty.reduce((sum, row) => sum + row.seatsWon, 0), 0);
  assert.ok(simulateElection({ ...input(), blankPct: 80, nullPct: 30 }).issues.length);
  assert.deepEqual(distributeVotes(input().parties, 997).map(row => row.votes), [598, 299, 100]);
  assert.equal(distributeVotes(input([0, 0, 0]).parties, 7).reduce((sum, row) => sum + row.votes, 0), 7);
});
test('D’Hondt keeps fractional quotients and detects ties at the final seat', () => {
  const calculation = simulateElection(input([599, 301, 100]));
  assert.deepEqual(calculation.issues, []);
  assert.deepEqual(calculation.result.allocationsByParty.map(row => row.seatsWon), [2, 1, 0]);
  assert.ok(calculation.result.dhondtMatrix.some(row => row.quotient === 299.5));
  const tied = simulateElection({ ...input([500, 500]), seats: 3 });
  assert.match(tied.issues.join(' '), /empate/);
  assert.equal(tied.result.userPartySeats, 0);
});
test('mayoral contests use relative majority, with no invented 40% threshold', () => {
  const calculation = simulateElection({ ...input([380, 340, 280]), seats: 1, level: 'Alcaldía' });
  assert.deepEqual(calculation.issues, []);
  assert.equal(calculation.result.thresholdVotes, 0);
  assert.deepEqual(calculation.result.allocationsByParty.map(row => row.seatsWon), [1, 0, 0]);
  assert.match(simulateElection({ ...input([500, 500]), seats: 1, level: 'Gobernación' }).issues.join(' '), /empate/);
});
test('two seats use quotient and remainders; blank majority cannot certify a winner', () => {
  const calculation = simulateElection({ ...input([601, 399]), seats: 2 });
  assert.deepEqual(calculation.issues, []);
  assert.deepEqual(calculation.result.allocationsByParty.map(row => row.seatsWon), [1, 1]);
  assert.equal(calculation.result.thresholdVotes, 151);
  assert.match(simulateElection({ ...input([300, 100]), blankPct: 60 }).issues.join(' '), /blanco/);
});
test('scenario toggles are deterministic and restore validation respects the tenant', () => {
  const base = { ...input(), turnout: 55 };
  assert.deepEqual(buildScenario(base, 'optimista'), buildScenario(base, 'optimista'));
  assert.equal(buildScenario(base, 'optimista').turnout, 60);
  assert.equal(base.parties[0].votes, 600);
  const snapshot = { version: 1, tenantId: 'a', municipality: 'Astrea', referenceYear: 2026, parameters: base, base, censusOrigin: 'Manual', historicalOrigin: 'Supuesto', imported: [] };
  assert.equal(validateSnapshot(snapshot, 'a').municipality, 'Astrea');
  assert.throws(() => validateSnapshot(snapshot, 'b'), /otra organización/);
  assert.throws(() => validateSnapshot({ ...snapshot, parameters: { ...base, turnout: NaN } }, 'a'), /Porcentajes/);
});
