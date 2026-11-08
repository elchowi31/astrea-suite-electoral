import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {cloudConversationKey,parseCloudMessages,readCloudEnvironment,validCloudSignature} from '../src/server/whatsappCloud.ts';

const federationEnvironment={GOOGLE_CLOUD_PROJECT_NUMBER:'123456789012',GOOGLE_WORKLOAD_IDENTITY_POOL_ID:'astrea-vercel',GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID:'vercel-production',GOOGLE_SERVICE_ACCOUNT_EMAIL:'astrea-firestore@demo.iam.gserviceaccount.com'};

test('Meta webhook signature matches the exact request bytes',()=>{
 const raw=Buffer.from('{"entry":[{"id":"waba"}]}'),secret='test-meta-app-secret';
 const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(validCloudSignature(raw,signature,secret),true);
 assert.equal(validCloudSignature(Buffer.from('{"entry":[]}'),signature,secret),false);
 assert.equal(validCloudSignature(raw,'sha256=bad',secret),false);
});

test('persisted conversation keys are keyed digests rather than enumerable phone hashes',()=>{
 const key=cloudConversationKey('573001234567','service-account-secret');
 assert.match(key,/^[a-f0-9]{64}$/);
 assert.equal(key,cloudConversationKey('573001234567','service-account-secret'));
 assert.notEqual(key,cloudConversationKey('573001234567','rotated-secret'));
 assert.notEqual(key,'573001234567');
});

test('official WhatsApp remains off until Meta, conversation and federated Firestore settings exist',()=>{
 assert.throws(()=>readCloudEnvironment({}),/todavía no está activada/);
 assert.throws(()=>readCloudEnvironment({WHATSAPP_CLOUD_ENABLED:'true'}),/configuración segura/);
 const cloud=readCloudEnvironment({WHATSAPP_CLOUD_ENABLED:'true',WHATSAPP_CLOUD_VERIFY_TOKEN:'verify-token-with-20-chars',WHATSAPP_CLOUD_APP_SECRET:'meta-app-secret-with-20-chars',WHATSAPP_CLOUD_ACCESS_TOKEN:'meta-access-token-at-least-20-chars',WHATSAPP_CLOUD_PHONE_NUMBER_ID:'123456789',WHATSAPP_CLOUD_GRAPH_VERSION:'v23.0',WHATSAPP_CLOUD_CONVERSATION_SECRET:'stable-conversation-secret-with-at-least-32-chars',...federationEnvironment});
 assert.equal(cloud.federation.providerId,'vercel-production');
 assert.equal(cloud.conversationSecret,'stable-conversation-secret-with-at-least-32-chars');
});

test('only private messages for the configured WhatsApp number are accepted',()=>{
 const payload={object:'whatsapp_business_account',entry:[{changes:[
  {field:'messages',value:{metadata:{phone_number_id:'123456789',display_phone_number:'+57 301 723 8257'},messages:[
   {id:'wamid.HBg123',from:'573001234567',type:'text',text:{body:'Necesito 3 almuerzos'}},
   {id:'wamid.HBg456',from:'573001234568',type:'image'},
   {id:'invalid',from:'not-a-phone',type:'text',text:{body:'ignore'}}
  ]}},
  {field:'messages',value:{metadata:{phone_number_id:'987654321',display_phone_number:'+57 301 723 8258'},messages:[{id:'wamid.other',from:'573001234569',type:'text',text:{body:'ignore'}}]}},
  {field:'statuses',value:{metadata:{phone_number_id:'123456789',display_phone_number:'+57 301 723 8257'},statuses:[{id:'wamid.status'}]}}
 ]}]};
 assert.deepEqual(parseCloudMessages(payload,'123456789'),[
  {phoneNumberId:'123456789',displayPhone:'573017238257',id:'wamid.HBg123',from:'573001234567',text:'Necesito 3 almuerzos'},
  {phoneNumberId:'123456789',displayPhone:'573017238257',id:'wamid.HBg456',from:'573001234568',text:null}
 ]);
 assert.deepEqual(parseCloudMessages({object:'unknown',entry:[]},'123456789'),[]);
});
