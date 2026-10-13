# Capas, equipos y transporte en la web

Entrega del 10 de octubre de 2026. Publicación: https://astrea-suite-electoral.vercel.app

## Controles de capas

- «Ver capa» activa la capa si estaba oculta, limpia los filtros de ubicación y lleva al mapa. El encuadre abarca todos los elementos y partes del archivo, incluidas rutas y polígonos. Funciona también al pulsarlo nuevamente sobre la misma capa.
- «Editar nombre» abre un formulario dentro de la tarjeta, con Guardar nombre, Cancelar y mensajes de resultado. No depende de ventanas `prompt` del navegador.
- «Retirar capa» presenta una confirmación dentro de la tarjeta. Solo Confirmar retiro elimina los documentos y registra la auditoría; Cancelar conserva la capa. Para recuperar una capa retirada se requiere importar su archivo nuevamente.
- «Usar ruta» lleva al trazado y ofrece «Editar o asignar ruta» y «Volver a capas».
- Los controles principales de edición tienen una altura mínima de 48 píxeles.

## Equipos por líder

En Mapa territorial, los administradores ven una ficha por líder. «Ver ubicación» centra el mapa; si existe un recorrido asociado a su último reporte, «Ver recorrido» abre su detalle.

La cuenta del líder se identifica por el correo de su ficha, comparado con una única cuenta activa y verificada de la misma organización. Los integrantes vinculados se cuentan mediante `assignedLeaderId`. El GPS de un subordinado no se atribuye al líder.

Las fichas distinguen la última posición GPS (con fecha, precisión y estado), una ubicación guardada manualmente y la ausencia de ubicación. Un reporte antiguo se identifica como «Sin señal reciente».

## Conductores y recorridos

En Transporte, los administradores pueden elegir un conductor y vehículo, consultar su posición, mostrar la ruta planificada y abrir el historial y detalle de sus desplazamientos.

El vínculo se obtiene de un recorrido en curso que asigne explícitamente ese vehículo a una cuenta, o de un teléfono del conductor que coincida con una única cuenta activa de la organización. No se asocia a las personas por similitud de nombre. La ruta planificada y el historial GPS se presentan por separado.

El seguimiento personal sigue reservado a administradores verificados. Los usuarios normales conservan acceso a las rutas publicadas del transporte del día de las elecciones. No se cambiaron las reglas de Firestore, los permisos GPS ni el APK.

## Comprobaciones

- TypeScript correcto y compilación de producción correcta.
- Suite completa: 124 pruebas; 107 aprobadas, 0 fallidas, 17 omitidas por requerir el emulador de Firestore.
- Pruebas nuevas: aislamiento por organización y rol, vínculos únicos de correo y teléfono, asignaciones de vehículo, reportes ausentes/antiguos/inválidos/futuros y encuadre de todas las geometrías de una capa.
- En una página local aislada, con datos ficticios y adaptadores en memoria: renombrado, cancelación y retiro, reactivación de una capa oculta, salto al mapa, ruta importada, editor de elementos, mapa del conductor, ruta planificada e historial con tres puntos.
- Anchos 375, 414, 768, 1024 y 1440: sin desbordamiento horizontal; botones Guardar/Cancelar de 48 píxeles.
- En el navegador integrado del usuario, con sesión administradora real: formulario visible de mapa.xls, guardado del nombre existente sin alterarlo, confirmación de retiro cancelada, las cinco capas conservadas, Ver capa lleva el mapa a la pantalla, Usar ruta muestra Ruta KML y su línea, fichas de líder/conductor e historial vacío real.
- En Coalición 2026, el líder y conductor de prueba no tienen cuenta vinculada ni coordenadas registradas. Se muestra esa ausencia; no se generaron posiciones ficticias en producción. Sigue pendiente un desplazamiento real nuevo con una cuenta vinculada.

Despliegue: `dpl_6z23eMuy3oH1hFxGCR8sJve9a4yZ`, producción READY, proyecto `astrea-suite-electoral`, equipo `wilson-joses-projects`.

Evidencia local: `D:\AstreaAndroid\verification-2026-10-10\capas-web-corregidas.png`. Pruebas: `tests-capas-equipos-web.log`; publicación: `deploy-capas-equipos-web.log` en la misma carpeta.
