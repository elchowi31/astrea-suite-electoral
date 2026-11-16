# Resúmenes primero y vinculación de WhatsApp

## Resultado de la implementación

La cabecera de Inicio contiene Solicitudes, Ver registros y Filtros junto al estado de datos. Se retiró el encabezado visible «Matriz gerencial». Los indicadores comienzan inmediatamente después de la cabecera. El estado de GPS y sus controles están en Mi dispositivo; no hay una cinta global de seguimiento.

Las páginas de solicitudes, líderes, finanzas, recompensas, operación y transporte muestran primero sus indicadores. Las acciones, selectores y filtros comparten la cinta de navegación. Canales reúne el asistente y WhatsApp junto a las secciones de Operación. En pantallas estrechas, las herramientas se agrupan en un único menú accesible. Las listas, formularios y ayudas siguen al resumen.

Recompensas conserva la regla aprobada: una única captura manual, meta completa para cada equipo y reparto proporcional de toda la producción. El resumen de granjas, horas, metas y frutos precede a la matriz de equipos.

## Plan aplicado

1. Crear un espacio común de herramientas en cabecera y navegación, conservando permisos, contexto y retorno entre módulos.
2. Reubicar las acciones de Inicio y retirar su título repetido.
3. Colocar los indicadores y gráficos antes de filtros, ayudas y listados en las páginas principales.
4. Llevar los canales de recepción a la cinta de Operación y reunir las herramientas en móvil.
5. Mantener el consentimiento inicial y sus decisiones guardadas; mover el control de GPS a Mi dispositivo. Una decisión previa de no autorizar ubicación no habilita seguimiento.
6. Añadir QR rotativo y código de vinculación alternativo a Baileys.
7. Conservar vínculos ya emparejados en el dispositivo con autorización de almacenamiento, recuperar el vínculo al abrir y recordar una pausa explícita.
8. Verificar escritorio, móvil de 335 px, navegación, aislamiento de cuenta, reconexión, pausa y retirada de datos.
9. Publicar el mismo código revisado en web y Android 1.3.1, manteniendo la firma de actualización y una versión anterior disponible.

## WhatsApp: alcance y conservación

El QR se dibuja localmente a partir del desafío recibido de WhatsApp. En ese modo no se solicita un código numérico. La alternativa por código mantiene su propio flujo. Los desafíos se retiran cuando cambia el modo, vence el intento o se completa el vínculo.

Solo se recuerda una identidad ya emparejada. La copia del dispositivo usa AES-GCM y una clave no exportable de Web Crypto, separada por cuenta y organización. No se coloca la clave de sesión en direcciones, registros o localStorage. Su vigencia local es de seis días desde la última conservación. El estado cifrado del servidor se renueva a siete días durante la recepción, incluso si no llegan mensajes. La expiración se comprueba en la aplicación; no se ha habilitado borrado automático facturado.

Los cortes temporales se reintentan con espera limitada a treinta segundos entre intentos. Una sesión revocada o incompleta requiere nuevo vínculo. Pausar detiene también el arranque automático y confirma que la preferencia quedó guardada. Retirar los datos del dispositivo espera las escrituras pendientes para impedir que una escritura tardía recree el vínculo retirado.

La recepción requiere Astrea abierta y activa. No hay servicio independiente de recepción con la aplicación cerrada. Los mensajes del intervalo cerrado o pausado no se incorporan automáticamente; se conservan los trabajos previamente aceptados. La recuperación depende también de que WhatsApp mantenga válido el vínculo.

## Verificación antes de publicar

- Pruebas automáticas de QR, reintentos, aislamiento, caducidad, pausa y retirada del almacén cifrado.
- Prueba autenticada con datos ficticios en emuladores: inicio, solicitudes, líderes, finanzas y recompensas en 1010 y 335 px; recuperación de identidad tras recargar, pausa persistente y cambio a código sin repetir la configuración.
- Recorrido funcional de 26 rutas de módulos sin errores de página ni desbordamiento general a 335 px.
- Posición del primer resumen: Inicio 56 px; solicitudes, líderes y finanzas 113 px; recompensas 149 px. Cabecera de 56 px y cinta contextual de 45 px.
- Desafío QR recibido de una conexión real al protocolo de WhatsApp. Se cerró antes de vincular un teléfono y no se enviaron mensajes. La prueba de restauración del receptor utilizó un flujo controlado; no acredita emparejamiento completo de un teléfono real.
- La publicación debe acreditar controles automáticos del código final, lectura del identificador de versión desplegada y APK firmado con sus archivos web correspondientes. El acta de entrega registra los identificadores definitivos.

No se han modificado las reglas de acceso a Firestore ni el plan gratuito. El borrado automático de sesiones y la recuperación histórica facturada continúan diferidos por decisión del usuario. Los permisos y avisos obligatorios del sistema operativo permanecen bajo control de Android.

## Referencias técnicas primarias

- [Baileys: conexión, QR, códigos y credenciales](https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/socket/connecting.md).
- [node-qrcode: generación local de imágenes QR](https://github.com/soldair/node-qrcode).
- [Android: solicitud y duración de permisos](https://developer.android.com/training/permissions/requesting).
- [Android: tipos de servicios en primer plano](https://developer.android.com/about/versions/14/changes/fgs-types-required).
