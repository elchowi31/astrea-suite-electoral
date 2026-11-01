# WhatsApp operativo mientras Astrea permanece abierta

## Uso

1. Entre como administrador global, elija la organización y «Usar datos reales».
2. En Solicitudes y jornadas abra «WhatsApp · recepción desde esta pestaña». Indique el número receptor con indicativo, responsable, jornada vigente y municipio. Use una jornada de prueba.
3. Pulse «Iniciar / reanudar recepción». En WhatsApp del receptor: Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono. Introduzca el código privado del panel.
4. Espere el estado verde «recepción activa». Desde otro número envíe «Necesito 3 almuerzos» o «Transporte para 8 personas», conteste la descripción y confirme el resumen. Los mensajes propios del receptor, grupos y contenido no textual no entran al asistente.
5. La confirmación guarda una solicitud real en Firestore, pendiente, con marca PRUEBA WHATSAPP, teléfono de origen y operador. El costo inicia en cero, por cotizar. No aprueba gastos ni reserva cupos. El radicado se devuelve después de verificar la escritura; el panel indica «Visible en la plataforma» cuando el listener recibe la fila.
6. Puede cambiar a otros módulos de Astrea sin detener la recepción. La barra superior informa el estado y permite detenerla. La conexión se renueva automáticamente antes del límite de cada función de Vercel, conservando la vinculación y los formularios en curso. Puede haber una breve pausa de reconexión; no se promete recepción instantánea durante ese intervalo.
7. «Detener recepción» interrumpe el servicio. Los mensajes enviados durante esa pausa voluntaria no se procesan al reanudar; los ya aceptados antes de detener permanecen pendientes. «Iniciar / reanudar» recupera la misma vinculación si conserva esta pestaña y los mismos datos. «Nueva vinculación» descarta la clave local; retire el dispositivo anterior en WhatsApp antes de volver a vincular. Cerrar o recargar la pestaña pierde la clave local y requiere iniciar una nueva vinculación. Las solicitudes ya confirmadas no se borran.

## Celular y PC

No requiere instalar Termux ni mantener un VPS. Se ejecuta con el navegador abierto y conectado a Internet. En Android mantenga Astrea en primer plano; el navegador puede suspender una pestaña con la pantalla bloqueada o al cambiar de aplicación. Se solicita Screen Wake Lock si el navegador lo admite. Esta API solo evita el apagado de pantalla mientras el navegador lo permite: no garantiza ejecución en segundo plano. Al regresar se comprueba la conexión y se reintenta automáticamente si la sesión sigue viva.

## Persistencia y control

- Una petición autenticada sostiene cada tramo de hasta 240 segundos; la función tiene máximo 300 segundos. Solo el controlador de la pestaña inicia el siguiente tramo, obteniendo un token Firebase actualizado. No hay cron, auto-invocación del servidor ni servicio autónomo 24/7.
- La recepción se monta fuera de las vistas de cada módulo y se detiene al salir de la cuenta, cambiar de organización, pasar a demo o perder el rol requerido. El backend exige claims de administrador global y verifica organización/responsable/jornada antes de conectar y antes de procesar cada solicitud.
- Baileys conserva su autenticación entre tramos. No se hace logout durante las renovaciones. Las claves Signal se escriben antes de confirmar su actualización; las credenciales, la bandeja pendiente y los cursores de conversación se guardan cifrados con AES-256-GCM en `usuarios/{uid}/whatsapp_sessions/{id}`. Cada escritura usa compare-and-set.
- La clave aleatoria de 256 bits vive solo en memoria de la pestaña y se transmite por HTTPS en el cuerpo autenticado. Nunca se escribe en Firestore, URLs, logs, localStorage ni sessionStorage. El cifrado se liga al operador, identificador y ámbito. La regla administrativa existente protege esos documentos. El campo expiresAt es metadato de retención; no presupone una política TTL ya instalada. Al perder la clave no se puede recuperar el documento cifrado desde otra pestaña.
- El bloqueo exclusivo por número evita conexiones simultáneas desde dos pestañas. Se libera después de guardar y cerrar el transporte; un bloqueo abandonado vence en cinco minutos. La pestaña reintenta con espera progresiva. Los errores de permiso y de vinculación requieren intervención visible.
- Los mensajes de la breve desconexión se admiten al volver si WhatsApp los entrega y corresponden al período de recepción activo (cada reanudación manual actualiza el corte; una renovación automática lo conserva). Se conserva la bandeja antes de procesarla y la respuesta antes de enviarla. Un fallo después de enviar y antes de guardar el recibo puede repetir una respuesta de WhatsApp, pero el backend conserva la idempotencia de la solicitud.
- Los borradores permanecen en `usuarios/{uid}/agent_conversations`; solicitudes y auditoría usan las colecciones existentes y una transacción. El cursor de cada remitente sobrevive a la renovación, incluso después de «nueva solicitud».
- Prueba de bajo volumen: 30 mensajes por contacto y 100 procesados por tramo, 100 pendientes, 1000 recibos por vinculación y estado cifrado con tamaño limitado. Los límites detienen o rechazan de forma visible; no habilitan campañas de mensajes masivos.

## Verificación

Las pruebas cubren cifrado y manipulación, restauración de claves binarias, escritura concurrente, renovación de la pestaña, revocación de permisos, cierre sin logout, bandeja pendiente y liberación del bloqueo antes de renovar. La integración con Auth/Firestore emulados crea solicitudes, renueva el backend entre pasos, inicia una segunda solicitud, confirma sin duplicar y vuelve a leer los datos persistentes.

La vinculación y recepción real con el teléfono requieren intervención del titular. Las pruebas automatizadas no prueban el protocolo real de WhatsApp, la estabilidad de la cuenta ni el comportamiento de Android durante una suspensión. El despliegue no equivale a tener el número conectado.

Referencias: https://vercel.com/docs/functions/configuring-functions/duration y https://github.com/WhiskeySockets/Baileys
