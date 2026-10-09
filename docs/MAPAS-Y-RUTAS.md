# Mapas, ubicaciones y rutas

Abra **Mapa territorial**. El visor **Satelital HD** muestra imágenes Esri World Imagery desde el primer acceso, incluso sin registros georreferenciados. **Calles** usa OpenStreetMap y **Google Maps** abre el visor alternativo con la configuración de producción. También hay enlaces para abrir la zona y navegar directamente en Google Maps.

Puede desplazar el mapa, acercar, alejar, ampliar y ajustar la vista a las ubicaciones. Los filtros permiten escoger municipio, zona, barrio o vereda, líderes y vehículos, o buscar por nombre y placa. Los puntos representan las coordenadas guardadas; un registro sin coordenadas aparece como pendiente de ubicación.

## Registrar ubicaciones

En los formularios de líderes y transporte, use **Seleccionar ubicación en mapa**, **Usar mi ubicación GPS** o escriba las coordenadas. El punto se guarda al enviar el formulario.

En el mapa territorial, toque un lugar, seleccione **Registro a ubicar** y pulse **Guardar ubicación**. Las modificaciones se comparten mediante Firestore. **Compartir GPS de este registro** actualiza la posición del líder o vehículo que lleva el dispositivo, como máximo cada diez segundos. Requiere permiso de ubicación del navegador. Se detiene al salir de esta vista o pulsar **Detener GPS compartido**; no garantiza seguimiento con el navegador cerrado o suspendido.

## Planificar y guardar rutas

1. Añada entre dos y cinco paradas desde ubicaciones registradas o puntos seleccionados en el mapa. La primera es el origen y la última el destino. Puede eliminar y reordenar paradas.
2. Pulse **Calcular ruta** para mostrar el recorrido por carretera, la distancia y el tiempo aproximado.
3. Escriba un nombre, seleccione un vehículo y pulse **Guardar ruta del vehículo**. El equipo puede cargarla después de recargar la página. También aparece en Transporte.
4. Use **Navegar en Google Maps** para abrir las indicaciones en la aplicación de mapas.

El cálculo usa OSRM con cartografía OpenStreetMap y envía únicamente las coordenadas de las paradas. Sus estimaciones no incluyen tráfico en vivo ni garantizan el estado de las vías. Si el proveedor no responde, el enlace de navegación en Google Maps permanece disponible. Cambiar las paradas exige calcular de nuevo antes de guardar; actualizar el GPS conserva la ruta y los demás campos del vehículo.

## Implementación y proveedores

Se revisaron las versiones `a677270` y `82bda51`, que contenían `TerritorialMapView`, `SatelliteRadarCanvas`, `DriverBeaconModal` y `telemetryService`. La versión `0375bec` había retirado el visor alternativo y sus controles. El visor histórico llamado satelital cargaba teselas de calles OpenStreetMap y tenía posiciones de respaldo simuladas. La recuperación usa imágenes satelitales reales, navegación táctil con Leaflet y las coordenadas registradas.

No se crean colecciones nuevas ni se cambian las reglas de acceso. Ubicaciones y rutas se actualizan parcialmente, con transacción y auditoría, en `lideres` y `vehiculos`, preservando los otros campos y verificando la organización. Los registros demo son de solo lectura. El GPS se activa por una acción explícita.

Los proveedores pueden cambiarse con `VITE_SATELLITE_TILE_URL`, `VITE_STREET_TILE_URL` y `VITE_ROUTING_SERVICE_URL`; al cambiar rutas debe actualizarse `connect-src` en `vercel.json`. Las claves e identificadores de Google Maps se configuran en Vercel; no se solicita al usuario final ingresar una clave.

Referencias: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), [CSP de Google Maps](https://developers.google.com/maps/documentation/javascript/content-security-policy), [Leaflet](https://leafletjs.com/reference.html), [OSRM](https://project-osrm.org/docs/v5.24.0/api/), [servicio público OSRM](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server), [condiciones de teselas OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/), [Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer).

El visor solicita solamente las teselas visibles, conserva la atribución del proveedor y usa la caché normal del navegador. Los servicios públicos OSM/OSRM tienen disponibilidad de mejor esfuerzo y límites de uso; configure otro proveedor si el volumen lo requiere.
