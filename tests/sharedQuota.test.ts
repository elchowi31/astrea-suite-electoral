import test from 'node:test';import assert from 'node:assert/strict';
import {consumeSharedQuota} from '../src/server/sharedQuota';
test('separate instances cannot consume beyond the same shared limit during races',async()=>{
 let count=0,version=0;
 const request=async(url:any,init:any)=>{
  if(!String(url).endsWith(':commit'))return count?new Response(JSON.stringify({fields:{count:{integerValue:String(count)}},updateTime:String(version)})):new Response('',{status:404});
  const write=JSON.parse(init.body).writes[0],condition=write.currentDocument;
  if((condition.exists===false&&count!==0)||(condition.updateTime!==undefined&&condition.updateTime!==String(version)))return new Response(JSON.stringify({error:{status:'PERMISSION_DENIED'}}),{status:403});
  count=Number(write.update.fields.count.integerValue);version++;return new Response('{}');
 };
 const options={projectId:'demo-astrea',databaseId:'(default)',uid:'user',tenantId:'a',token:'synthetic',now:100000,maximum:2,request:request as typeof fetch};
 const results=await Promise.allSettled([consumeSharedQuota(options),consumeSharedQuota(options),consumeSharedQuota(options)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2);assert.equal(count,2);assert.equal((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.status,429);
});
test('quota service failure blocks usage rather than falling back to an unshared counter',async()=>{
 await assert.rejects(()=>consumeSharedQuota({projectId:'demo',databaseId:'(default)',uid:'u',tenantId:'a',token:'synthetic',request:(async()=>new Response('',{status:403})) as typeof fetch}),(e:any)=>e.status===503);
});
