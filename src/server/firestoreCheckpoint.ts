// Put the precondition in the Commit JSON body. This is also understood by the
// emulator, which does not consistently parse nested timestamp query parameters.
export async function writeCheckpoint(options:{base:string;path:string;headers:Record<string,string>;fields:Record<string,unknown>;revision:string;request:typeof fetch;timeout?:number}){
 const root=new URL(options.base).pathname.replace(/^\/v1\//,'').replace(/^\//,'');
 const response=await options.request(`${options.base}:commit`,{method:'POST',headers:options.headers,body:JSON.stringify({writes:[{update:{name:`${root}/${options.path}`,fields:options.fields},currentDocument:options.revision?{updateTime:options.revision}:{exists:false}}]}),signal:AbortSignal.timeout(options.timeout||12000)});
 const data=response.ok?await response.json():null;
 return {ok:response.ok,status:response.status,updateTime:data?.writeResults?.[0]?.updateTime as string|undefined};
}
