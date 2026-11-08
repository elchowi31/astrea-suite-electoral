import {ExternalAccountClient} from 'google-auth-library';
import {AgentError} from '../lib/requestAgent.js';

export type GoogleFederationEnvironment={
 projectNumber:string;poolId:string;providerId:string;serviceAccountEmail:string;
};

const poolIdPattern=/^[a-z][a-z0-9-]{3,31}$/;

export function readGoogleFederationEnvironment(env:Record<string,string|undefined>):GoogleFederationEnvironment{
 const projectNumber=env.GOOGLE_CLOUD_PROJECT_NUMBER?.trim()||'';
 const poolId=env.GOOGLE_WORKLOAD_IDENTITY_POOL_ID?.trim()||'';
 const providerId=env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID?.trim()||'';
 const serviceAccountEmail=env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()||'';
 if(!/^\d{6,20}$/.test(projectNumber)||!poolIdPattern.test(poolId)||!poolIdPattern.test(providerId)||!/^[-a-z0-9]+@[-a-z0-9]+\.iam\.gserviceaccount\.com$/i.test(serviceAccountEmail)){
  throw new AgentError('Falta completar la federación OIDC segura para Firestore.',503);
 }
 return {projectNumber,poolId,providerId,serviceAccountEmail};
}

export async function googleFederatedFirestoreToken(options:{environment:GoogleFederationEnvironment;projectId:string;vercelOidcToken:string}){
 const {environment,projectId,vercelOidcToken}=options;
 if(!vercelOidcToken)throw new AgentError('Vercel no proporcionó el token OIDC de esta solicitud.',503);
 if(!environment.serviceAccountEmail.endsWith(`@${projectId}.iam.gserviceaccount.com`))throw new AgentError('La cuenta federada no corresponde al proyecto Firebase de Astrea.',503);
 const audience=`//iam.googleapis.com/projects/${environment.projectNumber}/locations/global/workloadIdentityPools/${environment.poolId}/providers/${environment.providerId}`;
 const auth=ExternalAccountClient.fromJSON({
  type:'external_account',
  audience,
  subject_token_type:'urn:ietf:params:oauth:token-type:jwt',
  token_url:'https://sts.googleapis.com/v1/token',
  service_account_impersonation_url:`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${environment.serviceAccountEmail}:generateAccessToken`,
  scopes:['https://www.googleapis.com/auth/datastore'],
  subject_token_supplier:{getSubjectToken:async()=>vercelOidcToken}
 });
 if(!auth)throw new AgentError('No se pudo iniciar la federación OIDC con Google Cloud.',503);
 const {token}=await auth.getAccessToken();
 if(!token)throw new AgentError('Google Cloud no entregó una credencial temporal para Firestore.',503);
 return token;
}
