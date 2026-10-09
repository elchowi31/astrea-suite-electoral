# Despliegue de Astrea en Vercel

- Proyecto: `astrea-suite-electoral` (`prj_gp0Vx6QrpUG25MzMFpeDBZCYCNfX`).
- Producción: https://astrea-suite-electoral.vercel.app
- Despliegue de la corrección: `dpl_8ATE4PCQpjr9HHJW61Di8gC35Vy6`. Sustituye la publicación inicial `dpl_DXuS1i3jXQuSfL4iwukzF953Ytj5`.
- Código: 55 archivos del espacio de trabajo, con instalación reproducible mediante `npm ci` y compilación de Vite. No se publicaron `.env`, dependencias locales ni el servidor local compilado.
- Gemini: `GEMINI_API_KEY` configurada exclusivamente en producción como variable sensible del servidor. Google aceptó la clave al consultar el catálogo de modelos; no se ejecutó una generación autenticada desde la plataforma.

## Evidencia de verificación

- Comprobación de TypeScript y compilación local completadas.
- Nueve pruebas de API y serialización aprobadas.
- `npm audit --omit=dev`: cero vulnerabilidades conocidas reportadas.
- Portada pública: HTTP 200.
- `/api/health`: HTTP 200 con respuesta JSON.
- Interfaz publicada: portada, demostración ficticia aislada y pantalla de acceso cargadas; sin errores de consola observados durante esa prueba.
- Ruta API desconocida: HTTP 404.

## Alcance pendiente

El despliegue no certifica el cierre de la auditoría integral. Faltan pruebas con cuentas reales autorizadas, operaciones de lectura/escritura en Firebase, conciliación y validación de las reglas e índices locales con la política real, flujos de Google Workspace y generación de IA autenticada. Las reglas e índices de Firebase no se publican al desplegar en Vercel y no deben publicarse sin esa conciliación.

## Corrección de acceso y recuperación de presentación

- La cuenta reportada ya existe en Authentication y tiene un perfil activo en la base nombrada `ai-studio-astreasuiteelect-5da3410d-4b0c-4301-8bd6-083fbb5c653b`. La interfaz y la API consultaban incorrectamente `(default)`, que tiene otra política y no contiene ese perfil. Se corrigió el identificador en la configuración compartida; no se recrearon cuentas ni se cambiaron permisos o reglas de producción.
- Se comparó la presentación con el código del despliegue anterior, repositorio `elchowi31/astrea-suite-electoral`, revisión `82bda51b2930ac55411fee67d134cf8ca2423682`. Se recuperaron la portada, el fondo neuronal, las ondas del acceso y el resumen administrativo. Las animaciones respetan movimiento reducido y el fondo se pausa cuando la pestaña está oculta.
- Las nueve pruebas locales pasan, incluida una comprobación de que la API usa la misma base nombrada que la interfaz. TypeScript y las compilaciones de frontend y servidor completaron sin errores.
- La publicación de esta corrección incluye 55 archivos de aplicación; excluye archivos de entorno, scripts de diagnóstico y credenciales administrativas.
- Verificación de acceso: la sesión existente abrió el espacio propio con rol `AdminTenant`; la comprobación de Firestore informó conexión y consulta del tenant completadas. No se cambiaron la contraseña, el perfil ni las reglas.
- La primera publicación de la corrección detectó un error de importación JSON en Node.js durante el arranque de la función. Se corrigió el atributo de importación y se añadió `npm run check:api-runtime` para verificar el arranque del módulo compilado sin empaquetado, además de las pruebas con `tsx`.
- Publicación final `READY`, sin errores de alias. `/api/health` devuelve 200, `/api/ai/analyze-document` sin sesión devuelve 401 y una ruta inexistente devuelve 404. La portada, el acceso, el regreso a portada y la presentación ficticia cargaron sin errores de consola observados. La sesión real vuelve a abrir su espacio después de recargar. Los flujos autenticados de IA siguen pendientes de prueba integral.

## Seguimiento de seguridad

Un comando de diagnóstico de Firebase CLI devolvió credenciales de sesiones administrativas locales en el registro de herramientas. Se notificó al usuario y no se utilizaron ni reprodujeron esas credenciales. Las sesiones administrativas afectadas deben revocarse y renovarse; no confundir esta medida con cambiar la contraseña de la cuenta reportada. Esta acción sigue pendiente y no se ejecutó automáticamente.
- La recuperación no declara restaurados todos los módulos históricos: faltan revisar la ingestión universal, los prospectos y las modalidades anteriores de demostración antes de reincorporarlos con controles compatibles.
