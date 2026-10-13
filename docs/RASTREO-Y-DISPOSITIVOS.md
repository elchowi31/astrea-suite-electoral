# Rastreo GPS y semilla de dispositivo

Auditoría y desarrollo: **Wilson José Arias** · Proyectos con Energía · 10 de octubre de 2026.

## Cómo funciona en cada celular

1. **Primera apertura.** Aparece «Configurar este dispositivo» en dos pasos: *Guardar Astrea en este dispositivo* (sesión, datos y posiciones pendientes) y *Activar la ubicación GPS*. El navegador muestra su aviso de permiso esa única vez.
2. **Semilla del dispositivo.** Se guarda en el navegador (`astrea-device-seed-v1`): identificador estable del dispositivo, estado del permiso GPS, fecha en que se autorizó y el recorrido que quedó activo. Con «Continuar sin guardar» la semilla dura solo hasta cerrar el navegador.
3. **Aperturas siguientes.** Astrea consulta el permiso en silencio (Permissions API). No vuelve a preguntar. Si había un recorrido «En curso» en ese dispositivo, para el mismo usuario y con el GPS autorizado, el seguimiento se reanuda solo.
4. **Registro en la nube.** Cada dispositivo queda en la colección `dispositivos` (`organización--usuario--dispositivo`) con modelo, estado del GPS, si está instalada como app, recorrido activo y última conexión. Los coordinadores lo ven en *Recorridos › Dispositivos registrados del equipo*.

## Calidad del rastreo

- Una posición cada 10 s como máximo; si llega antes, se conserva la más reciente y se registra al cumplirse el intervalo (antes se descartaba).
- Latido cada 60 s para que un teléfono quieto no aparezca como «sin señal».
- Sin señal o con tiempo agotado el recorrido **sigue activo** y vuelve a registrar al recuperar cobertura (antes se detenía y quedaba en «Pausado»). Solo una denegación del permiso lo detiene.
- Si el usuario retira el permiso en los ajustes del navegador, Astrea lo detecta, pausa el recorrido y explica cómo reactivarlo.
- Las posiciones se guardan primero en el dispositivo (IndexedDB) y se sincronizan con Firestore cuando hay conexión.

## Rastreo continuo

- **App instalada (Android):** el rastreo sigue con la pantalla apagada o la app minimizada, con notificación visible. Ver [APP-NATIVA-Y-PLAY-STORE.md](APP-NATIVA-Y-PLAY-STORE.md).
- **Navegador:** solo con Astrea abierta y visible. Astrea mantiene la pantalla encendida cuando el navegador lo permite (Wake Lock).
- **iPhone/Safari** puede volver a preguntar la ubicación periódicamente. Para evitarlo: *Ajustes › Safari › Ubicación › Permitir*, o instalar Astrea en la pantalla de inicio.
- Borrar los datos del sitio, usar navegación privada o cambiar de navegador crea un dispositivo nuevo y vuelve a mostrar la configuración inicial.

## Despliegue

1. Publicar las reglas antes que el frontend: `firebase deploy --only firestore:rules` (añaden `dispositivos` y `posiciones_actuales`; las colecciones existentes no cambian). Si el frontend se publica primero, el historial GPS funciona igual; el registro de dispositivos y el monitoreo en vivo quedan vacíos hasta publicar las reglas.
2. Publicar el frontend en Vercel: `npm run check` y luego `npm run deploy`.
3. Verificar en producción que `/service-worker.js` y `/manifest.webmanifest` no devuelvan la página de inicio.

## Recepción de archivos

*Mapa territorial › Cargar mapas, rutas y ubicaciones* acepta KML, KMZ, CSV, XLSX y XLS (hasta 25 MB). El CSV que guarda Excel en Windows en español (separador `;`, coma decimal, codificación Windows-1252) ahora se lee correctamente; antes se rechazaba con «Coordenadas inválidas».
