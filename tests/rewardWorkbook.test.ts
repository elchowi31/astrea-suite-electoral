import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {buildRewardWorkbook} from '../src/lib/rewardWorkbook';
import {importRewardMatrix} from '../src/lib/rewardFiles';
import {DEFAULT_REWARDS,calculateRewards} from '../src/lib/rewards';
test('Generated workbook round-trips editable inputs and retains automatic formulas',async()=>{
  const config=structuredClone(DEFAULT_REWARDS);config.farms[0].manualHours[0]=0;config.farms[1].manualHours[1]=1200;
  const book=buildRewardWorkbook(config),bytes=XLSX.write(book,{type:'array',bookType:'xlsx'});
  const restored=await importRewardMatrix({size:bytes.byteLength,arrayBuffer:async()=>bytes});
  assert.deepEqual(restored,config);assert.equal(book.Sheets.Matriz.F4.v,0);assert.ok(book.Sheets.Calculos.G2.f);
  const expected=calculateRewards(config).rows.flatMap(r=>r.teams);
  const hours=Object.entries(book.Sheets.Matriz).filter(([k])=>/^F[0-9]+$/.test(k)&&Number(k.slice(1))>=4).reduce((s,[,c])=>s+Number(c.v),0);
  assert.ok(Math.abs(hours-expected.reduce((s,t)=>s+t.hours,0))<0.000001);
});
