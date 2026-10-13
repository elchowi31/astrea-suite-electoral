# Revisión de cambios e instalación de Astrea Suite

Fecha: 10 de octubre de 2026. Fuente: cambios locales desde `92869f1`, archivos nuevos de Android, GPS, importación geográfica y edición; APK adjunto del usuario.

Estado: revisión y preparación de paquetes terminadas. APK release instalado y apertura comprobada en el Samsung; acceso y seguimiento físico pendientes. Consulte `PRUEBA-SAMSUNG-2026-10-10.md`.

## Diagnóstico de la captura

El texto coincide con la categoría **Uncommon** de Play Protect: Google no ha visto una aplicación de este desarrollador antes. El APK recibido verifica correctamente su firma v2, pero usa el certificado `Android Debug`, tiene depuración habilitada y versión 1.0 (código 1). La firma de publicación permite una distribución mantenible; por sí sola no obtiene la aprobación de Google ni garantiza que desaparezca la advertencia.

Fuentes: [mensajes oficiales de Play Protect](https://developers.google.com/android/play-protect/warning-strings), [verificación y apelación](https://support.google.com/googleplay/android-developer/answer/2992033), [firma de aplicaciones](https://developer.android.com/studio/publish/app-signing).

## Hallazgos y correcciones

| Área | Hallazgo | Corrección | Estado |
|---|---|---|---|
| Android | Solo había compilación debug; release carecía de firma y todas las versiones repetían código 1. | Clave de publicación privada, compilación release y AAB, versión 1.0.1/código 2, verificación de firma y SHA-256. | Implementado |
| Permisos GPS | La configuración inicial usaba GPS web y el proveedor asumía permiso nativo concedido, incluso después de retirarlo en Android. | Consultar y solicitar el permiso real con los métodos heredados de Capacitor, sin iniciar rastreo durante la configuración. | Implementado |
| Inicio de recorridos | Un permiso denegado podía dejar la asignación en curso antes de iniciar el GPS. | Preparar ubicación y notificaciones antes de cambiar el estado. | Implementado |
| Sincronización | `nativeCommit` trataba cualquier 409 o FAILED_PRECONDITION como una posición ya guardada. | Solo ALREADY_EXISTS es un reintento guardado; los demás errores conservan la posición en la cola. | Implementado |
| Sesión nativa | El asistente cambiaba la persistencia nativa IndexedDB por la del navegador. | Conservar IndexedDB en Android para la sesión guardada. | Implementado |
| Recorridos largos | Aunque las posiciones usaban HTTP nativo, renovar el token dependía del HTTP del WebView, limitado por Android en segundo plano. | Renovación por HTTP nativo con caducidad, reintento, aislamiento por sesión y protección de credenciales en errores. | Implementado |
| Notificación | La notificación de servicio reutilizaba el icono adaptativo, incompatible con un icono pequeño monocromo. | Icono vectorial de ubicación y permiso de notificación comprobado. | Implementado |
| Compilación | TypeScript incluía también los paquetes JavaScript generados en dist, build y Android porque allowJs estaba activo sin exclusiones. | Excluir salidas generadas del análisis para evitar analizar varias copias del bundle y agotar memoria. | Implementado |

## Verificación

Comprobación final:

- TypeScript correcto. **59 pruebas de aplicación aprobadas**, 0 fallos. Las 12 pruebas de reglas que aparecen omitidas en `npm test` se ejecutaron por separado: **12 aprobadas**, 0 fallos.
- Compilación web, servidor y API correctas. Compilación Android `assembleRelease assembleDebug bundleRelease` correcta, incluidas comprobaciones vitales de lint de release.
- APK release y debug: firmas verificadas con apksigner, alineación verificada con zipalign, identificador correcto, versión 1.0.1/código 2. Release tiene depuración desactivada. Debug conserva exactamente el certificado del APK recibido.
- AAB: firma criptográfica verificada con jarsigner. El certificado de desarrollador es autofirmado, como corresponde a la clave creada; la aprobación de Play Console sigue pendiente.
- API de producción: `/api/health` 200; preflight desde `https://localhost` 204 con el origen permitido. Servidor local compilado: página principal y health 200.
- La herramienta del navegador agotó el tiempo al abrir la aplicación local, así que no se considera realizada una comprobación visual en esta sesión.

Después de preparar los paquetes, el usuario conectó el Samsung SM-S721B con Android 16. Se instaló el APK release 1.0.1 por USB y se comprobó visualmente la portada y el formulario de acceso. La ubicación precisa está concedida y se activó la ubicación general. El inicio de sesión y diez minutos de seguimiento con pantalla apagada siguen pendientes de completar el acceso en el teléfono.

La renovación sigue la [API REST oficial de Firebase Auth](https://firebase.google.com/docs/reference/rest/auth#section-refresh-token). Se comprueba con tiempo simulado, renovación a una hora y respuestas rechazadas; la duración real del servicio en Samsung sigue pendiente.

## Detalles de la revisión

Se corrigieron **8 hallazgos**. No quedan hallazgos críticos identificados en el alcance revisado; esto no equivale a una certificación de seguridad de Google. También se corrigieron los textos de ajustes de Android y la retirada de la semilla local al borrar los datos del dispositivo.

| Hallazgo | Severidad | Archivo de la solución |
|---|---|---|
| Firma y versiones de publicación | Alta | `android/app/build.gradle:14`, `scripts/android-signing.ps1`, `scripts/android-apk.ps1` |
| Permiso nativo sustituido por una suposición | Alta | `src/lib/deviceSeed.ts:73`, `src/lib/nativeTracking.ts:27` |
| Recorrido en curso sin iniciar correctamente | Media | `src/components/RouteTrackingProvider.tsx:77` |
| Posiciones rechazadas consideradas entregadas | Alta | `src/lib/nativeTracking.ts:101` |
| Cambio de persistencia de sesión nativa | Media | `src/components/DevicePersistence.tsx:12` |
| Renovación de sesión limitada por el WebView | Alta | `src/lib/nativeAuth.ts:7`, `src/components/RouteTrackingProvider.tsx:34` |
| Aviso de recorrido sin icono pequeño adecuado | Media | `resources/android/res/drawable/ic_tracking.xml`, `scripts/setup-android.mjs` |
| Análisis de varias copias compiladas | Media, impacto de Android | `tsconfig.json:2` |

Revisión de seguridad: aislamiento por organización y usuario en Firestore, historial GPS inmutable, KML sin entidades externas, límites de importación, nombres de mapas tratados como texto, credenciales de firma fuera de Git/Vercel y errores de renovación sin tokens. Las ediciones existentes conservan auditoría y comprueban conflictos de campos mediante transacciones. El acceso de Google sigue limitado a la web y está documentado.

## Paquetes entregados

En `D:\Descargas`:

- `Astrea-Suite-release.apk`
- `Astrea-Suite-debug-1.0.1.apk`
- `Astrea-Suite-release.aab`
- Archivos SHA-256 junto a cada paquete.
- `Instalacion-Astrea-Suite-1.0.1.md`

El APK original adjunto se conserva sin sobrescribir. Su SHA-256 es `94E700C9F178B7257FF2184DAC197B51F234AE356E9896B87BD14BBCEAFDE167`.

No se cambiaron cuentas de Vercel/Firebase, reglas de producción, planes de facturación ni publicaciones en Google Play. Los cambios de esta revisión y los cambios previos siguen en la carpeta de trabajo para su revisión.
