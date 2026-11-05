# Pasajeros y eventos: implementación y verificación

## Objetivo y alcance

El servicio administra reservas de transporte para encuentros y eventos generales. Tiene un registro propio de pasajeros, puntos de recogida, trayectos y vehículos. No importa personas, metas ni asignaciones de las bases electorales existentes. La organización y la cuenta autenticada se usan para aislar los datos y autorizar la gestión.

## Plan ejecutado

1. Corregir la visibilidad de WhatsApp: las cuentas de organización ven el requisito de AdminGlobal y un botón para cambiar de cuenta. Cuenta propietaria configurada: `expcal@expcal.net`. PR #11.
2. Crear el módulo **Pasajeros y eventos** en el menú principal.
3. Registrar eventos, reservas con acompañantes y necesidad de vehículo accesible, autorización de registro, recorridos y presupuestos por trayecto.
4. Calcular propuestas por plazo de llegada y antigüedad de la solicitud. Validar origen, destino del evento, horario, cupos y accesibilidad. Para reservas de ida y regreso, reservar ambos trayectos antes de asignar la salida.
5. Mantener el regreso reservado aunque se retire el vehículo de ida. Liberar únicamente las plazas del trayecto retirado y proponer otro compatible. Impedir retirar viajes con embarques confirmados.
6. Guardar cambios mediante transacciones con revisión y agenda por vehículo/día, evitando sobrecupos, sobrescrituras y cruces entre eventos del módulo.
7. Mostrar alertas, siete indicadores, cuatro gráficos, filtros, listas operativas y un historial de las últimas 100 acciones.

## Funcionamiento

- Crear evento → registrar pasajeros → agregar trayectos de ida y regreso → revisar propuestas → confirmar asignaciones → confirmar embarques y llegadas.
- Las propuestas se actualizan automáticamente con los datos y el reloj. La coordinación confirma su aplicación; no se envían órdenes automáticas a conductores.
- Al retirar un trayecto sin embarques, sus reservas pendientes pueden pasar a otro vehículo. Las personas embarcadas o con llegada confirmada conservan su historial.
- Los horarios son los del dispositivo y se guardan en UTC. El tablero muestra la zona horaria usada.
- Las alertas detectan reservas sin cupo, salidas vencidas sin embarque y llegadas previstas sin confirmación. Son reglas de horario y disponibilidad, no predicciones basadas en tráfico o GPS.
- Costos: litros = km / km por litro; combustible = litros × COP/litro; costo del trayecto = combustible + alquiler; costo por persona registrada = suma de trayectos activos / personas en reservas activas. Son estimaciones y no se presentan como pagos realizados.

## Persistencia y acceso

Los eventos usan documentos con `kind: passenger-logistics-v1` en `eventos_workspace`, colección de la organización ya autorizada por las reglas existentes. La agenda usa `agenda_vehiculos` con identificadores de vehículo propios del módulo. No se cambian roles ni reglas de seguridad. Las cuentas AdminTenant y AdminGlobal gestionan el módulo; otros integrantes autorizados de la organización pueden consultarlo. La colección conserva su política preexistente de acceso interno por organización: no es un portal público para pasajeros.

Las transacciones verifican la revisión leída antes de guardar. Una lectura del servidor confirma el resultado. Los listeners actualizan otras sesiones; la pantalla diferencia datos locales de datos confirmados. Las transacciones requieren conexión. El motor verifica capacidades, horarios y estados en la aplicación; este cambio no introduce nuevas restricciones de esquema en las reglas de Firestore.

## Verificación

- Diez pruebas unitarias: ida/regreso indivisibles; cupos y acompañantes; accesibilidad, puntos y horarios; prioridad; retiro y reasignación; embarque/llegada; cancelación; propuestas obsoletas; costos y alertas; cruce de medianoche.
- Integración con emulador y reglas reales: cuenta AdminTenant, persistencia, listener con confirmación del servidor, rechazo de revisiones obsoletas, escrituras concurrentes, reserva del mismo vehículo entre eventos y aislamiento de otras organizaciones y usuarios anónimos.
- Comprobación completa de TypeScript, pruebas existentes, ejecución de API y compilación antes de integrar.

## Límites y siguientes etapas

- Máximo 300 reservas (con hasta 30 plazas por reserva) y 100 trayectos por evento; historial de 100 acciones. La pantalla informa los límites. Un servicio de gran escala requiere separar reservas y trayectos en documentos propios y reforzar invariantes en servidor/reglas.
- Se administran reservas desde una sesión de la organización. Un portal público de autoservicio con invitaciones, identidad, avisos y consentimiento por pasajero es una etapa pendiente.
- El agente WhatsApp existente recibe solicitudes de recursos mediante su cuestionario. Este módulo no convierte esas solicitudes en reservas de pasajeros ni da por comprobado el enlace con un teléfono físico. La vinculación sigue requiriendo la cuenta propietaria y completar el paso en el teléfono.
- El receptor WhatsApp actual depende de mantener la pestaña abierta. Una operación continua requiere un receptor persistente y monitoreo de entrega.
- Las agendas de este módulo son independientes de la flota anterior: un vehículo usado fuera de estos eventos debe declararse ocupado al programar sus trayectos; no hay conciliación automática con sistemas externos.
- No se prometen llegadas garantizadas: dependen de datos oportunos, cupos disponibles y ejecución de conductores. Los pendientes permanecen visibles hasta una confirmación del servicio.
