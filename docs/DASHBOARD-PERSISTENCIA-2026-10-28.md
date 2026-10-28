# Tablero y persistencia — 28 de octubre de 2026

La matriz gerencial conserva los colores financieros y la definición de litografía de la app. El control de datos de prueba se integra a la cabecera; los filtros ocupan una franja compacta. Los seis KPI usan barras horizontales con proporciones calculadas y etiquetas que explican su denominador. No se inventan series históricas.

En «Base de contactos por líder», Editar abre la ficha del responsable. Los contactos, verificaciones, gastos y cupos se corrigen en sus formularios de origen; los agregados se recalculan.

## Guardado

- El editor cubre los 17 tipos del catálogo demo, incluidos comités, tareas y pasajeros. Las planillas individuales también se guardan.
- Jornadas, solicitudes, aprobaciones, gastos vinculados, viajes, conteos y cesiones usan las mismas validaciones de negocio en ambos modos.
- El modo demo escribe atómicamente en `demo/{tenantId}--demo--{uid}`. Conserva `isSynthetic: true`; nunca escribe sus operaciones en las colecciones reales. Su historial de operaciones queda dentro de la coordinación de prueba; los identificadores de cesión evitan duplicaciones.
- Las ediciones, altas de entidades, planillas, tareas, operaciones y promociones revisadas se verifican con `getDocFromServer` después del commit. Un conflicto o una lectura fallida no produce confirmación de guardado verificado.
- Se mantienen los permisos existentes y las comprobaciones de organización, referencias, campos protegidos, cantidades y conflictos. No se cambian las reglas de seguridad.
- El documento demo mantiene el límite de 900 KB; hasta 500 operaciones auditadas. Si se alcanza, se informa y se rechaza el cambio sin truncar registros.

## Evidencia y alcance

`npm run check`: tipos, pruebas unitarias, arranque API y compilación de cliente/servidor.

`tests/persistence.integration.test.ts`: SDK real contra emuladores Auth/Firestore, edición de cada colección demo, lectura del servidor, rechazo de datos inválidos y escrituras obsoletas, creación y corrección de planillas/tareas, ciclo operativo, capacidad y solapamiento, cancelación, cesiones idempotentes, operaciones reales, promoción revisada y recuperación del documento completo desde una segunda instancia sin caché compartida.

Ejecución: `ASTREA_FIREBASE_TEST_EMULATORS=true` dentro de `firebase emulators:exec --project demo-astrea --config firebase.emulator.json --only firestore,auth`. La prueba comprueba proyecto y host del emulador antes de escribir. En Java 17 se utilizó firebase-tools 14.22.0.

`tests/firestore.rules.test.ts`: 19 pruebas de reglas en el emulador. Las denegaciones registradas forman parte de los casos negativos esperados.

Revisión visual de 390, 768, 1366 y 1920 píxeles sin desbordamiento horizontal. Formularios revisados con datos sintéticos.

Esto verifica almacenamiento y coherencia técnica, no la veracidad material de nombres, facturas o declaraciones. No se hicieron escrituras de prueba en la base productiva con una identidad del usuario; esa comprobación requiere una sesión autenticada.

## Kit del agente WhatsApp

El ZIP aportado usa Baileys (WhatsApp Web no oficial), un proceso Node persistente, sesión QR y SQLite local. No incluye la integración de formularios de Astrea con Firestore. Requiere adaptar autenticación, permisos, validación, idempotencia y confirmación de escrituras; no está desplegado ni conectado a un número.

La política de WhatsApp Business Platform prohíbe el uso por partidos, políticos, candidatos y campañas políticas, incluidos proveedores de servicios políticos. No se presenta Baileys como una alternativa aprobada ni como forma de eludir esa restricción. La lógica conversacional puede adaptarse a un asistente interno de Astrea.

Fuentes: https://whatsappbusiness.com/policy/ y https://github.com/WhiskeySockets/Baileys.
