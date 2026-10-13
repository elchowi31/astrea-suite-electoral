import { unzipSync, strFromU8 } from 'fflate';
import type { Coordinate, TerritorialRoute, TerritoryPoint } from './territorialMaps';
import { validLocation } from './territorialMaps';

export interface GeoGeometry { type: 'Point' | 'LineString' | 'Polygon'; coordinates: Coordinate[]; holes?: { coordinates: Coordinate[] }[] }
export interface GeoFeature { id: string; name: string; description: string; geometries: GeoGeometry[]; properties: Record<string, string> }
export interface GeographicLayer { id: string; tenantId: string; importId: string; name: string; filename: string; features: GeoFeature[]; createdBy: string; importedAt: string }
export interface ImportResult { filename: string; features: GeoFeature[]; warnings: string[] }
/** Todas las geometrías y partes de la importación, no solamente su primer punto. */
export function layerCoordinates(layers: GeographicLayer[]): Coordinate[] {
  return layers.flatMap(layer=>layer.features.flatMap(feature=>feature.geometries.flatMap(geometry=>[...geometry.coordinates,...(geometry.holes||[]).flatMap(hole=>hole.coordinates)]))).filter(validLocation);
}
export const IMPORT_LIMITS = { bytes: 25 * 1024 * 1024, expandedBytes: 40 * 1024 * 1024, features: 1000, vertices: 25000 };
const normalize = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]/g, '');
const number = (v: unknown) => typeof v === 'number' ? v : Number(String(v ?? '').trim().replace(',', '.'));
const coordinate = (lng: unknown, lat: unknown): Coordinate => {
  if (String(lng ?? '').trim() === '' || String(lat ?? '').trim() === '') throw new Error('Falta latitud o longitud.');
  const result = { latitude: number(lat), longitude: number(lng) };
  if (!validLocation(result)) throw new Error('Coordenadas inválidas. Use latitud y longitud WGS84 en grados decimales.');
  return result;
};
export function validateGeographicFeatures(features: GeoFeature[]): GeoFeature[] {
  if (!features.length) throw new Error('El archivo no contiene puntos, rutas o polígonos con coordenadas.');
  if (features.length > IMPORT_LIMITS.features) throw new Error(`Máximo ${IMPORT_LIMITS.features} elementos por importación. Divida el archivo.`);
  let vertices = 0;
  for (const feature of features) for (const geometry of feature.geometries) {
    if(!geometry.coordinates.every(validLocation)||(geometry.holes||[]).some(hole=>!hole.coordinates.every(validLocation)))throw new Error(`Coordenadas inválidas en «${feature.name}».`);
    vertices += geometry.coordinates.length + (geometry.holes || []).reduce((sum, hole) => sum + hole.coordinates.length, 0);
    if (geometry.type === 'Point' && geometry.coordinates.length !== 1) throw new Error(`El punto «${feature.name}» debe contener una sola coordenada.`);
    if (geometry.type === 'LineString' && geometry.coordinates.length < 2) throw new Error(`La ruta «${feature.name}» necesita dos puntos.`);
    if (geometry.type === 'Polygon' && geometry.coordinates.length < 4) throw new Error(`El polígono «${feature.name}» necesita un anillo cerrado.`);
    if(geometry.type==='Polygon')for(const ring of [geometry.coordinates,...(geometry.holes||[]).map(hole=>hole.coordinates)])if(ring.length<4||JSON.stringify(ring[0])!==JSON.stringify(ring.at(-1)))throw new Error(`El polígono «${feature.name}» contiene un anillo abierto.`);
  }
  if (vertices > IMPORT_LIMITS.vertices) throw new Error(`Máximo ${IMPORT_LIMITS.vertices} coordenadas. Simplifique o divida el archivo.`);
  return features;
}
const validate=validateGeographicFeatures;
const descendants = (node: Element | Document, tag: string): Element[] => Array.from(node.getElementsByTagNameNS('*', tag));
const direct = (node: Element, tag: string) => Array.from(node.childNodes).find(child => child.nodeType === 1 && (child as Element).localName === tag) as Element | undefined;
const text = (node: Element, tag: string) => direct(node, tag)?.textContent?.trim() || '';
function kmlCoordinates(node: Element): Coordinate[] {
  const value = descendants(node, 'coordinates')[0]?.textContent?.trim() || '';
  if (!value) throw new Error('Geometría KML sin coordenadas.');
  return value.split(/\s+/).map(tuple => { const [lng, lat] = tuple.split(','); return coordinate(lng, lat); });
}
export function parseKml(xml: string, parser: Pick<DOMParser, 'parseFromString'> = new DOMParser()): ImportResult {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('El KML no puede contener entidades externas.');
  const document = parser.parseFromString(xml, 'application/xml');
  if (descendants(document, 'parsererror').length || document.documentElement?.localName !== 'kml') throw new Error('El archivo KML no es un documento válido.');
  const features: GeoFeature[] = [];
  for (const placemark of descendants(document, 'Placemark')) {
    const geometries: GeoGeometry[] = [];
    for (const node of [...descendants(placemark, 'Point'), ...descendants(placemark, 'LineString'), ...descendants(placemark, 'Polygon')]) {
      const type = node.localName as GeoGeometry['type'];
      if (type === 'Polygon') {
        const outer = descendants(node, 'outerBoundaryIs')[0];
        if (!outer) throw new Error('Polígono KML sin borde exterior.');
        geometries.push({ type, coordinates: kmlCoordinates(outer), holes: descendants(node, 'innerBoundaryIs').map(ring => ({ coordinates: kmlCoordinates(ring) })) });
      } else geometries.push({ type, coordinates: kmlCoordinates(node) });
    }
    if (!geometries.length) continue;
    const properties: Record<string, string> = {};
    for (const data of descendants(placemark, 'Data')) { const key = data.getAttribute('name'); if (key && !['__proto__','constructor','prototype'].includes(key)) properties[key.slice(0,100)] = text(data, 'value').slice(0,2000); }
    features.push({ id: `feature-${features.length + 1}`, name: text(placemark, 'name').slice(0,160) || `Elemento ${features.length + 1}`, description: text(placemark, 'description').slice(0,2000), geometries, properties });
  }
  const warnings = descendants(document, 'NetworkLink').length ? ['Los enlaces externos del KML no se importan. Incluya las geometrías dentro del archivo.'] : [];
  return { filename: '', features: validate(features), warnings };
}
export function parseCoordinateRows(rows: Record<string, unknown>[], sheet = ''): ImportResult {
  const features: GeoFeature[] = []; const groups = new Map<string, { name: string; type: string; rows: { point: Coordinate; order: number; index: number }[] }>();
  const aliases = { lat: ['latitud','latitude','lat'], lng: ['longitud','longitude','lng','lon','long'], name: ['nombre','name','ubicacion','punto'], group: ['ruta','route','grupo','group','id'], type: ['tipo','type','geometria','geometry'], order: ['orden','order','secuencia','sequence'] };
  rows.forEach((row, index) => {
    const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalize(key), value]));
    if (Object.values(normalized).every(value => String(value ?? '').trim() === '')) return;
    const get = (field: keyof typeof aliases) => aliases[field].map(key => normalized[key]).find(value => value !== undefined && String(value).trim() !== '');
    let point: Coordinate;
    try { point = coordinate(get('lng'), get('lat')); } catch (error) { throw new Error(`${sheet ? `${sheet}, ` : ''}fila ${index + 2}: ${(error as Error).message}`); }
    const name = String(get('name') || get('group') || `Punto ${index + 1}`).slice(0,160);
    const kind = normalize(String(get('type') || 'punto'));
    if (['ruta','route','linea','linestring','poligono','polygon'].includes(kind)) {
      const key = `${String(get('group') || name)}:${kind}`;
      const group = groups.get(key) || { name: String(get('group') || name).slice(0,160), type: kind, rows: [] };
      const order = get('order') === undefined ? index : number(get('order'));
      if (!Number.isFinite(order)) throw new Error(`Fila ${index + 2}: orden inválido.`);
      group.rows.push({ point, order, index }); groups.set(key, group);
    } else {
      if (!['punto','point','ubicacion'].includes(kind)) throw new Error(`Fila ${index + 2}: tipo desconocido «${kind}». Use punto, ruta o poligono.`);
      const properties = Object.fromEntries(Object.entries(row).filter(([key]) => !['__proto__','constructor','prototype'].includes(key)).map(([key, value]) => [key.slice(0,100), String(value ?? '').slice(0,2000)]));
      features.push({ id: `feature-${features.length + 1}`, name, description: '', properties, geometries: [{ type: 'Point', coordinates: [point] }] });
    }
  });
  for (const group of groups.values()) {
    const coordinates = group.rows.sort((a,b) => a.order - b.order || a.index - b.index).map(row => row.point);
    const polygon = ['poligono','polygon'].includes(group.type);
    if (polygon && coordinates.length >= 3 && JSON.stringify(coordinates[0]) !== JSON.stringify(coordinates.at(-1))) coordinates.push({ ...coordinates[0] });
    features.push({ id: `feature-${features.length + 1}`, name: group.name, description: sheet, properties: {}, geometries: [{ type: polygon ? 'Polygon' : 'LineString', coordinates }] });
  }
  return { filename: '', features: validate(features), warnings: [] };
}
/** Text of a CSV as Excel saves it: UTF-8 (with or without BOM) or, on Spanish Windows, Windows-1252. */
export function decodeCsvText(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, ''); }
  catch { return new TextDecoder('windows-1252').decode(bytes); }
}
/** RFC 4180 CSV with the delimiter detected from the header (semicolon, comma or tab). Values stay text so «9,4981» keeps its decimal comma. */
export function parseCsvRows(text: string): Record<string, unknown>[] {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const outside = firstLine.replace(/"[^"]*"/g, '');
  const delimiter = [';', '\t', ','].map(candidate => ({ candidate, count: outside.split(candidate).length - 1 })).sort((a, b) => b.count - a.count)[0];
  const separator = delimiter.count ? delimiter.candidate : ',';
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) { if (char === '"' && text[index + 1] === '"') { field += '"'; index++; } else if (char === '"') quoted = false; else field += char; continue; }
    if (char === '"' && field === '') quoted = true;
    else if (char === separator) { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') { if (char === '\r' && text[index + 1] === '\n') index++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (rows.length > 25002) throw new Error('El CSV supera 25.000 filas. Divídalo.');
  const [header = [], ...body] = rows;
  const keys = header.map((key, index) => key.trim() || `columna${index + 1}`);
  return body.filter(values => values.some(value => value.trim() !== '')).map(values => Object.fromEntries(keys.map((key, index) => [key, (values[index] ?? '').trim()])));
}
export async function importGeographicFile(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>): Promise<ImportResult> {
  if (file.size > IMPORT_LIMITS.bytes) throw new Error('El archivo supera 25 MB. Divídalo antes de cargar.');
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if (!['kml','kmz','csv','xlsx','xls'].includes(extension || '')) throw new Error('Use KML, KMZ, CSV, XLSX o XLS.');
  const bytes = new Uint8Array(await file.arrayBuffer()); let result: ImportResult;
  if (extension === 'kml') result = parseKml(new TextDecoder().decode(bytes));
  else if (extension === 'kmz') {
    let expanded = 0;
    const archive = unzipSync(bytes, { filter: entry => { expanded += entry.originalSize; if (expanded > IMPORT_LIMITS.expandedBytes) throw new Error('El KMZ descomprimido supera 40 MB.'); return /\.kml$/i.test(entry.name); } });
    const names = Object.keys(archive).sort((a,b) => Number(/(^|\/)doc.kml$/i.test(b)) - Number(/(^|\/)doc.kml$/i.test(a)) || a.localeCompare(b));
    if (!names.length) throw new Error('El KMZ no contiene un archivo KML.');
    const parsed = names.map(name => parseKml(strFromU8(archive[name])));
    result = { filename: '', features: validate(parsed.flatMap(part => part.features).map((feature,index) => ({ ...feature, id: `feature-${index + 1}` }))), warnings: [...new Set(parsed.flatMap(part => part.warnings))] };
  } else if (extension === 'csv') {
    const rows = parseCsvRows(decodeCsvText(bytes));
    if (!rows.length) throw new Error('El archivo no contiene puntos, rutas o polígonos con coordenadas.');
    result = parseCoordinateRows(rows);
  } else {
    if(extension==='xlsx') { let expanded=0;unzipSync(bytes,{filter:entry=>{expanded+=entry.originalSize;if(expanded>IMPORT_LIMITS.expandedBytes)throw new Error('El Excel descomprimido supera 40 MB. Divida el archivo.');return false;}}); }
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(bytes, { type: 'array', dense: false, cellDates: true });
    const parsed = workbook.SheetNames.map(name => {
      const range=XLSX.utils.decode_range(workbook.Sheets[name]['!ref']||'A1');if(range.e.r-range.s.r>25001||range.e.c-range.s.c>100)throw new Error(`La hoja «${name}» supera 25.000 filas o 100 columnas. Divídala.`);
      const rows = XLSX.utils.sheet_to_json<Record<string,unknown>>(workbook.Sheets[name], { defval: '' });
      return rows.length ? parseCoordinateRows(rows, name) : null;
    }).filter((part): part is ImportResult => !!part);
    result = { filename: '', features: validate(parsed.flatMap(part => part.features).map((feature,index) => ({ ...feature, id: `feature-${index + 1}` }))), warnings: [] };
  }
  return { ...result, filename: file.name };
}
export function importedPoints(layers: GeographicLayer[]): TerritoryPoint[] {
  return layers.flatMap(layer => layer.features.flatMap(feature => feature.geometries.filter(geometry => geometry.type === 'Point').map((geometry,index) => ({ ...geometry.coordinates[0], id: `import-${layer.id}-${feature.id}-${index}`, recordId: layer.id, type: 'import' as const, name: feature.name, subtitle: layer.name, municipality: feature.properties.municipio || feature.properties.municipality || '', status: 'Importado' }))));
}
export function importedRoute(feature: GeoFeature): TerritorialRoute {
  const geometry = feature.geometries.find(item => item.type === 'LineString');
  if (!geometry || geometry.coordinates.length < 2) throw new Error('Seleccione una línea con dos puntos o más.');
  return { name: feature.name, geometry: geometry.coordinates, stops: [{ ...geometry.coordinates[0], name: `${feature.name}: inicio` }, { ...geometry.coordinates.at(-1)!, name: `${feature.name}: final` }], distanceMeters: geometry.coordinates.slice(1).reduce((sum,p,index) => sum + distanceBetween(geometry.coordinates[index],p),0), durationSeconds: 0, provider: 'Archivo', calculatedAt: new Date().toISOString() };
}
export function distanceBetween(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180; const lat = (b.latitude - a.latitude) * rad; const lng = (b.longitude - a.longitude) * rad;
  const value = Math.sin(lat/2)**2 + Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(lng/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0,1-value)));
}
/** Split into documents safely below Firestore's 1 MiB document limit. */
export function layerChunks(result: ImportResult, tenantId: string, name: string, actor: string): GeographicLayer[] {
  const importId = crypto.randomUUID(); const chunks: GeoFeature[][] = [[]];
  for (const feature of result.features) {
    if (new TextEncoder().encode(JSON.stringify(feature)).length > 600000) throw new Error(`El elemento «${feature.name}» es demasiado grande. Simplifique su geometría.`);
    const current = chunks.at(-1)!;
    if (new TextEncoder().encode(JSON.stringify([...current,feature])).length > 600000) chunks.push([feature]); else current.push(feature);
  }
  return chunks.map((features,index) => ({ id: `${tenantId}--geo-${importId}-${index}`, importId, tenantId, name: name.trim().slice(0,160) || result.filename, filename: result.filename, features, createdBy: actor, importedAt: new Date().toISOString() }));
}
