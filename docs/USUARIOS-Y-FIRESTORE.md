# Usuarios y formularios

## Crear la organización

En [Astrea Suite](https://astrea-suite-electoral.vercel.app), pulse **Acceder al Centro de Mando → Crear cuenta** y complete nombre, correo y contraseña. Se crea su acceso, organización y perfil administrador. Si falla el guardado, la pantalla muestra el motivo y no anuncia una cuenta utilizable sin perfil.

## Incorporar al equipo

Abra **Usuarios y accesos**. Complete nombre, correo, contraseña inicial y rol; puede asignar municipio, candidato y líder. Pulse **Crear usuario**. El integrante entra por **Iniciar sesión** con esas credenciales. **Crear cuenta** abre una organización propia.

Un responsable puede editar roles permitidos, asignaciones y estado activo. Desactivar el perfil impide acceder a los registros aunque la contraseña siga siendo válida. Solo se ofrecen roles que el responsable puede asignar. Su sesión permanece abierta después de crear integrantes.

## Diligenciar formularios

Los integrantes activos pueden guardar candidaturas, propuestas, líderes, transporte, gastos, aportes, registros territoriales, equipo y escenarios. La consulta de electores depende de la asignación; un integrante sin asignación consulta sus propios registros. La autorización de tratamiento de datos es obligatoria.

**Guardando…** indica que Firestore procesa el formulario. Se cierra al confirmar el guardado. Si hay un error, conserva los campos. Los cambios aparecen en tiempo real para cuentas autorizadas y se mantienen después de recargar o cerrar sesión. Las operaciones relevantes registran quién las realizó en auditoría.

## Simulaciones compartidas

En **Simulador electoral**, revise municipio, cargo, fuente y fecha. Puede aplicar históricos incorporados, cargar CSV y editar supuestos. **Guardar escenario** lo comparte con integrantes de su organización. Recuperarlo restablece parámetros y fuentes; retirar una fuente del catálogo no altera los escenarios guardados.

## Configuración publicada

Proyecto: `gen-lang-client-0498782352`. Base: `ai-studio-astreasuiteelect-5da3410d-4b0c-4301-8bd6-083fbb5c653b`. Las reglas probadas se publicaron el 9 de octubre de 2026 como `f3914cbd-99f2-4378-b528-c5f4cd85bc88`. Conocer el identificador de otra organización no concede acceso. El propietario verificado conserva sus permisos.
