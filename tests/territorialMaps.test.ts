import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRoadRoute, googleDirectionsUrl, parseLocation, territoryPoints } from '../src/lib/territorialMaps';
import type { Leader, TransportVehicle } from '../src/types';

test('A missing location never becomes a fabricated point, including a partly completed location', () => {
  const leaders = [{ id: 'one', fullName: 'Sin coordenadas' }, { id: 'two', latitude: 9.5 },
    { id: 'three', latitude: 0, longitude: 0 }, { id: 'four', latitude: 91, longitude: -74 }] as Leader[];
  const vehicles = [{ id: 'vehicle', latitude: 9.4981, longitude: -73.9785 }] as TransportVehicle[];
  assert.deepEqual(territoryPoints(leaders, vehicles).map(point => point.id), ['leader-three', 'vehicle-vehicle']);
  assert.equal(parseLocation('', ''), undefined);
  for (const [lat, lng] of [['', '0'], ['0', ''], ['91', '0'], ['0', '181'], ['NaN', '0']]) assert.throws(() => parseLocation(lat, lng));
});
test('Google navigation preserves the actual origin, destination and ordered intermediate stops', () => {
  const stops = [{ latitude: 9.5, longitude: -74 }, { latitude: 9.6, longitude: -73.9 }, { latitude: 9.7, longitude: -73.8 }];
  const url = new URL(googleDirectionsUrl(stops));
  assert.equal(url.searchParams.get('origin'), '9.5,-74'); assert.equal(url.searchParams.get('destination'), '9.7,-73.8');
  assert.equal(url.searchParams.get('waypoints'), '9.6,-73.9'); assert.equal(url.searchParams.get('travelmode'), 'driving');
  assert.throws(() => googleDirectionsUrl(stops.slice(0, 1)));
});
test('Road routing rejects a provider failure instead of drawing a fictitious road', async () => {
  const previous = globalThis.fetch;
  const stops = [{ name: 'Origen', latitude: 9.5, longitude: -74 }, { name: 'Destino', latitude: 9.6, longitude: -73.9 }];
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'NoRoute' }), { status: 200 });
    await assert.rejects(calculateRoadRoute(stops), /No se encontró/);
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 1000, duration: 120,
      geometry: { coordinates: [[-74, 9.5], [-73.95, 9.57], [-73.9, 9.6]] } }] }), { status: 200 });
    const route = await calculateRoadRoute(stops);
    assert.equal(route.distanceMeters, 1000); assert.equal(route.durationSeconds, 120);
    assert.deepEqual(route.geometry[1], { latitude: 9.57, longitude: -73.95 });
  } finally { globalThis.fetch = previous; }
});
