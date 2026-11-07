import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {cloudConversationKey,parseCloudMessages,validCloudSignature} from '../src/server/whatsappCloud.ts';

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
