# Asistente de solicitudes · integración Astrea / kit Claude

## Alcance implementado

En **Solicitudes y jornadas → Asistente de solicitudes**, un usuario autenticado puede describir una necesidad, completar o corregir la ficha, revisar el resumen y confirmar. El asistente es guiado: reconoce transporte, alimentación, refrigerios y combustible en el primer mensaje; todos los recursos del catálogo se pueden seleccionar en la ficha. No usa un modelo de lenguaje ni consume cuota de IA en esta versión.

Cada borrador y sus últimos 30 mensajes se guardan en Firestore bajo `usuarios/{uid}/agent_conversations/{id}`. El navegador conserva únicamente el identificador de la conversación, no su contenido. Al recargar se recupera desde el servidor. El asistente opera con datos reales; los formularios demo existentes conservan su comportamiento.

La confirmación escribe atómicamente conversación, recibo de idempotencia, solicitud en `solicitudes_recursos` y auditoría. El ID de solicitud es determinista. No aprueba recursos, no asigna pasajeros, no registra gastos pagados. Las listas y gráficos que ya consumen solicitudes reciben el mismo registro, sin tablas paralelas.

## Fusión y procedencia

Se revisó `02-kit-agente-whatsapp.zip`, aportado por el usuario, especialmente `src/lib/baileys/handler.ts`, `src/lib/tools/index.ts` y `src/lib/tools/derivar-humano.ts`.

Se conserva en el kit la conexión Baileys, QR, reconexión y controles de pausa. El adaptador `integrations/claude-kit/astrea-adapter.ts` reutiliza el patrón de recepción `messages.upsert`, filtrado de mensajes propios/grupos y comprobación de pausa antes de responder. Corrige el fallback del kit: un `@lid` sin número verificable NO se trata como teléfono. Se sustituye su herramienta de captura comercial/Airtable por la API autenticada de Astrea.

No se copió el dashboard Next.js ni la base SQLite del kit al frontend Vite. No se incorporó `openwa` (gestión escolar) ni un segundo cliente Go de `whatsapp-mcp`: mantener dos sesiones o motores de WhatsApp para el mismo propósito no aporta valor. El conector MCP evaluado sigue siendo una alternativa, no una dependencia implementada.

## Contrato HTTP

`POST /api/agent/turn`, `Authorization: Bearer <Firebase ID token del usuario vinculado>`, JSON:

```json
{
  "tenantId": "organizacion-autorizada",
  "conversationId": "UUID-estable",
  "messageId": "UUID-unico-por-mensaje",
  "revision": 0,
  "action": "message",
  "text": "Necesito 20 almuerzos"
}
```

Acciones: `resume`, `message`, `edit` (con `patch` de campos permitidos), `confirm`, `handoff`, `cancel`. `resume` devuelve la revisión vigente y el catálogo autorizado. Conservar `messageId` al reintentar: un error de red no demuestra que el servidor haya rechazado el guardado. Una revisión obsoleta devuelve 409. El servidor utiliza el token del usuario en Firestore REST y respeta sus reglas; no usa credenciales administrativas compartidas.

El catálogo devuelve hasta 500 responsables y 500 jornadas por organización. Fuera de ese límite debe ampliarse con búsqueda paginada antes de usarlo en organizaciones de mayor tamaño. No envía bases de votantes ni historiales privados a un proveedor de IA.

## Instalación del adaptador en el kit

1. Copiar `astrea-adapter.ts` a `src/lib/astrea/adapter.ts` del kit.
2. Construir una instancia `createKitAstreaHandler` con la URL HTTPS de Astrea y las funciones `resolveBinding(phone)` y `paused(phone)` del despliegue. La vinculación debe ser aprobada y asociar teléfono verificado, UID, tenant y un proveedor de token renovable de ESE usuario. Nunca tomar UID/tenant del texto del mensaje ni utilizar una cuenta AdminGlobal para todos.
3. Persistir el `conversationId` por vinculación mediante `setConversationId`; no guardarlo solo en memoria. El adaptador espera que ese contrato lo suministre el servicio de vinculación.
4. En `handleIncomingMessages` del kit, delegar en este manejador **antes** del flujo comercial. Activar un solo manejador para evitar respuestas dobles. Respetar la pausa global y el modo HUMAN en la función `paused`.
5. Probar con un número dedicado, contactos vinculados y entorno de prueba. No iniciar automáticamente al construir/desplegar Astrea. La vinculación real, renovación de credenciales y el despliegue del proceso Baileys siguen pendientes; este cambio no afirma que WhatsApp esté conectado.

Solo texto en esta entrega. Audio, imágenes, corrección conversacional libre, bandeja compartida de atención humana y notificaciones a coordinadores no están implementados. «Continuar manualmente» pausa el asistente y orienta al formulario; no afirma haber avisado a otra persona.

## Publicación y comprobación

Primero publicar `firestore.rules` en el proyecto Firebase de Astrea y en la base indicada por `firebase-applet-config.json`; luego desplegar API/frontend. Las reglas añaden borradores privados sin ampliar el acceso a solicitudes de otras organizaciones. No sustituirlas por reglas abiertas.

```bash
npm run lint
node --import tsx --test tests/requestAgent.test.ts tests/api.test.ts
npm run check:api-runtime
npx firebase-tools@14.27.0 emulators:exec --project demo-astrea --config firebase.emulator.json --only firestore,auth 'ASTREA_AGENT_EMULATOR=true node --import tsx --test tests/requestAgent.integration.test.ts'
npm run build
```

Después de publicar: crear una solicitud de prueba autorizada, recargar, verificar ID/cantidad/total/responsable en Solicitudes y confirmar la lectura independiente en Firestore. Mantenerla identificada como prueba; no generar aprobaciones ni desembolsos.

La API exige organización activa y, para miembros de la organización, perfil activo, versión de acceso vigente, rol operativo y ámbito coincidente. Los administradores globales acreditados por claims conservan su acceso a la organización seleccionada, igual que en el resto de la aplicación. Los borradores y recibos están restringidos a su autor entre los miembros; la regla global administrativa existente conserva acceso a todos los documentos. Al desactivar o revocar un miembro, o cambiarlo de organización, pierde acceso a sus borradores anteriores. El teléfono requiere una vinculación adicional para el canal WhatsApp. Las condiciones del proveedor de WhatsApp siguen aplicando; el código abierto no concede autorización de uso del servicio.
