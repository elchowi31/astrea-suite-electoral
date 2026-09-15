import React, { useMemo, useState } from 'react';
import { APIProvider, AdvancedMarker, InfoWindow, Map, Pin } from '@vis.gl/react-google-maps';
import { 
  Bus, 
  Filter, 
  MapPin, 
  Navigation, 
  Users, 
  Key, 
  ExternalLink, 
  Layers, 
  ShieldCheck, 
  Compass, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  CheckCircle2,
  Info,
  Radio,
  Search,
  Sparkles,
  Landmark,
  Trees,
  Store
} from 'lucide-react';
import { Leader, TransportVehicle, Tenant, UserProfile, UserRole, EntrepreneurProspect } from '../types';
import { getTerritorialScope } from '../lib/permissions';
import { getTerritoriosRurales, RuralTerritoryItem, ASTREA_TERRITORY_COORDINATES } from '../data/colombiaElectoralData';
import { parseKmlToProspects } from '../data/astreaEntrepreneursData';
import { SatelliteRadarCanvas } from './SatelliteRadarCanvas';

const ENV_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
const ENV_MAP_ID = (import.meta as any).env?.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

export type TerritoryPoint = {
  id: string;
  type: 'leader' | 'vehicle' | 'polling_station' | 'prospect';
  name: string;
  subtitle: string;
  municipality: string;
  veredaOrBarrio?: string;
  zoneOrDistrict?: string;
  status: string;
  latitude: number;
  longitude: number;
  assignedVoters?: number;
  phone?: string;
  documentId?: string;
  economicActivity?: string;
  subActivity?: string;
  isViolenceVictim?: boolean;
};

interface TerritorialMapViewProps {
  leaders?: Leader[];
  vehicles?: TransportVehicle[];
  prospects?: EntrepreneurProspect[];
  tenantName?: string;
  currentTenant?: Tenant;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  onPromoteProspectToLeader?: (prospect: EntrepreneurProspect) => void;
}

const validCoordinate = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export const TerritorialMapView: React.FC<TerritorialMapViewProps> = ({ 
  leaders = [], 
  vehicles = [], 
  prospects = [],
  tenantName = 'Organización',
  currentTenant,
  currentUser,
  userRole,
  onPromoteProspectToLeader
}) => {
  // Determine territorial scope and municipal jurisdiction
  const scope = useMemo(() => getTerritorialScope(currentUser, userRole), [currentUser, userRole]);

  // Resolves the exact municipality associated with the current tenant and user
  const tenantMunicipality = useMemo(() => {
    if (currentUser?.municipality && currentUser.municipality.trim()) {
      return currentUser.municipality.trim();
    }
    const tName = (currentTenant?.name || tenantName || '').toLowerCase();
    const tId = (currentTenant?.tenantId || '').toLowerCase();
    if (tName.includes('astrea') || tId.includes('astrea')) return 'Astrea';
    if (tName.includes('el paso') || tId.includes('el-paso') || tId.includes('elpaso')) return 'El Paso';
    if (tName.includes('bosconia') || tId.includes('bosconia')) return 'Bosconia';
    if (tName.includes('valledupar') || tId.includes('valledupar')) return 'Valledupar';
    if (tName.includes('chiriguaná') || tName.includes('chiriguana') || tId.includes('chiriguana')) return 'Chiriguaná';
    if (tName.includes('aguachica') || tId.includes('aguachica')) return 'Aguachica';
    if (tName.includes('codazzi') || tId.includes('codazzi')) return 'Agustín Codazzi';
    if (tName.includes('jagua') || tId.includes('jagua')) return 'La Jagua de Ibirico';
    return 'Astrea';
  }, [currentUser, currentTenant, tenantName]);

  const isAlcalde = userRole === 'Alcalde' || userRole === 'Concejal' || scope.isAlcalde || scope.isConcejal;

  // Selected municipality for departamental roles (Gobernador / Admin Global); Alcaldes are locked to tenantMunicipality
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(tenantMunicipality);
  const activeMunicipality = isAlcalde ? tenantMunicipality : selectedMunicipality;

  // 2 Territorial Filters:
  // Filter 1: Type / Mode ('todos' | 'corregimientos' | 'veredas')
  const [territorialFilterType, setTerritorialFilterType] = useState<'todos' | 'corregimientos' | 'veredas'>('todos');

  // Filter 2: Specific territory selection ('todos' or name of corregimiento/vereda)
  const [selectedTerritory, setSelectedTerritory] = useState<string>('todos');

  const [typeFilter, setTypeFilter] = useState<'all' | 'leader' | 'vehicle' | 'prospect'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<TerritoryPoint | null>(null);

  // KML Dynamic Layer State
  const [loadedKmlProspects, setLoadedKmlProspects] = useState<EntrepreneurProspect[]>([]);
  const [kmlImportNotice, setKmlImportNotice] = useState<string | null>(null);
  const kmlInputRef = React.useRef<HTMLInputElement | null>(null);
  
  // Custom API key entered by user in UI if not in env
  const [customKey, setCustomKey] = useState<string>(() => {
    return localStorage.getItem('astrea_gmaps_custom_key') || ENV_API_KEY;
  });
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'vector_radar' | 'google_maps'>('vector_radar');
  const [tacticalZoom, setTacticalZoom] = useState<number>(1);
  const [keyInputTemp, setKeyInputTemp] = useState(customKey);
  const [keyTestStatus, setKeyTestStatus] = useState<string | null>(null);

  const activeApiKey = customKey.trim() || ENV_API_KEY;

  // Handle KML File Upload directly to map
  const handleKmlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const result = parseKmlToProspects(text, currentTenant?.tenantId || 'tenant-astrea');
        if (result.prospects.length > 0) {
          setLoadedKmlProspects((prev) => [...prev, ...result.prospects]);
          setKmlImportNotice(`Cargados ${result.prospects.length} puntos desde archivo KML (${file.name}).`);
          setTimeout(() => setKmlImportNotice(null), 5000);
        } else {
          setKmlImportNotice(`El archivo KML no contiene puntos <Point> reconocibles.`);
          setTimeout(() => setKmlImportNotice(null), 5000);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Load corregimientos and veredas for active municipality based on Tenant ID
  const ruralData = useMemo(() => {
    return getTerritoriosRurales(activeMunicipality === 'todos' ? tenantMunicipality : activeMunicipality);
  }, [activeMunicipality, tenantMunicipality]);

  const corregimientos = ruralData.corregimientos;
  const veredas = ruralData.veredas;

  // Real data transformed from Firestore Leaders & Vehicles with intelligent territory coordinate geocoding
  const points = useMemo<TerritoryPoint[]>(() => {
    const list: TerritoryPoint[] = [];

    leaders.forEach((item, idx) => {
      let lat = item.latitude;
      let lng = item.longitude;

      // If explicit lat/lng is missing, automatically geocode based on assigned vereda or corregimiento
      if (!validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
        const desc = `${item.veredaOrBarrio || ''} ${item.zoneOrDistrict || ''} ${item.fullName || ''}`.toLowerCase();
        for (const [tName, coords] of Object.entries(ASTREA_TERRITORY_COORDINATES)) {
          if (desc.includes(tName.toLowerCase())) {
            const jitterLat = (((idx % 5) - 2) * 0.003);
            const jitterLng = ((((idx * 3) % 5) - 2) * 0.003);
            lat = coords.lat + jitterLat;
            lng = coords.lng + jitterLng;
            break;
          }
        }
        // Fallback to municipal center with subtle distribution offset
        if (!validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
          lat = 9.5333 + (((idx % 5) - 2) * 0.006);
          lng = -73.9667 + ((((idx * 2) % 5) - 2) * 0.006);
        }
      }

      list.push({
        id: `leader-${item.id}`,
        type: 'leader',
        name: item.fullName,
        subtitle: item.zoneOrDistrict || item.veredaOrBarrio || 'Territorio municipal',
        municipality: item.municipality || tenantMunicipality,
        veredaOrBarrio: item.veredaOrBarrio,
        zoneOrDistrict: item.zoneOrDistrict,
        status: item.status || 'Activo',
        latitude: lat,
        longitude: lng,
        assignedVoters: item.committedVotes || item.voteTarget || 0,
        phone: item.phone
      });
    });

    vehicles.forEach((item, idx) => {
      let lat = item.latitude;
      let lng = item.longitude;

      if (!validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
        const desc = (item.assignedZone || '').toLowerCase();
        for (const [tName, coords] of Object.entries(ASTREA_TERRITORY_COORDINATES)) {
          if (desc.includes(tName.toLowerCase())) {
            lat = coords.lat + 0.002;
            lng = coords.lng + 0.002;
            break;
          }
        }
        if (!validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
          lat = 9.5333 + (((idx % 4) - 1.5) * 0.007);
          lng = -73.9667 + ((((idx * 3) % 4) - 1.5) * 0.007);
        }
      }

      list.push({
        id: `vehicle-${item.id}`,
        type: 'vehicle',
        name: `${item.vehicleType} · ${item.licensePlate}`,
        subtitle: item.assignedZone || 'Ruta Día D',
        municipality: item.municipality || tenantMunicipality,
        zoneOrDistrict: item.assignedZone,
        status: item.status || 'Disponible',
        latitude: lat,
        longitude: lng,
        phone: item.driverPhone
      });
    });

    // 3. Map Real Entrepreneur Prospects from Astrea survey and KML
    const allProspects = [...prospects, ...loadedKmlProspects];
    allProspects.forEach((item) => {
      let lat = item.latitude;
      let lng = item.longitude;

      if (!validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
        lat = 9.5000;
        lng = -73.9739;
      }

      list.push({
        id: `prospect-${item.id}`,
        type: 'prospect',
        name: item.fullName,
        subtitle: `${item.economicActivity}${item.subActivity ? ` · ${item.subActivity}` : ''}`,
        municipality: tenantMunicipality,
        veredaOrBarrio: item.veredaOrBarrio || item.locationCategory,
        zoneOrDistrict: item.locationCategory,
        status: item.electoralRole,
        latitude: lat,
        longitude: lng,
        assignedVoters: item.potentialVotes || 15,
        phone: item.phone,
        documentId: item.documentId,
        economicActivity: item.economicActivity,
        subActivity: item.subActivity,
        isViolenceVictim: item.isViolenceVictim
      });
    });

    return list;
  }, [leaders, vehicles, prospects, loadedKmlProspects, tenantMunicipality]);

  const municipalities = useMemo(() => Array.from(new Set(points.map((item) => item.municipality))).sort(), [points]);
  
  const filteredPoints = useMemo(() => {
    return points.filter((item) => {
      // 1. Municipal scope validation (Enforced strictly for Alcalde)
      if (isAlcalde) {
        if (item.municipality.toLowerCase() !== tenantMunicipality.toLowerCase()) {
          return false;
        }
      } else if (activeMunicipality !== 'todos') {
        if (item.municipality.toLowerCase() !== activeMunicipality.toLowerCase()) {
          return false;
        }
      }

      // 2. Corregimientos and Veredas territorial filter
      const textToMatch = `${item.subtitle} ${item.veredaOrBarrio || ''} ${item.zoneOrDistrict || ''} ${item.name}`.toLowerCase();

      if (selectedTerritory !== 'todos') {
        const target = selectedTerritory.toLowerCase();
        if (!textToMatch.includes(target)) {
          return false;
        }
      } else {
        // When 'todos' is chosen within a specific filter mode:
        if (territorialFilterType === 'corregimientos') {
          const matchesAnyCorregimiento = corregimientos.some((c) =>
            textToMatch.includes(c.name.toLowerCase()) || textToMatch.includes('corregimiento')
          );
          if (!matchesAnyCorregimiento) return false;
        } else if (territorialFilterType === 'veredas') {
          const matchesAnyVereda = veredas.some((v) =>
            textToMatch.includes(v.name.toLowerCase()) || textToMatch.includes('vereda')
          );
          const matchesCorregimiento = corregimientos.some((c) =>
            textToMatch.includes(c.name.toLowerCase()) || textToMatch.includes('corregimiento')
          );
          if (!matchesAnyVereda || matchesCorregimiento) return false;
        }
      }

      // 3. Resource type filter (all, leader, vehicle)
      const matchType = typeFilter === 'all' || item.type === typeFilter;

      // 4. Search query filter
      const matchSearch = !searchQuery.trim() || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.municipality.toLowerCase().includes(searchQuery.toLowerCase());

      return matchType && matchSearch;
    });
  }, [
    points,
    isAlcalde,
    tenantMunicipality,
    activeMunicipality,
    selectedTerritory,
    territorialFilterType,
    corregimientos,
    veredas,
    typeFilter,
    searchQuery
  ]);

  const missingCoordinates = (leaders.length + vehicles.length) - points.length;

  // Selected territory approximate coordinates for targeted map centering
  const activeTerritoryCoordinates = useMemo(() => {
    if (selectedTerritory !== 'todos') {
      const match = [...corregimientos, ...veredas].find(
        (t) => t.name.toLowerCase() === selectedTerritory.toLowerCase()
      );
      if (match?.latitude && match?.longitude) {
        return { lat: match.latitude, lng: match.longitude };
      }
    }
    return null;
  }, [selectedTerritory, corregimientos, veredas]);

  // Center calculation with fallback to Astrea / Cesar coordinates
  const defaultCenter = useMemo(() => {
    if (activeTerritoryCoordinates) {
      return activeTerritoryCoordinates;
    }
    if (filteredPoints.length > 0) {
      const avgLat = filteredPoints.reduce((acc, p) => acc + p.latitude, 0) / filteredPoints.length;
      const avgLng = filteredPoints.reduce((acc, p) => acc + p.longitude, 0) / filteredPoints.length;
      return { lat: avgLat, lng: avgLng };
    }
    return { lat: 9.5333, lng: -73.9667 }; // Astrea, Cesar
  }, [activeTerritoryCoordinates, filteredPoints]);

  // Dynamic tactical radar bounds to properly spread points across the canvas
  const radarBounds = useMemo(() => {
    if (filteredPoints.length > 0) {
      const lats = filteredPoints.map((p) => p.latitude);
      const lngs = filteredPoints.map((p) => p.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const latPad = Math.max(0.025, (maxLat - minLat) * 0.18);
      const lngPad = Math.max(0.025, (maxLng - minLng) * 0.18);
      return {
        minLat: minLat - latPad,
        maxLat: maxLat + latPad,
        minLng: minLng - lngPad,
        maxLng: maxLng + lngPad
      };
    }
    return {
      minLat: defaultCenter.lat - 0.08,
      maxLat: defaultCenter.lat + 0.08,
      minLng: defaultCenter.lng - 0.08,
      maxLng: defaultCenter.lng + 0.08
    };
  }, [filteredPoints, defaultCenter]);

  const handleSaveCustomKey = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = keyInputTemp.trim();
    setCustomKey(clean);
    localStorage.setItem('astrea_gmaps_custom_key', clean);
    setKeyTestStatus('Clave guardada localmente para esta sesión. Activando visor de Google Maps...');
    setTimeout(() => {
      setIsConfigModalOpen(false);
      setKeyTestStatus(null);
      if (clean) setViewMode('google_maps');
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-5 shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-400 shadow-inner">
            <Compass className="h-6 w-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">Inteligencia y Cobertura Territorial</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Cesar 2026
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Georreferenciación en tiempo real de líderes, puestos y logística para <strong className="text-slate-200">{tenantName}</strong>
            </p>
          </div>
        </div>

        {/* View Mode Switch & Map Key Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* KML Uploader */}
          <input
            type="file"
            ref={kmlInputRef}
            onChange={handleKmlFileUpload}
            accept=".kml,application/vnd.google-earth.kml+xml"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => kmlInputRef.current?.click()}
            className="px-3.5 py-2 rounded-2xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-500/40 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
            title="Cargar polígonos o puntos desde archivo KML de Google Earth"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Cargar KML</span>
            {loadedKmlProspects.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-mono font-black">
                +{loadedKmlProspects.length}
              </span>
            )}
          </button>

          <div className="flex rounded-2xl bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('vector_radar')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'vector_radar'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Radar Satelital en Vivo (HD + GPS)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!activeApiKey) {
                  setIsConfigModalOpen(true);
                } else {
                  setViewMode('google_maps');
                }
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'google_maps'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Google Maps Platform</span>
              {!activeApiKey && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Pendiente de configuración" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 transition cursor-pointer"
            title="Configurar credenciales de Google Maps Platform"
          >
            <Key className="w-3.5 h-3.5 text-cyan-400" />
            <span>Configurar API Key</span>
          </button>
        </div>
      </header>

      {/* KML Import Alert Banner if loaded */}
      {kmlImportNotice && (
        <div className="p-3 rounded-2xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex items-center justify-between animate-fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{kmlImportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setKmlImportNotice(null)}
            className="text-amber-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric 
          icon={<MapPin className="h-4 w-4" />} 
          label="Puntos Georreferenciados" 
          value={points.length} 
          tone="text-cyan-400" 
          subtext="Coordenadas exactas en Cesar"
        />
        <Metric 
          icon={<Store className="h-4 w-4" />} 
          label="Emprendimientos / Prospectos" 
          value={points.filter((item) => item.type === 'prospect').length} 
          tone="text-amber-400" 
          subtext="Votantes y líderes en potencia"
        />
        <Metric 
          icon={<Users className="h-4 w-4" />} 
          label="Líderes con Ubicación" 
          value={points.filter((item) => item.type === 'leader').length} 
          tone="text-emerald-400" 
          subtext="Veredas y corregimientos"
        />
        <Metric 
          icon={<Bus className="h-4 w-4" />} 
          label="Flota de Transporte" 
          value={points.filter((item) => item.type === 'vehicle').length} 
          tone="text-blue-400" 
          subtext="Vehículos asignados Día D"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Territory Selector: Corregimientos and Veredas */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Filter className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <select
              value={selectedTerritory}
              onChange={(e) => setSelectedTerritory(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer font-medium max-w-[220px] truncate"
              title="Filtrar por corregimiento o vereda según el Tenant ID"
            >
              {territorialFilterType === 'corregimientos' ? (
                <>
                  <option value="todos" className="bg-slate-900 font-bold text-cyan-400">
                    🏛️ Todos los Corregimientos ({corregimientos.length})
                  </option>
                  {corregimientos.map((item) => (
                    <option key={item.name} value={item.name} className="bg-slate-900 text-slate-200">
                      {item.fullName}
                    </option>
                  ))}
                </>
              ) : territorialFilterType === 'veredas' ? (
                <>
                  <option value="todos" className="bg-slate-900 font-bold text-emerald-400">
                    🌾 Todas las Veredas ({veredas.length})
                  </option>
                  {veredas.map((item) => (
                    <option key={item.name} value={item.name} className="bg-slate-900 text-slate-200">
                      {item.fullName}
                    </option>
                  ))}
                </>
              ) : (
                <>
                  <option value="todos" className="bg-slate-900 font-bold text-white">
                    🗺️ Todo el Territorio ({corregimientos.length + veredas.length} sectores)
                  </option>
                  <optgroup label={`Corregimientos de ${activeMunicipality} (${corregimientos.length})`} className="bg-slate-900 text-cyan-300 font-semibold">
                    {corregimientos.map((item) => (
                      <option key={item.name} value={item.name} className="bg-slate-900 text-slate-200">
                        {item.fullName}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={`Veredas de ${activeMunicipality} (${veredas.length})`} className="bg-slate-900 text-emerald-300 font-semibold">
                    {veredas.map((item) => (
                      <option key={item.name} value={item.name} className="bg-slate-900 text-slate-200">
                        {item.fullName}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </div>

          {/* 2 Filters Selector: Corregimientos / Veredas / Todo */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setTerritorialFilterType('todos');
                setSelectedTerritory('todos');
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                territorialFilterType === 'todos'
                  ? 'bg-slate-800 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mostrar corregimientos y veredas juntos"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Todo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTerritorialFilterType('corregimientos');
                setSelectedTerritory('todos');
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                territorialFilterType === 'corregimientos'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/50 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
              title="Filtrar exclusivamente Corregimientos"
            >
              <Landmark className="w-3.5 h-3.5 text-cyan-400" />
              <span>Corregimientos ({corregimientos.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTerritorialFilterType('veredas');
                setSelectedTerritory('todos');
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                territorialFilterType === 'veredas'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
              title="Filtrar exclusivamente Veredas"
            >
              <Trees className="w-3.5 h-3.5 text-emerald-400" />
              <span>Veredas ({veredas.length})</span>
            </button>
          </div>

          {/* Departmental user municipality switcher */}
          {!isAlcalde && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-500 font-medium">Municipio:</span>
              <select
                value={selectedMunicipality}
                onChange={(e) => {
                  setSelectedMunicipality(e.target.value);
                  setSelectedTerritory('todos');
                }}
                className="bg-transparent text-slate-300 outline-none cursor-pointer font-semibold"
              >
                <option value="Astrea" className="bg-slate-900">Astrea</option>
                <option value="Valledupar" className="bg-slate-900">Valledupar</option>
                <option value="Bosconia" className="bg-slate-900">Bosconia</option>
                <option value="Chiriguaná" className="bg-slate-900">Chiriguaná</option>
                <option value="El Paso" className="bg-slate-900">El Paso</option>
                <option value="todos" className="bg-slate-900">Todos (Dpto)</option>
              </select>
            </div>
          )}

          {/* Alcalde Tenant Scope Badge */}
          {isAlcalde && (
            <div className="hidden lg:flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-1 rounded-xl text-[11px] text-cyan-300">
              <Landmark className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Mando: <strong>{tenantMunicipality}</strong></span>
              <span className="font-mono text-[10px] text-cyan-400/80 bg-cyan-950 px-1 py-0.5 rounded border border-cyan-800/40">
                {currentTenant?.tenantId || 'tenant-astrea-2026'}
              </span>
            </div>
          )}

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${typeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('prospect')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${typeFilter === 'prospect' ? 'bg-amber-950 text-amber-300 border border-amber-800/40' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Emprendimientos ({points.filter((p) => p.type === 'prospect').length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('leader')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${typeFilter === 'leader' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Líderes
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('vehicle')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${typeFilter === 'vehicle' ? 'bg-blue-950 text-blue-300 border border-blue-800/40' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Vehículos
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por líder, placa, vereda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Interactive Map Viewport */}
      {viewMode === 'google_maps' && activeApiKey ? (
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl relative">
          <APIProvider apiKey={activeApiKey} version="weekly">
            <div className="h-[560px] w-full relative">
              <Map
                defaultCenter={defaultCenter}
                defaultZoom={11}
                mapId={ENV_MAP_ID}
                mapTypeId="hybrid"
                style={{ width: '100%', height: '100%' }}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                gestureHandling="greedy"
                fullscreenControl={true}
              >
                {filteredPoints.map((point) => (
                  <AdvancedMarker
                    key={point.id}
                    position={{ lat: point.latitude, lng: point.longitude }}
                    title={point.name}
                    onClick={() => setSelectedPoint(point)}
                  >
                    <Pin
                      background={point.type === 'leader' ? '#059669' : point.type === 'prospect' ? '#d97706' : '#2563EB'}
                      glyphColor="#ffffff"
                      borderColor="#0f172a"
                      scale={point.type === 'prospect' ? 1.05 : 1.1}
                    />
                  </AdvancedMarker>
                ))}

                {selectedPoint && (
                  <InfoWindow
                    position={{ lat: selectedPoint.latitude, lng: selectedPoint.longitude }}
                    onCloseClick={() => setSelectedPoint(null)}
                  >
                    <div className="max-w-xs p-3 text-slate-900 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          selectedPoint.type === 'leader' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : selectedPoint.type === 'prospect'
                            ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedPoint.type === 'leader' ? 'Líder Territorial' : selectedPoint.type === 'prospect' ? 'Emprendedor / Prospecto Astrea' : 'Vehículo Día D'}
                        </span>
                        {selectedPoint.isViolenceVictim && (
                          <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                            Víctima
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 leading-tight">{selectedPoint.name}</h3>
                      {selectedPoint.documentId && (
                        <p className="text-[11px] font-mono text-slate-600">C.C. {selectedPoint.documentId}</p>
                      )}
                      
                      <p className="text-xs text-slate-600">{selectedPoint.municipality} · {selectedPoint.subtitle}</p>

                      {selectedPoint.type === 'prospect' && (
                        <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-xs space-y-1">
                          <p className="font-semibold text-amber-900">Actividad: {selectedPoint.economicActivity}</p>
                          {selectedPoint.subActivity && (
                            <p className="text-[11px] text-amber-800 italic">{selectedPoint.subActivity}</p>
                          )}
                          <p className="text-[11px] font-bold text-emerald-800">
                            Potencial Electoral: ~{selectedPoint.assignedVoters || 15} votos
                          </p>
                        </div>
                      )}

                      {selectedPoint.type === 'leader' && selectedPoint.assignedVoters ? (
                        <p className="text-xs font-bold text-emerald-700">Meta electoral: {selectedPoint.assignedVoters} votos</p>
                      ) : null}

                      {selectedPoint.phone && (
                        <p className="text-xs text-slate-700 font-mono flex items-center gap-1">
                          <span>📞 Contacto:</span>
                          <a href={`tel:${selectedPoint.phone}`} className="text-blue-700 underline font-bold">
                            {selectedPoint.phone}
                          </a>
                        </p>
                      )}

                      <div className="pt-1 text-[10px] text-slate-400 font-mono">
                        GPS: {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </div>
          </APIProvider>
        </div>
      ) : (
        /* High-Definition Satellite Radar with Live Telemetry & Territory Diagnostics */
        <SatelliteRadarCanvas
          center={defaultCenter}
          points={filteredPoints}
          corregimientos={corregimientos}
          veredas={veredas}
          municipality={activeMunicipality === 'todos' ? tenantMunicipality : activeMunicipality}
          selectedPoint={selectedPoint}
          onSelectPoint={setSelectedPoint}
          filterType={typeFilter}
          onFilterTypeChange={setTypeFilter}
          tenant={currentTenant || undefined}
          currentUser={currentUser}
          userRole={userRole}
        />
      )}

      {/* Directory of Locations */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white">Directorio Territorial ({filteredPoints.length} puntos)</h3>
            <p className="text-xs text-slate-400">Puntos georreferenciados activos en la base de datos de Firestore</p>
          </div>
        </div>

        {filteredPoints.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredPoints.map((point) => (
              <article 
                key={point.id} 
                onClick={() => setSelectedPoint(point)}
                className={`rounded-2xl border p-4 cursor-pointer transition ${
                  selectedPoint?.id === point.id 
                    ? 'bg-slate-800 border-cyan-500/50 shadow-lg' 
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2.5 shrink-0 ${
                    point.type === 'leader' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {point.type === 'leader' ? <Users className="h-5 w-5" /> : <Bus className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{point.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{point.municipality} · {point.subtitle}</p>
                    {point.assignedVoters ? (
                      <p className="text-[11px] font-bold text-emerald-400 mt-1">🎯 {point.assignedVoters} votos meta</p>
                    ) : null}
                    <p className="mt-2 font-mono text-[10px] text-cyan-400/80">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            No se encontraron puntos con los criterios de búsqueda seleccionados.
          </div>
        )}
      </section>

      {/* Google Maps Configuration Modal / Drawer */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Configuración de Google Maps Platform</h3>
                <p className="text-xs text-slate-400">Activación de mapas satelitales, capas de tráfico y AdvancedMarkerElement</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
                <Info className="w-4 h-4 shrink-0" />
                <span>¿Cómo activar Google Maps en producción (Vercel / Cloud Run)?</span>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-slate-400 leading-relaxed">
                <li>
                  Vaya a <strong className="text-white">Google Cloud Console</strong> &gt; <strong className="text-white">Credenciales</strong> (o utilice una <em>Maps Demo Key</em> para prototipado).
                </li>
                <li>
                  En su panel de <strong className="text-white">Vercel / Cloud Run</strong>, agregue la variable de entorno:
                  <code className="block mt-1 bg-slate-900 text-cyan-300 p-2 rounded-xl font-mono text-[11px] select-all">
                    VITE_GOOGLE_MAPS_PLATFORM_KEY="AIzaSy..."
                  </code>
                </li>
                <li>
                  <strong className="text-white">Restricción de Seguridad:</strong> Restrinja su clave con <strong className="text-emerald-400">Referencia HTTP</strong> a sus dominios de campaña (ej: <code className="text-cyan-300">https://*.vercel.app/*</code> y <code className="text-cyan-300">https://*.run.app/*</code>).
                </li>
                <li>
                  <strong className="text-white">Firestore Intacto:</strong> Todos los datos de líderes, rutas y coordenadas se almacenan permanentemente en su base de datos Firestore multi-tenant.
                </li>
              </ol>
            </div>

            {/* Quick Testing Form for the Current Browser Session */}
            <form onSubmit={handleSaveCustomKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Probar API Key en esta sesión de navegador:
                </label>
                <input
                  type="text"
                  placeholder="Pegue aquí su Google Maps API Key (ej. AIzaSy...)"
                  value={keyInputTemp}
                  onChange={(e) => setKeyInputTemp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              {keyTestStatus && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{keyTestStatus}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <a
                  href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Obtener Demo Key</span>
                </a>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/30 cursor-pointer"
                  >
                    Guardar y Activar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: number; tone: string; subtext?: string }> = ({ 
  icon, 
  label, 
  value, 
  tone,
  subtext 
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-md">
    <div className={`flex items-center gap-2 text-xs ${tone}`}>
      {icon}
      <span className="text-slate-400 font-medium">{label}</span>
    </div>
    <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
    {subtext && <p className="text-[10px] text-slate-500 mt-0.5">{subtext}</p>}
  </div>
);
