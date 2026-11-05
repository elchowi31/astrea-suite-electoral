# Verificación de WhatsApp y control financiero

## 1. Resultado comprobado

- Se corrigió un fallo de vinculación: se solicitaba el código durante el evento inicial `connecting`, antes de completar el registro. La versión fijada de Baileys modifica `creds.me` al solicitar el código; hacerlo demasiado pronto podía convertir el primer registro en un intento de acceso sin vinculación válida. Ahora se espera el desafío de registro (`qr`).
- Las desconexiones distinguen una vinculación inicial rechazada de una sesión previamente vinculada que se cerró. Se conserva la causa del error y se detienen seis fallos consecutivos; una renovación normal continúa automáticamente.
- La respuesta de guardado del agente depende de la transacción y de una lectura de verificación en Firestore. El mensaje confirmado queda pendiente de revisión; no autoriza entregas.
- Se activaron las pruebas de integración que antes se omitían en la comprobación habitual. Resultado: 37 pruebas aprobadas, ninguna omitida, utilizando Firebase Auth y Firestore Emulator, proyecto aislado `demo-astrea`.
- La prueba adicional de tiempo real suscribe un lector independiente a la consulta de solicitudes por organización, escribe mediante el backend REST y comprueba la llegada de los datos sin recargar. También se comprobaron recuperación, duplicados, revocación y separación entre organizaciones.
- No se modificaron las reglas de acceso a Firestore.

Evidencia: PR 9 https://github.com/elchowi31/astrea-suite-electoral/pull/9 y ejecución https://github.com/elchowi31/astrea-suite-electoral/actions/runs/41948597415.

## 2. Prueba real con WhatsApp

Se accedió a la aplicación publicada con la sesión administrativa existente y a la configuración guardada de Wilson José Arias. El intento anterior a la corrección terminó con un error de sesión rechazada. Después de publicar la corrección, el navegador dejó de permitir la interacción necesaria para terminar el emparejamiento.

Estado honesto: la persistencia y la recepción por software están verificadas con el emulador; no está comprobado un intercambio completo desde un teléfono, a través de WhatsApp, hasta la base de datos publicada. No se debe presentar como un canal ya operativo las 24 horas.

Pasos para cerrar la prueba con el propietario:

1. Abrir https://astrea-suite-electoral.vercel.app y actualizar la aplicación.
2. Seleccionar la organización que tiene guardado el número. Abrir Solicitudes y jornadas → WhatsApp.
3. Elegir Nueva vinculación e Iniciar / reanudar recepción.
4. En el teléfono receptor: WhatsApp → Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono. Introducir allí el código mostrado en el panel; no copiarlo al chat ni a un informe.
5. Desde un segundo número, enviar una solicitud ficticia de atención general. Por ejemplo: «Necesito 2 almuerzos», descripción «Verificación técnica del formulario; no entregar recursos». Revisar la ficha devuelta y escribir «confirmar».
6. Comprobar el mismo radicado en la respuesta de WhatsApp y en Solicitudes y jornadas, sin recargar. Repetir la confirmación y verificar que no aparece otra solicitud.
7. Recargar después de terminar la prueba y verificar la permanencia del registro. La recarga cierra la vinculación que dependía de la pestaña.

La sesión actual depende de mantener la pestaña y el navegador activos. Los mensajes enviados desde el mismo número receptor se excluyen; la prueba requiere otro emisor. No enviar datos personales reales durante esta comprobación.

## 3. Tablero financiero publicado

Ruta: Finanzas y aportes → Costos por servicio.

- Indicadores: gasto registrado, pagado, aprobado por pagar y pendiente de aprobación.
- Seis gráficos: rubro, responsable, municipio, vereda/barrio, estado de pago y fecha. Cada gráfico incluye una tabla con todos los grupos, aunque visualmente se destaquen los ocho de mayor gasto.
- Filtros: rubro, municipio y búsqueda existentes; además responsable, vereda/barrio, estado y fechas. Todas las cifras del nuevo tablero respetan ese conjunto de filtros y el ámbito autorizado.
- Costo unitario ponderado por rubro y unidad: suma de importes con cantidad válida / suma de cantidades de esos registros. Ejemplo: COP 200.000 / 10 personas = COP 20.000 por persona registrada como unidad de gasto.
- Las personas, los viajes, las raciones, los galones y las piezas se calculan por separado. La cantidad facturada no acredita asistencia ni votos. Un gasto sin cantidad sigue dentro del gasto total y se excluye del promedio unitario.
- Alertas: importe inválido, estado sin clasificar, falta de cantidad o unidad, falta de soporte, falta de responsable y diferencia entre importe y cantidad × precio. Son señales de revisión documental, no afirmaciones de fraude.
- No hay una predicción estadística de sobrecostos: requiere presupuestos y series de ejecución comparables. Tampoco se infieren gastos a partir de metas electorales.

Evidencia: PR 10 https://github.com/elchowi31/astrea-suite-electoral/pull/10 y ejecución https://github.com/elchowi31/astrea-suite-electoral/actions/runs/41949247216. Cuatro pruebas financieras cubren separación de organizaciones, filtros combinados, unidades distintas, cantidades faltantes y discrepancias aritméticas.

## 4. Pendientes antes de afirmar que todo está terminado

1. Cerrar la prueba con teléfono y Firestore publicado, con radicado coincidente y actualización observada.
2. Encuestas y cuestionarios configurables: actualmente existe únicamente el formulario fijo de solicitudes. No se agregó un motor de encuestas.
3. Verificar la identidad de cada remitente y asociarla con su cuenta y permisos. En el modo actual la sesión tiene un responsable fijo; el teléfono emisor se registra como traza y no equivale a un usuario verificado.
4. Para atención permanente, disponer de un proceso con disponibilidad y supervisión independientes de una pestaña abierta.
5. Revisar los nuevos gráficos en escritorio y móvil con datos representativos. Las comprobaciones de tipos, pruebas y compilación pasaron; la revisión visual posterior quedó interrumpida por el navegador.

Referencia técnica de pruebas: https://firebase.google.com/docs/emulator-suite/connect_firestore.
