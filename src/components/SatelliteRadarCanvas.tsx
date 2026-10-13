import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Expand, RotateCcw } from 'lucide-react';
import { ASTREA_CENTER, type Coordinate, type TerritoryPoint } from '../lib/territorialMaps';
import type { GeographicLayer } from '../lib/geographicImport';

export type BaseLayer = 'satellite' | 'streets';
interface SatelliteRadarCanvasProps {
  center?: Coordinate; points?: TerritoryPoint[]; selectedId?: string;
  layer?: BaseLayer; route?: Coordinate[]; pickedLocation?: Coordinate | null;
  onSelectPoint?: (point: TerritoryPoint) => void; onPickLocation?: (point: Coordinate) => void;
  compact?: boolean; geographicLayers?: GeographicLayer[]; fitCoordinates?: Coordinate[]; fitLabel?:string; markerLabels?: Record<string, string>;
}
export const SatelliteRadarCanvas: React.FC<SatelliteRadarCanvasProps> = ({ center = ASTREA_CENTER, points = [], selectedId,
  layer = 'satellite', route = [], pickedLocation, onSelectPoint, onPickLocation, compact = false, geographicLayers = [], fitCoordinates, fitLabel, markerLabels = {} }) => {
  const container = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null);
  const callbacks = useRef({ onSelectPoint, onPickLocation }); callbacks.current = { onSelectPoint, onPickLocation };
  const currentBounds = useRef<Coordinate[]>([]);
  currentBounds.current = fitCoordinates || [...points, ...route, ...geographicLayers.flatMap(layer => layer.features.flatMap(feature => feature.geometries.flatMap(geometry => geometry.coordinates)))];
  const [tileFailure, setTileFailure] = useState(false); const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    // Leaflet 1.x puede terminar una animación después de retirar el mapa al cambiar de vista.
    const instance = L.map(container.current, { center: [center.latitude, center.longitude], zoom: compact ? 14 : 13,
      minZoom: 3, maxZoom: 20, scrollWheelZoom: !compact, zoomAnimation: false, markerZoomAnimation: false });
    map.current = instance;
    instance.on('click', event => callbacks.current.onPickLocation?.({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
    L.control.scale({ imperial: false }).addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize()); observer.observe(container.current);
    return () => { observer.disconnect(); instance.stop(); instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current; if (!instance) return;
    setTileFailure(false); let loaded = false;
    const tiles = layer === 'satellite'
      ? L.tileLayer(import.meta.env.VITE_SATELLITE_TILE_URL || 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 20, maxNativeZoom: 20, attribution: 'Imágenes © <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noreferrer">Esri</a>, Vantor, Earthstar Geographics y GIS User Community' })
      : L.tileLayer(import.meta.env.VITE_STREET_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 20, maxNativeZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' });
    tiles.on('tileload', () => { loaded = true; setTileFailure(false); });
    tiles.on('tileerror', () => { if (!loaded) setTileFailure(true); }); tiles.addTo(instance);
    const labels = layer === 'satellite' ? L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 20, maxNativeZoom: 19, pane: 'overlayPane', attribution: 'Rótulos © Esri' }).addTo(instance) : null;
    return () => { instance.removeLayer(tiles); if (labels) instance.removeLayer(labels); };
  }, [layer]);
  useEffect(() => { map.current?.setView([center.latitude, center.longitude], map.current.getZoom()); }, [center.latitude, center.longitude]);

  useEffect(() => {
    const instance = map.current; if (!instance) return;
    const markers = L.layerGroup().addTo(instance);
    for (const point of points) {
      const color = point.type === 'import' ? '#d97706' : point.type === 'leader' ? '#059669' : '#2563eb';
      const active = point.id === selectedId;
      const badge = markerLabels[point.id];
      const size = badge ? 32 : 20;
      const marker = document.createElement('span');
      marker.style.cssText = `display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:${color};color:white;font-size:16px;font-weight:800;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px #0009${active ? ',0 0 0 5px #22d3ee99' : ''}`;
      marker.textContent = badge || '';
      const icon = L.divIcon({ className: '', html: marker, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      const label = document.createElement('span'); label.textContent = point.name;
      L.marker([point.latitude, point.longitude], { icon, title: `Ver ${point.name}`, alt: point.name, keyboard: true })
        .bindTooltip(label).on('click', () => callbacks.current.onSelectPoint?.(point)).addTo(markers);
    }
    return () => { instance.removeLayer(markers); };
  }, [points, selectedId, markerLabels]);
  useEffect(() => {
    const instance = map.current; if (!instance) return;
    const group = L.layerGroup().addTo(instance);
    for (const layer of geographicLayers) for (const feature of layer.features) for (const geometry of feature.geometries) {
      if (geometry.type === 'Point') continue;
      const coordinates = geometry.coordinates.map(point=>[point.latitude,point.longitude] as L.LatLngTuple);
      const shape = geometry.type === 'Polygon' ? L.polygon([coordinates,...(geometry.holes||[]).map(hole=>hole.coordinates.map(point=>[point.latitude,point.longitude] as L.LatLngTuple))],{color:'#f59e0b',weight:3,fillOpacity:0.12}) : L.polyline(coordinates,{color:'#f59e0b',weight:4});
      const label=document.createElement('span');label.textContent=feature.name;shape.bindTooltip(label).addTo(group);
    }
    return () => { instance.removeLayer(group); };
  },[geographicLayers]);
  useEffect(() => {
    const instance = map.current; if (!instance || !pickedLocation) return;
    const marker = L.circleMarker([pickedLocation.latitude, pickedLocation.longitude], { radius: 10, color: '#fff', fillColor: '#f59e0b', fillOpacity: 1, weight: 3 }).addTo(instance);
    return () => { instance.removeLayer(marker); };
  }, [pickedLocation]);
  useEffect(() => {
    const instance = map.current; if (!instance || route.length < 2) return;
    const line = L.polyline(route.map(point => [point.latitude, point.longitude] as L.LatLngTuple), { color: '#22d3ee', weight: 5, opacity: 0.95 }).addTo(instance);
    instance.fitBounds(line.getBounds(), { padding: [35, 35], maxZoom: 15 });
    return () => { instance.removeLayer(line); };
  }, [route]);
  useEffect(() => {
    if (fitCoordinates?.length) map.current?.fitBounds(L.latLngBounds(fitCoordinates.map(point => [point.latitude, point.longitude])), {padding: [35, 35], maxZoom: fitCoordinates.length > 1 ? 19 : 17});
  }, [fitCoordinates]);
  const fitPoints = () => {
    const rows = currentBounds.current;
    if (rows.length) map.current?.fitBounds(L.latLngBounds(rows.map(point => [point.latitude, point.longitude])), { padding: [35, 35], maxZoom: fitCoordinates && rows.length > 1 ? 19 : 16 });
    else map.current?.setView([center.latitude, center.longitude], 13);
  };
  return <div className="relative isolate z-0 overflow-hidden rounded-xl border border-slate-700" data-testid="satellite-map">
    <div ref={container} aria-label={layer === 'satellite' ? 'Mapa satelital HD' : 'Mapa de calles'} style={{ height: compact ? 260 : expanded ? 'min(80vh, 800px)' : 'min(65vh, 560px)', minHeight: compact ? 260 : 360 }} />
    <div className="absolute right-3 top-3 z-[1000] flex gap-1 rounded-lg bg-slate-950/90 p-1 text-white shadow-lg">
      <button type="button" aria-label={fitLabel || (fitCoordinates ? 'Ver recorrido completo' : 'Ajustar ubicaciones')} title={fitLabel || (fitCoordinates ? 'Ver recorrido completo' : 'Ajustar ubicaciones')} onClick={fitPoints} className="min-h-12 min-w-12 rounded p-3 hover:bg-slate-700"><Crosshair size={20} /></button>
      <button type="button" aria-label="Centrar mapa" title="Centrar mapa" onClick={() => map.current?.setView([center.latitude, center.longitude], 13)} className="min-h-12 min-w-12 rounded p-3 hover:bg-slate-700"><RotateCcw size={20} /></button>
      {!compact && <button type="button" aria-label={expanded ? 'Reducir mapa' : 'Ampliar mapa'} title={expanded ? 'Reducir mapa' : 'Ampliar mapa'} onClick={() => setExpanded(value => !value)} className="min-h-12 min-w-12 rounded p-3 hover:bg-slate-700"><Expand size={20} /></button>}
    </div>
    {tileFailure && <p role="alert" className="absolute left-14 right-3 top-16 z-[1000] rounded-lg bg-slate-950/95 p-3 text-xs text-amber-200">No se pudieron cargar las imágenes. Cambie a Calles o Google Maps y compruebe la conexión.</p>}
  </div>;
};
