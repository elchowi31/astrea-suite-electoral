# Controles de publicación de las mejoras de Astrea

El informe original del grafo (11 de noviembre, 436 nodos y 1.416 relaciones) se utilizó como evidencia del sistema de partida. Sus recomendaciones se contrastaron con el código, las reglas y las pruebas. La publicación requiere comprobar el mismo commit y guardar los identificadores de despliegue, reglas e índices fuera de los datos privados.

| Hallazgo | Cambio y comprobación |
| --- | --- |
| SEG-01 | Consulta e Invitado quedan fuera de escrituras operativas en reglas y formularios. Pruebas positivas y de rechazo por rol. |
| SEG-02 | OAuth de Workspace vinculado a UID y organización, caducidad de 45 minutos y limpieza al cambiar ámbito. La vista se vuelve a montar por ámbito. |
| SEG-03 | Retirada local: sincronizar pendientes, cerrar sesión, terminar Firestore, borrar su persistencia y retirar todas las claves de Astrea de ambos almacenes. Se conservan claves de otras aplicaciones. |
| SEG-04 | Copia privada y huella de las reglas publicadas antes de su cambio. Publicar las reglas probadas y comprobar su contenido después. |
| SEG-05 | Cuota de IA por usuario y minuto compartida entre instancias mediante precondiciones de Firestore; concurrencia real ensayada. El límite HTTP general sigue siendo por proceso y así se declara. |
| SEG-06 | Respaldo operativo seleccionado, validado y restauración solo de faltantes, con auditoría y protección transaccional contra sobrescrituras. Sesión cifrada de WhatsApp caduca tras 24 horas sin actualización; recibos de transporte a 7 días y diagnóstico a 30 días. Campos TTL de tipo timestamp e instalación de la política comprobados durante publicación. |
| SEG-07 | Salud básica identifica versión y declara dependencias no comprobadas. Las pruebas autenticadas de Firestore, recuperación y actas se registran aparte. |
| SEG-08 | Suscripciones con límite explícito, aviso de resultados parciales, latencia y error visible; se conserva el último resultado del mismo ámbito ante errores. |
| SEG-09 | Diagnóstico sin texto de mensajes ni respuestas, teléfono limitado a cuatro cifras; registros de errores sin datos de sesión ni excepciones completas de proveedores. |
| SEG-10 | Tipos, pruebas, integración y build antes de publicar; CI asociado al commit, versión anterior disponible para reversión. |
| SEG-11 | Siete espacios, permisos originales, barra común de regreso, historial e interiores con retorno. Ensayo de teclado, formularios y ancho de 335 px. |
| SEG-12 | La prueba independiente del kit solo acredita su transporte. Baileys es el conector abierto utilizado por Astrea; una pestaña activa ofrece recepción por tramos. No se ofrece como servicio continuo 24/7 ni como integración completa del kit externo. |
| SEG-13 | Un mismo lector limitado valida el tamaño del Buffer recibido y del flujo antes de analizar los webhooks. |

## Límites y operación

- Los precios del estudio son hipótesis comerciales para validar. No se publican como tarifas aprobadas.
- La medición de productividad registra guardados y errores de la sesión actual, sin contactos ni contenido. No acredita entrevistas, adopción, ahorro económico ni resultados de 90 días.
- Los respaldos descargados contienen datos personales. Excluyen cuentas, credenciales, auditoría, sesiones, binarios externos y componentes operativos no seleccionados; no se presentan como exportaciones completas de Firestore.
- TTL es asíncrono. La caducidad de la sesión se comprueba también al cargarla; el borrado automático no es inmediato. Los recibos de idempotencia de solicitudes y la auditoría operativa no se eliminan con estas políticas de transporte.
- Actas: captura manual y revisión humana, máximo de 30 líneas por acta y foto codificada de hasta 500 KB. La representación canónica nombre;cantidad permite validar todas las filas en el servidor. La consolidación privada incluye solo evidencias revisadas por elección; no sustituye resultados oficiales.
- La verificación de producción utiliza una organización y cuentas ficticias aisladas; se retiran únicamente sus registros al terminar.
- El controlador visual de la sesión de trabajo presentó un error de inicialización. Las comprobaciones automáticas de interfaz usan un navegador aislado y datos ficticios; no reutilizan ni extraen credenciales del navegador del usuario.
