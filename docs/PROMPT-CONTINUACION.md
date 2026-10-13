# Prompt de continuación — Astrea Suite Electoral (10/10/2026)

Copia todo lo que está debajo de la línea y pégalo como primer mensaje en una sesión nueva.

---

Eres el desarrollador de **Astrea Suite Electoral**, plataforma de control de campaña (logística, rastreo de recorridos, finanzas, reportes). Autor: **Wilson José Arias** · Proyectos con Energía. Responde en español.

## Dónde está todo
- Código: `C:\Users\WILSON\Downloads\astrea-Suit -2026` (Windows). Vite + React 19 + TypeScript, Firebase (Auth + Firestore con base **nombrada** `ai-studio-astreasuiteelect-5da3410d-4b0c-4301-8bd6-083fbb5c653b`), API serverless en `api/index.ts`, Capacitor 8 para Android.
- Proyecto Firebase: `gen-lang-client-0498782352`. Las reglas se publican con la cuenta **expcal@expcal.net** (la predeterminada del CLI, astreaemprende@gmail.com, NO tiene permiso):
  `firebase deploy --only firestore:rules --project gen-lang-client-0498782352 --account expcal@expcal.net`
- Web en producción: https://astrea-suite-electoral.vercel.app — proyecto Vercel `astrea-suite-electoral` (id `prj_gp0Vx6QrpUG25MzMFpeDBZCYCNfX`, equipo `wilson-joses-projects`). El CLI de Vercel en este equipo está con la sesión **elchowi31** y la carpeta ya está enlazada (`.vercel/project.json`). El usuario indica que la cuenta con permisos en Vercel debería ser **solver.expcal@gmail.com**: verificar con `npx vercel whoami` y, si hace falta, `npx vercel logout` / `npx vercel login` con esa cuenta antes de publicar. Publicar: `npx vercel deploy --prod --yes`.
- Repositorio GitHub: `elchowi31/astrea-suite-electoral`. Hay MUCHOS cambios sin commit (de sesiones anteriores y de esta). Hacer commit antes de seguir.
- Herramientas Android instaladas en **D:\AstreaAndroid** (Java 21, SDK Android 36, caché Gradle). El disco C: tiene solo ~2 GB libres: no instalar nada pesado en C:.

## Lo que se hizo el 10/10/2026 (todo verificado)
1. **Recepción de archivos**: `src/lib/geographicImport.ts` ahora lee el CSV de Excel en español (separador `;`, coma decimal, Windows-1252, BOM, comillas). Formatos probados: KML, KMZ, CSV, XLSX, XLS. Selector de archivos con tipos MIME para Android.
2. **Semilla de dispositivo** (`src/lib/deviceSeed.ts`): ID estable por dispositivo, estado del permiso GPS, recorrido activo. Asistente de primera apertura en 2 pasos (`src/components/DevicePersistence.tsx`): guardar datos + autorizar GPS **una sola vez**. Reanudación automática del recorrido al reabrir.
3. **Rastreo** (`src/components/RouteTrackingProvider.tsx`): capa común web/nativa (`src/lib/nativeTracking.ts`). Sin señal ya no detiene el recorrido; posición que llega antes de 10 s se conserva (antes se perdía); latido cada 60 s en web; cola en IndexedDB; en la app nativa los envíos van por HTTP nativo a la API REST de Firestore (Android frena el WebView tras 5 min en segundo plano).
4. **Monitoreo en vivo** (`src/components/LiveMonitorPanel.tsx`, `src/lib/livePosition.ts`): colección `posiciones_actuales/{tenant--uid}`; estados En vivo (<90 s), Demorado (<5 min), Sin señal; alertas; batería, velocidad, precisión. Registro de dispositivos en `dispositivos/{tenant--uid--deviceId}`.
5. **Invitación por celular**: botones WhatsApp/SMS por recorrido (usa `phone` del perfil). NO se rastrea un número sin que la persona instale la app y autorice (Ley 1581 de 2012).
6. **Reglas Firestore** (`firestore.rules`): nuevas `dispositivos` y `posiciones_actuales`. **Publicadas** en producción. 12/12 pruebas de reglas pasan en emulador.
7. **Servidor/PWA**: `server.ts` sirve service worker, manifiesto e íconos; CSP unificada con `vercel.json`; íconos PNG; manifiesto completo. API con CORS para la app (`https://localhost`, `capacitor://localhost`). **Web publicada** en Vercel y verificada (SW, manifiesto, íconos, CSV, /api/health 200, CORS 204).
8. **App Android** (Capacitor, appId `co.proyectosconenergia.astrea` — permanente al publicar en Play Store): plugin `@capacitor-community/background-geolocation` con notificación visible, `useLegacyBridge: true`, permisos mínimos (ubicación, servicio en primer plano de ubicación, notificaciones, internet). Ícono y splash de Astrea en `resources/android/res`. APK de prueba: `Astrea-Suite-debug.apk` en la raíz del proyecto.
9. Verificación: `npm run check` → 54 pruebas pasan, 0 fallan; build OK. Pruebas e2e en navegador: rastreo, reapertura sin pedir permiso, pérdida de señal, monitoreo y alertas.

## Comandos útiles
- Pruebas y build: `npm run check`
- Reglas en emulador (requiere Java 21): en PowerShell `$env:JAVA_HOME='D:\AstreaAndroid\jdk\jdk-21.0.12.1+1'; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules`
- Compilar APK: `powershell -ExecutionPolicy Bypass -File scripts\android-apk.ps1` (≈1 min; resultado `Astrea-Suite-debug.apk`)
- Reinstalar herramientas en otro equipo: `scripts\android-tools.ps1 -Root D:\AstreaAndroid`

## Pendiente (en este orden)
1. **Probar en celular real** (Samsung del usuario): instalar el APK (Play Protect avisa «app desconocida» → «Instalar de todas formas»), iniciar sesión con correo/contraseña (Google no funciona dentro de la app), permitir ubicación y notificaciones, batería «Sin restricciones», iniciar un recorrido, apagar pantalla 10 min y confirmar en la web (*Recorridos › Monitoreo en vivo*) que sigue «En vivo». Si falla, revisar que los envíos nativos (`nativeCommit`) no reciban 403 de las reglas.
2. Confirmar la cuenta de Vercel (solver.expcal@gmail.com) y que el proyecto esté bajo esa cuenta/equipo.
3. Hacer commit de todo en git (rama nueva) y subir.
4. Activar plan **Blaze** de Firebase (≈5.800 escrituras por integrante por jornada de 8 h).
5. Play Store: cuenta de desarrollador (US$25 pago único); cuenta personal exige prueba cerrada con 12 testers × 14 días; declarar servicio en primer plano de ubicación con video; política de privacidad pública; generar **clave de firma de publicación** y guardarla con copia de seguridad; compilar AAB (`gradlew bundleRelease`).
6. Opcional: iPhone (US$99/año + Mac), Google Workspace/Drive real (el botón «Escanear carpeta Drive» solo redirige), índice/limpieza de `puntos_recorrido` antiguos.

## Precauciones
- No publicar reglas sin correr `npm run test:rules`.
- No cambiar el `appId` después de publicar en Play Store.
- La carpeta `.github` no se puede escribir por herramientas remotas; el flujo de GitHub Actions para compilar el APK está en `docs/github-actions/android-apk.yml` (moverlo a `.github/workflows/`).
- Documentación: `docs/RASTREO-Y-DISPOSITIVOS.md`, `docs/APP-NATIVA-Y-PLAY-STORE.md`.
