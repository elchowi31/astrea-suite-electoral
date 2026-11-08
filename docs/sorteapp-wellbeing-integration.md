# Inscripciones de sorteos gratuitos desde Sorteapp

## Separación de datos

Astrea recibe únicamente sorteos internos gratuitos (`employee_wellbeing_free`). No se reciben rifas comerciales, pagos, comprobantes, boletas pagadas, perfiles políticos ni datos de votantes. El módulo de Astrea se llama **Sorteos gratuitos** y sus documentos se guardan en:

- `sorteos_bienestar/{drawHash}`
- `sorteos_bienestar/{drawHash}/participantes/{entryHash}`
- `integraciones_sorteapp_eventos/{eventHash}` para idempotencia y auditoría técnica

Los identificadores externos se convierten en SHA-256 antes de guardarse como rutas. El webhook solo conserva nombre, un medio de contacto, fecha de inscripción y la constancia de consentimiento con su versión. Un retiro elimina del registro los datos personales y conserva únicamente un marcador mínimo con identificadores codificados para impedir que un reintento atrasado vuelva a crear la participación, más el recibo técnico.

## Endpoint de Astrea

Después de desplegar esta versión, Sorteapp enviará `POST` a:

`https://astrea-suite-electoral.vercel.app/api/integrations/sorteapp/reward-entries`

Use `Content-Type: application/json` y la cabecera `X-Sorteapp-Signature` con `sha256=` seguido del HMAC-SHA256 del cuerpo HTTP exacto, firmado con `SORTEAPP_WEBHOOK_SECRET`. No firme una representación JSON reconstruida: el orden, espacios y bytes deben ser los mismos que se envían.

Variables server-only de Vercel Production:

- `SORTEAPP_REWARDS_ENABLED=true`
- `SORTEAPP_WEBHOOK_SECRET`: secreto aleatorio de al menos 32 caracteres, compartido de forma segura entre los dos servidores.
- `SORTEAPP_REWARDS_TENANT_IDS`: lista separada por comas de los identificadores de organizaciones Astrea autorizadas a recibir estos sorteos.
- `GOOGLE_CLOUD_PROJECT_NUMBER`, `GOOGLE_WORKLOAD_IDENTITY_POOL_ID`, `GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID` y `GOOGLE_SERVICE_ACCOUNT_EMAIL`: identificadores de la federación descrita abajo; no contienen claves privadas.
- `FIREBASE_PROJECT_ID` y `FIRESTORE_DATABASE_ID` pueden usar los valores existentes del proyecto Astrea.

Mantenga `SORTEAPP_REWARDS_ENABLED=false` hasta desplegar ambas partes y verificar una prueba. Incluya únicamente organizaciones activas que participarán. Nunca incluya el secreto en el navegador, repositorio, cuerpo del evento ni chat.

### Acceso de Vercel a Firestore sin claves

Google Cloud bloquea las claves privadas de cuentas de servicio en este proyecto. Configure Workload Identity Federation con la identidad OIDC de Vercel en lugar de crear o copiar una clave:

La federación ya está creada en el proyecto Google Cloud `gen-lang-client-0498782352` (número `243559457978`): pool `astrea-vercel`, proveedor `vercel-production`, emisor `https://oidc.vercel.com/wilson-joses-projects` y audiencia `https://vercel.com/wilson-joses-projects`. El proveedor mapea `google.subject=assertion.sub`, `attribute.project=assertion.project_id` y `attribute.environment=assertion.environment`; solo acepta el proyecto Vercel `prj_gp0Vx6QrpUG25MzMFpeDBZCYCNfX` en `production`.

La cuenta de servicio dedicada es `astrea-firestore@gen-lang-client-0498782352.iam.gserviceaccount.com`. Tiene `roles/datastore.user` en el proyecto Astrea y permite `roles/iam.workloadIdentityUser` únicamente al asunto `owner:wilson-joses-projects:project:astrea-suite-electoral:environment:production` del pool. No se creó ninguna clave privada. En Vercel, el proyecto `astrea-suite-electoral` tiene OIDC de equipo habilitado y las variables de federación configuradas solo para Production.

El endpoint usa el token OIDC de la solicitud de Vercel para obtener un token de Firestore de corta duración. No almacena una clave privada ni conserva el token del usuario que envía el webhook. La aplicación valida además el HMAC del webhook antes de usar la federación.

## Contrato versión 1

### Inscripción consentida

```json
{
  "schemaVersion": 1,
  "eventId": "uuid-unico-del-evento",
  "eventType": "draw.entry.created",
  "occurredAt": "2026-11-06T15:00:00.000Z",
  "draw": {
    "id": "uuid-del-sorteo",
    "tenantId": "tenant-astrea-2026",
    "title": "Sorteo de bienestar del equipo",
    "prize": "Licuadora",
    "kind": "employee_wellbeing_free",
    "paid": false,
    "entryPrice": 0,
    "currency": "COP",
    "startsAt": "2026-11-01T00:00:00.000Z",
    "endsAt": "2026-11-30T23:59:59.000Z"
  },
  "entry": {
    "id": "uuid-unico-de-la-inscripcion",
    "name": "Nombre de la persona",
    "email": "persona@example.com",
    "phone": "+573001234567",
    "registeredAt": "2026-11-06T15:00:00.000Z"
  },
  "consent": {
    "accepted": true,
    "purpose": "employee_reward_draw",
    "policyVersion": "2026-11",
    "acceptedAt": "2026-11-06T14:59:00.000Z"
  }
}
```

`email` o `phone` puede omitirse; se requiere al menos uno. El consentimiento debe registrarse antes de la inscripción. El cuerpo no admite campos adicionales. No envíe fecha de nacimiento, documento, ubicación, partido, candidatura, intención de voto ni campos de pago.

### Retiro de una inscripción

```json
{
  "schemaVersion": 1,
  "eventId": "uuid-unico-del-evento-de-retiro",
  "eventType": "draw.entry.deleted",
  "occurredAt": "2026-11-07T10:00:00.000Z",
  "draw": {"id": "uuid-del-sorteo", "tenantId": "tenant-astrea-2026"},
  "entry": {"id": "uuid-unico-de-la-inscripcion"}
}
```

Cada aviso debe tener un `eventId` nuevo. En reintentos, Sorteapp conserva el mismo `eventId` y exactamente el mismo cuerpo. Astrea responde HTTP 200 con `success: true` tras guardar el evento o reconocer un duplicado. Un HTTP 5xx se debe reintentar con retroceso exponencial; 4xx indica que se debe corregir el aviso o la firma.

## Seguridad y operación

- Sorteapp envía datos solo después de obtener el consentimiento específico para administrar la inscripción y contactar a la persona sobre el sorteo.
- La selección del ganador y cualquier contacto posterior quedan dentro del propósito informado. No se habilita mercadeo ni uso electoral mediante este contrato.
- Astrea comprueba la firma, la organización activa, el formato, el carácter gratuito y los requisitos de consentimiento antes de guardar.
- Un HMAC de identificadores evita duplicar eventos y participaciones en reintentos. La operación de guardado de inscripción, sorteo y recibo es atómica en Firestore.
- La sección Astrea es de solo lectura para el administrador global; las escrituras provienen del receptor servidor a servidor.
- Antes de lanzar el sorteo, confirme con la autoridad competente qué autorización aplica según su alcance geográfico.

## Estado de preparación

El receptor y la vista administrativa están desplegados en Astrea. El proyecto Google Cloud, la cuenta de servicio sin clave y la federación OIDC de producción están configurados. `SORTEAPP_REWARDS_ENABLED=true` en Vercel Production y la lista de organizaciones limita la recepción a Coalición 2026. Astrea está lista para recibir el evento de prueba firmado del servidor de Sorteapp; después se debe verificar el recibo técnico y la participación en Firestore. Sorteapp debe usar este contrato en su servidor y permitir acceso público a su formulario sin exponer el panel administrativo.

WhatsApp Cloud comparte la federación segura de Firestore y tiene preparado el secreto de conversación, pero aún requiere la configuración de la app Meta, el token de acceso y el identificador del número antes de poder activar su webhook.
