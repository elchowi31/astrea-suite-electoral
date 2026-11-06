import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, AdvancedMarker, Map, Pin, useMap } from '@vis.gl/react-google-maps';
import { googleLocationUrl, type Coordinate, type TerritoryPoint } from '../lib/territorialMaps';
import type { GeographicLayer } from '../lib/geographicImport';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
interface Props {
  center: Coordinate; points: TerritoryPoint[]; route: Coordinate[]; pickedLocation: Coordinate | null;
  onSelectPoint: (point: TerritoryPoint) => void; onPickLocation: (point: Coordinate) => void;
  geographicLayers?: GeographicLayer[]; fitCoordinates?:Coordinate[];fill?:boolean;onSelectFeature?:(layerId:string,featureId:string)=>void;
}
const GoogleOverlays: React.FC<Pick<Props, 'center' | 'route' | 'geographicLayers'|'fitCoordinates'|'onSelectFeature'>> = ({ center, route, geographicLayers=[], fitCoordinates,onSelectFeature }) => {
  const map = useMap();
  const featureCallback=useRef(onSelectFeature);featureCallback.current=onSelectFeature;
  useEffect(() => { map?.panTo({ lat: center.latitude, lng: center.longitude }); }, [map, center.latitude,center.longitude]);
  useEffect(() => {
    if (!map || route.length < 2) return;
    const line = new google.maps.Polyline({ map, path: route.map(point => ({ lat: point.latitude, lng: point.longitude })), strokeColor: '#00c9dd', strokeWeight: 5 });
    const bounds = new google.maps.LatLngBounds(); route.forEach(point => bounds.extend({ lat: point.latitude, lng: point.longitude })); map.fitBounds(bounds, 35);
    return () => line.setMap(null);
  }, [map, route]);
  useEffect(()=> {
    if(!map)return; const shapes:(google.maps.Polyline|google.maps.Polygon)[]=[];
    for(const layer of geographicLayers) for(const feature of layer.features) for(const geometry of feature.geometries) {
      if(geometry.type==='Point')continue; const path=geometry.coordinates.map(point=>({lat:point.latitude,lng:point.longitude}));
      const shape=geometry.type==='Polygon' ? new google.maps.Polygon({map,paths:[path,...(geometry.holes||[]).map(hole=>hole.coordinates.map(point=>({lat:point.latitude,lng:point.longitude})))],strokeColor:'#f59e0b',strokeWeight:3,fillColor:'#f59e0b',fillOpacity:0.12}) : new google.maps.Polyline({map,path,strokeColor:'#f59e0b',strokeWeight:4}); shapes.push(shape);
    }
    const items=geographicLayers.flatMap(layer=>layer.features.flatMap(feature=>feature.geometries.filter(g=>g.type!=='Point').map(()=>({layerId:layer.id,featureId:feature.id}))));
    shapes.forEach((shape,i)=>shape.addListener('click',()=>featureCallback.current?.(items[i].layerId,items[i].featureId)));
    return ()=>shapes.forEach(shape=>{google.maps.event.clearInstanceListeners(shape);shape.setMap(null);});
  },[map,geographicLayers]);
  useEffect(()=>{if(!map||!fitCoordinates?.length)return;const bounds=new google.maps.LatLngBounds();fitCoordinates.forEach(point=>bounds.extend({lat:point.latitude,lng:point.longitude}));map.fitBounds(bounds,35);if(fitCoordinates.length===1)map.setZoom(17);},[map,fitCoordinates]);
  return null;
};
export const GoogleTerritorialMap: React.FC<Props> = props => {
  const [failed, setFailed] = useState(!API_KEY);
  useEffect(() => {
    const previous = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => { setFailed(true); previous?.(); };
    return () => { (window as any).gm_authFailure = previous; };
  }, []);
  if (failed) return <div className="rounded-xl border border-amber-700 bg-slate-950 p-6 text-sm text-slate-300">
    <p>Google Maps no pudo cargar el visor. El mapa satelital y el mapa de calles siguen disponibles.</p>
    <a href={googleLocationUrl(props.center)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-cyan-300 underline">Abrir esta zona en Google Maps</a>
  </div>;
  return <APIProvider apiKey={API_KEY} onError={() => setFailed(true)}>
    <div className="isolate overflow-hidden" style={{ height: props.fill?'100%':'min(65vh, 560px)', minHeight: props.fill?0:360 }} data-testid="google-map">
      <Map defaultCenter={{ lat: props.center.latitude, lng: props.center.longitude }} defaultZoom={13}
        mapTypeId="hybrid" mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'} gestureHandling="greedy"
        onClick={event => { if (event.detail.latLng) props.onPickLocation({ latitude: event.detail.latLng.lat, longitude: event.detail.latLng.lng }); }}>
        {props.points.map(point => <AdvancedMarker key={point.id} position={{ lat: point.latitude, lng: point.longitude }} title={`Ver ${point.name}`} onClick={() => props.onSelectPoint(point)}>
          <Pin background={point.type === 'import' ? '#d97706' : point.type === 'leader' ? '#059669' : point.type==='member'?'#9333ea':'#2563eb'} borderColor="#fff" glyphColor="#fff" />
        </AdvancedMarker>)}
        {props.pickedLocation && <AdvancedMarker position={{ lat: props.pickedLocation.latitude, lng: props.pickedLocation.longitude }} title="Ubicación seleccionada"><Pin background="#f59e0b" /></AdvancedMarker>}
        <GoogleOverlays center={props.center} route={props.route} geographicLayers={props.geographicLayers} fitCoordinates={props.fitCoordinates} onSelectFeature={props.onSelectFeature}/>
      </Map>
    </div>
  </APIProvider>;
};
