import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {parseKml,importedPoints,geographicFeatureMatches,layerChunks} from '../src/lib/geographicImport';
test('Full KML fields, SimpleData and descriptions survive import and carry stable card references',()=>{
  const long='Descripción extensa '.repeat(250);
  const xml='<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>Taller de prueba</name><description>'+long+'</description><ExtendedData><Data name="MUNICIPIO"><value>Astrea</value></Data><SchemaData><SimpleData name="VEREDA">La Ye</SimpleData><SimpleData name="Actividad">Artesanía</SimpleData><SimpleData name="Notas">'+long+'</SimpleData></SchemaData></ExtendedData><Point><coordinates>-73.9,9.5</coordinates></Point></Placemark></kml>';
  const result=parseKml(xml,new DOMParser() as unknown as globalThis.DOMParser),feature=result.features[0];
  assert.equal(feature.description,long.trim());assert.equal(feature.properties.Notas,long.trim());
  assert(geographicFeatureMatches(feature,'artesania'));assert(!geographicFeatureMatches(feature,'inexistente'));
  const layers=layerChunks(result,'test','Importación prueba','admin'),point=importedPoints(layers)[0];
  assert.equal(point.layerId,layers[0].id);assert.equal(point.featureId,feature.id);assert.equal(point.municipality,'Astrea');assert.equal(point.subtitle,'La Ye');
  assert.deepEqual(layers[0].features[0].properties,feature.properties);
});
