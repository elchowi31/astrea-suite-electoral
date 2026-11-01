# Identidad, permisos e invitaciones: estado verificado

La recepción desde una pestaña y la identidad de cada remitente son funciones diferentes. El despliegue de la recepción operativa no completa el registro por invitación.

| Capacidad | Estado actual | Evidencia |
| --- | --- | --- |
| Inicio de sesión y perfil | Implementado con Firebase Auth y perfiles activos | `src/lib/firebaseAuth.ts` |
| Crear usuarios de equipo y registrar quién los creó | Implementado; administrador o responsable con jerarquía suficiente | `src/lib/userProvisioning.ts`, colección `auditoria` |
| Iniciar la recepción corporativa | Solo administrador global verificado; valida organización y jornada | `api/whatsapp-pilot.ts` |
| Reconocer el teléfono de origen | Implementado desde el mensaje privado recibido; se conserva en las notas | `src/server/whatsappPilotCore.ts` |
| Asociar ese teléfono con la cuenta personal del remitente | **Pendiente**. No basta con escribir un teléfono editable en el perfil | No hay desafío de verificación ni registro de vínculos verificados |
| Aplicar el rol del remitente a sus solicitudes | **Pendiente**. Actualmente `createdBy` es el administrador que sostiene la sesión y el responsable es el configurado en el panel | `pilotIntake`, `createAgentBackend` |
| Invitar mediante enlace o QR y reconstruir la cadena de invitadores | **Pendiente**. La creación directa de cuentas tiene auditoría, pero no es un sistema de invitaciones | No existe colección ni flujo de aceptación de invitaciones |

## Flujo que falta implementar

1. El integrante autorizado genera una invitación con identificador aleatorio, organización, creador, rol solicitado, fecha de vencimiento y estado de revocación. Un líder puede proponer integrantes; no puede conceder acceso administrativo ni asignar un nivel superior.
2. El enlace o QR abre el registro de esa organización. La aceptación registra la cuenta autenticada, el identificador de invitación y el invitador original. Reenviar el enlace no cambia su autor. No se confía en un `inviterId` modificable en la URL.
3. La autoridad correspondiente aprueba el rol y la asignación a líder o candidatura. Registrarse, recibir un enlace o conocer el teléfono corporativo no concede permisos por sí solo.
4. Desde su sesión en la aplicación, la persona solicita un código de un solo uso y vigencia corta. Lo envía desde su WhatsApp al receptor corporativo. El servidor vincula el teléfono realmente observado con esa cuenta, sin aceptar la identidad declarada en un mensaje.
5. Cada operación vuelve a comprobar cuenta activa, organización, rol y asignaciones. Un remitente sin vínculo recibe instrucciones de registro y no crea solicitudes. Las cuentas revocadas dejan de operar inmediatamente.
6. La solicitud y su auditoría registran el UID del solicitante, teléfono verificado, organización, líder o candidatura autorizados, invitación, invitador, canal y fecha. El administrador de la conexión es un dato separado; no sustituye al autor de la solicitud.

## Requisitos antes de considerar completo ese flujo

- Reglas de Firestore para invitaciones, aceptación, vínculos telefónicos y auditoría inmutable; pruebas de suplantación, escalamiento de rol, reutilización del código, invitación revocada y cruce de organizaciones.
- Pantallas para invitar, aceptar, aprobar y revocar; verificación del teléfono y consulta de la procedencia de cada integrante.
- Sustituir la atribución general al administrador en `pilotIntake` por el remitente autenticado y autorizado. La ausencia de vínculo debe denegar la creación, sin recurrir al responsable predeterminado.
- Revisar también los permisos de escritura generales: actualmente `operator()` en `firestore.rules` incluye todos los roles de equipo, incluidos `Consulta` e `Invitado`. El endpoint del asistente sí excluye esos dos roles. Esta diferencia debe resolverse expresamente en la política de acceso, no suponerse corregida por cambiar el menú.

El QR de invitación debe contener únicamente el enlace de incorporación. El código o QR de **Dispositivos vinculados de WhatsApp** es una credencial de la conexión corporativa, no una invitación para integrantes.

Esta revisión no afirma que dichas capacidades pendientes estén implementadas ni desplegadas.
