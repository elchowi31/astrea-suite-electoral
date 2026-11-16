# Propuesta de interfaz compacta de Astrea

Estado: implementación autorizada por el usuario el 16 de noviembre de 2026. La comprobación y publicación se registran en INFORME-COMPACTO-2026-11-16.md.
Fecha inicial: 14 de noviembre de 2026. Actualización de reglas: 16 de noviembre de 2026.

## Objetivo

Mostrar registros, formularios y acciones útiles en la primera pantalla. Conservar la identidad oscura de Astrea y sus siete espacios de trabajo, sus permisos y el historial de regreso. Reducir capas repetidas de navegación y mensajes; no depender de reducir el tamaño de letra o el zoom del navegador.

Las capturas muestran aproximadamente 450–550 px de cabeceras, seguimiento, regreso, submenú, bienvenida y demostración antes de los registros. Es una estimación visual, no una medición del navegador. Objetivo de aceptación: cabecera y navegación juntas de 96–112 px en escritorio, hasta 120 px en móvil; título y filtros compactos, con los primeros registros alrededor de 180–220 px desde el inicio de la aplicación. Se comprobará en el navegador antes de publicar.

## Distribución propuesta

| Elemento actual | Propuesta |
| --- | --- |
| Cabecera con perfil, botón Mi perfil y etiqueta de rol repetidos | Una cabecera de 52–56 px con marca, organización, estado y un único menú de cuenta. Cambiar cuenta y cerrar sesión dentro de ese menú. |
| Cinta completa de seguimiento incluso pausado y sin pendientes | Estado pequeño en la cabecera: «GPS pausado». Al abrirlo: reanudar, pendientes y detalle. Errores y pendientes importantes continúan visibles. |
| Caja de Volver y Tablero principal | Controles compactos en la misma fila que la navegación de la sección. Volver conserva el recorrido real; Inicio conserva el reinicio al tablero. |
| Caja adicional del espacio con título y pestañas | Pestañas en línea dentro de la barra compartida; en móvil, selector de sección con nombre visible. |
| Tarjeta grande de bienvenida en los módulos | Retirarla de los módulos: el usuario y su organización ya están en la cabecera. |
| Cinta de demostración ocupando una fila | Distintivo ámbar «Datos de prueba» siempre visible al usar demostración. Opciones al abrirlo; el modo real/prueba no se oculta. |
| Título, introducción y acción en bloques separados | Título y acción principal en una fila; una descripción breve solo cuando aporta. |
| Ayudas, fórmulas y leyendas extensas siempre abiertas | Ayuda contextual y detalles desplegables. Errores, falta de permisos, conflictos y cambios sin guardar siguen visibles. |
| Filtros extensos | Búsqueda directa y botón Filtros con cantidad de filtros activos. |
| Tarjetas y bloques anidados | Superficies más planas, separadores discretos, espacios de 4/8/12/16 px y filas de datos consistentes. |

Se propone un fondo oscuro estable detrás de tablas y formularios. Los efectos decorativos no competirían con los datos.

## Recompensas: reglas confirmadas el 16 de noviembre

**Una sola captura:** Horas manuales por equipo y granja. Se elimina la segunda entrada de Verificadas / avance y la alternativa Auto. Al abrir un plan se reutilizan sus datos; no se pide volver a ingresarlos.

**Meta completa para cada equipo:** la granja define una referencia individual. Si es 500 h y participan tres equipos, cada uno tiene como referencia 500 h. Nunca se divide en 166,67 h por equipo. La misma regla rige para una granja grande, con su propia meta individual.

| Equipo | Horas manuales | Meta individual | Avance | Horas para alcanzar la meta |
| --- | ---: | ---: | ---: | ---: |
| Equipo 1 | 300 | 500 | 60 % | 200 |
| Equipo 2 | 400 | 500 | 80 % | 100 |
| Equipo 3 | 250 | 500 | 50 % | 250 |

Las 950 h totales se muestran solo como información. No convierten el avance individual en 190 % ni hacen que los tres alcancen la meta. Las horas por encima de la referencia se conservan y muestran como esfuerzo adicional.

**Recompensa antes de alcanzar la meta:** el usuario confirmó que un equipo con 300 de 500 h sí puede recibir una parte proporcional. La referencia de 500 h no es una prohibición absoluta de recibir frutos antes de completarla.

**Reparto confirmado:** se distribuye toda la producción disponible de la granja entre los equipos que registran esfuerzo, proporcionalmente a sus horas. No se retiene parte de la producción por estar por debajo de las 500 h. La meta mide el avance individual; el reparto utiliza el esfuerzo relativo de cada equipo dentro de esa granja.

Ejemplo confirmado por el usuario: 20 frutos y horas de 300/400/250 ⇒ reparto de **6/9/5** frutos. La suma siempre es 20. Se conservan el reparto entero por mayores residuos y el orden estable para desempates.

- Avance individual = horas del equipo / meta individual de esa granja × 100.
- Peso de reparto = horas del equipo / suma de horas de los equipos participantes de esa granja.
- Frutos = producción fija × peso de reparto, ajustando enteros sin aumentar ni perder frutos.
- Con todas las horas en cero o sin captura, no se divide entre cero ni se asignan frutos: la producción sigue disponible.
- Un equipo con cero horas recibe cero frutos. Si solo un equipo registra horas positivas, esa regla le asigna toda la producción disponible al confirmar el reparto.
- Las horas superiores a la meta se conservan; no se recortan a 500 y siguen contando para el reparto. El porcentaje puede superar 100 % y el estado indicará Meta alcanzada.
- Cada granja mantiene su propia meta individual y su propia producción; no se mezclan bolsas de frutos ni horas de granjas distintas.

- Tabla compacta: Equipo | Horas manuales | Avance individual | Frutos. El avance incorpora porcentaje y horas faltantes, ambos de lectura.
- La cabecera de la granja indica «Meta: 500 h por equipo», producción y equipos. Se retiran las columnas redundantes de horas asignadas y la segunda captura de verificación.
- Guardar y confirmar, para quien ya tiene permiso, reutiliza exactamente las horas manuales y conserva revisión y auditoría. No convierte una captura en verificación sin la confirmación autorizada.
- Para otros usuarios se mantiene Guardar. Al cambiar horas después de confirmar, la nueva versión vuelve a Pendiente de confirmación.
- Precargar las horas manuales ya ingresadas o las horas confirmadas existentes. Si ambos valores difieren, conservar el historial y presentar una revisión puntual antes de unificarlos. Las antiguas asignaciones automáticas de planificación no se convierten en trabajo realizado ni aprobado; permanecen como referencia histórica. No sustituir valores en silencio.
- Nombre, fruto, producción y meta se editan desde Editar granja. Solo la granja que se está trabajando permanece abierta.
- Guardar, recargar, cambiar de plan e importar/exportar Excel deben conservar la única captura por equipo y granja.

Los ejemplos son ilustrativos y no cambian los datos de producción.

## Plan de ejecución después de aprobar la propuesta

1. **Estructura común.** Compactar Header, PageNavigationBar, WorkspaceNavigation y los estados de seguimiento, prueba y sincronización. Mantener la barra de navegación antes de Suspense y conservar los retornos interiores.
2. **Coherencia de módulos.** Aplicar la misma fila de título/acción y el mismo criterio de ayudas y filtros a Inicio, Personas, Territorio, Operación, Finanzas, Análisis, Documentos, Administración y Otros proyectos. Revisión transversal; no solo retocar Líderes.
3. **Recompensas.** Unificar la captura de horas, aplicar la meta completa a cada equipo, adaptar el reparto acordado y la aprobación sin segunda entrada, conservar datos de planes existentes y ajustar Excel y reportes afectados.
4. **Estados y accesibilidad.** Móvil de 335 px, escritorio de 1366 × 768 y tamaños intermedios; texto largo, teclado, foco, retorno, errores, pendientes, demostración y cambio de organización. Mantener áreas táctiles de 44 px y texto legible.
5. **Verificación y publicación.** Comprobar guardado y lectura, recarga del plan, duplicados de captura, versiones, permisos y cálculos. Presentar la versión compacta ya preparada para su revisión y publicarla cuando corresponda dentro del alcance aprobado.

## Criterios para aceptar el resultado

- Registros o formulario útil visibles en la primera pantalla; no una pila de cintas y saludos.
- Un único acceso a la cuenta y un único conjunto de navegación contextual.
- No ocultar errores de guardado, falta de conexión, pendientes ni el indicador de datos de prueba.
- Sin desplazamiento horizontal de toda la página; tablas con su propia adaptación cuando sea necesario.
- En Recompensas, una sola captura de horas por equipo y granja, valores existentes precargados y ninguna segunda entrada para confirmar.
- Con meta individual de 500 h, las entradas 300/400/250 muestran 60/80/50 %, independientemente de que su suma sea 950 h.
- Para la granja del ejemplo, las entradas 300/400/250 reparten los veinte frutos en 6/9/5, manteniendo avances individuales de 60/80/50 %.
- El reparto proporcional nunca supera la producción fija de frutos. No se deduce verificación por GPS ni por una asignación automática anterior.
- No cambiar permisos, historial de navegación ni datos de otras organizaciones.

## Archivos y componentes afectados al implementar

- Estructura: src/App.tsx, Header, PageNavigation, WorkspaceNavigation, Sidebar, UserGreetingBanner y RouteTrackingProvider.
- Módulos: cabeceras, filtros, cintas y ayudas que repiten estructura o información; aplicar un patrón común de densidad.
- Recompensas: RewardsView, RewardManagementReport, rewards, rewardStore, rewardFiles, rewardWorkbook y las pruebas relacionadas. Revisar las reglas si la conversión necesita nueva información; no quitar la protección de aprobación ni auditoría.

La propuesta conserva el plan gratuito y las exclusiones acordadas de TTL automático y PITR. La implementación conserva esta decisión y no habilita servicios de pago.

## Vista previa para aprobar

La vista previa se presentó al usuario antes de la implementación. Las capturas de la aplicación se adjuntan al informe de ejecución.

La imagen es una maqueta visual, no una captura de una aplicación ya modificada. Muestra Líderes, Recompensas y móvil con datos ilustrativos. Los tamaños exactos y las áreas táctiles se comprobarán en la implementación; no se atribuyen medidas de navegador a una imagen generada.

Las reglas confirmadas son: meta completa por equipo, recompensa proporcional incluso por debajo de la meta y reparto de toda la producción disponible por esfuerzo. El ejemplo 500 h por equipo y entradas 300/400/250 se representa con avances de 60/80/50 % y frutos de 6/9/5.

Aprobación recibida: «procede a realizar las mejoras». La ejecución y las comprobaciones se documentan en el informe de esta entrega.
