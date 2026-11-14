# Plan de implementación y verificación — 12 de noviembre de 2026

Objetivo autorizado: aplicar las mejoras del estudio de mercado, publicarlas y comprobar el resultado en producción. Se trabaja en `improvement-work`, rama `codex/market-improvements-2026-11-12`; `map-work` y sus cambios previos se conservan.

## Revisión del grafo

Se revisó el grafo proporcionado por el usuario: `D:/Descargas/KITS Claude Code/02-kit-agente-whatsapp/docs/grafo-astrea-2026-11-11/INFORME.md`, con 436 nodos, 1.416 relaciones y commit coincidente con la base. Se conserva además un grafo estructural de respaldo en `graphify-out`, que se refrescará con los cambios. Los trece hallazgos SEG-01 a SEG-13 se incorporan como controles de publicación. El 13 de noviembre el usuario confirmó que WhatsApp utilizará un servicio de código abierto; se conserva el camino Baileys/kit, separado de Business Platform.

## Secuencia y aceptación

1. [x] **Base y mapa de dependencias.** Conservar diff y archivos previos, registrar revisión y despliegue anterior; generar `graphify-out/GRAPH_REPORT.md`, `graph.json` y `graph.html`; identificar módulos compartidos, autorización, persistencia y pruebas afectadas.
2. [x] **Navegación y fusiones.** Siete espacios principales con subnavegación por rol; administración y funciones de otros dominios separadas. Conservar rutas internas, permisos, historial de retorno y datos. Validar a 335 px, teclado y regreso desde formularios.
3. [x] **Finanzas e indicadores.** Una función de resumen para efectivo, especie, pagos y compromisos; reutilizarla en finanzas y resúmenes. Integrar el control de gastos en Finanzas. Sustituir confianza estadística aparente por volumen de datos y explicar las métricas operativas. Probar estados mixtos, importes inválidos y organizaciones distintas.
4. [x] **Datos, consentimiento y recuperación.** Vista de revisión de duplicados y autorizaciones; revocación explícita y auditable. Respaldo y restauración administrativa con validación de organización, esquema y límites; vista previa y conflictos sin sobrescritura automática. Probar aislamiento, errores, reintentos y restauración con datos ficticios.
5. [x] **Operación conectada.** Subnavegación compartida de solicitudes, eventos, reservas, asistencia y transporte; referencias comunes y accesos contextuales. Mantener transacciones para cupos/aprobaciones. Utilizar el conector de código abierto Baileys/kit solicitado; no presentar Business Platform como el servicio contratado ni activar envíos masivos. Probar reservas y permisos existentes.
6. [x] **Testigos y actas.** Recorrido real de asignación por mesa, incidencia, evidencia, captura de resultados y revisión humana. Persistencia, trazabilidad, conflictos y reglas por organización/rol. Sin afirmar resultados oficiales, lectura OCR o votos individuales. Probar captura y lectura independiente con emuladores y datos ficticios.
7. [x] **Análisis, documentación y medición.** Consolidar herramientas de análisis y documentos; ayuda contextual sobre origen y límites. Añadir medición mínima de tareas y errores sin datos personales; presupuestar consumo de IA. Registrar límites de capacidad y condiciones de soporte sin publicar precios comerciales hipotéticos como aprobados.
8. [x] **Cierre técnico y publicación.** Tipos, pruebas unitarias y de integración relevantes, compilación y runtime API; ensayo de navegación móvil y recuperación. Commit, controles del mismo SHA, despliegue con variables de producción, reglas e índices si cambian, comprobación de salud y flujos autenticados, revisión de errores y rollback disponible. Actualizar recursos Android y paquete firmado si el entorno lo permite.

Cada etapa registra archivos, comprobaciones y resultado antes de pasar a la siguiente. No se borran colecciones, datos ni cuentas existentes. No se publican credenciales, archivos de entorno o respaldos con datos privados.

## Evidencia que requiere uso real

La instrumentación permite medir adopción, ahorro de tiempo y costo. No se inventarán entrevistas, disposición a pagar, pilotos de tres organizaciones ni resultados acumulados de noventa días. Se entregarán mecanismos operativos y criterios para medirlos; su observación posterior se distingue de las pruebas de software.

## Registro

- Base Git: `50c51e031a96e300db0544a6136269ae3d177168`.
- Producción anterior: `dpl_99CRThQMS4RmQV1SDQJSqSnu3BDw`, READY.
- Proyecto Vercel: `prj_gp0Vx6QrpUG25MzMFpeDBZCYCNfX`; equipo `team_jTU5F86GlzBAHfEPuaaR9HtA`.
- Respaldo de cambios previos: `.audit-runtime/improvements-baseline.patch` y `.audit-runtime/improvements-baseline.json`, fuera del repositorio publicable.

## Continuación del 14 de noviembre

La sesión de consola Firebase fue abierta por el usuario. La credencial local de gcloud de la cuenta administradora aún requiere renovación. El controlador de navegador informó un error de escritura de sus recursos de ejecución; se conserva el acceso abierto y no se extraen credenciales del navegador. Se sigue con correcciones y pruebas independientes.

## Evidencia del 14 de noviembre

- Tipos, pruebas generales, runtime de API y compilación completados. Integración completa: 93/93 pruebas positivas, sin omisiones, con Auth y Firestore emulados. Control de calidad de GitHub del commit `afabb003d09fc6a66dcd777fd4a0124fd552642e`: ambos trabajos correctos.
- Reglas publicadas y cotejadas con la fuente probada: ruleset `8545d995-bd0f-4f13-9372-aa730f20ca0b`, SHA-256 normalizado `f67ab085d94804195203b3b85fdc11bd3d8d99d2f197fa434324afade0ff10e1`. La versión anterior se conserva para reversión.
- Prueba autenticada sobre la base real, con organización ficticia: respaldo, borrado del registro ficticio, restauración, lectura de servidor, conservación de existentes, captura y revisión de treinta líneas, y tres solicitudes concurrentes con dos aceptadas y una limitada. Los datos ficticios se retiran al cerrar la publicación.
- El usuario decidió conservar el plan gratuito y dejar pendientes TTL automático y PITR. Las políticas preparadas se separan de los índices activos; no se vincula facturación. Protección contra eliminación de la base activada y comprobada.
- Android 1.2.0, versión 10: paquete firmado con el certificado existente y alineación verificada. La versión final se regenera después de la última corrección visual.
- En la comprobación móvil se corrigió una pérdida ocasional de foco hacia el contenido mientras el menú estaba abierto. Se comprueba el recorrido completo antes de marcar navegación y publicación como terminadas.

- Interfaz en navegador aislado: siete espacios; retención y retorno del foco con teclado; regreso interior de Finanzas y Testigos; historial entre módulos y reinicio a tablero; acta guardada y revisada desde la pantalla; descarga y vista previa de respaldo; navegación de escritorio; borrado local y cierre de sesión. Sin errores de página. Ancho raíz comprobado a 335 px.

## Cierre verificado — Astrea 1.2.1

La versión final corrige el máximo permitido por el servicio real de Firestore. Commit de aplicación comprobado y publicado: `2ac0b5c0cacdda5c68a3a59a24d18685e7b4440b`; CI del mismo commit: [Quality checks 54](https://github.com/elchowi31/astrea-suite-electoral/actions/runs/43626144598), ambos trabajos correctos. Las doce suscripciones principales quedaron listas y sin avisos de error en el dominio público. Se repitieron los recorridos móviles, escritorio, captura/revisión, respaldo y retirada local sobre esa misma compilación.

Producción: https://astrea-suite-electoral.vercel.app · despliegue `dpl_28QTjjBEhcWDJooMaci7TDrxSwgW`. Android 1.2.1 (11): https://github.com/elchowi31/astrea-suite-electoral/releases/tag/v1.2.1, firma y descarga verificadas. La versión 1.2.0 fue retirada de publicación tras detectar el límite de consultas; se conserva como borrador histórico. Los registros ficticios, sus recibos y sesiones, la organización y su cuenta de autenticación se retiraron al concluir las pruebas.

Las únicas dos exclusiones de infraestructura acordadas expresamente son TTL automático y PITR, para conservar el plan gratuito. Se mantienen la caducidad al cargar sesiones y la recuperación operativa seleccionada. El detalle de evidencia y límites está en [CIERRE-PRODUCCION-2026-11-14.md](CIERRE-PRODUCCION-2026-11-14.md).
