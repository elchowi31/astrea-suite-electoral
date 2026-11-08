import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleFederatedFirestoreToken,readGoogleFederationEnvironment} from '../src/server/googleFederation.ts';

const env={GOOGLE_CLOUD_PROJECT_NUMBER:'123456789012',GOOGLE_WORKLOAD_IDENTITY_POOL_ID:'astrea-vercel',GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID:'vercel-production',GOOGLE_SERVICE_ACCOUNT_EMAIL:'astrea-firestore@demo.iam.gserviceaccount.com'};

test('Firestore federation rejects missing or malformed workload identity settings',()=>{
 assert.throws(()=>readGoogleFederationEnvironment({}),/federación OIDC segura/);
 assert.throws(()=>readGoogleFederationEnvironment({...env,GOOGLE_WORKLOAD_IDENTITY_POOL_ID:'Invalid_Pool'}),/federación OIDC segura/);
 assert.deepEqual(readGoogleFederationEnvironment(env),{projectNumber:'123456789012',poolId:'astrea-vercel',providerId:'vercel-production',serviceAccountEmail:'astrea-firestore@demo.iam.gserviceaccount.com'});
});

test('Firestore federation requires a request token and the Astrea project service account',async()=>{
 const environment=readGoogleFederationEnvironment(env);
 await assert.rejects(googleFederatedFirestoreToken({environment,projectId:'demo',vercelOidcToken:''}),/no proporcionó el token OIDC/);
 await assert.rejects(googleFederatedFirestoreToken({environment,projectId:'another-project',vercelOidcToken:'request-token'}),/no corresponde al proyecto Firebase de Astrea/);
});
