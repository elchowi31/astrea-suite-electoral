# Astrea Suite 1.0.5: acceso y contraseña

Fecha: 10 de octubre de 2026. Versión Android 1.0.5, código 6.

## Correcciones

- Los formularios de ingreso, cambio de cuenta y registro tienen **Mostrar / Ocultar contraseña**. La contraseña permanece oculta inicialmente; mostrarla no guarda ni cambia su valor.
- El cambio de cuenta ahora incluye el campo de contraseña, que faltaba en ese formulario.
- El ingreso no espera la escritura del registro de auditoría para completar una sesión válida. La auditoría se sigue intentando en segundo plano.
- Cada fase de red del ingreso por correo tiene una espera máxima de 25 segundos. Un tiempo agotado informa un problema de conexión y permite reintentar; no se presenta como contraseña incorrecta. La espera no cancela la operación del SDK y una autenticación válida tardía puede ser reconocida por el observador de sesión.
- Firebase informa las credenciales incorrectas con un mensaje en español y el mismo texto para correo inexistente o contraseña errónea. Se conservan las validaciones del perfil activo y de los privilegios de administrador.

## Validación realizada

- `npm run check`: correcto. 90 pruebas aprobadas, cero fallos; 17 pruebas que requieren el emulador de Firestore omitidas en esta ejecución. No se cambiaron las reglas desplegadas.
- `npm run lint` después del ajuste final de los campos: correcto.
- APK release compilado, firma y alineación verificadas. Certificado SHA-256: `7a152cecbf2f551b90aa4cdb94e967926ec19b71ebafc227711b87501f119b96`.
- Actualización por USB del Samsung SM-S721B: `Success`, versión instalada 1.0.5/código 6; hora de actualización 15:59:49 (Bogotá).
- Permisos conservados: ubicación precisa concedida y notificaciones bloqueadas.
- Web de producción publicada y confirmada `READY`: `https://astrea-suite-electoral.vercel.app`, despliegue `dpl_89goyW6SjVNutJDB8Dtwem95Rxjp`.
- Prueba real en Chrome con datos ficticios: Mostrar cambia el campo a texto, Ocultar lo devuelve a contraseña; el servidor rechaza las credenciales inválidas, muestra el mensaje previsto y vuelve a habilitar Iniciar sesión. Los datos ficticios se retiraron de los campos al terminar.

## Archivo para instalar

Solo `D:\Descargas\Astrea-Suite-release.apk`.

SHA-256: `7618784D746EE41490410791993FB61D4A7EBAA9325B9B027FB7264198E9B675`.

## Cuenta administradora y resultado en el celular

En la primera prueba, el usuario confirmó que en el Samsung aparecía **correo o contraseña incorrectos**, en lugar de permanecer en Autenticando. Esa combinación fue rechazada.

Una consulta administrativa de solo lectura, limitada a metadatos de `expcal@expcal.net`, confirmó que la cuenta existe, su correo está verificado, no está deshabilitada y tiene proveedores `google.com` y `password`. La consulta excluyó hashes, contraseñas y tokens. No se modificaron cuentas, privilegios ni credenciales, y no se enviaron correos de recuperación.

El intento automatizado con Google en Chrome no completó la selección de cuenta y quedó en Cargando; se cerró esa ventana. Posteriormente el usuario confirmó: **«ya ingresé desde el celular y web con cuenta admin»**. El ingreso satisfactorio en ambos entornos queda confirmado por el titular. No fue necesario cambiar credenciales ni enviar recuperación desde las herramientas del agente.

## Comprobación pendiente

Falta observar directamente las pantallas de seguimiento de la nueva sesión administrativa: al intentar comprobarlas por USB, el teléfono estaba bloqueado. La prueba de desplazamiento real con pantalla apagada continúa pendiente. El ingreso por sí solo no acredita la recepción de nuevos puntos durante un traslado.
