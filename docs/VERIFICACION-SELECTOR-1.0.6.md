# Verificación del selector y acceso al seguimiento — 10 de octubre de 2026

## Problema observado

En el Samsung, la cuenta verificada de administrador global estaba consultando los datos de prueba de Alcaldía · Cesar · Astrea, dentro de Coalición 2026. El selector «Seleccione líder o vehículo» estaba deshabilitado por el modo de solo lectura. Había 78 registros pendientes de ubicar y ninguno con coordenadas. Ese selector pertenece al mapa de ubicaciones guardadas; el seguimiento privado de celulares está en otro módulo.

## Corrección entregada

- El selector territorial permite consultar registros también en la demostración. Muestra el nombre y «Pendiente de ubicar» cuando no hay coordenadas. Si existen coordenadas, selecciona el punto, restablece los filtros y centra el mapa. Elegir un registro no guarda una ubicación.
- El mapa ofrece un botón «Recorridos y seguimiento» únicamente a administradores autorizados. Abre datos reales y sale de la demostración.
- El administrador global puede cambiar «Equipo a supervisar» dentro del módulo desde el celular. La captura y la cola de GPS del teléfono conservan la organización de su usuario; consultar otro equipo no las traslada.
- «Ver seguimiento» desplaza la vista y enfoca el detalle del recorrido elegido. Los resultados de la organización anterior y el recorrido local de otro equipo se excluyen de la lista mostrada.
- Se conservan los permisos existentes, el bloqueo de notificaciones y la separación entre seguimiento personal y transporte electoral publicado.

## Comprobación realizada

- `npm run lint`: correcto. `git diff --check`: correcto.
- `npm test`: 110 pruebas, 93 aprobadas, 0 fallidas y 17 omitidas por requerir el emulador de Firestore. Las reglas de Firestore no se modificaron en esta corrección. Las tres pruebas nuevas comprueban el aislamiento de la lista de recorridos al cambiar de equipo.
- Compilación release, firma APK y alineación: correctas.
- Instalación por actualización (`adb install -r`): correcta, sin desinstalar ni borrar datos. Samsung SM-S721B, Android 16, paquete `co.proyectosconenergia.astrea`, versión 1.0.6, código 7.
- La sesión de administrador global se conservó. La ubicación precisa continúa concedida y `POST_NOTIFICATIONS` continúa denegado.
- En la demostración, el selector abrió la lista y permitió elegir «Líder ficticio DEMO 1-1». La pantalla mostró «Pendiente de ubicar» y conservó deshabilitado Guardar ubicación. No se crearon coordenadas ni registros GPS de prueba.
- Desde el botón del mapa se abrió «Recorridos y seguimiento» con datos reales. «Equipo a supervisar» permitió elegir «Espacio de marcosalcaldeastrea» y cargar sus registros. «Ver seguimiento» abrió y enfocó el detalle del traslado guardado de las 14:23.
- El traslado de las 14:23 pertenece a pruebas anteriores y no acredita movimiento real ni valida el filtro actual en campo. Su historial se conservó.
- El servicio nativo siguió activo después de cambiar el equipo supervisado, con canal silencioso, sin sonido ni vibración. No aparecieron errores JavaScript de ejecución en el registro revisado del proceso después de las interacciones.
- Se restauró `stay_on_while_plugged_in` a su valor original, 0, al terminar la comprobación. El tiempo habitual de bloqueo no se cambió.
- La web quedó publicada en `https://astrea-suite-electoral.vercel.app`, despliegue `dpl_9D5iccrdNkuFRsTr2yd4rjxzwGpH`, estado READY y destino production.

## Artefactos

- APK único: `D:\Descargas\Astrea-Suite-release.apk` (4.436.444 bytes).
- SHA-256 APK: `9CC81B8FD4CE170564BD6530AB41914C8D913A74D3549EA01E448860BEBF2BC3`.
- SHA-256 certificado: `7a152cecbf2f551b90aa4cdb94e967926ec19b71ebafc227711b87501f119b96`.
- Captura del selector de prueba: `D:\AstreaAndroid\verification-2026-10-10\selector-demo-1.0.6.png`.
- Logs: `build-release-1.0.6.log` y `deploy-web-1.0.6.log` en la misma carpeta de verificación.

La comprobación de esta entrega verifica los controles, la navegación, el acceso administrativo y la continuidad del servicio. El recorrido real con pantalla apagada y la sincronización tras un tramo sin conexión requieren una prueba en campo.
