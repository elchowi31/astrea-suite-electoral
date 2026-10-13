# App nativa Android, monitoreo en vivo y publicación en Google Play

Desarrollo: **Wilson José Arias** · Proyectos con Energía · 10 de octubre de 2026.

## Una sola plataforma, dos formas de abrirla

La web (Vercel) y la app Android usan **el mismo código y la misma base de datos Firestore**. Todo lo que se registra en una aparece al instante en la otra: recorridos, posiciones, líderes, gastos. No hay que sincronizar nada a mano.

| | Navegador (web) | App instalada (Android) |
|---|---|---|
| Rastreo con Astrea abierta | Sí | Sí |
| Rastreo con pantalla apagada o app minimizada | No garantizado | **Sí**, con notificación visible «Astrea · Ruta…» |
| Envío en segundo plano | — | HTTP nativo a Firestore (Android no lo frena tras 5 min) |
| Permiso de ubicación | Una vez por navegador | Una vez por teléfono |
| Actualizaciones | Inmediatas al publicar en Vercel | Nueva versión en Play Store (o APK) |
| Inicio de sesión con Google | Sí | No (correo y contraseña) |

## Monitoreo en tiempo real

- Cada posición se guarda en `puntos_recorrido` (historial) y actualiza `posiciones_actuales/{organización--usuario}` (último punto). Los coordinadores ven el panel **Recorridos › Monitoreo en vivo**, que Firestore actualiza solo.
- Estados: **En vivo** (< 90 s), **Demorado** (< 5 min), **Sin señal** (> 5 min). Alerta roja para recorridos en curso sin reporte.
- Se muestran precisión, velocidad, batería y origen (navegador o app).

## Invitación por número celular

En cada recorrido, **Enviar por WhatsApp** o **Enviar por SMS** abre un mensaje al celular registrado en el perfil del integrante con el enlace y las instrucciones. El integrante inicia sesión y acepta la ubicación en su teléfono.

Astrea **no localiza un número sin que la persona instale o abra la app y autorice la ubicación**. La ubicación de una línea por la red del operador solo la entregan los operadores a autoridades con orden judicial. Los servicios que prometen ubicar cualquier número suelen ser fraudes o ilegales. Rastrear a una persona sin su autorización vulnera la Ley 1581 de 2012 (datos personales). Por eso el seguimiento exige consentimiento, se limita a recorridos asignados y el integrante puede pausarlo.

## Generar la app Android

En este equipo ya está todo instalado en `D:\AstreaAndroid` (Java 21, SDK de Android 16 y caché de Gradle; fuera del disco C:, que tiene poco espacio). Para compilar un APK nuevo después de cambiar el código:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\android-apk.ps1
```

El resultado queda en `Astrea-Suite-debug.apk` en la raíz del proyecto. En otro computador, ejecute primero `scripts\android-tools.ps1` (instala Java 21 y el SDK sin permisos de administrador) y luego `npm install` y `npm run android:init`.

Si prefiere el editor gráfico, instale Android Studio y abra la carpeta `android/` (`npm run android:open`); reutiliza el mismo SDK.

Alternativa sin instalar nada: mueva `docs/github-actions/android-apk.yml` a `.github/workflows/`, súbalo a GitHub y ejecute **Actions › Android APK › Run workflow**. El APK de prueba queda en *Artifacts*.

Para instalar el APK de prueba: copiarlo al celular, abrirlo y permitir «instalar apps de origen desconocido».

### Configuración del celular de cada integrante

1. Ubicación: **Mientras se usa la app** + ubicación precisa. El servicio visible de ubicación continúa el recorrido iniciado con Astrea abierta. Esta versión no solicita «Permitir siempre».
2. Notificaciones: permitir (la notificación indica que el recorrido se está registrando).
3. Batería: *Ajustes › Apps › Astrea › Batería › Sin restricciones*. En Xiaomi, Huawei, Oppo y Samsung este paso es indispensable o el sistema cierra la app.

### Versión firmada para distribución

```powershell
powershell -ExecutionPolicy Bypass -File scripts\android-apk.ps1 -Variant Release -OutputDirectory D:\Descargas
# AAB para cargar en Play Console (no se instala directamente):
powershell -ExecutionPolicy Bypass -File scripts\android-apk.ps1 -Variant Release -Bundle -OutputDirectory D:\Descargas
```

La firma se crea una sola vez en `D:\AstreaAndroid\signing` y se reutiliza. La contraseña está protegida para el usuario de Windows; `android/keystore.properties` tiene permisos restringidos y está excluido de Git y Vercel. Conserve un respaldo privado de la clave y de ese archivo de propiedades para recuperarlos en otro equipo. Los comandos verifican la firma y generan un archivo SHA-256 del paquete.

La versión release utiliza una firma distinta de la debug. Android no permite actualizar una instalación debug con el APK release. Si hay posiciones GPS pendientes, sincronícelas antes de migrar; si desea conservar la instalación actual, use el nuevo APK debug firmado con la misma clave de prueba.

Play Protect puede seguir mostrando la advertencia de desarrollador desconocido. Firmar no equivale a que Google haya aprobado la app. Para una distribución estable, registre el desarrollador y tramite la revisión en Google Play. Si Google la clasifica erróneamente, use su [formulario oficial de apelación](https://support.google.com/googleplay/android-developer/answer/2992033).

## Publicar en Google Play

- Cuenta de desarrollador: **US$25, pago único**.
- Cuentas **personales** creadas después del 13/11/2023: prueba cerrada con **12 testers durante 14 días seguidos** antes de producción. Una cuenta de **organización** (requiere D-U-N-S, gratuito) evita ese requisito según la experiencia habitual; confírmelo en Play Console.
- Declaración del **servicio en primer plano de ubicación** (App content): descripción, impacto si se interrumpe, enlace a un video que muestre al usuario iniciando el recorrido y caso de uso «compartir ubicación iniciado por el usuario».
- Política de privacidad pública (URL) que explique el uso de la ubicación.
- Firma: generar una clave de carga (Android Studio › Build › Generate Signed Bundle) y **guardarla con copia de seguridad**; sin ella no se pueden publicar actualizaciones.
- El identificador `co.proyectosconenergia.astrea` (en `capacitor.config.ts`) es permanente una vez publicado: cámbielo antes si prefiere otro.

iPhone (App Store): cuenta de Apple Developer US$99 al año y un Mac para compilar. El código ya es compatible (`npx cap add ios`).

## Costos de operación (Firestore)

Cada integrante en recorrido escribe ~2 documentos cada 10 s (historial + posición en vivo): unas 5.800 escrituras por jornada de 8 h. La cuota gratuita diaria de Firestore cubre pocos integrantes; con el plan Blaze el costo es de centavos de dólar por integrante al día. Revise la tarifa vigente en la consola de Firebase.
