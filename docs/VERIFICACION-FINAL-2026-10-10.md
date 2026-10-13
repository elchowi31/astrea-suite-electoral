# Verificación de la actualización Astrea Suite 1.0.3

## Resultado

El 10 de octubre se actualizó por USB el Samsung SM-S721B con Android 16 usando únicamente el APK release. La instalación devolvió `Success`, abrió Astrea y conservó la cuenta y permisos previamente concedidos. No se desinstaló la app ni se borraron sus datos.

- Paquete: `co.proyectosconenergia.astrea`.
- Versión: `1.0.3`, código `4`, SDK objetivo `36`.
- Última actualización comprobada: 14:57:01, hora de Colombia.
- Archivo: `D:\Descargas\Astrea-Suite-release.apk`.
- SHA-256: `6EAC326BA94C0A639A16546CCD4AB94CFC0946FADF4AF74177DB9D304C0C3CE6`.
- APK firmado y alineado: verificaciones `apksigner` y `zipalign` satisfactorias.

## Acceso y funcionamiento

El seguimiento privado queda limitado a administradores en navegación, componentes y reglas de Firestore. Los demás roles pueden registrar sus propios desplazamientos autorizados, pero no consultar recorridos, posiciones ni dispositivos mediante la API. La configuración inicial informa del propósito y solicita los permisos una vez.

El filtro de movimiento utiliza GPS y el sensor de aceleración lineal. El servicio y sensor continuaron activos tras la actualización: Android confirmó servicio de ubicación en primer plano, muestreo a 10 Hz y canal silencioso con importancia baja, sin sonido, vibración, luces ni insignia. La comprobación en reposo y sus límites se describen en `PRUEBA-SAMSUNG-2026-10-10.md`. Queda pendiente un traslado físico con la versión final, pantalla apagada y un tramo sin internet.

Los recorridos publicados para transporte del día de elecciones tienen una colección independiente accesible a los miembros activos de la organización. No permiten leer seguimiento privado ni publicar posiciones personales.

Todos los roles pueden cargar una demostración personal correspondiente a su cargo y territorio. Se probó la carga desde el Samsung con el perfil conectado: apareció **Datos de prueba · 100% ficticios**, con el entorno **Alcaldía · Cesar · Astrea**. Se regresó a los datos reales y quedó disponible la copia de prueba. No se generaron coordenadas ni historial GPS ficticios.

## Limpieza visual

Se retiraron de las pantallas habituales el bloque de GPS autorizado, el botón y modal de Verificar Firestore, la franja fija de seguimiento y el identificador de aislamiento de la organización. La opción **Datos de prueba** se presenta plegada en Inicio. Las herramientas de administración y la preparación inicial conservan las acciones necesarias.

## Validaciones

- Comprobación completa de TypeScript, pruebas, API y compilación: exit 0; **83 pruebas aprobadas**, sin fallos. Las 17 pruebas de reglas se omiten en este comando porque requieren el emulador.
- Emulador de Firestore: **17 pruebas aprobadas**, sin fallos. Incluyen todos los roles de demostración, propiedad, territorio, organización, prohibición de lectura del seguimiento privado y lectura de transporte electoral.
- Después de la limpieza visual: TypeScript aprobado y compilaciones Android/web satisfactorias. Se inspeccionó visualmente la nueva pantalla de Inicio en el Samsung.
- Reglas de Firestore desplegadas correctamente en la base configurada del proyecto `gen-lang-client-0498782352`.
- Despliegue web final de producción: `dpl_7qCbJ3oUb9J1AvHbo36AUQNnPT1J`, estado `READY`, con alias `https://astrea-suite-electoral.vercel.app`.
- Web y `/api/health`: HTTP 200; la API respondió estado `ok`.
- Consulta de errores AndroidRuntime, Capacitor y Chromium durante la apertura final: sin mensajes de error en la muestra revisada.

Se conserva la firma de release para futuras actualizaciones. La instalación por USB no equivale a aprobación de Google Play Protect. Solo se debe distribuir el APK release; no las claves de firma ni los archivos privados del entorno de compilación.
