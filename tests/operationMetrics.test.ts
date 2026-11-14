import test from 'node:test';import assert from 'node:assert/strict';
import {setOperationMetricsScope,recordFormOperation,operationMetricsSummary} from '../src/lib/operationMetrics';
test('session measurements have explicit semantics, percentiles and no cross-account history',()=>{
 setOperationMetricsScope('synthetic-scope-a','finances');recordFormOperation('completed',100);recordFormOperation('completed',300);recordFormOperation('error',200);
 const summary=operationMetricsSummary();assert.equal(summary.samples,3);assert.equal(summary.modules[0].completed,2);assert.equal(summary.modules[0].errors,1);assert.equal(summary.modules[0].p95Ms,300);assert.ok(!JSON.stringify(summary).includes('synthetic-scope-a'));
 setOperationMetricsScope('synthetic-scope-b','dashboard');assert.equal(operationMetricsSummary().samples,0);
});
