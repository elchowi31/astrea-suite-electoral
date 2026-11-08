# Formularios, Firestore y trabajo sin internet

Revisión del 8 de noviembre de 2026. Esta matriz corresponde al código de esta entrega. Las pruebas con emuladores usan exclusivamente el proyecto `demo-astrea` y datos ficticios. La validación del despliegue se registra por separado.

## Capturas con conservación local y envío automático

| Formulario o acción | Persistencia | Comportamiento sin red |
| --- | --- | --- |
| Candidaturas, propuestas, líderes, vehículos, gastos y aportes | Helpers de `firebase.ts`; `candidatos`, `propuestas`, `lideres`, `vehiculos`, `gastos`, `aportes` y `auditoria` | Intención completa en IndexedDB; se envía en orden al volver la red. |
| Votantes y coordinaciones | `votantes_rasos`, `comites_coordinaciones` | Misma cola. Los permisos y referencias se vuelven a comprobar al sincronizar. |
| Edición de fichas, comités y tareas | `recordEditing.ts`, `saveCommitteeTask` | Conserva los campos originales; las ediciones detectan cambios concurrentes. Las marcas de tareas se aplican a la tarea correspondiente sin reemplazar otros comités. |
| Jornadas, solicitudes iniciales y reportes de avance | `operationsStore.ts`; `jornadas_operativas`, `solicitudes_recursos`, `reportes_jornada` | Cola durable; las transacciones y las validaciones se ejecutan al reconectar. Una solicitud pendiente no constituye aprobación. |
| Planillas de embarque y llegada | `attendanceStore.ts`; `registros_jornada` | Conserva la acción y combina canales al sincronizar; documento, consentimiento y revisión se validan en Firestore. |
| Ubicación de líderes, vehículos y trazados guardados | `mapPersistence.ts`; `lideres`, `vehiculos` | Conserva los campos de ubicación y recorrido. El cálculo de rutas y los mapas externos requieren red. |
| Elementos de capas geográficas | `saveGeographicFeature`; `capas_geograficas` | Detecta cambios en el elemento editado y conserva las modificaciones de otros elementos. |
| Importación de tablas, capas geográficas y rutas electorales | `persistFirestoreBatch`; `bases_datos`, `capas_geograficas`, `rutas_transporte_electoral` | Conserva el lote antes de cerrar el formulario. Mantiene las restricciones de lectura de tablas privadas. |
| Fuentes estadísticas y escenarios compartidos | `sharedSimulation.ts`; `fuentes_estadisticas`, `simulaciones` | Nuevas importaciones y escenarios usan la cola durable. Retirar una fuente completa o un escenario requiere red para localizar todos sus fragmentos. |
| Archivos y metadatos de Workspace; resultados de IA | `archivos_drive`, `eventos_workspace`, `analisis_ia` | La persistencia local del resultado usa la cola. Crear recursos en Google o generar resultados de IA necesita conexión. |

Cada comando usa una constancia inmutable bajo `usuarios/{uid}/mutaciones_offline/{id}`. La escritura y su constancia se confirman en la misma transacción. Repetir un comando después de un cierre no vuelve a aplicar sus datos ni duplica su auditoría.

La confirmación local significa que IndexedDB terminó de guardar. El aviso de Firestore procede de una lectura del servidor. La cola no se mezcla entre cuentas u organizaciones. Un error de permisos, validación o conflicto conserva el intento, detiene los siguientes envíos y ofrece revisión, respaldo y reintento. Retirar un intento con error exige confirmación en la interfaz.

## Operaciones que necesitan conexión

| Operación | Motivo |
| --- | --- |
| Crear cuentas, cambiar accesos y administrar organizaciones | La cuenta y su autorización deben estar confirmadas antes de informar éxito. |
| Aprobar solicitudes, convertirlas en gasto, transferir recursos o reservar transporte | Deben consultar disponibilidad y decisiones actuales de otras personas. |
| Reservas y cupos de pasajeros | Mantienen la revisión y la agenda de vehículos de forma atómica. |
| Certificar recompensas | Necesita validar permisos y revisiones actuales. |
| Preparar, editar o promover datos de demostración compartidos | Usa transacciones sobre una presentación separada de los registros reales. |
| Configurar WhatsApp, consumir servicios Google/IA o recibir eventos de SorteApp | Dependen de servidores externos. El bloqueo de alta en Meta sigue siendo independiente. |

Los formularios muestran el motivo al intentar estas operaciones sin red y conservan sus campos. No se concede un cupo ni una aprobación basándose únicamente en la caché.

## Preparación del dispositivo

1. Abrir Astrea con internet e iniciar sesión.
2. Autorizar la conservación de datos en un dispositivo propio. Puede continuar sin seguimiento GPS.
3. Abrir las listas que necesitará y esperar su carga.
4. En **Mi dispositivo**, comprobar que la aplicación está preparada para abrir sin internet.
5. Al reconectar, mantener o volver a abrir Astrea con la cuenta y organización que capturaron los datos. Revisar el estado de sincronización hasta resolver todos los pendientes.

Solo se pueden consultar offline los datos previamente descargados. Una instalación nueva y el primer ingreso necesitan red. La sincronización web no se garantiza con el navegador cerrado o suspendido. Borrar datos del navegador o desinstalar elimina lo que aún no se haya enviado. El panel impide retirar datos locales mientras existan formularios, rutas o posiciones pendientes.

El respaldo de pendientes contiene datos personales; debe conservarse en un lugar privado. Es una copia de las intenciones pendientes, no una restauración automática de toda la base.

## Evidencia reproducible

- `npm run check`: tipos, pruebas de lógica, carga del runtime API y compilación web/servidor.
- Emuladores Auth/Firestore: reglas de acceso, persistencia, segundo cliente independiente, reservas concurrentes y recepción de solicitudes.
- `offlineMutations.integration.test.ts`: captura con Firestore desconectado, reapertura de IndexedDB, separación de cuentas/organizaciones, reenvío después de un cierre, conflicto concurrente, comités, planillas, tablas, capas, Workspace/IA, estadísticas y lote de 25 documentos.
- `offlineApp.test.ts`: caché de la versión activa, apertura offline, exclusión de API/autorización y comprobación de todos los archivos descargados.

El trabajo de integración usa `--test-force-exit` después de terminar los tests: el SDK de Firestore para Node conserva temporizadores de conexión en la prueba que alterna repetidamente la red. Se mantienen los límites por test, las aserciones y los fallos; la suite normal se ejecuta sin ese indicador.

Referencia técnica: [persistencia offline y condiciones de uso de Firestore](https://firebase.google.com/docs/firestore/manage-data/enable-offline).
