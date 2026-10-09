import assert from 'node:assert/strict';
import { test } from 'node:test';
import history from '../src/data/cesarElectionHistory.json';
import seats from '../src/data/cesarSeats.json';
import { CESAR_MUNICIPALITIES } from '../src/data/geography';
import { historicalBaseline, historyKey, referenceRow, validateRows, type StatisticalRow } from '../src/lib/statisticalData';

test('All 52 official pre-count bulletins reconcile ballots and list votes',()=>{
  const rows=history as StatisticalRow[];validateRows(rows);
  for (const [municipality,level] of [...CESAR_MUNICIPALITIES.flatMap(name=>[[''+name,'Alcaldía'],[''+name,'Concejo Municipal']]),['Cesar','Gobernación'],['Cesar','Asamblea / Diputación']]) {
    const first=rows.find(row=>row.municipality===municipality && row.level===level);
    assert(first,`${municipality}/${level}`);
    const baseline=historicalBaseline(rows,municipality,level as any,historyKey(first));
    assert(baseline.census>0 && baseline.turnout>0 && baseline.turnout<=100);
    assert(baseline.parties.length>0);
    assert(first.source.includes('Preconteo') && first.source.includes('no escrutinio'));
  }
  const astrea=rows.filter(row=>row.municipality==='Astrea'&&row.level==='Alcaldía');
  assert.equal(astrea.find(row=>row.metric==='censo')?.value,16558);
  assert.equal(astrea.find(row=>row.metric==='sufragantes')?.value,11819);
  assert(!JSON.stringify(rows).includes('cedula'));
});
test('Reference seats cover every Cesar council and the departmental assembly',()=>{
  validateRows(seats);
  assert.equal(seats.length,26);
  assert.equal(seats.find(row=>row.municipality==='Astrea')?.value,11);
  assert.equal(seats.find(row=>row.municipality==='Valledupar')?.value,19);
  assert.equal(referenceRow(seats as StatisticalRow[],'Astrea','curules')?.value,11);
  assert.equal(referenceRow(seats as StatisticalRow[],'Valledupar','curules')?.value,19);
  assert.equal(referenceRow(seats as StatisticalRow[],'Cesar','curules')?.value,11);
  assert.deepEqual(new Set(seats.filter(row=>row.level==='Concejo Municipal').map(row=>row.municipality)),new Set(CESAR_MUNICIPALITIES));
});
