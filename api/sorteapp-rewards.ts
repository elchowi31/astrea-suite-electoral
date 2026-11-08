import {Buffer} from 'node:buffer';
import type {IncomingMessage,ServerResponse} from 'node:http';
import firebaseConfig from '../firebase-applet-config.json' with {type:'json'};
import {AgentError} from '../src/lib/requestAgent.js';
import {parseSorteappRewardsEvent,processSorteappRewardsEvent,readSorteappRewardsEnvironment,validSorteappSignature} from '../src/server/sorteappRewards.js';

type RawRequest=IncomingMessage&{rawBody?:Buffer};
const MAX_BODY_BYTES=64*1024;
export const config={api:{bodyParser:false}};
function reply(res:ServerResponse,status:number,body:unknown){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body));}
async function readRawBody(req:RawRequest){
 if(Buffer.isBuffer(req.rawBody)){if(req.rawBody.length>MAX_BODY_BYTES)throw new AgentError('El aviso de Sorteapp excede el tamaño permitido.',413);return req.rawBody;}
 const parts:Buffer[]=[];let size=0;
 for await(const chunk of req){const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=data.length;if(size>MAX_BODY_BYTES)throw new AgentError('El aviso de Sorteapp excede el tamaño permitido.',413);parts.push(data);}
 return Buffer.concat(parts);
}
export default async function handler(req:RawRequest,res:ServerResponse){
 if(req.method!=='POST')return reply(res,405,{success:false,error:'Método no permitido.'});
 let environment;try{environment=readSorteappRewardsEnvironment(process.env);}catch(error){return reply(res,error instanceof AgentError?error.status:503,{success:false,error:error instanceof AgentError?error.message:'La recepción de Sorteapp no está configurada.'});}
 try{
  const raw=await readRawBody(req),signature=String(req.headers['x-sorteapp-signature']||'');
  if(!validSorteappSignature(raw,signature,environment.secret))return reply(res,401,{success:false,error:'Firma de Sorteapp no válida.'});
  let payload:unknown;try{payload=JSON.parse(raw.toString('utf8'));}catch{return reply(res,400,{success:false,error:'Aviso de Sorteapp no válido.'});}
  const event=parseSorteappRewardsEvent(payload),result=await processSorteappRewardsEvent({projectId:process.env.FIREBASE_PROJECT_ID||firebaseConfig.projectId,databaseId:process.env.FIRESTORE_DATABASE_ID||firebaseConfig.firestoreDatabaseId||'(default)',environment,event,vercelOidcToken:String(req.headers['x-vercel-oidc-token']||'')});
  return reply(res,200,{success:true,...result});
 }catch(error){
  const status=error instanceof AgentError?error.status:503;
  return reply(res,status>=500?503:status,{success:false,error:error instanceof AgentError?error.message:'No se pudo guardar el aviso de Sorteapp.'});
 }
}
