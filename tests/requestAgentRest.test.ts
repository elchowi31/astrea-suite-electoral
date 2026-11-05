import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAgentBackend,encodeFields,decodeFields} from '../src/server/requestAgent';
import type {AgentTurn} from '../src/lib/requestAgent';

const input:AgentTurn={conversationId:'rest-conversation',messageId:'rest-message',revision:0,action:'edit',patch:{resource:'Alimentación',quantity:3,unitCost:0,municipality:'Astrea',description:'Evento de prueba',leaderId:'leader-a'}};
function fixture(){
 const root='projects/demo-astrea/databases/(default)/documents';
 const documents=new Map<string,any>();
 const commits:any[]=[];let version=0;
 const put=(path:string,data:Record<string,any>)=>documents.set(root+'/'+path,{name:root+'/'+path,fields:encodeFields(data),updateTime:`2026-01-01T00:00:00.${String(++version).padStart(6,'0')}Z`});
 put('lideres/leader-a',{id:'leader-a',tenantId:'team-a',fullName:'Responsable'});
 const fetcher:typeof fetch=async(url,init)=>{
  const path=decodeURI(new URL(String(url)).pathname.slice(4));
  assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer user-id-token');
  // Production user credentials must never need the server transaction RPCs.
  assert.ok(!/:(beginTransaction|rollback|batchGet)$/.test(path));
  if(path.endsWith(':commit')){
   const body=JSON.parse(init!.body as string);assert.ok(!('transaction' in body));commits.push(body);
   for(const write of body.writes){
    const name=write.update?.name||write.verify,stored=documents.get(name),condition=write.currentDocument;
    assert.ok(condition,'Every write or verification must have a precondition');
    if(condition.exists===false&&stored||condition.updateTime&&condition.updateTime!==stored?.updateTime)
     return new Response(JSON.stringify({error:{status:'FAILED_PRECONDITION'}}),{status:400});
   }
   for(const write of body.writes)if(write.update)put(write.update.name.slice(root.length+1),decodeFields(write.update.fields));
   return new Response(JSON.stringify({writeResults:[]}));
  }
  assert.equal(init?.method,'GET');
  const document=documents.get(path);
  return new Response(JSON.stringify(document||{error:{status:'NOT_FOUND'}}),{status:document?200:404});
 };
 const options={projectId:'demo-astrea',databaseId:'(default)',uid:'user-a',tenantId:'team-a',token:'user-id-token',leaderIds:['leader-a'],eventIds:[] as string[],fetcher};
 return {root,documents,commits,put,fetcher,options};
}
test('user-token REST draft and confirmation use version preconditions and one atomic commit',async()=>{
 const f=fixture(),backend=createAgentBackend(f.options);
 const draft=await backend.turn(input);assert.equal(draft.conversation.revision,1);
 assert.equal(f.commits[0].writes.length,2);
 assert.deepEqual(f.commits[0].writes[0].currentDocument,{exists:false});
 const duplicate=await backend.turn(input);assert.equal(duplicate.duplicate,true);assert.equal(f.commits.length,1);
 const confirmation={...input,patch:undefined,action:'confirm' as const,revision:1,messageId:'rest-confirm'};
 const saved=await backend.turn(confirmation);assert.equal(saved.conversation.status,'submitted');
 const writes=f.commits[1].writes;
 assert.equal(writes.length,5);assert.ok(writes.find((w:any)=>w.verify===f.root+'/lideres/leader-a'));
 assert.ok(writes.find((w:any)=>w.update?.name.endsWith('/rest-conversation')).currentDocument.updateTime);
 assert.equal(decodeFields(f.documents.get(f.root+'/solicitudes_recursos/'+saved.conversation.requestId).fields).quantity,3);
 assert.equal((await backend.turn(confirmation)).duplicate,true);assert.equal(f.commits.length,2);
});
test('contention after a concurrent delivery replays its receipt without duplicating a draft',async()=>{
 const f=fixture();let raced=false;
 const backend=createAgentBackend({...f.options,fetcher:async(url,init)=>{
  if(String(url).endsWith(':commit')&&!raced){raced=true;await createAgentBackend(f.options).turn(input);}
  return f.fetcher(url,init);
 }});
 const result=await backend.turn(input);
 assert.equal(result.duplicate,true);assert.equal(result.conversation.revision,1);
 assert.equal([...f.documents.keys()].filter(p=>p.includes('/receipts/')).length,1);
});
test('a rejected commit never claims success and exposes only a safe operation label',async()=>{
 const f=fixture();
 const backend=createAgentBackend({...f.options,fetcher:async(url,init)=>String(url).endsWith(':commit')?new Response(JSON.stringify({error:{message:'secret-token-and-document-path',status:'PERMISSION_DENIED'}}),{status:403}):f.fetcher(url,init)});
 await assert.rejects(backend.turn(input),(error:any)=>error.status===403&&error.message.includes('guardado atómico')&&!error.message.includes('secret'));
 assert.equal([...f.documents.keys()].filter(p=>p.includes('agent_conversations')).length,0);
});
test('persistent precondition conflicts stop after three atomic attempts',async()=>{
 const f=fixture();let attempts=0;
 const backend=createAgentBackend({...f.options,fetcher:async(url,init)=>{
  if(String(url).endsWith(':commit')){attempts++;return new Response(JSON.stringify({error:{status:'FAILED_PRECONDITION'}}),{status:400});}
  return f.fetcher(url,init);
 }});
 await assert.rejects(backend.turn(input),(e:any)=>e.status===409);assert.equal(attempts,3);
});
