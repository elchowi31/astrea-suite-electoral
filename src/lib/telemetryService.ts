import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { LiveTelemetryBeacon } from '../types';

const BEACONS_COLLECTION = 'telemetria_balizas';

// Store local wake lock reference
let activeWakeLock: any = null;
let watchPositionId: number | null = null;
let heartbeatInterval: any = null;
let silentAudioCtx: any = null;
let silentOscillator: any = null;

/**
 * Anclaje en Segundo Plano: Silent Audio Keep-Alive Anchor
 * Evita que el sistema operativo móvil (Android / iOS) suspenda los temporizadores de GPS
 * cuando el conductor minimiza el navegador o la pantalla entra en reposo.
 */
export function startBackgroundAudioAnchor(): boolean {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx && !silentAudioCtx) {
      silentAudioCtx = new AudioCtx();
      const osc = silentAudioCtx.createOscillator();
      const gain = silentAudioCtx.createGain();
      gain.gain.value = 0.00001; // Inaudible pero mantiene activo el hilo de audio del OS
      osc.connect(gain);
      gain.connect(silentAudioCtx.destination);
      osc.start(0);
      silentOscillator = osc;
      return true;
    }
  } catch (err) {
    console.warn('Silent audio keep-alive anchor no iniciado:', err);
  }
  return false;
}

export function stopBackgroundAudioAnchor(): void {
  try {
    if (silentOscillator) {
      silentOscillator.stop();
      silentOscillator.disconnect();
      silentOscillator = null;
    }
    if (silentAudioCtx) {
      silentAudioCtx.close();
      silentAudioCtx = null;
    }
  } catch (err) {
    // quiet
  }
}

/**
 * Request Screen Wake Lock to prevent the driver's phone from sleeping
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if ('wakeLock' in navigator) {
    try {
      activeWakeLock = await (navigator as any).wakeLock.request('screen');
      activeWakeLock.addEventListener('release', () => {
        activeWakeLock = null;
      });
      return true;
    } catch (err) {
      console.warn('Wake Lock no disponible o denegado:', err);
      return false;
    }
  }
  return false;
}

/**
 * Release the Screen Wake Lock
 */
export async function releaseScreenWakeLock(): Promise<void> {
  if (activeWakeLock) {
    try {
      await activeWakeLock.release();
      activeWakeLock = null;
    } catch (e) {
      console.warn('Error liberando Wake Lock:', e);
    }
  }
}

/**
 * Get device battery level if supported
 */
export async function getDeviceBatteryLevel(): Promise<number | undefined> {
  try {
    if ('getBattery' in navigator) {
      const battery: any = await (navigator as any).getBattery();
      return Math.round(battery.level * 100);
    }
  } catch (e) {
    // Ignore if not supported
  }
  return undefined;
}

/**
 * Start transmitting this device's live GPS telemetry as a driver or supervisor
 */
export function startDriverBeaconTransmission({
  tenantId,
  beaconId,
  driverName,
  role = 'Conductor',
  vehiclePlate,
  vehicleType,
  phone,
  assignedRoute,
  deviceId,
  onUpdate,
  onError
}: {
  tenantId: string;
  beaconId: string;
  driverName: string;
  role?: LiveTelemetryBeacon['role'];
  vehiclePlate?: string;
  vehicleType?: string;
  phone?: string;
  assignedRoute?: string;
  deviceId?: string;
  onUpdate?: (beacon: LiveTelemetryBeacon) => void;
  onError?: (errorMsg: string) => void;
}): () => void {
  if (!navigator.geolocation) {
    onError?.('Su dispositivo no soporta geolocalización GPS.');
    return () => {};
  }

  // Request screen wake lock so the driver's phone stays on while moving
  requestScreenWakeLock();

  // Activar anclaje de audio en segundo plano (mantiene activo el GPS si el conductor bloquea la pantalla)
  startBackgroundAudioAnchor();

  // Prevent accidental tab closure while on route
  const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '⚠️ La transmisión de rastreo electoral está activa. Si cierra la app, la Torre de Control perderá su posición en ruta.';
    return e.returnValue;
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);

  // Monitor visibility changes (when user minimizes app or locks screen)
  const visibilityChangeHandler = () => {
    if (document.visibilityState === 'hidden') {
      if (lastLat && lastLng) {
        const ref = doc(db, BEACONS_COLLECTION, beaconId);
        setDoc(ref, {
          isBackground: true,
          status: 'En Segundo Plano / Celular Bloqueado',
          lastHeartbeat: Date.now()
        }, { merge: true }).catch(() => {});
      }
    } else {
      if (lastLat && lastLng) {
        const ref = doc(db, BEACONS_COLLECTION, beaconId);
        setDoc(ref, {
          isBackground: false,
          status: lastSpeed > 3 ? 'En Movimiento' : 'En Espera',
          lastHeartbeat: Date.now()
        }, { merge: true }).catch(() => {});
      }
    }
  };
  document.addEventListener('visibilitychange', visibilityChangeHandler);

  let currentTrail: { lat: number; lng: number; time: number }[] = [];
  let lastLat = 0;
  let lastLng = 0;
  let lastSpeed = 0;

  const pushBeaconUpdate = async (pos: GeolocationPosition) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = Math.round(pos.coords.accuracy || 10);
    // Speed from m/s to km/h
    const speedKmH = pos.coords.speed !== null && pos.coords.speed >= 0
      ? Math.round(pos.coords.speed * 3.6)
      : 0;
    const heading = pos.coords.heading || undefined;

    lastLat = lat;
    lastLng = lng;
    lastSpeed = speedKmH;

    // Append to local breadcrumb trail (max 30 points to avoid huge docs)
    currentTrail.push({ lat, lng, time: Date.now() });
    if (currentTrail.length > 30) {
      currentTrail = currentTrail.slice(currentTrail.length - 30);
    }

    const batteryLevel = await getDeviceBatteryLevel();
    const status: LiveTelemetryBeacon['status'] = speedKmH > 3
      ? 'En Movimiento'
      : (assignedRoute ? 'En Espera' : 'Detenido en Puesto');

    const beaconData: LiveTelemetryBeacon = {
      id: beaconId,
      tenantId,
      userId: auth.currentUser?.uid,
      deviceId,
      driverName,
      role,
      vehiclePlate: vehiclePlate || 'MÓVIL-GPS',
      vehicleType: vehicleType || 'Vehículo de Operación',
      phone: phone || '',
      assignedRoute: assignedRoute || 'Ruta General Electoral',
      latitude: lat,
      longitude: lng,
      accuracy,
      speed: speedKmH,
      heading,
      batteryLevel,
      status,
      lastHeartbeat: Date.now(),
      isScreenLocked: !!activeWakeLock,
      historyTrail: currentTrail
    };

    onUpdate?.(beaconData);

    // Persist to Firestore
    try {
      const ref = doc(db, BEACONS_COLLECTION, beaconId);
      await setDoc(ref, beaconData, { merge: true });
    } catch (err) {
      console.warn('Error subiendo telemetría a Firestore (guardando local):', err);
    }
  };

  // Watch position with highest accuracy GPS
  watchPositionId = navigator.geolocation.watchPosition(
    (position) => {
      pushBeaconUpdate(position);
    },
    (err) => {
      onError?.(`Error de señal GPS: ${err.message}`);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    }
  );

  // Periodic heartbeat every 10 seconds to keep lastHeartbeat fresh even if stationary
  heartbeatInterval = setInterval(async () => {
    if (lastLat && lastLng) {
      try {
        const ref = doc(db, BEACONS_COLLECTION, beaconId);
        await setDoc(ref, {
          lastHeartbeat: Date.now(),
          status: lastSpeed > 3 ? 'En Movimiento' : 'Detenido en Puesto'
        }, { merge: true });
      } catch (e) {
        // quiet
      }
    }
  }, 10000);

  // Return cleanup / stop transmission function
  return () => {
    if (watchPositionId !== null) {
      navigator.geolocation.clearWatch(watchPositionId);
      watchPositionId = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
    releaseScreenWakeLock();
    stopBackgroundAudioAnchor();

    // Mark as inactive or delete beacon
    try {
      const ref = doc(db, BEACONS_COLLECTION, beaconId);
      setDoc(ref, {
        status: 'Desconectado / App Cerrada',
        lastHeartbeat: Date.now()
      }, { merge: true }).catch(() => {});
    } catch (e) {
      // quiet
    }
  };
}

/**
 * Send an immediate SOS Alert from driver's device
 */
export async function sendDriverSOSAlert(beaconId: string, message: string): Promise<void> {
  try {
    const ref = doc(db, BEACONS_COLLECTION, beaconId);
    await setDoc(ref, {
      sosAlert: true,
      sosMessage: message,
      status: 'Alerta Desvío',
      lastHeartbeat: Date.now()
    }, { merge: true });
  } catch (err) {
    console.error('Error enviando SOS:', err);
    throw err;
  }
}

/**
 * Subscribe to all active vehicle and supervisor beacons for a tenant
 */
export function subscribeToActiveBeacons(
  tenantId: string,
  onBeaconsChanged: (beacons: LiveTelemetryBeacon[]) => void
): () => void {
  try {
    const q = query(
      collection(db, BEACONS_COLLECTION),
      where('tenantId', '==', tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: LiveTelemetryBeacon[] = [];
      const now = Date.now();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as LiveTelemetryBeacon;
        // Check if device went offline (> 90 seconds without heartbeat)
        const isOffline = (now - (data.lastHeartbeat || 0)) > 90000;
        const finalStatus = isOffline ? 'Desconectado / App Cerrada' : data.status;

        list.push({
          ...data,
          status: finalStatus
        });
      });

      onBeaconsChanged(list);
    }, (error) => {
      console.warn('Error suscripción Firestore balizas, usando balizas de prueba activas:', error);
      onBeaconsChanged([]);
    });

    return unsubscribe;
  } catch (e) {
    console.warn('Firestore no disponible para telemetría:', e);
    return () => {};
  }
}

/**
 * Seed realistic simulated mobile beacons for testing the control tower
 */
export function getSimulatedAstreaBeacons(tenantId: string): LiveTelemetryBeacon[] {
  const now = Date.now();
  return [
    {
      id: 'sim-veh-01',
      tenantId,
      driverName: 'Eider Gómez (Conductor)',
      role: 'Conductor',
      vehiclePlate: 'UGA-482',
      vehicleType: 'Camioneta 4x4 Rural',
      phone: '312-849-2041',
      assignedRoute: 'Ruta 1: Astrea Cabecera ➔ Corregimiento Arjona',
      latitude: 9.5580,
      longitude: -73.9420,
      accuracy: 8,
      speed: 48,
      heading: 42,
      batteryLevel: 84,
      status: 'En Movimiento',
      lastHeartbeat: now - 5000,
      isScreenLocked: true,
      historyTrail: [
        { lat: 9.5333, lng: -73.9667, time: now - 300000 },
        { lat: 9.5420, lng: -73.9580, time: now - 180000 },
        { lat: 9.5510, lng: -73.9490, time: now - 60000 },
        { lat: 9.5580, lng: -73.9420, time: now - 5000 }
      ]
    },
    {
      id: 'sim-veh-02',
      tenantId,
      driverName: 'Álvaro Mendoza (Conductor)',
      role: 'Conductor',
      vehiclePlate: 'TLK-915',
      vehicleType: 'Microbús / Van (19 pas)',
      phone: '315-772-9910',
      assignedRoute: 'Ruta 2: Vereda San Isidro ➔ Santa Cecilia',
      latitude: 9.5890,
      longitude: -73.9210,
      accuracy: 6,
      speed: 0,
      heading: 180,
      batteryLevel: 92,
      status: 'Detenido en Puesto',
      lastHeartbeat: now - 12000,
      isScreenLocked: true
    },
    {
      id: 'sim-sup-01',
      tenantId,
      driverName: 'Dra. Sandra Maestre (Supervisora)',
      role: 'Supervisor Electoral',
      vehiclePlate: 'MÓVIL-SUPERVISIÓN',
      vehicleType: 'Automóvil de Coordinación',
      phone: '310-445-8812',
      assignedRoute: 'Inspección Puestos de Votación Zona Urbana',
      latitude: 9.5370,
      longitude: -73.9640,
      accuracy: 4,
      speed: 25,
      heading: 90,
      batteryLevel: 67,
      status: 'En Movimiento',
      lastHeartbeat: now - 8000,
      isScreenLocked: true
    }
  ];
}
