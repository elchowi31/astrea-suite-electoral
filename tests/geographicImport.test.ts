import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {zipSync,strToU8} from 'fflate';
import * as XLSX from 'xlsx';
import {parseKml,parseCoordinateRows,importGeographicFile,layerChunks,importedRoute} from '../src/lib/geographicImport';
const parser=new DOMParser();
const kml='<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Astrea</name><Point><coordinates>-73.9785,9.4981,0</coordinates></Point></Placemark><Placemark><name>Visita</name><LineString><coordinates>-73.9785,9.4981 -73.977,9.499</coordinates></LineString></Placemark><Placemark><name>Zona</name><Polygon><outerBoundaryIs><LinearRing><coordinates>-74,9 -73,9 -73,10 -74,9</coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>-73.8,9.2 -73.6,9.2 -73.6,9.4 -73.8,9.2</coordinates></LinearRing></innerBoundaryIs></Polygon></Placemark></Document></kml>';
const parse=(xml:string)=>parseKml(xml,parser as unknown as globalThis.DOMParser);
test('KML preserves actual points, line strings and polygons with holes',()=>{const result=parse(kml);assert.equal(result.features.length,3);assert.deepEqual(result.features[0].geometries[0].coordinates[0],{latitude:9.4981,longitude:-73.9785});assert.equal(result.features[2].geometries[0].holes?.length,1);assert.equal(importedRoute(result.features[1]).provider,'Archivo');assert.equal(importedRoute(result.features[1]).durationSeconds,0);});
test('Import rejects malformed coordinates, external entities and empty geometry',()=>{assert.throws(()=>parse(kml.replace('-73.9785,9.4981,0','-73.9785,999,0')),/inválidas/);assert.throws(()=>parse('<!DOCTYPE kml [<!ENTITY unsafe SYSTEM "file:///private">]><kml/>'),/entidades/);assert.throws(()=>parse('<kml/>'),/no contiene/);assert.throws(()=>parse(kml.replace('-74,9</coordinates>','-74,8</coordinates>')),/abierto/);});
test('CSV and Excel headers, decimal commas and route order are validated',()=>{const result=parseCoordinateRows([{Nombre:'Fin',Latitud:'9,499',Longitud:'-73,977',Tipo:'ruta',Ruta:'Visita',Orden:2},{Nombre:'Inicio',Latitud:9.4981,Longitud:-73.9785,Tipo:'ruta',Ruta:'Visita',Orden:1}]);assert.equal(result.features[0].geometries[0].coordinates[0].latitude,9.4981);assert.throws(()=>parseCoordinateRows([{latitud:'',longitud:-74}]),/fila 2/);assert.throws(()=>parseCoordinateRows([{latitud:9,longitud:-74,tipo:'ruta',ruta:'Incompleta'}]),/dos puntos/);});
test('KMZ and all spreadsheet formats use the same validated import path',async()=>{
  Object.assign(globalThis,{DOMParser});
  const input=async(name:string,bytes:Uint8Array)=>importGeographicFile({name,size:bytes.length,arrayBuffer:async()=>bytes.slice().buffer as ArrayBuffer});
  const archive=zipSync({'doc.kml':strToU8(kml),'../ignored.png':strToU8('not extracted')});assert.equal((await input('mapa.kmz',archive)).features.length,3);
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{nombre:'Astrea',latitud:9.4981,longitud:-73.9785}]),'Ubicaciones');XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([{nombre:'Otro punto',latitud:9.5,longitud:-74}]),'Segunda');
  for(const extension of ['xlsx','xls'] as const){const bytes=XLSX.write(book,{type:'array',bookType:extension==='xls'?'biff8':'xlsx'});assert.equal((await input(`mapa.${extension}`,new Uint8Array(bytes))).features.length,2);}
  assert.equal((await input('mapa.csv',strToU8('nombre,latitud,longitud\nAstrea,9.4981,-73.9785'))).features.length,1);
  await assert.rejects(input('mapa.txt',strToU8('invalid')),/Use KML/);
  await assert.rejects(importGeographicFile({name:'grande.kml',size:26*1048576,arrayBuffer:async()=>{throw Error('must not read');}}),/25 MB/);
});
test('CSV exported by Excel in Spanish (semicolon, decimal comma, Windows-1252, BOM, quotes, tabs) is accepted',async()=>{
  const input=async(name:string,bytes:Uint8Array)=>importGeographicFile({name,size:bytes.length,arrayBuffer:async()=>bytes.slice().buffer as ArrayBuffer});
  const semicolon=await input('excel.csv',strToU8('﻿nombre;latitud;longitud;tipo\nPunto Á;9,4981;-73,9785;punto\n"Sede; norte";9,505;-73,97;punto\n'));
  assert.deepEqual(semicolon.features.map(feature=>[feature.name,feature.geometries[0].coordinates[0]]),[['Punto Á',{latitude:9.4981,longitude:-73.9785}],['Sede; norte',{latitude:9.505,longitude:-73.97}]]);
  const latin1=new Uint8Array([...strToU8('nombre;latitud;longitud\nBarrio '),0xd1,0x61,0x6e,0x64,0xfa,...strToU8(';9,5;-74\n')]);
  assert.equal((await input('ansi.csv',latin1)).features[0].name,'Barrio Ñandú');
  assert.equal((await input('tabs.csv',strToU8('nombre\tlatitud\tlongitud\r\nA\t9.5\t-74\r\n'))).features.length,1);
  const route=await input('ruta.csv',strToU8('nombre;latitud;longitud;tipo;ruta;orden\nB;9,51;-73,96;ruta;R1;2\nA;9,50;-73,97;ruta;R1;1\n'));
  assert.deepEqual(route.features[0].geometries[0].coordinates.map(point=>point.latitude),[9.5,9.51]);
  await assert.rejects(input('vacio.csv',strToU8('nombre;latitud;longitud\n')),/no contiene/);
});
test('Layer documents are split below Firestore document limits without losing features',()=>{const feature=parse(kml).features[0];const features=Array.from({length:500},(_,index)=>({...feature,id:String(index),description:'d'.repeat(1900)}));const chunks=layerChunks({filename:'large.kml',features,warnings:[]},'team','Mapa','operator');assert.ok(chunks.length>1);assert.equal(chunks.flatMap(chunk=>chunk.features).length,500);for(const chunk of chunks)assert.ok(Buffer.byteLength(JSON.stringify(chunk))<650000);assert.equal(new Set(chunks.map(chunk=>chunk.importId)).size,1);});
