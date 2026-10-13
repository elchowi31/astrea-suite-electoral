# Prueba física de Astrea Suite en Samsung

Fecha: 10 de octubre de 2026.

## Instalación comprobada

- Samsung `SM-S721B`, Android 16, conectado mediante USB y reconocido por ADB.
- Antes de la prueba no había instalada una aplicación con el identificador `co.proyectosconenergia.astrea`.
- Se instaló únicamente `D:\Descargas\Astrea-Suite-release.apk`. Android devolvió `Success`.
- El paquete instalado tiene versión 1.0.1, código 2, SDK objetivo 36 y depuración desactivada.
- La actividad principal abrió correctamente. Se comprobó visualmente la portada y la pantalla de acceso en el teléfono.
- Android confirmó ubicación precisa y aproximada concedidas. La ubicación general del teléfono estaba apagada; se activó y se comprobó mediante `cmd location is-location-enabled`.
- No se desactivó Play Protect. La instalación por USB no demuestra aprobación de Google ni que la distribución desde WhatsApp deje de mostrar la advertencia.
- No se detectaron errores de AndroidRuntime, Capacitor o Chromium en la consulta de errores del proceso durante la primera apertura.

## Actualización 1.0.3

El usuario completó personalmente el acceso y activó Ubicación. La actualización release conserva su sesión y autorizaciones, sin volver a solicitar los permisos iniciales.

En la prueba de la versión 1.0.2 apareció un traslado a las 14:23:03 cuando el usuario confirmó que el celular estaba quieto. Esa prueba reveló que la deriva del GPS podía superar el filtro geométrico. El registro permanece identificado por esa hora; no debe interpretarse como un traslado real ni como evidencia favorable de esa versión.

La versión 1.0.3 combina desplazamiento GPS con actividad física del sensor de aceleración lineal del Samsung. Android confirmó que el sensor estaba activo a 10 Hz desde las 14:36:31. En la revisión de las 14:49, el monitor mostró **0 en movimiento, 1 en reposo**, **Preparado · esperando movimiento**, cero posiciones pendientes y únicamente el antiguo registro finalizado de las 14:23. No apareció otro traslado en esta comprobación.

El servicio de ubicación se ejecuta en primer plano con el canal `astrea_tracking_silent_v1`: importancia baja, sin sonido ni vibración, sin luces ni avisos emergentes. El indicador de Android sigue visible. Los controles, mapas, historial y dispositivos están limitados a administradores también mediante reglas del servidor; un miembro puede enviar sus propios datos pero no leerlos.

La compilación final incluye demostraciones personales por rol y territorio y recorridos electorales publicados para todos los miembros. Se verifican por separado los permisos de estas funciones.

## Comprobaciones de campo pendientes

Debe comprobarse un traslado real con la nueva versión, su continuidad con pantalla apagada, cierre después de cinco minutos sin desplazamiento y sincronización de un tramo sin internet. Las pruebas automatizadas y la observación en reposo no reemplazan esta comprobación física. No se simularon coordenadas en el celular.

La instalación requiere únicamente el APK release. No instale el APK debug ni el archivo AAB.
