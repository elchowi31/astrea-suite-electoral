export function workspaceTokenCache(now:()=>number=Date.now){
 let token:string|null=null,owner='',scope='',expiresAt=0;
 const clear=()=>{token=null;owner='';expiresAt=0;};
 return {clear,setScope(next:string){if(scope!==next){clear();scope=next;}},
  save(value:string,uid:string,expectedScope:string){if(!uid||scope!==expectedScope)throw new Error('La cuenta u organización cambió durante la conexión de Google.');token=value;owner=uid;expiresAt=now()+45*60_000;},
  get(uid:string|null){if(!uid||uid!==owner||now()>=expiresAt){clear();return null;}return token;},
  scope:()=>scope,
 };
}
