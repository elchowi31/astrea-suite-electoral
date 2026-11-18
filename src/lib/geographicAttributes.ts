import type {
  GeoFeature,
  GeographicLayer,
  GeoGeometry,
} from './geographicImport';
export const geoKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const field = (feature: GeoFeature, aliases: string[]) =>
  Object.entries(feature.properties)
    .find(
      ([key, value]) => aliases.includes(geoKey(key)) && String(value).trim(),
    )?.[1]
    ?.trim() || '';
export function geographicAttributes(feature: GeoFeature) {
  const activity = field(feature, [
    'actividadeconomica',
    'tipodenegocio',
    'tipodeemprendimiento',
    'negocio',
    'actividad',
  ]);
  const other = field(feature, [
    'continuacionotrasactividades',
    'otraactividad',
    'otrasactividades',
  ]);
  return {
    location:
      field(feature, ['ubicacion', 'localidad', 'veredacorregimiento']) ||
      feature.name,
    activity:
      activity && geoKey(activity).startsWith('otros')
        ? other || 'Otros'
        : activity || 'Sin dato',
    victim:
      field(feature, [
        'esvictimareconocidadelaviolencia',
        'victimadelconflicto',
        'esvictima',
        'victima',
      ]) || 'Sin dato',
    sex:
      field(feature, ['sexo', 'sexodeclarado', 'generodeclarado', 'genero']) ||
      'Sin dato',
    person: field(feature, [
      'nombrecompletodelencuestado',
      'nombredelpropietario',
      'nombrecompleto',
    ]),
    list: feature.source?.folderPath?.join(' / ') || 'Lista no registrada',
    locationTitle:
      /casco\s*urbano|vereda|corregimiento|finca|barrio|cabecera/i.test(
        feature.name,
      ),
  };
}
export type GeographicFilters = {
  location: string;
  activity: string;
  victim: string;
  sex: string;
  list: string;
};
export const EMPTY_GEOGRAPHIC_FILTERS: GeographicFilters = {
  location: 'all',
  activity: 'all',
  victim: 'all',
  sex: 'all',
  list: 'all',
};
export function matchesGeographicAttributes(
  feature: GeoFeature,
  filters: GeographicFilters,
) {
  const values = geographicAttributes(feature);
  return (Object.keys(filters) as (keyof GeographicFilters)[]).every(
    (key) => filters[key] === 'all' || filters[key] === values[key],
  );
}
export function geographicFilterOptions(layers: GeographicLayer[]) {
  const rows = layers.flatMap((layer) =>
    layer.features.map(geographicAttributes),
  );
  return Object.fromEntries(
    (Object.keys(EMPTY_GEOGRAPHIC_FILTERS) as (keyof GeographicFilters)[]).map(
      (key) => [
        key,
        [...new Set(rows.map((row) => row[key]))].sort((a, b) =>
          a.localeCompare(b, 'es'),
        ),
      ],
    ),
  ) as Record<keyof GeographicFilters, string[]>;
}
const xml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const coordinates = (points: GeoGeometry['coordinates']) =>
  points.map((point) => `${point.longitude},${point.latitude},0`).join(' ');
function geometry(item: GeoGeometry): string {
  if (item.type === 'Point' || item.type === 'LineString')
    return `<${item.type}><coordinates>${coordinates(item.coordinates)}</coordinates></${item.type}>`;
  return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates(item.coordinates)}</coordinates></LinearRing></outerBoundaryIs>${(item.holes || []).map((hole) => `<innerBoundaryIs><LinearRing><coordinates>${coordinates(hole.coordinates)}</coordinates></LinearRing></innerBoundaryIs>`).join('')}</Polygon>`;
}
/** All property names and values are exported verbatim as XML text, never executed as HTML. */
export function geographicKml(layers: GeographicLayer[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Exportación de Astrea</name>${layers
    .flatMap((layer) =>
      layer.features.map((feature) => {
        const mark = `<Placemark><name>${xml(feature.name)}</name><description>${xml(feature.description)}</description><ExtendedData>${Object.entries(
          feature.properties,
        )
          .map(
            ([key, value]) =>
              `<Data name="${xml(key)}"><value>${xml(value)}</value></Data>`,
          )
          .join(
            '',
          )}</ExtendedData><MultiGeometry>${feature.geometries.map(geometry).join('')}</MultiGeometry></Placemark>`;
        return (feature.source?.folderPath || []).reduceRight(
          (content, name) =>
            `<Folder><name>${xml(name)}</name>${content}</Folder>`,
          mark,
        );
      }),
    )
    .join('')}</Document></kml>`;
}
