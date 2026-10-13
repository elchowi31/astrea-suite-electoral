# Reinstalación del Samsung y recuperación de la preparación inicial

## Instalación desde cero

El 10 de octubre se probó la reinstalación en el Samsung SM-S721B con Android 16, conectado por USB. Antes de desinstalar se ejecutó «Retirar datos locales y cerrar sesión»: la acción comprueba que no existan recorridos ni posiciones pendientes antes de retirar datos. Se guardó una copia del APK anterior en el directorio privado de verificación.

La desinstalación y la instalación devolvieron `Success`. La primera instalación de esta prueba quedó registrada a las **15:07:04, hora de Colombia**. Las decisiones locales y los permisos se reiniciaron; los datos sincronizados de la cuenta siguen en el servidor.

## Problema detectado y corrección 1.0.4

El usuario autorizó la ubicación precisa y decidió mantener las notificaciones bloqueadas. La versión 1.0.3 exigía erróneamente el permiso de notificaciones tanto al preparar el seguimiento como al iniciar el servicio. El asistente permanecía abierto y no permitía continuar.

La versión 1.0.4 acepta esa decisión y permite terminar la preparación con GPS autorizado. No vuelve a solicitar los permisos ya decididos. Una preparación interrumpida de 1.0.3 permite completar el paso de activación; una decisión completada de aceptar, rechazar o pausar conserva su estado. No se activa el seguimiento automáticamente por una migración de datos.

Android permite iniciar un servicio en primer plano sin `POST_NOTIFICATIONS`, aunque la app debe proporcionar su notificación. Con el permiso denegado, Android mantiene el aviso del servicio en Aplicaciones activas y no muestra su notificación en el panel habitual: [documentación oficial](https://developer.android.com/develop/ui/compose/notifications/notification-permission).

## APK comprobado

- Archivo para instalar o distribuir: `D:\Descargas\Astrea-Suite-release.apk` (un solo APK).
- Paquete: `co.proyectosconenergia.astrea`.
- Versión: `1.0.4`, código `5`, SDK objetivo `36`.
- SHA-256 del APK: `C8A6D545F4D0AC9C082B42F7BC734F87A6D9B995351B48341847BD080274A0D5`.
- Certificado release SHA-256: `7a152cecbf2f551b90aa4cdb94e967926ec19b71ebafc227711b87501f119b96`.
- Firma y alineación: `apksigner` y `zipalign` satisfactorios.
- Actualización por USB a las **15:19:31**: `Success`, conservando la primera instalación de las 15:07:04 y sus datos.
- Estado Android después de actualizar: ubicación precisa concedida, notificaciones denegadas. No se concedieron las notificaciones mediante ADB.

## Validaciones de código y web

`npm run check` terminó con código 0: TypeScript, **86 pruebas aprobadas**, sin fallos, API y compilación web/servidor. Las 17 pruebas de reglas requieren su emulador y se omitieron en este comando; las reglas no cambiaron en esta corrección y conservan la validación anterior.

Las nuevas regresiones cubren notificaciones denegadas, preparación con ubicación concedida, ausencia de solicitudes posteriores y recuperación de una preparación interrumpida sin cambiar una elección completada.

La compilación Android release terminó con código 0. El despliegue web de producción `dpl_B8jeLZjGc9z7K6YGYVAVV9uGQWV8` quedó `READY`, con el alias `https://astrea-suite-electoral.vercel.app`. La web respondió HTTP 200 y `/api/health` respondió `ok`. El primer intento de despliegue fue rechazado con «Not authorized»; se comprobó la cuenta y equipo y el reintento terminó correctamente.

## Comprobación en el teléfono

La preparación inicial corregida se mostró sin el error de notificaciones. Después de la activación se cerró el asistente y apareció la portada. Se abrió el formulario de acceso para que el usuario iniciara sesión personalmente.

Se comprobó el acceso a la cuenta del usuario y su panel de Inicio, con el rol AdminTenant. Android confirmó servicio de ubicación en primer plano (`isForeground=true`, tipo `0x00000008`) y sensor de aceleración lineal activo a 10 Hz desde las 15:21:48. Las notificaciones siguieron denegadas; el servicio utiliza el canal silencioso `astrea_tracking_silent_v1`, sin sonido ni vibración y con `ONLY_ALERT_ONCE`.

Se cerró el proceso de la app y se abrió de nuevo: PID anterior 14812, nuevo PID 16628. Se recuperaron la sesión y el panel del usuario, el servicio volvió a iniciarse automáticamente y no aparecieron el asistente inicial ni diálogos de permisos. Después de minimizar la app, el servicio y sensor continuaron activos durante la comprobación. Se regresó a Astrea y se restauró el ajuste original del teléfono que permite apagar automáticamente la pantalla.

Un traslado físico con pantalla apagada y sincronización tras un tramo sin internet sigue siendo una prueba de campo independiente; esta reinstalación no sustituye ese recorrido.
