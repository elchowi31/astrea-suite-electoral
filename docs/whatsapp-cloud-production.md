# WhatsApp oficial en producción

Después de desplegar esta versión, el endpoint oficial será https://astrea-suite-electoral.vercel.app/api/whatsapp/cloud. Meta verifica el endpoint y envía los eventos messages; cada respuesta se envía desde la WhatsApp Business Platform. El navegador de Astrea no mantiene la conexión abierta.

## Requisitos en Vercel

Configure estas variables como secretos de Production:

- WHATSAPP_CLOUD_ENABLED=true
- WHATSAPP_CLOUD_VERIFY_TOKEN: frase aleatoria de al menos 16 caracteres; debe coincidir con la de Meta.
- WHATSAPP_CLOUD_APP_SECRET: App Secret de la aplicación Meta.
- WHATSAPP_CLOUD_ACCESS_TOKEN: token de sistema con permiso de mensajería para la cuenta de WhatsApp.
- WHATSAPP_CLOUD_PHONE_NUMBER_ID: identificador del número registrado en la plataforma.
- WHATSAPP_CLOUD_GRAPH_VERSION: versión Graph vigente que use la cuenta Meta.
- FIREBASE_SERVICE_ACCOUNT_BASE64: JSON de una cuenta de servicio del mismo proyecto Firebase de Astrea, codificado en Base64 y con permisos de lectura y escritura de Firestore.

No incluya estos valores en el repositorio, en variables VITE_* ni en el chat. El receptor solo usa la credencial de Firebase en el servidor.

## Activación en Meta

1. Añada WhatsApp Business Platform a una aplicación Meta propiedad de la empresa.
2. Registre el número. WhatsApp documenta una opción para conservar la aplicación Business, el número y el historial al conectar la Plataforma en el mismo número, pero el flujo y la elegibilidad dependen de Meta. Confirme que la incorporación de esta cuenta ofrezca coexistencia antes de continuar; el registro estándar puede requerir desvincular el número de la app.
3. En Webhooks, use la URL anterior y el mismo WHATSAPP_CLOUD_VERIFY_TOKEN; suscriba la cuenta al campo messages.
4. En Astrea, guarde una sola configuración de WhatsApp con el mismo número, organización activa, responsable y jornada vigente.
5. Envíe un mensaje de prueba desde otro teléfono y confirme que aparece en Actividad de WhatsApp y que una solicitud confirmada queda en Firestore.

Meta puede repetir los avisos si el receptor no confirma su procesamiento. Astrea valida la firma y registra idempotentemente los turnos de conversación para no crear de nuevo una solicitud ya guardada. Como el envío a Meta y el recibo local no se pueden confirmar en una sola transacción, una respuesta podría repetirse si Meta aceptó el envío pero se perdió la confirmación; en ese caso la solicitud no se vuelve a crear. Si Meta revoca el token o desconecta el número, un administrador debe resolverlo desde las herramientas oficiales.

Para desactivar el receptor, cambie WHATSAPP_CLOUD_ENABLED a false en Vercel. La ruta anterior basada en una pestaña permanece separada hasta que el número oficial quede verificado.
