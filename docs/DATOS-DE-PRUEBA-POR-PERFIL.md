# Datos de prueba por perfil y territorio

Todos los roles de una cuenta activa pueden cargar, regenerar, consultar y retirar su propia demostración. No se cambian el rol, las asignaciones reales ni las autorizaciones de la cuenta.

| Perfil | Ejemplos y cobertura |
| --- | --- |
| Gobernador | Aspirante a gobernación, asamblea y equipos municipales del departamento |
| Diputado | Aspirante a asamblea y equipos municipales del departamento, sin candidaturas a gobernación |
| Alcalde | Aspirante a alcaldía, concejo, líderes y logística del municipio |
| Concejal | Aspirante a concejo, líderes, votantes y logística del municipio |
| Líder, supervisor, operador | Equipo local y votantes ligados a un líder de demostración en su municipio |
| Administradores | Estructura departamental de la organización |
| Jefe político, consulta, invitado | Ejemplos municipales acordes con el nivel electoral registrado en el perfil |

Se usan exclusivamente municipios del departamento indicado, y barrios/veredas de ese municipio cuando figuran en el catálogo local. Si un territorio todavía no está catalogado, se conserva el departamento y municipio del perfil y se nombran los sectores como ficticios. No se sustituye por Cesar ni se inventan coordenadas o recorridos GPS. Las cifras son ilustrativas; no representan censos oficiales, votos reales, aportes recibidos ni personas existentes.

La copia personal está en `/demo/{tenantId}--demo--{uid}`. Cada usuario activo de esa organización puede administrar únicamente su copia. Las reglas vinculan propietario, rol y territorio al perfil almacenado. Los documentos compartidos anteriores de presentación no se convierten en datos operativos ni se eliminan durante la actualización.

El botón de carga está disponible incluso si hay información real. **Usar datos reales** y **Ver mis datos de prueba** cambian la vista sin mezclar ambos conjuntos. **Eliminar mis datos de prueba** retira únicamente la copia personal. Los formularios operativos deben utilizarse después de volver a los datos reales. Un cambio de rol o de territorio hace necesario regenerar la demostración.

La demostración conserva la restricción de seguimiento privado: solo administradores pueden consultar recorridos personales y dispositivos. Todos los miembros activos pueden consultar los recorridos de transporte publicados para el día de las elecciones.
