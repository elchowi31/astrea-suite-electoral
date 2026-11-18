import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASI_CLOSED_EXAMPLE,
  listMembers,
  parseListMembers,
} from '../src/lib/closedLists';
import {
  simulateElection,
  distributeVotes,
} from '../src/lib/electoralSimulation';
test('ASI 1400 has two seats at a quotient cutoff of 700 in the declared hypothetical 11-seat scenario', () => {
  const calculation = simulateElection(structuredClone(ASI_CLOSED_EXAMPLE));
  assert.deepEqual(calculation.issues, []);
  assert.equal(calculation.result.cifraRepartidora, 700);
  assert.equal(calculation.result.userPartySeats, 2);
  const members = listMembers(ASI_CLOSED_EXAMPLE.parties[0], 2);
  assert.deepEqual(
    members.members.map((row) => row.position),
    [1, 2],
  );
});
test('Open and closed lists have identical allocation between parties; only member ordering changes', () => {
  const closed = structuredClone(ASI_CLOSED_EXAMPLE),
    opened = structuredClone(closed);
  opened.parties[0].listKind = 'open';
  assert.deepEqual(
    simulateElection(closed).result.allocationsByParty,
    simulateElection(opened).result.allocationsByParty,
  );
  const party = {
    ...closed.parties[0],
    candidateVotes: [
      { id: 'a', name: 'A', position: 1, votes: 10 },
      { id: 'b', name: 'B', position: 2, votes: 100 },
    ],
  };
  assert.equal(listMembers(party, 1).members[0].name, 'A');
  assert.equal(
    listMembers({ ...party, listKind: 'open' }, 1).members[0].name,
    'B',
  );
  assert.equal(distributeVotes([party], 200)[0].candidateVotes?.length, 2);
});
test('Member records reject impossible preference totals and expose a tie instead of inventing its winner', () => {
  const party = {
    ...ASI_CLOSED_EXAMPLE.parties[0],
    listKind: 'open' as const,
    votes: 100,
  };
  assert.throws(() => parseListMembers('A | 80\nB | 30', party), /superar/);
  const candidateVotes = parseListMembers('A | 50\nB | 50', party);
  assert.equal(listMembers({ ...party, candidateVotes }, 1).pendingTie, true);
});
test('If no list passes, the constitutional fallback applies without inventing automatic tie resolution', () => {
  const parties = Array.from({ length: 47 }, (_, i) => ({
    id: String(i),
    name: String(i),
    votes: i + 1,
    color: '#123456',
  }));
  const calculation = simulateElection({
    ...ASI_CLOSED_EXAMPLE,
    census: 1128,
    blankPct: 0,
    seats: 3,
    parties,
  });
  assert.equal(calculation.result.thresholdException, true);
  assert.deepEqual(calculation.issues, []);
  assert.equal(
    calculation.result.allocationsByParty.reduce(
      (sum, row) => sum + row.seatsWon,
      0,
    ),
    3,
  );
});
