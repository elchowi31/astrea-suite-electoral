# Astrea Suite 1.0.6: instalación y seguimiento automático

Instale solamente **Astrea-Suite-release.apk**, en `D:\Descargas`. No instale dos APK ni el archivo AAB. Esta versión actualiza las releases anteriores y conserva su sesión, datos y decisiones de permisos. El APK debug anterior tiene otra firma; no sirve para actualizar una instalación release.

## Preparación inicial

1. Instale o actualice el APK y abra Astrea. Android requiere abrir la app y aceptar personalmente los permisos; la instalación por sí sola no concede autorizaciones.
2. En un dispositivo nuevo, elija **Permitir y guardar**. En esta actualización se conserva esa decisión.
3. En **Preparar seguimiento automático**, permita **ubicación precisa / Mientras se usa la app**. Puede mantener **las notificaciones bloqueadas**: esa elección no impide continuar ni activar el seguimiento. Cada permiso se solicita una sola vez. Si retira la ubicación después, actívela desde los ajustes de Android; Astrea no volverá a abrir el diálogo de autorización.
4. Mantenga encendida la ubicación del teléfono. En **Ajustes > Aplicaciones > Astrea Suite > Batería**, elija **Sin restricciones** y compruebe que Astrea no figure en aplicaciones en suspensión profunda.
5. Inicie sesión personalmente con su cuenta. Use **Mostrar / Ocultar** junto a la contraseña para revisar lo digitado. Una credencial incorrecta muestra un mensaje claro; una conexión lenta informa el problema y permite volver a intentar. Una vez configurada, el seguimiento queda preparado automáticamente. Solo los administradores ven **Preparado · esperando movimiento** y sus controles. No necesita iniciar cada recorrido ni recibir avisos de inicio o fin.

## Funcionamiento

- Estando quieto, no se crea un recorrido ni se acumulan posiciones en el historial.
- Un traslado se confirma con varios desplazamientos coherentes y buena precisión GPS. Los primeros metros pueden tardar en aparecer hasta confirmar movimiento. Se filtran lecturas imprecisas, saltos imposibles y posiciones antiguas.
- Los puntos nuevos se guardan cuando hay desplazamiento suficiente, con separación mínima de unos 10 segundos. El sensor de movimiento confirma actividad física para que el ruido del GPS sobre una mesa no cree traslados. La línea ámbar muestra la trayectoria registrada.
- Después de cinco minutos sin desplazamiento confirmado, el traslado se cierra con la hora del último movimiento. El seguimiento queda preparado para detectar el siguiente.
- Los recorridos y posiciones sin internet quedan en el dispositivo y se sincronizan al recuperar la conexión. No desinstale ni borre los datos mientras existan posiciones pendientes.
- La app no genera sonidos, vibraciones ni avisos emergentes de seguimiento. Si bloquea las notificaciones, Android muestra el servicio en **Aplicaciones activas**, sin su notificación en el panel habitual. Astrea sigue proporcionando la notificación requerida por el servicio; Android decide cómo mostrarla según el permiso.
- Los administradores pueden detenerlo con **Pausar seguimiento** y volver a prepararlo con **Activar seguimiento automático**. No se repiten los diálogos de permisos. Cualquier persona conserva el control de las autorizaciones de su propio teléfono desde los ajustes de Android.

## Dónde ver la trayectoria

Solo **AdminTenant** (su propia organización) y **AdminGlobal** (identidad verificada) pueden abrir **Más > Recorridos y seguimiento**, ver mapas, historial, posiciones, dispositivos o configuración. Los demás roles no tienen este panel ni pueden leer sus propios datos de seguimiento mediante la API. Su app autorizada solo registra y envía desplazamientos.

El administrador también puede abrir **Recorridos y seguimiento** desde el botón del **Mapa territorial**. Este acceso muestra datos reales, incluso si estaba consultando la demostración. El administrador global puede elegir **Equipo a supervisar** dentro del módulo, también desde el celular. Consultar otra organización no cambia la organización donde el teléfono registra su propio seguimiento.

En **Monitoreo en vivo**, seleccione una persona para ver su posición y la línea del traslado. En la lista de recorridos, **Ver seguimiento** lleva al detalle del recorrido elegido y su historial.

**Mapa territorial** muestra las ubicaciones guardadas de líderes y vehículos. **Seleccionar líder o vehículo** consulta ese registro: si tiene coordenadas, centra el mapa en su ubicación; si no las tiene, muestra **Pendiente de ubicar**. El selector funciona también con datos de prueba, que no tienen coordenadas inventadas. Para registrar una ubicación, use datos reales, elija el punto y pulse **Guardar ubicación**. La selección no guarda coordenadas automáticamente ni representa el recorrido GPS del celular.

## Transporte del día de elecciones

Todos los usuarios activos de la organización pueden abrir **Transporte** y consultar los recorridos electorales publicados: fecha, hora, vehículo, paradas, instrucciones y trazado planificado. El administrador publica una ruta previamente guardada en un vehículo. Estos recorridos se conservan separados del historial privado de los celulares. No se publican por defecto ubicaciones personales ni recorridos registrados por GPS.

## Datos de prueba para todos los perfiles

Cada usuario puede abrir **Inicio > Datos de prueba** y elegir **Cargar mis datos de prueba**, sin cambiar su rol. La demostración se adapta al cargo y al departamento y municipio de su perfil. Gobernación y asamblea tienen alcance departamental; alcaldía y concejo usan su municipio; líderes y operadores reciben ejemplos de su entorno local. Si falta el territorio del perfil, indique departamento y municipio en el control de prueba.

La interfaz habitual no muestra avisos de GPS autorizado, verificación de Firestore, identificadores internos ni una franja permanente de seguimiento. La configuración de permisos permanece en la preparación inicial y las herramientas de seguimiento quedan en los módulos exclusivos de administradores.

Cada cuenta conserva una demostración independiente con aspirantes, líderes, votantes y logística ficticios, sin coordenadas GPS inventadas. No se mezcla con los registros reales. Puede elegir **Usar datos reales**, **Ver mis datos de prueba**, regenerar o eliminar su propia copia. Los registros ficticios son de solo lectura y no conceden permisos adicionales. Si cambia el rol o el territorio del perfil, vuelva a cargar la demostración.

## Comprobación en campo

1. Deje el celular quieto y confirme que no aparece un traslado nuevo por el ruido del GPS.
2. Camine o haga un traslado real, preferiblemente al aire libre, con ubicación precisa y buena señal. Confirme que la trayectoria comienza al detectar movimiento.
3. Apague la pantalla y continúe. Compruebe desde la web que llegan nuevos puntos y que el indicador permanece silencioso.
4. Deténgase cinco minutos: el recorrido debe finalizar con la hora del último desplazamiento y quedar listo para el siguiente.
5. Pruebe un tramo sin internet y compruebe la sincronización al recuperarlo.

Android puede detener el servicio si fuerza el cierre, se pulsa **Forzar detención**, se reinicia el teléfono o se retiran permisos. En esos casos abra Astrea para reanudar la preparación automática. No se promete funcionamiento después de una detención forzada sin volver a abrirla.

## Play Protect

Una firma válida no equivale a la aprobación de Google. Si aparece el mismo aviso inicial de desarrollador poco conocido, el APK revisado ofrece **Instalar de todas formas**. Mantenga Play Protect activo. No desactive la protección si aparece una detección distinta; revise el mensaje. No necesita volver a instalar esta versión si ya se actualizó por USB.

Referencias: [permiso de notificaciones y servicios activos de Android](https://developer.android.com/develop/ui/compose/notifications/notification-permission), [canales y notificaciones silenciosas de Android](https://developer.android.com/develop/ui/views/notifications/channels), [servicios de ubicación](https://developer.android.com/develop/background-work/services/fgs/service-types), [firma y actualizaciones](https://developer.android.com/studio/publish/app-signing), [mensajes de Play Protect](https://developers.google.com/android/play-protect/warning-strings).

