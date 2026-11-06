import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {parseKml,layerChunks} from '../src/lib/geographicImport';
import {googleMapId,fetchGoogleMapKml} from '../src/server/googleMapImport';
const url='https://www.google.com/maps/d/u/1/kml?forcekml=1&mid=map_test_12345';
test('A Google NetworkLink is a recoverable preview, never an empty saved layer',()=>{
  const xml=`<kml xmlns="http://www.opengis.net/kml/2.2"><Document><NetworkLink><Link><href><![CDATA[${url}]]></href></Link></NetworkLink></Document></kml>`;
  const r=parseKml(xml,new DOMParser() as unknown as globalThis.DOMParser);assert.equal(r.features.length,0);assert.deepEqual(r.networkLinks,[url]);assert.throws(()=>layerChunks(r,'t','Mapa','u'),/coordenadas/);
});
test('Only fixed My Maps exports may be fetched; private or redirected responses fail',async()=>{
  assert.equal(googleMapId(url),'map_test_12345');for(const link of ['http://www.google.com/maps/d/kml?mid=map_test_12345','https://127.0.0.1/maps/d/kml?mid=map_test_12345','https://www.google.com.evil.example/maps/d/kml?mid=map_test_12345','https://user:pass@www.google.com/maps/d/kml?mid=map_test_12345'])assert.throws(()=>googleMapId(link));
  const kml='<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>';
  const xml=await fetchGoogleMapKml(url,(async(input,options)=>{assert.equal(String(input),'https://www.google.com/maps/d/kml?forcekml=1&mid=map_test_12345');assert.equal(options?.redirect,'error');return new Response(kml);}) as typeof fetch);assert.equal(xml,kml);
  await assert.rejects(fetchGoogleMapKml(url,(async()=>new Response('Denied',{status:403})) as typeof fetch),/accesible/);
  await assert.rejects(fetchGoogleMapKml(url,(async()=>new Response('<html>Login</html>')) as typeof fetch),/KML/);
});
