# Control operativo de jornadas

En **Solicitudes y jornadas**, cada responsable registra su listado: una línea por recurso, con cantidad, costo estimado y jornada. El botón **Guardar y agregar otro recurso** conserva al responsable para continuar el listado. Coordinación aprueba, confirma la entrega y registra el gasto. Los formularios guardan en Firestore y comparten sus cambios dentro de la organización.

El tablero reúne metas de líderes, reportes acumulados, personas registradas y validadas, costos, solicitudes y transporte. Los porcentajes pueden superar el 100%. Las llegadas de transporte se muestran por separado: no acreditan un voto emitido. La alerta de avance compara el reporte con el tiempo transcurrido de la jornada, con un margen del 20%; es una referencia operativa, no un pronóstico electoral.

## Transporte y reasignación

1. Aprobar las solicitudes de transporte y seleccionar la jornada y el sentido: **Ida** o **Regreso**.
2. Analizar la capacidad disponible y aplicar o programar los viajes. Se excluyen mantenimiento y reservas simultáneas. La propuesta inicial reserva la ventana de la jornada; los horarios manuales permiten programar vueltas adicionales. No se calculan tiempos de carretera para estas propuestas.
3. En **Reasignación, sobrantes y regreso**, actualizar el conteo de personas pendientes, incluyendo próximas recogidas. Los conteos se consideran vigentes durante 30 minutos.
4. Si los demás vehículos cubren la cola confirmada del responsable y otro tiene demanda sin cupo, el sistema propone reasignar un viaje programado. Coordinación confirma recogida, destino, tiempo disponible y motivo. Los viajes iniciados no se reasignan. Los reportes electorales no determinan el acceso al transporte o a la alimentación.
5. Al cerrar cada viaje, registrar las llegadas reales. Los cupos no utilizados se liberan. Solicitar el regreso de quienes lo requieran, revisar cantidades y destinos, aprobar y programar el retorno por separado.

Las reservas se verifican mediante transacciones y una agenda por vehículo y día. Dos usuarios no pueden reservar simultáneamente el mismo vehículo en el mismo horario mediante el flujo de la aplicación.

## Sobrantes y costos

Registrar consumo acumulado y sobrantes confirmados de recursos entregados. **Ceder sobrante** mueve unidades entre solicitudes aprobadas del mismo recurso y jornada. La cesión exige un responsable distinto, cantidad disponible y motivo. La operación conserva una auditoría y evita duplicar una cesión por reintento.

El costo de las unidades cedidas permanece en el gasto de origen. La solicitud receptora registra gasto solamente por las unidades que aún deba adquirir; el tablero conserva esta atribución contable. Para evitar un segundo gasto, una solicitud receptora con gasto ya registrado no admite la cesión: se utiliza una necesidad adicional sin gasto. Las entregas posteriores descuentan las unidades ya recibidas por cesión.

## Territorio y líderes

**Territorio → Cargar mapas, rutas y ubicaciones** admite KML, KMZ, CSV, XLSX y XLS hasta 25 MB. Se importan puntos, rutas y polígonos; en Excel se leen todas las hojas con datos. Se usa WGS84: latitud y longitud en grados decimales. Los archivos inválidos presentan el error antes de guardar. Los enlaces externos de KML no se descargan.

CSV y Excel usan columnas `nombre`, `latitud`, `longitud`; para rutas se agregan `tipo=ruta`, `ruta` y `orden`. El panel incluye una plantilla CSV. La vista previa muestra los elementos, y **Importar y guardar** persiste la capa compartida. Es posible ocultar, renombrar, editar o retirar capas.

En **Líderes y metas → Registrar Nuevo Líder → Seleccionar ubicación en mapa**, tocar un punto completa latitud y longitud. También se puede escribirlas o usar el GPS. Se guardan al enviar el formulario y pueden editarse posteriormente. La selección no infiere una dirección postal ni cambia automáticamente el municipio declarado.

## Demostración y permisos

La demostración contextual incluye los 25 municipios del Cesar para perfiles departamentales, categorías completas de recursos y gastos, actividades, personas ficticias, reportes superiores a la meta y ejemplos de vehículos y comida disponibles para reasignar. Se guarda aparte de los registros operativos. **Regenerar mis datos de prueba** actualiza presentaciones anteriores; **Usar datos reales** permite operar.

Los miembros activos crean formularios dentro de su organización. Coordinación administra aprobaciones, viajes y cesiones; los responsables asignados pueden actualizar sus conteos y reportes. La ubicación privada del equipo mantiene sus permisos de seguimiento y no se incorpora a la demostración.
