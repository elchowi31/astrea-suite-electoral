# Verificación del detalle de recorridos en la web

## Alcance

El usuario pidió aclarar el módulo y poder abrir el detalle, y posteriormente limitó esta entrega a la web. No se compiló, instaló ni reemplazó el APK 1.0.6.

## Cambios

- La vista inicial presenta la lista de recorridos, del más reciente al más antiguo, con filtros de persona y fecha y botones «Ver detalle».
- El detalle tiene una pantalla propia y un botón para regresar. El saludo general, el mapa en vivo y el formulario de asignación ya no desplazan el historial hacia el fondo de una página larga.
- Se muestran inicio, finalización o último registro, duración y distancia calculados a partir de los datos guardados, con horarios de Colombia y segundos en el detalle.
- El mapa encuadra todo el trayecto, distingue inicio y última posición y permite seleccionar puntos del historial y volver al recorrido completo.
- Se distinguen carga, error de lectura, ausencia de puntos y un único punto disponible. Los errores incluyen una acción para reintentar.
- El monitoreo en vivo usa tarjetas adaptables y un botón explícito para abrir el mismo detalle. Las asignaciones y los dispositivos están en «Administrar».
- Se corrigió el retorno involuntario a la organización principal cuando se refrescaba el perfil del administrador global. La selección se conserva para la misma identidad y alcance; se restablece al cambiar de cuenta, de organización propia, de rol o al cerrar sesión.
- Se corrigió un error de Leaflet al completar una animación después de desmontar el mapa. Los mapas se retiran deteniendo sus animaciones y el zoom no deja una transición pendiente al cambiar de vista.
- Se conserva el aislamiento entre organizaciones, el acceso administrativo y el comportamiento del registro GPS. No se modificaron las reglas de Firestore ni los registros históricos.

## Validación automática

- TypeScript (`npm run lint`): correcto.
- Suite completa final: 119 pruebas, 102 aprobadas, 0 fallidas, 17 omitidas porque requieren el emulador de Firestore.
- Las pruebas nuevas cubren aislamiento y orden de los puntos, fecha de Colombia y duración basada en datos registrados, sin inventar un tiempo cuando no existen marcas temporales.
- La suite específica de presentación, trazado e independencia de equipos pasó sus ocho pruebas. Se añadieron cinco casos de refresco de identidad, cambio de cuenta, reducción de rol, cambio de organización propia e inicio/cierre de sesión.

## Validación en navegador

Los componentes reales se ejercitaron en una página local aislada, con datos ficticios y sin acceso a Firebase. Se verificaron filtros, regreso a la lista, selección de un punto, encuadre de los extremos, paginación de 31 puntos y estados de un punto, sin puntos, carga pendiente, error con reintento y dos segmentos separados por falta de señal.

Se verificaron anchos de 375, 414, 768, 1024 y 1440 píxeles, sin desbordamiento horizontal, con controles principales de 48 píxeles de altura. Una advertencia de React durante la recarga del montaje local de prueba no corresponde al código de producción.

En producción se utilizó la sesión que el usuario inició personalmente en Chrome como administrador global. Se seleccionó **Espacio de marcosalcaldeastrea**, se abrió el registro del 10 de octubre a las 14:23 y se comprobaron:

- Tres puntos leídos desde el servicio real, cuatro segundos y aproximadamente 0,06 km registrados.
- Línea visible y extremos A y B dentro del mapa.
- Comprobación del ajuste final de escala: el trayecto corto ocupa 218 píxeles de alto, ambos extremos permanecen dentro del mapa y no aparecen errores JavaScript nuevos después de recargar la publicación final.
- Selección del segundo punto y regreso al encuadre completo.
- Regreso a la lista y acceso al mismo detalle desde **En vivo**.
- En la versión final se repitieron tres aperturas, aumentos de zoom y regresos rápidos a la lista. El equipo elegido permaneció seleccionado y no se registraron errores JavaScript nuevos. También se comprobó en producción un filtro sin resultados y su limpieza, y se volvió a abrir el detalle desde En vivo.

Ese registro corresponde a las pruebas anteriores de GPS; no se presenta como evidencia de desplazamiento real. Esta verificación comprueba la consulta y la interfaz web, no un nuevo recorrido de campo.

Los registros de compilación, despliegue y pruebas quedan en `D:\AstreaAndroid\verification-2026-10-10`, con nombres `deploy-detalle-web-final.log`, `tests-detalle-web.log`, `tests-detalle-web-focused.log` y `lint-detalle-web.log`.

## Publicación

- URL: https://astrea-suite-electoral.vercel.app
- Despliegue final: `dpl_96Rv2zBaCLNfv3sAPtm8Pj7zwjNF`, READY, producción.
- Proyecto: `astrea-suite-electoral`, equipo `wilson-joses-projects`.
- Base local: `92869f1c8a43e96de3a3b36903903861ac2e42ee` con los cambios del espacio de trabajo, sin crear un commit.
- Captura de la comprobación real: `D:\AstreaAndroid\verification-2026-10-10\detalle-recorrido-web.png`.
- APK 1.0.6 conservado: SHA-256 `9CC81B8FD4CE170564BD6530AB41914C8D913A74D3549EA01E448860BEBF2BC3`.
