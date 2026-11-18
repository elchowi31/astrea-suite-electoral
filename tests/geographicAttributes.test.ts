import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import {
  geographicAttributes,
  matchesGeographicAttributes,
  geographicKml,
  EMPTY_GEOGRAPHIC_FILTERS,
} from '../src/lib/geographicAttributes';
import { parseKml, layerChunks } from '../src/lib/geographicImport';
const parse = (text: string) =>
  parseKml(text, new DOMParser() as unknown as globalThis.DOMParser);
const xml =
  '<kml><Document><Folder><name>Lista productiva</name><Placemark><name>Casco Urbano Astrea</name><description>Descripción &amp; datos originales</description><ExtendedData><Data name="Nombre completo del encuestado"><value>María Ejemplo</value></Data><Data name="Actividad Económica"><value>Artesanías</value></Data><Data name="SEXO"><value></value></Data><Data name="Es Victima reconocida de la violencia?."><value>Sí</value></Data></ExtendedData><Point><coordinates>-73.9,9.5</coordinates></Point></Placemark></Folder></Document></kml>';
test('Location, economic activity and declared victim value are separate; missing sex is never inferred from the name', () => {
  const feature = parse(xml).features[0],
    values = geographicAttributes(feature);
  assert.equal(values.location, 'Casco Urbano Astrea');
  assert.equal(values.person, 'María Ejemplo');
  assert.equal(values.sex, 'Sin dato');
  assert.equal(values.victim, 'Sí');
  assert.equal(values.activity, 'Artesanías');
  assert.equal(values.list, 'Lista productiva');
  assert.equal(feature.source?.properties.SEXO, '');
  assert.equal(feature.source?.name, feature.name);
  assert.ok(
    matchesGeographicAttributes(feature, {
      ...EMPTY_GEOGRAPHIC_FILTERS,
      sex: 'Sin dato',
      victim: 'Sí',
    }),
  );
  assert.equal(
    matchesGeographicAttributes(feature, {
      ...EMPTY_GEOGRAPHIC_FILTERS,
      sex: 'Mujer',
    }),
    false,
  );
});
test('Filtered KML preserves every property and description as text without executing markup', () => {
  const input = parse(xml),
    layers = layerChunks(
      { ...input, filename: 'source.kml' },
      'one',
      'Negocios',
      'actor',
    ),
    roundTrip = parse(geographicKml(layers));
  assert.deepEqual(
    roundTrip.features[0].properties,
    input.features[0].properties,
  );
  assert.equal(
    roundTrip.features[0].description,
    input.features[0].description,
  );
  assert.deepEqual(
    roundTrip.features[0].geometries,
    input.features[0].geometries,
  );
  assert.deepEqual(
    roundTrip.features[0].source?.folderPath,
    input.features[0].source?.folderPath,
  );
});

test('Unlocated KML records retain their original data, whitespace and folders without becoming fabricated map points', () => {
  const input = parse(
    '<kml><Folder><name>Lista</name><Placemark><name>Vereda</name><ExtendedData><Data name="SEXO"><value> Mujer </value></Data></ExtendedData></Placemark></Folder></kml>',
  );
  assert.equal(input.features.length, 1);
  assert.deepEqual(input.features[0].geometries, []);
  assert.equal(input.features[0].properties.SEXO, ' Mujer ');
  assert.equal(geographicAttributes(input.features[0]).sex, 'Mujer');
  assert.match(input.warnings[0], /sin coordenadas/);
  assert.deepEqual(
    parse(geographicKml(layerChunks(input, 't', 'Mapa', 'owner'))).features[0]
      .properties,
    input.features[0].properties,
  );
});
