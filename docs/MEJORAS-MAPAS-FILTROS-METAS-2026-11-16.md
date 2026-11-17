# Mapas, filtros territoriales y metas de candidatura

## Plan aplicado

1. Rastrear el selector de archivos desde Ubicaciones hasta la lectura del archivo y su guardado. Comprobar el modo de datos, permisos, geometrías y reglas de acceso.
2. Habilitar la apertura y vista previa de KML en datos de prueba. Separar la vista previa del guardado real y conservar el archivo al cambiar de modo.
3. Aplicar filtros comunes a toda la Base territorial: departamento, municipio, candidatura y equipo, líder y sector.
4. Separar la meta general de cada candidatura de la suma de metas de sus líderes. Añadir edición directa y comparación con déficit, coincidencia o exceso.
5. Verificar el guardado y la recarga con datos ficticios, una lectura desde un cliente independiente y los controles automáticos del código final.
6. Publicar web y Android 1.3.2, conservando la firma de actualización, una versión anterior y la configuración gratuita existente.

## Diagnóstico y cambios

### Archivo geográfico

El campo estaba deshabilitado cuando Ubicaciones mostraba datos de prueba. Por eso un clic no abría el selector y no había una explicación dentro del panel.

El selector ahora permite abrir y revisar archivos en ese modo. «Ver en mapa sin guardar» dibuja las geometrías localmente. «Usar datos reales» conserva el contenido y nombre seleccionados en un borrador temporal, separado por cuenta, rol y organización. Este borrador se consume al restaurar el panel; no se persiste en el almacenamiento del navegador ni en la nube por el cambio de modo. Es necesario pulsar «Importar y guardar» para persistir la capa.

El cambio de modo reinicia el contenedor operativo de la aplicación. La prueba detectó que ese reinicio también perdía el archivo; el borrador se mantiene por encima de ese contenedor. Se conserva el reinicio que separa datos reales y de prueba.

El usuario ve el estado del procesamiento y los errores. Los perfiles sin permiso de operación pueden previsualizar, pero no guardar. Se mantienen KML, KMZ, CSV, XLSX y XLS, sus límites existentes y el guardado autorizado por organización. No se cambian reglas de Firestore.

### Base territorial

«Filtros» está en la cinta superior. Todos sus criterios se intersectan y actualizan los indicadores, pirámide, sectores, padrón y exportación. Las opciones provienen de los datos del ámbito autorizado; no consultan ni amplían otras organizaciones. Cambiar departamento o municipio reinicia los filtros inferiores; cambiar candidatura o sector reinicia la selección de líder.

Las candidaturas de apoyo se relacionan mediante «Candidatura superior». Se conserva el contexto de esas relaciones al filtrar por líder. Los registros personales de una candidatura o de sus equipos vinculados se cuentan una vez, sin añadir nuevamente los compromisos declarados. Una asignación nominal de candidatura tiene prioridad sobre una asociación indirecta por líder.

Las metas por sector proceden de metas registradas de líderes. Se retiraron los valores fijos que estimaban cincuenta votos por líder y cien por sector. No se infieren alianzas por compartir municipio ni se presenta una lista de Asamblea si el filtro no contiene candidaturas de ese nivel.

### Líderes y metas

Seleccione el equipo en la cinta y pulse «Editar meta». El diálogo identifica la candidatura y edita únicamente su meta general, usando el guardado con auditoría, comprobación y protección contra cambios concurrentes existente.

La tarjeta muestra esa meta general, separada de los compromisos reportados y de las metas individuales. El aviso compara la suma de metas de líderes con la meta general y muestra el número de votos faltantes o excedentes. El avance reportado se calcula contra la meta general seleccionada; la barra visual no rebasa su contenedor.

Cada líder cuenta una sola vez, tanto si está asignado directamente como si pertenece a una candidatura de apoyo vinculada. No se añaden también las metas propias de esas candidaturas, porque incluirían de nuevo equipos ya contados. Sus metas independientes se comparan al seleccionarlas. Las relaciones circulares no duplican líderes ni bloquean el cálculo. Los vínculos con otra organización quedan fuera.

Los líderes sin una candidatura visible asignada se señalan expresamente. Su ficha permite editar «Candidatura asignada»; el formulario de nuevo líder también ofrece esa selección. Para vincular candidaturas se utiliza Candidaturas → Editar → Candidatura superior. El selector «Todos los equipos» mantiene la lectura agregada y la identifica como suma de metas de líderes.

## Validación

- Pruebas del cálculo: meta general independiente, apoyos explícitos, duplicados, ciclos, aislamiento de organización y filtros intersectados.
- Recorrido con navegador y emuladores: clic real del selector de archivos, KML con punto/ruta/polígono, dibujo local, cambio a datos reales sin volver a elegir el archivo, guardado y reapertura tras recargar.
- Filtros de departamento, municipio, candidatura, líder y sector comprobados sobre indicadores, pirámide, padrón y CSV exportado.
- Edición manual comprobada con meta general 1000 y equipo 750: faltan 250. Con meta 500: excedente de 250. Con meta 750: coincidencia. Reapertura comprobada tras recargar.
- Recorridos de escritorio de 1010 px y móvil de 335 px sin desbordamiento general. Cinta de navegación de 45 px.
- Prueba de persistencia añadida: la meta general cambia y las metas de líderes y candidatura de apoyo permanecen intactas; un cliente independiente lee el KML y los valores guardados. Se comprueba rechazo de una edición obsoleta y una meta fraccionaria.

La entrega registra las ejecuciones automáticas, identificadores de despliegue y huellas del instalador definitivos. No se afirma una prueba física del selector de archivos en un teléfono Android. Se mantiene el plan gratuito y las funciones facturadas aplazadas previamente por el usuario.
