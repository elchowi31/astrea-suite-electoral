import {Buffer} from 'node:buffer';
import {timingSafeEqual} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import firebaseConfig from '../firebase-applet-config.json' with {type:'json'};
import {AgentError} from '../src/lib/requestAgent.js';
import {parseCloudMessages,processCloudMessages,readCloudEnvironment,validCloudSignature} from '../src/server/whatsappCloud.js';

type RawRequest=IncomingMessage&{rawBody?:Buffer};
const MAX_BODY_BYTES=1024*1024;
export const config={api:{bodyParser:false}};

function reply(res:ServerResponse,status:number,body:string,contentType='application/json; charset=utf-8'){
 res.statusCode=status;res.setHeader('Content-Type',contentType);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(body);
}
function sameSecret(actual:string,expected:string){
 const left=Buffer.from(actual),right=Buffer.from(expected);
 return left.length===right.length&&timingSafeEqual(left,right);
}
async function readRawBody(req:RawRequest){
 if(Buffer.isBuffer(req.rawBody))return req.rawBody;
 const parts:Buffer[]=[];let size=0;
 for await(const chunk of req){const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=data.length;if(size>MAX_BODY_BYTES)throw new AgentError('El aviso de WhatsApp excede el tamaño permitido.',413);parts.push(data);}
 return Buffer.concat(parts);
}

export default async function handler(req:RawRequest,res:ServerResponse){
 let cloud;
 try{cloud=readCloudEnvironment(process.env);}catch(error){return reply(res,error instanceof AgentError?error.status:503,JSON.stringify({success:false,error:error instanceof AgentError?error.message:'La conexión oficial de WhatsApp no está configurada.'}));}
 const url=new URL(req.url||'/', 'https://astrea.local');
 if(req.method==='GET'){
  const mode=url.searchParams.get('hub.mode')||'',provided=url.searchParams.get('hub.verify_token')||'',challenge=url.searchParams.get('hub.challenge')||'';
  if(mode!=='subscribe'||!challenge||!sameSecret(provided,cloud.verifyToken))return reply(res,403,'Forbidden','text/plain; charset=utf-8');
  return reply(res,200,challenge,'text/plain; charset=utf-8');
 }
 if(req.method!=='POST')return reply(res,405,JSON.stringify({success:false,error:'Método no permitido.'}));
 try{
  const raw=await readRawBody(req),signature=String(req.headers['x-hub-signature-256']||'');
  if(!validCloudSignature(raw,signature,cloud.appSecret))return reply(res,401,JSON.stringify({success:false,error:'Firma de WhatsApp no válida.'}));
  let payload:unknown;try{payload=JSON.parse(raw.toString('utf8'));}catch{return reply(res,400,JSON.stringify({success:false,error:'Aviso de WhatsApp no válido.'}));}
  const messages=parseCloudMessages(payload,cloud.phoneNumberId);
  if(messages.length)await processCloudMessages({projectId:process.env.FIREBASE_PROJECT_ID||firebaseConfig.projectId,databaseId:process.env.FIRESTORE_DATABASE_ID||firebaseConfig.firestoreDatabaseId||'(default)',cloud,messages});
  return reply(res,200,'OK','text/plain; charset=utf-8');
 }catch(error){
  const status=error instanceof AgentError?error.status:503;
  return reply(res,status>=500?503:status,JSON.stringify({success:false,error:error instanceof AgentError?error.message:'No se pudo procesar el aviso de WhatsApp.'}));
 }
}
