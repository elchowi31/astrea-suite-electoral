# Referentes y mejoras de Astrea

Consulta: 7 de noviembre de 2026. Alcance: fiabilidad de formularios, operación de campo, permisos, protección de datos y experiencia de uso. Las páginas de proveedores describen sus productos; no se contrataron ni probaron sus servicios. No hay evidencia suficiente para afirmar que una plataforma sea la mejor del mercado.

## Qué conviene aprender de otras plataformas

| Referente | Capacidad documentada por el proveedor | Aplicación concreta a Astrea |
| --- | --- | --- |
| Ecanvasser | Guarda actividad de campo en el dispositivo y la sincroniza al recuperar conectividad. Su guía recomienda comprobar Auto Sync y la sincronización después del trabajo offline. | Mostrar con claridad qué está en el dispositivo, qué fue recibido por Firestore y qué requiere atención. Que exista conexión no basta para afirmar que todos los registros fueron confirmados. [Función offline](https://www.ecanvasser.com/feature/offline-canvassing), [guía móvil](https://support.ecanvasser.com/en/articles/2499368-ecanvasser-mobile-app-getting-started). |
| Qomon | Permite descargar previamente una acción y muestra disponibilidad offline. Distingue preparación, captura y reconexión; su documentación aclara que el mapa no está disponible en ese modo. | Incorporar una comprobación antes de salir a campo: aplicación y datos disponibles, sesión preparada y operaciones que necesitan red. Informar las limitaciones de mapas, API y transacciones. [Guía offline](https://help.qomon.com/en/articles/10985150-offline-mode-download-your-actions). |
| NationBuilder | Separa acceso a todos los perfiles, acceso a asignados y ausencia de acceso. Importación, exportación, actualización masiva y borrado tienen permisos propios. | Revisar autorización de cada exportación y operación masiva. Poder leer un registro no debe conceder automáticamente todas las formas de extraerlo o modificarlo. [Conjuntos de permisos](https://support.nationbuilder.com/en/articles/2362659-create-edit-or-delete-a-permission-set). |
| NGP VAN / MiniVAN | Su informe documenta estados de datos pendientes y consolidados, con vista de actividad por persona. La guía de soporte distingue la identidad de acceso de las listas asignadas. | Crear un informe de sincronización que permita rastrear cada registro sin confundir guardado local, transmisión y recepción. Facilitar soporte con versión, dispositivo y estado, sin copiar datos personales al diagnóstico. [Informe MiniVAN](https://www.ngpvan.com/wp-content/uploads/2024/10/MiniVAN-reporting.pdf), [soporte](https://supportcenter.ngpvan.com/minivan-support). |
| Qomon, consentimiento | Documenta consentimiento por finalidad y canal, avisos en captura y exportación de su registro. | Evolucionar del indicador de consentimiento a una constancia con versión del aviso, finalidad, origen, momento de aceptación y revocación. Mantener separadas las autorizaciones de Astrea y SorteApp. [Centro de consentimiento](https://help.qomon.com/en/articles/13312243-consent-management-in-qomon). |
| VOTOMAP, Colombia | Su página diferencia captura pendiente de recepción, describe revisión de posibles coincidencias y recomienda ensayar el flujo móvil completo con datos ficticios. | Probar el recorrido de extremo a extremo y revisar coincidencias antes de consolidar registros. Comparar roles en dispositivos distintos. [Alcance Colombia](https://www.votomap.com/software-electoral/colombia). |
| Control G, Colombia | Describe preparación con conexión, captura Android offline, sincronización posterior, revisión y formularios configurables con evidencias. Advierte que mapas y GPS tienen condiciones distintas. | Conservar formularios simples para la operación actual; un constructor configurable sería una ampliación posterior con validaciones y versiones, no un requisito para corregir la persistencia existente. [Operación de campo](https://www.controlg.co/). |

Las conclusiones de la última columna son propuestas de diseño propias derivadas de las capacidades descritas, no funciones ya verificadas en los productos ni garantías sobre su desempeño. Se omiten precios y comparaciones de capacidad porque requieren ofertas y ensayos equivalentes.

## Comparación con el código de Astrea

Esta revisión del repositorio identifica implementaciones, no acredita que cada flujo haya funcionado ya en producción. El inventario de formularios y el informe de pruebas de esta intervención deben aportar esa evidencia por separado. Los archivos pueden recibir correcciones durante la misma intervención; esta tabla describe las capacidades y brechas observadas al iniciar la revisión.

| Área | Evidencia local | Estado observado y criterio de cierre |
| --- | --- | --- |
| Organización y acceso individual | `firestore.rules`, `src/lib/accessPolicy.ts`, `src/lib/permissions.ts`, `src/lib/firebaseAuth.ts`. | Implementado en código. Validar perfiles activos, aislamiento entre organizaciones y denegación por rol con reglas reales o emulador. Un filtro visual no acredita autorización del servidor. |
| Escritura y auditoría | `src/lib/firebase.ts` usa lotes de registro + auditoría; `src/lib/saveVerification.ts` relee el servidor y compara campos. | Implementado para los flujos que usan esos helpers. La matriz de formularios debe comprobar que no hay handlers que únicamente modifiquen el estado React. |
| Conservación local | `src/lib/firebase.ts` configura caché persistente con varias pestañas cuando el usuario la habilita; `src/lib/deviceStorage.ts` conserva rutas y posiciones. | Implementado parcialmente. Debe comprobarse que las escrituras de formularios mantienen una cola durable y un estado comprensible durante cortes, recargas y cambios de sesión. |
| Apertura de la web sin red | `buildOfflineApp.ts` genera service worker con versión por contenido y exclusión de API/peticiones autenticadas. | Implementado. Requiere primera descarga satisfactoria; comprobar apertura y recarga offline después de preparar el dispositivo y después de una actualización. No equivale a disponer de todos los recursos externos sin internet. |
| Retroalimentación al guardar | `src/components/FormSaveStatus.tsx` bloquea envíos simultáneos y conserva errores con regiones accesibles. `saveVerification.ts` emite recibo verificado. | Implementado para formularios conectados. Falta acreditar una vista unificada que separe pendiente local, confirmado y error sin llamar guardado remoto a una escritura en cola. |
| Trabajo concurrente | `saveCommitteeTask` y stores operativos usan transacciones. | Implementado para operaciones concretas. Las transacciones que leen y reservan recursos requieren conexión; no deben convertirse en aprobaciones offline que puedan duplicar cupos o gastos. |
| Consentimiento | `GrassrootsVoter` contiene `consentGiven`, `consentAt`; reglas exigen autorización para varios registros. | Implementado para esos datos. No se identificó un centro completo de finalidades/canales, versiones del aviso y atención de revocaciones. La integración de recompensas tiene su contrato propio. |
| GPS y acceso a formularios | `DevicePersistence.tsx` mostraba un segundo paso que cerraba la sesión al rechazar el seguimiento. | Brecha de experiencia y minimización. Ofrecer continuar con formularios sin activar ubicación; el seguimiento debe conservar su autorización específica. |
| Control de calidad automático | `.github/workflows/quality.yml` ejecuta comprobaciones y pruebas de reglas/integración. | Implementado en repositorio. Confirmar la ejecución del commit publicado y no equiparar un build correcto con la prueba de cada formulario. |
| Copias y restauración | Existen exportaciones de datos y documentos de despliegue. | No se verificaron políticas de backup de Firestore, restauración ensayada ni tiempos de recuperación. Exportar una hoja no es una copia completa de la base. |
| Rendimiento y accesibilidad móvil | Interfaz React y componentes con estados accesibles; existe proyecto Android. | No se verificó cobertura completa de teclado/lector de pantalla ni capacidad concurrente bajo carga real. Requiere medición con datos ficticios representativos. |

## Orden recomendado de mejoras

### P0: integridad antes de ampliar funciones

1. **Estado de sincronización visible.** Identificar pendientes por cuenta y organización, mostrar última confirmación y errores accionables. Aceptación: capturar sin red, cerrar y volver a abrir, recuperar conexión y ver una sola escritura confirmada por registro; un rechazo de permisos conserva el dato local y muestra la causa.
2. **Preparación offline comprobable.** En “Mi dispositivo”, mostrar si la aplicación quedó descargada, si la conservación está activa y qué funciones requieren red. Aceptación: la prueba en modo avión permite abrir y completar los formularios admitidos con los datos previamente preparados; mapas o servicios externos informan su condición real.
3. **GPS opcional para formularios.** Permitir continuar sin seguimiento y activarlo más tarde. Aceptación: una cuenta puede registrar información sin conceder ubicación; rechazar GPS no termina la sesión ni concede permisos implícitos.
4. **Regresión por formulario.** Mantener la matriz formulario → handler → colección → rol → comportamiento offline. Aceptación: cada alta/edición relevante tiene evidencia del registro persistido y del rechazo esperado con una cuenta sin permiso, usando datos ficticios.

### P1: operación profesional

| Mejora | Criterio observable |
| --- | --- |
| Conflictos entre dispositivos | Dos ediciones concurrentes no silencian un conflicto; la persona entiende cuál versión se confirmó y puede revisar los cambios. Una escritura antigua en cola no debe sobrescribir inadvertidamente una revisión nueva. |
| Permisos de exportación | Cada botón y endpoint valida su autorización; se registra quién exportó y qué alcance, sin guardar el contenido completo de los datos personales en los logs. |
| Duplicados | Normalización y coincidencias por identificadores relevantes, revisión humana y conservación del origen; evitar fusiones automáticas basadas únicamente en nombres. |
| Registro de autorizaciones | Guardar finalidad, versión del aviso, momento, origen y estado; reflejar revocaciones en los usos y sistemas conectados que correspondan. |
| Respaldo y recuperación | Política activa verificada, restauración sobre un destino de prueba y tiempos medidos. Definir cuánto dato se admite perder y cuánto puede tardar la recuperación. |
| Diagnóstico sin datos sensibles | Obtener versión, conectividad, almacenamiento y errores por código; permitir compartir un diagnóstico que excluya documentos, contactos, ubicaciones, tokens y secretos. |
| Instrucciones por tarea | Ayuda breve junto al campo que produce errores y recorrido inicial que permita terminar una operación con una cuenta nueva. |

### P2: ampliaciones que requieren validación de utilidad

Constructor de formularios con versiones, evidencias y reglas; iOS si hay demanda confirmada; administración de materiales descargados; bandeja de tareas con responsable y fecha; métricas de calidad de captura. Estas funciones deben conservar aislamiento, trazabilidad y límites offline. No conviene introducir módulos nuevos antes de estabilizar y medir los actuales.

## Cómo evaluar si la app mejora

Medir con un conjunto de registros ficticios y repetir la misma secuencia después de cada versión: primera apertura con red, preparación local, corte durante edición, corte al enviar, recarga sin red, reconexión intermitente, dos pestañas, dos usuarios y dos organizaciones. Registrar:

- registros capturados, pendientes, confirmados, rechazados, perdidos y duplicados;
- tiempo entre reconexión y confirmación del último registro;
- tiempo para terminar un formulario y errores que requieren ayuda;
- consumo de almacenamiento y resultado al bloquear IndexedDB o alcanzar la cuota;
- acceso denegado por tenant/rol y ausencia de datos de otra cuenta en la interfaz;
- latencia de carga y guardado con el volumen y concurrencia esperados;
- resultado de restauración y actualización de la aplicación con pendientes.

La meta de integridad es cero registros perdidos y cero duplicados en esos ensayos, con explicación visible para toda escritura rechazada. No se publica como garantía absoluta: deben conservarse las condiciones, versión, navegador/dispositivo y evidencia del ensayo. El límite de una web suspendida o cerrada debe explicarse; la sincronización se confirma al volver a abrir o activar la aplicación, salvo que un mecanismo adicional haya sido implementado y probado.

## Alcance de la investigación

No se solicitó acceso a bases de competidores, se copiaron datos o diseños privados, ni se enviaron registros de Astrea a ellos. Las propuestas se concentran en calidad de software y operación neutral. La operación de SorteApp y WhatsApp conserva verificaciones y dependencias separadas; ninguna comparación acredita que esas integraciones externas estén activadas.
