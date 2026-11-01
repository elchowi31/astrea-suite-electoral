import type {IncomingMessage,ServerResponse} from 'node:http';
import {authorize,parseBody,readAuthorizedDocument,FIREBASE_PROJECT_ID,FIRESTORE_DATABASE_ID,NATIVE_APP_ORIGINS} from './index.js';
import {isPlatformAdminClaims} from '../src/lib/accessPolicy.js';
import {AgentError} from '../src/lib/requestAgent.js';
import {validatePilotConfig} from '../src/server/whatsappPilotCore.js';
import {runWhatsappPilot} from '../src/server/whatsappPilot.js';
import {validateTabSession} from '../src/server/whatsappSessionStore.js';

export default async function handler(req:IncomingMessage,res:ServerResponse){
 const origin=String(req.headers.origin||'');
 if(NATIVE_APP_ORIGINS.has(origin)){
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Max-Age','600');
 }
 if(req.method==='OPTIONS'){res.statusCode=NATIVE_APP_ORIGINS.has(origin)?204:403;res.end();return;}
 const respond=(status:number,error:string)=>{if(res.headersSent){res.end();return;}res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({success:false,error}));};
 if(req.method!=='POST')return respond(405,'Método no permitido.');
 const user=await authorize(req,res);if(!user)return;
 if(!isPlatformAdminClaims(user))return respond(403,'La recepción de WhatsApp está disponible para el administrador global.');
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return respond(415,'Se requiere contenido JSON.');
 try{
  const body=await parseBody(req);
  const config=validatePilotConfig(body);
  const token=req.headers.authorization!.slice(7);
  const checkActive=async()=>{
   const [tenant,leader,event]=await Promise.all([
    readAuthorizedDocument(`organizaciones/${config.tenantId}`,token),
    readAuthorizedDocument(`lideres/${config.leaderId}`,token),
    readAuthorizedDocument(`jornadas_operativas/${config.eventId}`,token)
   ]);
   if(tenant?.active!==true||leader?.tenantId!==config.tenantId||event?.tenantId!==config.tenantId||!['Planificado','En curso'].includes(String(event?.status)))throw new AgentError('Seleccione una organización activa, un responsable y una jornada vigente de esa organización.',403);
  };
  await checkActive();
  const session=validateTabSession(body.session);
  await runWhatsappPilot({projectId:FIREBASE_PROJECT_ID,databaseId:FIRESTORE_DATABASE_ID,token,uid:user.sub,config,session,res,checkActive});
 }catch(e){respond(e instanceof AgentError?e.status:503,e instanceof AgentError?e.message:'No se pudo iniciar la recepción de WhatsApp.');}
}
