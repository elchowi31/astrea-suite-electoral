import { EntrepreneurProspect, ProspectElectoralRole } from '../types';

/**
 * Intelligent Parser for Colombian Electoral Characterizations and Surveys
 * Handles unquoted commas, scientific notation in cedulas/phones, and WKT coordinates
 */

export function cleanCedula(raw: string | number | undefined): string {
  if (!raw) return '';
  const str = String(raw).trim();
  // Check for scientific notation e.g. 1.063427697E9
  if (/^[0-9.]+[eE]\+?[0-9]+$/.test(str)) {
    try {
      const num = Number(str);
      if (!isNaN(num)) return Math.round(num).toString();
    } catch {
      // fallback
    }
  }
  // Remove non-alphanumeric except hyphens
  return str.replace(/[^0-9a-zA-Z-]/g, '').trim();
}

export function cleanPhone(raw: string | number | undefined): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (str.toLowerCase().includes('no tiene')) return '';
  // Check for scientific notation
  if (/^[0-9.]+[eE]\+?[0-9]+$/.test(str)) {
    try {
      const num = Number(str);
      if (!isNaN(num)) return Math.round(num).toString();
    } catch {
      // fallback
    }
  }
  // Extract 10 digit Colombian mobile numbers (starts with 3)
  const mobileMatch = str.match(/3\d{9}/);
  if (mobileMatch) return mobileMatch[0];
  return str.replace(/[^\d\s\-_/]/g, '').trim();
}

export function parseWktPoint(wkt: string): { lat: number; lng: number } | null {
  if (!wkt) return null;
  // POINT (-73.973942 9.500013) -> [lng, lat]
  const match = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (match) {
    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Robust line parser that handles survey rows with unquoted internal commas
 */
export function parseAstreaCharacterizationCsv(
  csvText: string,
  tenantId: string = 'tenant-astrea'
): EntrepreneurProspect[] {
  if (!csvText || !csvText.trim()) return [];

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const results: EntrepreneurProspect[] = [];

  // Identify header
  let startIdx = 0;
  if (lines[0].toLowerCase().includes('wkt') || lines[0].toLowerCase().includes('nombre')) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 1. Extract WKT POINT if present: POINT (-73.973942 9.500013)
    let wkt = '';
    let lat = 0;
    let lng = 0;
    let remainingLine = line;

    const pointMatch = line.match(/^POINT\s*\([^)]+\)/i);
    if (pointMatch) {
      wkt = pointMatch[0];
      const coords = parseWktPoint(wkt);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
      remainingLine = line.slice(wkt.length).replace(/^,\s*/, '');
    }

    // 2. Tokenize the remaining line intelligently
    // In these surveys, standard tokens are:
    // [Numero de identificacion, Nombre, Ubicacion, Latitud, Longitud, Es Victima?, SEXO, Actividad, Celular, Continuacion...]
    // Note: Sometimes internal commas appear in: "Tienda o Comercio Local, ( Tiendas Pequeñas, Ventas en casa de otros productos)"
    const rawTokens = remainingLine.split(',').map((t) => t.trim());

    // Fallback coordinate search if WKT wasn't at the beginning
    if (lat === 0 || lng === 0) {
      for (let t = 0; t < rawTokens.length; t++) {
        const val = parseFloat(rawTokens[t]);
        if (!isNaN(val)) {
          if (val > 8.0 && val < 11.5 && lat === 0) lat = val;
          if (val < -72.0 && val > -76.0 && lng === 0) lng = val;
        }
      }
    }

    // Find Gender
    const gender = rawTokens.find((t) => /^(Hombre|Mujer|LBTIQ\+|LGBTI|Otro)$/i.test(t)) || 'Mujer';

    // Find Victim
    const victimToken = rawTokens.find((t) => /^(Sí|Si|No)$/i.test(t));
    const isViolenceVictim = victimToken ? /^(Sí|Si)$/i.test(victimToken) : false;

    // Find Location Category
    let locationCategory = 'Casco Urbano Astrea';
    if (rawTokens.some((t) => /corregimiento/i.test(t))) {
      locationCategory = 'Corregimiento';
    } else if (rawTokens.some((t) => /vereda/i.test(t))) {
      locationCategory = 'Vereda';
    } else if (rawTokens.some((t) => /finca/i.test(t))) {
      locationCategory = 'Finca';
    } else if (rawTokens.some((t) => /casco urbano/i.test(t))) {
      locationCategory = 'Casco Urbano Astrea';
    }

    // Specific territory detection (Arjona, San Isidro, etc.)
    let specificTerritory = '';
    const fullLineLower = line.toLowerCase();
    if (fullLineLower.includes('arjona')) {
      specificTerritory = 'Arjona';
    } else if (fullLineLower.includes('san isidro')) {
      specificTerritory = 'San Isidro';
    } else if (fullLineLower.includes('santa cecilia')) {
      specificTerritory = 'Santa Cecilia';
    } else if (fullLineLower.includes('cascajal')) {
      specificTerritory = 'Cascajal';
    } else if (locationCategory === 'Casco Urbano Astrea') {
      specificTerritory = 'Cabecera Municipal';
    }

    // Identify Name and Cédula
    let documentId = '';
    let fullName = '';

    // First two tokens after WKT are usually ID and Name (or Name and ID)
    const token0 = rawTokens[0] || '';
    const token1 = rawTokens[1] || '';

    if (/^\d{6,12}$/.test(token0.replace(/[.\s]/g, '')) || /^[0-9.]+[eE]\+?[0-9]+$/.test(token0)) {
      documentId = cleanCedula(token0);
      fullName = token1;
    } else if (/^\d{6,12}$/.test(token1.replace(/[.\s]/g, '')) || /^[0-9.]+[eE]\+?[0-9]+$/.test(token1)) {
      documentId = cleanCedula(token1);
      fullName = token0;
    } else {
      // Look for a numeric token in the first 4 tokens
      const numToken = rawTokens.slice(0, 4).find((t) => /^\d{6,12}$/.test(t.replace(/[.\s]/g, '')));
      if (numToken) {
        documentId = cleanCedula(numToken);
        const nameToken = rawTokens.slice(0, 4).find((t) => t !== numToken && t.length > 4 && !/^(punto|point|casco|vereda)/i.test(t));
        fullName = nameToken || `Emprendedor ${i}`;
      } else {
        fullName = token0 || token1 || `Emprendedor Astrea ${i}`;
        documentId = `AST-${1000 + i}`;
      }
    }

    // Clean up Name
    fullName = fullName.replace(/^(POINT\s*\([^)]*\)|Corregimiento|Vereda|Casco Urbano)/gi, '').trim();
    if (!fullName || fullName.length < 2) fullName = `Emprendedor ${i + 1}`;

    // Economic Activity
    let economicActivity = 'Comercio Local';
    if (fullLineLower.includes('tienda o comercio local')) {
      economicActivity = 'Tienda o Comercio Local';
    } else if (fullLineLower.includes('venta ambulante')) {
      economicActivity = 'Venta Ambulante';
    } else if (fullLineLower.includes('venta de alimentos')) {
      economicActivity = 'Venta de Alimentos';
    } else if (fullLineLower.includes('artesanías') || fullLineLower.includes('artesanias')) {
      economicActivity = 'Artesanías';
    } else if (fullLineLower.includes('taller') || fullLineLower.includes('motos') || fullLineLower.includes('mecanic')) {
      economicActivity = 'Talleres y Servicios';
    } else if (fullLineLower.includes('cria') || fullLineLower.includes('cerdo') || fullLineLower.includes('pollo') || fullLineLower.includes('galpón')) {
      economicActivity = 'Agropecuario y Cría';
    } else {
      economicActivity = 'Otros Emprendimientos';
    }

    // Sub-activity / Detail (from the last tokens)
    let subActivity = '';
    const detailCandidates = rawTokens.filter((t) => {
      if (!t || t.length < 3) return false;
      if (t === fullName || t === documentId) return false;
      if (/^(Casco|Corregimiento|Vereda|Finca|Hombre|Mujer|Sí|No|Point)/i.test(t)) return false;
      if (/^\d+(\.\d+)?$/.test(t)) return false;
      if (/^(Tienda|Venta Ambulante|Venta de Alimentos|Artesanías|Otros)/i.test(t)) return false;
      return true;
    });

    if (detailCandidates.length > 0) {
      subActivity = detailCandidates[detailCandidates.length - 1].replace(/[()]/g, '').trim();
    }

    // Phone detection
    let phone = '';
    for (let p = rawTokens.length - 1; p >= 0; p--) {
      const pCand = cleanPhone(rawTokens[p]);
      if (pCand && pCand.length >= 7) {
        phone = pCand;
        break;
      }
    }

    // Political & Electoral Potential Assessment
    let electoralRole: ProspectElectoralRole = 'Votante Comprometido';
    let potentialVotes = 12;

    if (economicActivity === 'Tienda o Comercio Local') {
      electoralRole = 'Líder de Equipo en Potencia';
      potentialVotes = 35; // Tiendas tienen alta afluencia vecinal diaria
    } else if (economicActivity === 'Talleres y Servicios') {
      electoralRole = 'Punto de Encuentro / Logístico';
      potentialVotes = 25; // Punto de concentración comunitario
    } else if (economicActivity === 'Venta de Alimentos') {
      electoralRole = 'Líder de Equipo en Potencia';
      potentialVotes = 20;
    } else if (economicActivity === 'Venta Ambulante') {
      electoralRole = 'Multiplicador Territorial';
      potentialVotes = 15;
    } else if (economicActivity === 'Artesanías') {
      electoralRole = 'Votante Comprometido';
      potentialVotes = 14;
    }

    // Assigned Group assignment for campaign structure
    let assignedGroupName = 'Comercio y Tiendas Astrea';
    if (specificTerritory === 'Arjona') {
      assignedGroupName = 'Comité Arjona Rural';
    } else if (locationCategory === 'Vereda' || locationCategory === 'Finca') {
      assignedGroupName = 'Red Agropecuaria y Veredal';
    } else if (economicActivity === 'Venta de Alimentos') {
      assignedGroupName = 'Gastronomía y Alimentación';
    } else if (economicActivity === 'Venta Ambulante') {
      assignedGroupName = 'Sector Movilidad y Comercio Ambulante';
    } else if (economicActivity === 'Artesanías') {
      assignedGroupName = 'Mujeres y Artesanos';
    }

    results.push({
      id: `prospect-${documentId || i + 1}`,
      tenantId,
      wkt: wkt || `POINT (${lng.toFixed(6)} ${lat.toFixed(6)})`,
      documentId: documentId || `7718${i}`,
      fullName: fullName || `Líder Potencial ${i + 1}`,
      locationCategory,
      veredaOrBarrio: specificTerritory || locationCategory,
      latitude: lat || 9.5000,
      longitude: lng || -73.9739,
      isViolenceVictim,
      gender,
      economicActivity,
      subActivity: subActivity || undefined,
      phone,
      electoralRole,
      assignedGroupId: assignedGroupName.toLowerCase().replace(/\s+/g, '-'),
      assignedGroupName,
      conversionStatus: 'Prospecto',
      potentialVotes,
      notes: `${economicActivity} ${subActivity ? `(${subActivity})` : ''} - Caracterización Oficial Astrea 2026`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return results;
}

/**
 * Parser for Google Earth / GIS KML files
 */
export function parseKmlToProspects(
  kmlText: string,
  tenantId: string = 'tenant-astrea'
): {
  prospects: EntrepreneurProspect[];
  polygonsCount: number;
} {
  const prospects: EntrepreneurProspect[] = [];
  let polygonsCount = 0;

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

    const placemarks = Array.from(xmlDoc.getElementsByTagName('Placemark'));

    placemarks.forEach((pm, idx) => {
      const name = pm.getElementsByTagName('name')?.[0]?.textContent?.trim() || `Punto KML ${idx + 1}`;
      const description = pm.getElementsByTagName('description')?.[0]?.textContent?.trim() || '';
      
      // Check for Point coordinates
      const pointEl = pm.getElementsByTagName('Point')?.[0];
      if (pointEl) {
        const coordsText = pointEl.getElementsByTagName('coordinates')?.[0]?.textContent?.trim() || '';
        if (coordsText) {
          // KML coordinates format: lng,lat,alt
          const parts = coordsText.split(',').map((p) => parseFloat(p.trim()));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const lng = parts[0];
            const lat = parts[1];

            // Parse metadata from description if it has key-values
            const phoneMatch = description.match(/3\d{9}/);
            const cedulaMatch = description.match(/\b\d{7,10}\b/);

            prospects.push({
              id: `kml-${Date.now()}-${idx}`,
              tenantId,
              wkt: `POINT (${lng.toFixed(6)} ${lat.toFixed(6)})`,
              documentId: cedulaMatch ? cedulaMatch[0] : `KML-${idx + 1}`,
              fullName: name,
              locationCategory: 'Casco Urbano Astrea',
              veredaOrBarrio: 'Cargado desde KML',
              latitude: lat,
              longitude: lng,
              isViolenceVictim: description.toLowerCase().includes('víctima') || description.toLowerCase().includes('victima'),
              gender: 'Mujer',
              economicActivity: description.includes('Tienda') ? 'Tienda o Comercio Local' : 'Emprendimiento KML',
              subActivity: description.slice(0, 60),
              phone: phoneMatch ? phoneMatch[0] : '',
              electoralRole: 'Líder de Equipo en Potencia',
              assignedGroupId: 'kml-import',
              assignedGroupName: 'Importación KML Territorial',
              conversionStatus: 'Prospecto',
              potentialVotes: 20,
              notes: `Importado desde archivo KML: ${description}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      // Check for Polygons
      const polyEl = pm.getElementsByTagName('Polygon')?.[0];
      if (polyEl) {
        polygonsCount++;
      }
    });
  } catch (err) {
    console.error('Error parsing KML file:', err);
  }

  return { prospects, polygonsCount };
}

/**
 * Generate KML content from prospects for export to Google Earth
 */
export function generateProspectsKml(
  prospects: EntrepreneurProspect[],
  title: string = 'Emprendimientos y Lideres Astrea 2026'
): string {
  const placemarksXml = prospects
    .filter((p) => p.latitude && p.longitude)
    .map((p) => {
      const safeName = (p.fullName || 'Emprendedor').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeDesc = `
        <![CDATA[
          <h3>${safeName}</h3>
          <p><strong>Cédula:</strong> ${p.documentId}</p>
          <p><strong>Teléfono:</strong> ${p.phone || 'Sin registrar'}</p>
          <p><strong>Ubicación:</strong> ${p.locationCategory} (${p.veredaOrBarrio || 'Astrea'})</p>
          <p><strong>Actividad:</strong> ${p.economicActivity} ${p.subActivity ? `- ${p.subActivity}` : ''}</p>
          <p><strong>Rol Proyectado:</strong> ${p.electoralRole}</p>
          <p><strong>Votos Potenciales:</strong> ${p.potentialVotes}</p>
          <p><strong>Víctima de Violencia:</strong> ${p.isViolenceVictim ? 'Sí' : 'No'}</p>
        ]]>
      `.trim();

      return `
    <Placemark id="${p.id}">
      <name>${safeName}</name>
      <description>${safeDesc}</description>
      <Point>
        <coordinates>${p.longitude},${p.latitude},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${title}</name>
    <description>Caracterización Territorial de Emprendimientos, Votantes y Líderes en Potencia - Municipio de Astrea, Cesar</description>
${placemarksXml}
  </Document>
</kml>`;
}
