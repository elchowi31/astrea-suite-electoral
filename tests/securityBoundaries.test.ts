import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedRawBody} from '../src/server/rawBody';
import {workspaceTokenCache} from '../src/lib/workspaceSession';
test('webhook body limit applies equally to buffers and streams before parsing',async()=>{
 const buffered=Object.assign((async function*(){})(),{rawBody:Buffer.alloc(11)});
 await assert.rejects(()=>boundedRawBody(buffered,10,'Aviso'),(e:any)=>e.status===413);
 await assert.rejects(()=>boundedRawBody((async function*(){yield Buffer.alloc(6);yield Buffer.alloc(5);})(),10,'Aviso'),(e:any)=>e.status===413);
 assert.equal((await boundedRawBody(Object.assign((async function*(){})(),{rawBody:Buffer.alloc(10)}),10,'Aviso')).length,10);
});
test('Google token ownership, organization switch and expiry invalidate cached access',()=>{
 let now=0;const cache=workspaceTokenCache(()=>now);cache.setScope('organization-a');cache.save('private-token','user-a','organization-a');assert.equal(cache.get('user-a'),'private-token');assert.equal(cache.get('user-b'),null);
 cache.save('new-token','user-a','organization-a');cache.setScope('organization-b');assert.equal(cache.get('user-a'),null);assert.throws(()=>cache.save('late-result','user-a','organization-a'));
 cache.save('short-lived','user-a','organization-b');now=45*60_000;assert.equal(cache.get('user-a'),null);
});
