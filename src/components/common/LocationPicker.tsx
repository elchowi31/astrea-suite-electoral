import React, { lazy, Suspense, useMemo, useState } from 'react';
import { currentDeviceLocation, parseLocation, ASTREA_CENTER } from '../../lib/territorialMaps';
const SatelliteRadarCanvas = lazy(() => import('../SatelliteRadarCanvas').then(module => ({ default: module.SatelliteRadarCanvas })));
export const LocationPicker: React.FC<{ latitude: string; longitude: string; onChange: (latitude: string, longitude: string) => void }> = ({ latitude, longitude, onChange }) => {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const picked = useMemo(() => { try { return parseLocation(latitude, longitude) || null; } catch { return null; } }, [latitude, longitude]);
  return <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-xs text-slate-300">Latitud (opcional)<input aria-label="Latitud (opcional)" type="number" min="-90" max="90" step="any" value={latitude} onChange={event => onChange(event.target.value, longitude)} placeholder="Ej: 9.4981" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 font-mono" /></label>
      <label className="text-xs text-slate-300">Longitud (opcional)<input aria-label="Longitud (opcional)" type="number" min="-180" max="180" step="any" value={longitude} onChange={event => onChange(latitude, event.target.value)} placeholder="Ej: -73.9785" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 font-mono" /></label>
    </div>
    <div className="flex flex-wrap gap-3 text-xs">
      <button type="button" className="text-cyan-300 underline" onClick={() => setOpen(value => !value)}>{open ? 'Ocultar mapa' : 'Seleccionar ubicación en mapa'}</button>
      <button type="button" disabled={busy} className="text-emerald-300 underline disabled:opacity-50" onClick={async () => { setBusy(true); setMessage(''); try { const point = await currentDeviceLocation(); onChange(point.latitude.toFixed(7), point.longitude.toFixed(7)); setMessage(`Ubicación obtenida; precisión aproximada de ${Math.round(point.accuracy)} m.`); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }}>{busy ? 'Obteniendo GPS…' : 'Usar mi ubicación GPS'}</button>
    </div>
    {message && <p role="status" className="text-xs text-slate-300">{message}</p>}
    {open && <><p className="text-xs text-slate-400">Toque el punto exacto en el mapa. La ubicación se guarda al enviar el formulario.</p><Suspense fallback={<p className="text-xs">Cargando mapa…</p>}><SatelliteRadarCanvas compact center={picked || ASTREA_CENTER} pickedLocation={picked} onPickLocation={point => onChange(point.latitude.toFixed(7), point.longitude.toFixed(7))} /></Suspense></>}
  </section>;
};
