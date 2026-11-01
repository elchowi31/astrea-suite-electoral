# WhatsApp: prueba temporal en Vercel

## Alcance

En Solicitudes y jornadas, un administrador global puede abrir «WhatsApp · prueba en Vercel». Es una prueba atendida de cuatro minutos, dentro de una función con límite de 300 segundos. No ofrece recepción permanente ni invocaciones automáticas para mantenerla viva. Mantenga el panel abierto y el teléfono con conexión mientras prueba.

El receptor es el número corporativo que el operador escribe al iniciar. Desde OTRO número de WhatsApp se envían las solicitudes. Los mensajes propios, grupos, historias, mensajes antiguos, medios y remitentes LID sin teléfono verificable se ignoran. Solo se reciben textos nuevos mientras el panel indica «Conectado». Cualquier contacto puede enviar una solicitud durante esta ventana; no obtiene acceso a la base ni a otros registros. Hay un límite de 30 mensajes por contacto y 100 por sesión.

## Uso

1. Inicie sesión como administrador global y seleccione la organización correcta y «Usar datos reales».
2. Cree o seleccione un responsable y una jornada claramente identificados como pruebas. Abra el panel, escriba el número receptor con indicativo, el responsable, la jornada y el municipio. Estos tres últimos datos se aplican a todas las solicitudes de la ventana.
3. Pulse «Iniciar prueba de 4 minutos». En WhatsApp del receptor, abra Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono. Introduzca allí el código que muestra el panel. No lo comparta ni lo envíe en chats.
4. Espere «Conectado». Desde un segundo teléfono, escriba «Necesito 3 almuerzos» o «Transporte para 8 personas». Conteste la descripción solicitada y revise el resumen. El costo inicial es cero, por cotizar; el operador puede corregirlo posteriormente desde la plataforma. Escriba «confirmar» solo si los datos están bien.
5. WhatsApp devuelve un radicado únicamente después de verificar la escritura. En el panel aparece «Solicitud guardada» y, cuando el listener de Firestore recibe la fila, «Visible en la plataforma». La solicitud aparece en la tabla habitual, pendiente, con la marca PRUEBA WHATSAPP y el teléfono de origen en las notas. No implica aprobación, reserva de transporte, entrega ni desembolso.
6. Recargue la plataforma y busque el radicado: los registros y borradores persisten en Firestore. «Nueva solicitud» inicia otro borrador; «cancelar» cierra el actual. Las solicitudes se registran bajo el operador que autorizó la sesión; no se suplanta una cuenta Astrea del remitente.
7. Pulse «Detener y desconectar» al terminar. También finaliza al cerrar la página, perder la conexión o alcanzar el límite. Se intenta cerrar la sesión vinculada; si Vercel termina abruptamente el proceso, retire manualmente el dispositivo desde WhatsApp. La siguiente prueba requiere vincular de nuevo. Los datos confirmados no se borran.

## Implementación

- Se conserva Baileys como transporte y el normalizador de remitentes del adaptador del kit Claude. No se ejecutan su dashboard, SQLite, herramientas comerciales ni llamadas a modelos de IA.
- API autenticada: POST `/api/whatsapp/pilot`. Solo claims de administrador global. Se verifican organización, responsable y jornada antes de conectar y antes de procesar cada mensaje.
- Las credenciales de WhatsApp y claves Signal solo viven en la memoria de la función. No se guardan QR/códigos, credenciales ni tokens en Firestore, logs o almacenamiento del navegador.
- Firestore `whatsapp_pilot_locks/{hashDelTelefono}` guarda un bloqueo temporal adquirido con compare-and-set. No contiene credenciales. La regla administrativa existente limita su acceso. Un bloqueo abandonado vence en cinco minutos; una ejecución antigua no puede liberar el bloqueo de una nueva.
- Los borradores y recibos usan `usuarios/{uid}/agent_conversations`, y las solicitudes `solicitudes_recursos`, con auditoría en la misma transacción. La lista existente usa `onSnapshot` y no necesita actualización manual.
- La prueba es compatible con navegador móvil; Samsung S24 FE / Android 16 sirve como teléfono de vinculación, sin instalar Termux. No es una garantía de estabilidad de WhatsApp ni de ejecución en segundo plano del navegador.
- La vinculación de WhatsApp y una solicitud real de extremo a extremo requieren que el propietario introduzca el código en su teléfono. Las pruebas automatizadas validan almacenamiento, deduplicación, permisos y bloqueos; no sustituyen esa comprobación real.

## Validación

`npm run check` comprueba TypeScript, pruebas, carga de las dos funciones en Node y compilación. La integración usa Auth/Firestore emulados y verifica petición, confirmación repetida, notas de origen y lectura posterior. No abre una sesión real de WhatsApp ni envía mensajes a terceros.

Referencia de duración: https://vercel.com/docs/functions/configuring-functions/duration

Referencia de conexión: https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/socket/connecting.md
