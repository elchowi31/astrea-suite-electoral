import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  ShieldCheck,
  Zap,
  Radio,
  AlertTriangle,
  Phone,
  Power,
  CheckCircle2,
  Lock,
  BatteryCharging,
  Navigation,
  Share2,
  X
} from 'lucide-react';
import {
  startDriverBeaconTransmission,
  sendDriverSOSAlert,
  requestScreenWakeLock,
  releaseScreenWakeLock,
  getDeviceBatteryLevel
} from '../lib/telemetryService';
import { LiveTelemetryBeacon, Tenant, UserProfile } from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface DriverBeaconModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  currentUser?: UserProfile | null;
  onBeaconActive?: (beacon: LiveTelemetryBeacon | null) => void;
}

export const DriverBeaconModal: React.FC<DriverBeaconModalProps> = ({
  isOpen,
  onClose,
  tenant,
  currentUser,
  onBeaconActive
}) => {
  const profileName = [currentUser?.fullName, currentUser?.displayName]
    .find((value) => value && !value.includes('@')) || '';
  const deviceId = (() => {
    const key = 'astrea_device_id';
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, created);
    return created;
  })();
  const unitKey = `astrea_beacon_unit_${tenant.tenantId}_${currentUser?.uid || deviceId}`;
  const savedUnit = (() => {
    try { return JSON.parse(localStorage.getItem(unitKey) || '{}'); } catch { return {}; }
  })();
  const [driverName, setDriverName] = useState<string>(
    savedUnit.driverName || profileName
  );
  const [role, setRole] = useState<LiveTelemetryBeacon['role']>(
    savedUnit.role || 'Conductor'
  );
  const [vehiclePlate, setVehiclePlate] = useState<string>(
    savedUnit.vehiclePlate || ''
  );
  const [vehicleType, setVehicleType] = useState<string>(savedUnit.vehicleType || 'Camioneta 4x4 Rural');
  const [assignedRoute, setAssignedRoute] = useState<string>(savedUnit.assignedRoute || 'Ruta Astrea - Corregimientos');
  const [phone, setPhone] = useState<string>(
    savedUnit.phone || currentUser?.phone || ''
  );
  const [rememberUnit, setRememberUnit] = useState<boolean>(savedUnit.rememberUnit !== false);

  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [currentBeacon, setCurrentBeacon] = useState<LiveTelemetryBeacon | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [batteryPct, setBatteryPct] = useState<number | undefined>(undefined);
  const [sosActive, setSosActive] = useState<boolean>(false);
  const [sosReason, setSosReason] = useState<string>('Problema mecánico en ruta');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stopTransmissionFn, setStopTransmissionFn] = useState<(() => void) | null>(null);

  // Check battery
  useEffect(() => {
    getDeviceBatteryLevel().then((lvl) => setBatteryPct(lvl));
  }, []);

  // La transmisión continúa aunque se cierre el modal; solo se detiene al salir del mapa.
  useEffect(() => {
    return () => {
      if (stopTransmissionFn) {
        stopTransmissionFn();
      }
    };
  }, [stopTransmissionFn]);

  const handleStartTransmission = async (automatic = false) => {
    if (isTransmitting) return;
    if (!driverName.trim()) {
      if (!automatic) setErrorMessage('Por favor ingrese su nombre para identificar la unidad.');
      return;
    }

    setErrorMessage(null);
    const unit = { driverName: driverName.trim(), role, vehiclePlate, vehicleType, assignedRoute, phone, rememberUnit };
    localStorage.setItem(unitKey, JSON.stringify(unit));
    localStorage.setItem(`${unitKey}_auto_resume`, rememberUnit ? 'true' : 'false');

    const beaconId = `beacon-${tenant.tenantId}-${currentUser?.uid || deviceId}`;
    try {
      await setDoc(doc(db, 'telemetria_autorizaciones', `${tenant.tenantId}_${currentUser?.uid || deviceId}`), {
        tenantId: tenant.tenantId,
        userId: currentUser?.uid || null,
        deviceId,
        driverName: driverName.trim(),
        role,
        vehiclePlate: vehiclePlate.toUpperCase() || null,
        consentGiven: true,
        autoResume: rememberUnit,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.warn('No fue posible sincronizar la autorización; se conserva en este dispositivo.', error);
    }

    // Request Wake Lock to prevent screen timeout
    const wakeOk = await requestScreenWakeLock();
    setWakeLockActive(wakeOk);

    const stop = startDriverBeaconTransmission({
      tenantId: tenant.tenantId,
      beaconId,
      driverName,
      role,
      vehiclePlate: vehiclePlate.toUpperCase() || 'MÓVIL-CAMPO',
      vehicleType,
      phone,
      assignedRoute,
      deviceId,
      onUpdate: (beacon) => {
        setCurrentBeacon(beacon);
        onBeaconActive?.(beacon);
      },
      onError: (msg) => {
        setErrorMessage(msg);
        setIsTransmitting(false);
      }
    });

    setStopTransmissionFn(() => stop);
    setIsTransmitting(true);
  };

  useEffect(() => {
    if (localStorage.getItem(`${unitKey}_auto_resume`) !== 'true' || !driverName.trim() || isTransmitting) return;
    let cancelled = false;
    const resume = async () => {
      try {
        if (!navigator.permissions?.query) return;
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (!cancelled && permission.state === 'granted') await handleStartTransmission(true);
      } catch {
        // Algunos navegadores no exponen la API de permisos; el usuario conserva el botón manual.
      }
    };
    resume();
    return () => { cancelled = true; };
  }, [unitKey]);

  const handleStopTransmission = () => {
    if (stopTransmissionFn) {
      stopTransmissionFn();
      setStopTransmissionFn(null);
    }
    releaseScreenWakeLock();
    setWakeLockActive(false);
    setIsTransmitting(false);
    setCurrentBeacon(null);
    localStorage.setItem(`${unitKey}_auto_resume`, 'false');
    onBeaconActive?.(null);
  };

  if (!isOpen) return null;

  const handleSendSOS = async () => {
    if (!currentBeacon) return;
    try {
      await sendDriverSOSAlert(currentBeacon.id, sosReason);
      setSosActive(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl text-white relative my-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black tracking-tight">
              Modo Conductor y Supervisor Móvil
            </h3>
            <p className="text-xs text-slate-400">
              Baliza GPS en vivo con anclaje a Torre de Control y Puesto de Mando
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isTransmitting ? (
          /* ACTIVE TRANSMISSION COCKPIT */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center relative overflow-hidden">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2 animate-pulse">
                <Radio className="w-3.5 h-3.5" />
                TRANSMITIENDO EN VIVO A LA TORRE DE CONTROL
              </span>
              <h4 className="text-lg font-black text-white">{driverName}</h4>
              <p className="text-xs text-emerald-300 font-mono">
                {vehiclePlate ? `Placa: ${vehiclePlate.toUpperCase()} · ` : ''}{role}
              </p>

              {/* Telemetry live gauges */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-emerald-500/20 text-center">
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Velocidad</span>
                  <span className="text-sm font-black text-cyan-300">
                    {currentBeacon?.speed || 0} km/h
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Precisión GPS</span>
                  <span className="text-sm font-black text-emerald-300">
                    ±{currentBeacon?.accuracy || 10} m
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Batería</span>
                  <span className="text-sm font-black text-amber-300">
                    {batteryPct !== undefined ? `${batteryPct}%` : 'Normal'}
                  </span>
                </div>
              </div>
            </div>

            {/* Anti-Sleep & Background Protection Notification */}
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300 font-bold">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  Pantalla Activa (Wake Lock):
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  wakeLockActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-700 text-slate-400'
                }`}>
                  {wakeLockActive ? 'Activado (No se apagará)' : 'Estándar'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                🛡️ La aplicación mantiene su pantalla encendida y activa una protección contra cierre accidental. Si bloquea o cierra el teléfono, la Torre de Control recibirá una alerta automática de desconexión.
              </p>
            </div>

            {/* SOS Emergency Button */}
            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Botón de Novedad / SOS Inmediato
                </span>
                {sosActive && (
                  <span className="text-[10px] px-2 py-0.5 bg-rose-500 text-white rounded-full font-black animate-ping">
                    ALERTA ENVIADA
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <select
                  value={sosReason}
                  onChange={(e) => setSosReason(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                >
                  <option value="Problema mecánico o varada">Problema mecánico / Varada</option>
                  <option value="Bloqueo o congestión en vía rural">Bloqueo en vía rural</option>
                  <option value="Urgencia con pasajeros o testigos">Urgencia con pasajeros</option>
                  <option value="Sin combustible">Sin combustible</option>
                </select>
                <button
                  type="button"
                  onClick={handleSendSOS}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-900/50 cursor-pointer transition flex items-center gap-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Enviar SOS</span>
                </button>
              </div>
            </div>

            {/* Stop Transmission Button */}
            <button
              type="button"
              onClick={handleStopTransmission}
              className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-rose-900/30 hover:border-rose-500/50 border border-slate-700 text-slate-300 hover:text-rose-300 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Power className="w-4 h-4" />
              <span>Finalizar Turno / Detener Transmisión GPS</span>
            </button>
          </div>
        ) : (
          /* CONFIGURATION & AUTHORIZATION FORM */
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 leading-relaxed">
              <strong className="block font-bold text-white mb-1">Autorización Operativa de Rastreo:</strong>
              Al iniciar turno, su teléfono compartirá su ubicación GPS en tiempo real exclusivamente con la Torre de Control y Puesto de Mando Electoral de {tenant.name}. La pantalla se mantendrá encendida durante todo el recorrido.
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre Completo del Conductor o Supervisor *
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Ej. Eider Gómez"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Rol Operativo
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                  >
                    <option value="Conductor">Conductor de Ruta</option>
                    <option value="Supervisor Electoral">Supervisor Electoral</option>
                    <option value="Líder Territorial">Líder Territorial</option>
                    <option value="Coordinador Día D">Coordinador Día D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Placa del Vehículo
                  </label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="Ej. UGA-482"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none uppercase font-mono focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Tipo de Vehículo
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                  >
                    <option value="Camioneta 4x4 Rural">Camioneta 4x4 Rural</option>
                    <option value="Microbús / Van (19 pas)">Microbús / Van</option>
                    <option value="Bus Gran Capacidad">Bus Gran Capacidad</option>
                    <option value="Motocarro / Tricimóvil">Motocarro</option>
                    <option value="Automóvil Coordinación">Automóvil Coordinación</option>
                    <option value="Moto Enlace">Moto Enlace</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Teléfono Móvil (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 312 849 2041"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Ruta o Zona Asignada
                </label>
                <input
                  type="text"
                  value={assignedRoute}
                  onChange={(e) => setAssignedRoute(e.target.value)}
                  placeholder="Ej. Ruta Astrea Cabecera ➔ Corregimiento Arjona"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
                <input
                  type="checkbox"
                  checked={rememberUnit}
                  onChange={(e) => setRememberUnit(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-cyan-400"
                />
                <span>
                  <strong className="block text-xs text-white">Recordar esta unidad</strong>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
                    Reanudará el GPS al volver al mapa si el teléfono conserva el permiso de ubicación.
                  </span>
                </span>
              </label>
            </div>

            {/* Start Button */}
            <button
              type="button"
              onClick={handleStartTransmission}
              className="w-full py-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-cyan-900/50"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Autorizar y Comenzar Transmisión en Vivo</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
