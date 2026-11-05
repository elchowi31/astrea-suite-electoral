# Auditoría técnica y plan de cierre de Astrea Suite Electoral

Fecha de corte: 4 de noviembre de 2026, hora de Colombia.
Responsable del producto: Wilson Jose Arias.
Repositorio: https://github.com/elchowi31/astrea-suite-electoral
Versión examinada: b15e120060adde40ec21c8443e49e52c8b9978e4.
Publicación de referencia: dpl_FJAbDwdAEPEj9YtXjq7bLEn1kWsv, estado READY en Vercel. Creada el 31 de octubre de 2026 a las 22:59, hora de Colombia.

## 1 Conclusión

La plataforma cuenta con una base funcional considerable, pero no hay evidencia suficiente para certificarla como un servicio terminado, autónomo y listo para vender con garantías de disponibilidad. La revisión confirma componentes en el código y una publicación terminada. No equivale a certificar cada pantalla, el estado actual de las reglas desplegadas, una restauración de respaldo ni la operación de punta a punta con cuentas reales.

Se prepararon correcciones de seguridad y actualización de la aplicación, con 13 pruebas nuevas aprobadas localmente. La compilación completa y el control continuo se gestionan en la rama de cambios; su resultado final debe consultarse en la revisión de código.

El alcance ejecutado es la seguridad, integridad de datos y calidad técnica general. No se implementó optimización de movilización electoral, reasignación por rendimiento político, costo por voto ni automatización política de WhatsApp. La logística neutral sería un producto de servicios generales independiente de preferencias, metas o resultados electorales; no basta con cambiar los nombres de los campos.

## 2 Alcance y límites de la comprobación

| Evidencia | Resultado |
| --- | --- |
| Repositorio y versión en producción | La rama main coincide con el commit de la publicación READY consultada. |
| Copia ZIP adjunta | Se localizó la copia de septiembre, pero no se consiguió transferir. No se presenta como contenido inspeccionado. La revisión se basó en el repositorio vigente. |
| Código de acceso, guardado, reglas, API, Workspace y WhatsApp | Inspeccionado. Los hallazgos se distinguen de pruebas en producción. |
| Navegador | La conexión no permitió abrir una sesión de prueba. No se certifica la experiencia visual ni accesibilidad. |
| Datos de clientes | No se crearon ni modificaron registros en producción. |
| Reglas de Firestore | Se revisó el archivo del repositorio. Falta cotejarlo con las reglas efectivamente publicadas en la base nombrada. |
| Dependencias locales | No fue posible instalar el conjunto completo en el entorno restringido. Las 13 pruebas nuevas se ejecutaron con Node 22 y sus utilidades integradas, sin servicios externos. |
| Configuración externa | Se verificó el plan Hobby de Vercel y la presencia de variables para Gemini y Maps, sin revelar sus valores. Tener una variable no acredita que el servicio funcione. |
| CI anterior | La consulta de GitHub Actions devolvió cero ejecuciones. El árbol de producción no contenía un flujo activo en .github/workflows. |

## 3 Qué existe y qué no está demostrado

| Área | Evidencia concreta | Estado y límite |
| --- | --- | --- |
| Autenticación | Firebase Auth, observación del perfil activo y accessVersion 2; src/lib/firebaseAuth.ts | Implementada en código. Falta prueba real de ingreso, recuperación y revocación. |
| Separación por cliente | tenantId, reglas sameTenant, organizaciones activas y API que usa el token del solicitante | Diseño presente. Requiere pruebas con dos organizaciones y reglas desplegadas antes de certificar aislamiento. |
| Creación de usuarios | Instancia secundaria de Auth y escritura por lote; src/lib/userProvisioning.ts | Conserva la sesión del administrador en el diseño. Falta prueba de punta a punta. |
| Guardado y auditoría | persistEntity realiza lote con auditoría y verifySavedRecord | Implementado para ese flujo. No demuestra que toda escritura alternativa esté obligada por reglas a incluir auditoría. |
| Datos demostrativos | Espacio propio y controles separados de los registros operativos | Presente en código; debe comprobarse el cambio de modo sin mezcla de datos. |
| Finanzas | Gastos, aportes, estados y reportes existentes | Presente. No se certificó conciliación contable, aprobación documental ni exactitud de todos los gráficos. |
| Eventos y recursos | Jornadas, solicitudes, aprobaciones, existencias y transacciones | Ya existen; no es un módulo que haya que construir desde cero. No se modificaron sus reglas de movilización electoral. |
| Viajes | Ida y regreso se registran por separado; documentación y operations.ts | No hay evidencia de que una ida garantice automáticamente un regreso individual. No se ofrece esa garantía comercial. |
| Pronósticos | forecast7 usa gasto de 14 días y una extrapolación de 7 días; requiere cuatro días con gasto | Es una estimación aritmética; no acredita un modelo predictivo entrenado ni validado. |
| Alertas de jornada | Comparación lineal con tiempo transcurrido y margen; operations.ts | Reglas predefinidas. No prueban inteligencia predictiva ni un resultado electoral. |
| Mapas y GPS | Componentes de mapas, recorridos, permisos y cola local | Implementados en código. No se probó campo, mala señal, batería, precisión o continuidad. |
| WhatsApp | Baileys, conexión de hasta 240 segundos renovada desde la pestaña | No es un receptor permanente independiente del navegador. No se activó. |
| Autoría en WhatsApp | pilotIntake y docs/WHATSAPP-IDENTIDAD-E-INVITACIONES.md | La documentación reconoce que el remitente no se vincula a una cuenta verificada y la operación se atribuye al administrador. No debe venderse como identidad individual validada. |
| Google Workspace | OAuth, Sheets, Forms y Calendar | Implementado; se corrigió el modo de exportación a Sheets. No se hicieron llamadas reales a cuentas del usuario. |
| API de salud | /api/health devuelve un estado fijo y fecha | Comprueba la ejecución del manejador; no comprueba por sí sola Firestore, Gemini o WhatsApp. |
| Android y funcionamiento sin conexión | Proyecto Capacitor y generador de service worker | Existen. Falta validación de instalación y actualización en dispositivo real para esta revisión. |
| Planes comerciales | Tipo Gratuito/Profesional/Institucional en src/types.ts | Una etiqueta de plan no acredita facturación, cobro, cuotas ni suspensión automática. |

## 4 Hallazgos y medidas

P0 significa bloqueo de lanzamiento o de una promesa comercial; P1, corrección necesaria antes del uso general; P2, mejora posterior condicionada a mediciones.

| ID | Prioridad | Hallazgo y evidencia | Tratamiento y criterio de cierre |
| --- | --- | --- | --- |
| AUD-01 | P0 | Vercel informa plan Hobby. Su documentación limita ese plan a uso personal no comercial. | Contratar infraestructura con condiciones que admitan el servicio vendido. No se hizo ninguna compra ni cambio de plan. |
| AUD-02 | P0 | WhatsApp Business Platform excluye campañas, candidatos y proveedores de servicios electorales. | No ofrecer esa integración como API oficial habilitable para este producto. Baileys no convierte el uso en una integración oficial autorizada. |
| AUD-03 | P0 | El receptor actual necesita una pestaña abierta; identidad del remitente no validada. | No prometer atención permanente ni autoría individual certificada. El agente queda sin activar en esta intervención. |
| AUD-04 | P1 | Sheets usaba USER_ENTERED para datos de formularios/importaciones. Una cadena que comienza por = puede ejecutarse como fórmula y alterar el resultado. | Corregido a RAW en un exportador independiente, conservando números como números y textos como textos. Tres pruebas. |
| AUD-05 | P1 | La versión de caché se calculaba únicamente con nombres de archivo. Cambiar HTML o un manifiesto sin renombrarlo podía reutilizar una caché antigua. | Corregido: huella del contenido del bundle y archivos públicos; lectura de la caché de la versión actual; exclusión de API y peticiones autenticadas. Seis pruebas. |
| AUD-06 | P1 | El verificador JWT propio no comprobaba auth_time y admitía iat futuro hasta 60 segundos. | Endurecido según la documentación de Firebase. Cuatro pruebas de firma y atributos. No se afirma que existiera un acceso explotable con un token legítimo. |
| AUD-07 | P1 | No había ejecuciones de Actions ni flujo activo de comprobación; Vercel construye solo el frontend. | Añadir control de tipos, pruebas, comprobación de API compilada y build para cada propuesta. La protección de rama sigue siendo una configuración separada pendiente. |
| AUD-08 | P1 | operator() incluye Consulta e Invitado mediante teamRole(); la API del asistente los excluye. | Resolver explícitamente la matriz de permisos y probar acceso directo a Firestore. No se cambiaron permisos existentes sin conocer el comportamiento autorizado para cada rol. |
| AUD-09 | P1 | Reglas en el repositorio y reglas publicadas pueden diferir; la base es nombrada. | Cotejar versión, ejecutar emuladores y verificar dos clientes aislados. No publicar reglas de otra base por error. |
| AUD-10 | P1 | requestBuckets vive en memoria de cada instancia de API. | No considerarlo límite global de consumo. Diseñar una cuota por cliente y medir concurrencia antes de prometer costos máximos. |
| AUD-11 | P1 | Google Workspace conserva un token en memoria sin metadatos explícitos de usuario y vencimiento. | Probar cambio de cuenta y expiración; vincular la credencial al usuario y exigir reconexión cuando corresponda. Pendiente. |
| AUD-12 | P1 | createVolunteerGoogleForm devuelve resultado aun cuando batchUpdate falla; registra una advertencia. | Pendiente: no confirmar como completo un recurso creado parcialmente; exponer estado recuperable. No se modificó el flujo electoral de captación. |
| AUD-13 | P1 | clearDeviceData elimina la cola local y cachés de la aplicación, pero no muestra una limpieza explícita de la caché persistente de Firestore. | Comprobar cierre de sesión y eliminación en equipo compartido. Definir retención, advertencia y borrado verificable. |
| AUD-14 | P1 | La aplicación abre varias suscripciones a colecciones completas; el suscriptor general no establece paginación. | Medir lecturas, memoria y tiempos con datos sintéticos; paginar y agregar en servidor cuando la medición lo justifique. |
| AUD-15 | P0 | No se obtuvo evidencia de restauración de respaldo, pruebas de carga ni guardia de incidentes. | Ensayo documentado de recuperación y capacidad; responsables y tiempos de atención antes de vender un SLA. |
| AUD-16 | P1 | Existe auditoría por lote en los flujos revisados, pero no una exigencia universal demostrada en reglas. | Probar escrituras directas fuera de la interfaz; impedir o registrar las mutaciones que deban tener trazabilidad. |
| AUD-17 | P1 | Etiquetas de plan sin ciclo comercial integral verificado. | Definir alta, contrato, cuotas, facturación, baja y exportación de datos; verificar cada transición en servidor. |
| AUD-18 | P1 | La interfaz no se probó visualmente en esta sesión. | Pruebas de teclado, contraste, estados vacíos, errores, móvil y carga lenta. Evitar multiplicar gráficos que no respondan a una decisión administrativa. |

## 5 Plan de ejecución y aceptación

El orden depende de resultados verificables, no de un porcentaje de avance inventado. Las tareas pueden desarrollarse sin cambiar los módulos electorales restringidos.

| Etapa | Entrega | Criterio de aceptación | Estado en esta intervención |
| --- | --- | --- | --- |
| 1 Diagnóstico | Versión de referencia, inventario y hallazgos | Evidencia y límites escritos; sin confundir código existente con función comprobada | Realizado |
| 2 Correcciones generales | Exportación segura, caché y validación de tokens | 13 pruebas nuevas aprobadas | Realizado localmente |
| 3 Control de calidad | Flujo automático de tipos, pruebas y compilación | Ejecución completa sobre el mismo commit que se revise | Configuración preparada; consultar resultado en la propuesta |
| 4 Seguridad de acceso | Matriz de roles, sesiones y aislamiento | Dos organizaciones de prueba; todos los accesos cruzados prohibidos rechazados; revocación comprobada | Pendiente de verificación integrada |
| 5 Integridad y recuperación | Conciliación, respaldo, restauración y retención | Totales consistentes; sin duplicados por reintento; restauración ensayada con datos sintéticos | Pendiente |
| 6 Capacidad y observabilidad | Medición de carga, fallos y costos por cliente | Presupuesto técnico definido y límites de consumo probados; alarmas de errores y disponibilidad | Pendiente |
| 7 Experiencia de uso | Navegación, filtros administrativos, móvil y accesibilidad | Recorridos completados por usuarios representativos; filtros con estado visible y opción de restablecer | Pendiente |
| 8 Operación comercial | Infraestructura admitida, condiciones del servicio y soporte | Ningún P0 abierto; comprobaciones técnicas completas; aceptación de un piloto administrativo | Pendiente; no se autoriza venta con SLA por este informe |

Responsabilidades sugeridas: titular del producto para alcance y contratación; desarrollo para correcciones; QA para comprobación independiente; responsable de datos para retención y atención de titulares; operación para respaldos e incidentes. Son roles de trabajo propuestos, no personas contratadas.

## 6 Reglas para presentar indicadores con honestidad

- Mostrar fecha de actualización, alcance del filtro y fuente de cada dato.
- Distinguir dato registrado, validación, pago, compromiso y estimación.
- Identificar valores faltantes y denominadores cero; no sustituir desconocido por cero.
- Separar los registros de demostración de las operaciones reales.
- Explicar la fórmula y los supuestos de una proyección de gasto. Validar su error con datos históricos antes de denominarla predictiva.
- Un registro, una asistencia o un traslado no demuestran por quién votó una persona. No se debe presentar esa equivalencia.

Estas reglas sirven a la calidad de la información y no definen estrategias para obtener apoyo político.

## 7 Protección de datos y condiciones del servicio

La Ley 1581 de 2012, artículos 5 y 6, trata como sensibles, entre otros, los datos de orientación política y salud y establece condiciones específicas para su tratamiento. Antes de incorporar información sobre embarazo o salud, el responsable debe justificar la necesidad, definir acceso restringido y revisar la base jurídica y la autorización aplicable. Una etiqueta de consentimiento no sustituye todo ese proceso.

Para comercializar, faltan evidencias del aviso de privacidad, inventario de tratamientos, plazos de retención, atención de solicitudes de titulares, contratos pertinentes y procedimiento de incidentes. Este informe no constituye certificación jurídica ni permite afirmar que no existen documentos externos al repositorio.

## 8 Pruebas y comprobación posterior

Pruebas nuevas: tests/firebaseToken.test.ts, tests/googleSheetsExport.test.ts y tests/offlineApp.test.ts.
Resultado local: 13 aprobadas, 0 fallidas; no se contactó Firebase, Google Sheets ni WhatsApp.

Comando local utilizado:

~~~sh
node --experimental-strip-types --test tests/firebaseToken.test.ts tests/googleSheetsExport.test.ts tests/offlineApp.test.ts
~~~

Verificación completa prevista en CI:

~~~sh
npm ci --no-audit --no-fund
npm run check
~~~

Las pruebas de reglas necesitan el emulador de Firestore y Java, además de una versión controlada de Firebase CLI. El script test:rules existe, pero firebase-tools no está declarado en package.json. Debe completarse ese requisito para que esa comprobación sea reproducible.

No se afirma haber validado la salud actual de todos los servicios, probado WhatsApp con un número real ni certificado producción. El estado de publicación de los cambios se informa en la propuesta de integración.

## 9 Fuentes

Código de referencia: https://github.com/elchowi31/astrea-suite-electoral/tree/b15e120060adde40ec21c8443e49e52c8b9978e4

- Acceso y persistencia: src/lib/firebase.ts, src/lib/firebaseAuth.ts, src/lib/userProvisioning.ts, firestore.rules.
- Integraciones: api/index.ts, api/whatsapp-pilot.ts, src/server/whatsappPilot.ts, src/server/whatsappPilotCore.ts, src/server/whatsappSessionStore.ts, src/lib/googleWorkspace.ts.
- Experiencia y datos: src/App.tsx, src/lib/deviceStorage.ts, src/lib/operations.ts, src/lib/operationsStore.ts.
- Limitaciones previamente documentadas: docs/CONTROL-OPERATIVO.md y docs/WHATSAPP-IDENTIDAD-E-INVITACIONES.md.
- WhatsApp Business Messaging Policy, sección Government and Political Use: https://whatsappbusiness.com/policy/
- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Vercel Fair Use Guidelines: https://vercel.com/docs/limits/fair-use-guidelines
- Google Sheets, lectura y escritura de valores: https://developers.google.com/workspace/sheets/api/guides/values
- Firebase, verificación de tokens: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- GitHub Actions para Node: https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs
- Ley 1581 de 2012: https://normograma.mintic.gov.co/mintic/compilacion/docs/ley_1581_2012.htm

Fuentes externas consultadas el 4 de noviembre de 2026. Revisar sus condiciones nuevamente al contratar o lanzar el servicio.

