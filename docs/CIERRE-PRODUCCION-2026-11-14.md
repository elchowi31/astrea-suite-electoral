# Astrea 1.2.1 — cierre de mejoras del 14 de noviembre

[Aplicación en producción](https://astrea-suite-electoral.vercel.app) · [Instalador Android firmado](https://github.com/elchowi31/astrea-suite-electoral/releases/download/v1.2.1/Astrea-Suite-release.apk) · [Plan ejecutado](PLAN-MEJORAS-2026-11-12.md)

## Resultado por área

| Área | Resultado implementado |
| --- | --- |
| Navegación | Siete espacios principales, subnavegación por rol, administración y otros proyectos separados. Teclado, retorno interior y entre módulos, y ancho de 335 px comprobados. |
| Finanzas | Resumen compartido de dinero, especie, pagos y compromisos; gastos detallados dentro de Finanzas; forma de liquidación explícita. El saldo registrado no se presenta como conciliación bancaria. |
| Calidad de datos | Coincidencias por documento dentro de la organización, búsqueda y paginación. Autorización o retiro con constancia y auditoría; sin fusiones automáticas. |
| Recuperación | Respaldo operativo seleccionado, vista previa, recuperación solo de faltantes y protección contra sobrescrituras simultáneas. Restauración y lectura posterior verificadas en la base real. |
| Operación | Solicitudes, eventos, transporte y testigos bajo un espacio común; transacciones y límites de cupos existentes conservados y probados. |
| Testigos y actas | Asignación por mesa y elección, incidencia, foto, captura manual de hasta treinta líneas, revisión humana y consolidación privada de evidencias revisadas. No representa resultados oficiales. |
| Análisis y documentos | Espacios comunes y límites de los indicadores aclarados. Métricas de guardados y errores de la sesión, sin contenido personal ni resultados de productividad inventados. |
| Seguridad | Permisos de solo consulta coherentes, sesión Google aislada por cuenta y organización, borrado local completo, límites de webhooks y cuota de IA compartida. Errores y resultados parciales visibles. |
| WhatsApp | Conector abierto Baileys conservado; diagnóstico sin texto de mensajes ni respuestas. La recepción por pestaña se distingue del kit externo y de un servicio continuo 24/7. |
| Android | Versión 1.2.1, código 11, certificado existente, alineación y descarga del paquete comprobados. |

## Evidencia de publicación

- Aplicación: commit `2ac0b5c0cacdda5c68a3a59a24d18685e7b4440b`; despliegue Vercel `dpl_28QTjjBEhcWDJooMaci7TDrxSwgW`, entorno de producción. El endpoint de salud devuelve ese mismo commit.
- [Control de calidad del mismo commit](https://github.com/elchowi31/astrea-suite-electoral/actions/runs/43626144598): tipos, pruebas generales, runtime de API y compilación; integración con Auth/Firestore, 93 pruebas correctas sin omisiones.
- [Cambios principales](https://github.com/elchowi31/astrea-suite-electoral/pull/23) y [compatibilidad con el servicio real](https://github.com/elchowi31/astrea-suite-electoral/pull/24), integrados en main.
- Reglas reales cotejadas con la fuente probada: `8545d995-bd0f-4f13-9372-aa730f20ca0b`; SHA-256 normalizado `f67ab085d94804195203b3b85fdc11bd3d8d99d2f197fa434324afade0ff10e1`. Versión previa conservada para reversión.
- Doce listas principales cargadas desde el servicio real, sin errores ni aviso de resultados incompletos, con la cuenta ficticia de comprobación. La prueba detectó que el servicio rechaza límites superiores a 10.000 aunque el emulador los aceptaba; el límite final es 10.000 y alcanzar ese valor activa un aviso conservador de alcance parcial.
- Pruebas reales: restaurar un registro ficticio eliminado, comprobarlo mediante lectura de servidor, conservar existentes, rechazar sobrescritura, capturar y revisar treinta líneas y limitar solicitudes concurrentes. API sin sesión: 401; otra organización: 403.
- Interfaz en dominio público: doce suscripciones listas, teclado y foco del menú, recorrido de regreso, móvil de 335 px y escritorio; guardado y revisión de acta, descarga y vista previa de respaldo; retirada de datos locales y cierre de sesión. Sin errores de página.
- Datos de comprobación retirados: 61 documentos ficticios y recibos, además del perfil, la organización y la cuenta de autenticación.
- Reversión disponible al despliegue previo `dpl_99CRThQMS4RmQV1SDQJSqSnu3BDw`. Los cambios originales del espacio map-work se conservaron.

## Límites acordados

Se conserva el plan gratuito por decisión del usuario: borrado automático TTL y recuperación histórica PITR quedan pendientes. No se vinculó facturación. La protección contra eliminación de la base sí está activa. Los respaldos operativos no incluyen cuentas, credenciales, auditoría, sesiones ni binarios externos y no sustituyen una copia completa de Firestore.

No se publicaron tarifas comerciales hipotéticas como aprobadas. La medición acumulada de adopción, tiempos, ahorro y disposición a pagar requiere observación real posterior; no se inventaron pilotos ni resultados de noventa días. La prueba del kit de WhatsApp acredita su transporte independiente, no una integración externa continua en producción.

[Controles y capacidad del plan gratuito](CONTROLES-PRODUCCION-2026-11-14.md).
