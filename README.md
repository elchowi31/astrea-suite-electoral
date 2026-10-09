# Astrea Suite Electoral

Plataforma para gestionar equipos, formularios y simulaciones de Astrea y los 25 municipios del Cesar. Los registros, las estadísticas importadas y los escenarios se comparten mediante Cloud Firestore y se aíslan por organización.

## Uso

Abra [la plataforma](https://astrea-suite-electoral.vercel.app). **Crear cuenta** crea una organización propia. El administrador incorpora integrantes desde **Usuarios y accesos**; estos ingresan con el correo y contraseña asignados. Crear usuarios del equipo conserva la sesión del administrador.

Todos los integrantes activos pueden diligenciar y guardar formularios. La administración de cuentas, eliminación y consulta de electores respetan los permisos de cada rol. Un formulario se cierra después de que Firestore confirma el guardado; si hay un error, conserva los campos y permite reintentar.

Consulte [Usuarios y Firestore](docs/USUARIOS-Y-FIRESTORE.md) y [Revisión y simulación](docs/REVISION-Y-SIMULACION.md).

## Datos de la simulación

- Censo de referencia, electoras, electores y mesas: Divipole RNEC Congreso 2026.
- Población total, cabecera y rural: proyecciones DANE 2023, 2026 y 2027.
- Participación, blancos, nulos, no marcados y votos por lista: 52 boletines del preconteo territorial RNEC 2023, informativo y diferente del escrutinio definitivo.
- Curules de referencia: publicaciones RNEC 2023 para los 25 concejos y la Asamblea del Cesar.

El simulador muestra fuente, fecha y territorio. Permite importar CSV de estadísticas agregadas, ajustar supuestos, comparar, guardar, recuperar y exportar escenarios. Cada escenario conserva sus fuentes aunque luego se retiren del catálogo compartido. Los supuestos no son probabilidades de victoria y la demografía no se convierte automáticamente en preferencias políticas.

## Arquitectura y acceso

React 19, TypeScript, Vite, Firebase Authentication y Cloud Firestore. La API de Vercel verifica el token Firebase y el perfil antes de utilizar Gemini. Google Workspace utiliza OAuth individual. [Mapa territorial](docs/MAPAS-Y-RUTAS.md) ofrece Satelital HD, Calles y Google Maps, ubicación desde formularios o GPS, filtros y rutas por carretera guardadas en los vehículos. El mapa permanece visible aun sin registros georreferenciados.

Proyecto Firebase: `gen-lang-client-0498782352`. Base **nombrada**: `ai-studio-astreasuiteelect-5da3410d-4b0c-4301-8bd6-083fbb5c653b`. Interfaz, API y `firebase.json` usan la misma base. Publicar reglas de `(default)` no cambia el acceso de esta plataforma.

Las reglas publicadas están en [firestore.rules](firestore.rules). Exigen autenticación, perfil activo con `accessVersion: 2`, organización activa y pertenencia a ella. Conservan el acceso del propietario verificado. El registro público solo crea un espacio `org-{uid}` propio mediante guardado atómico; conocer el identificador de otra organización no permite ingresar en ella. Los responsables crean perfiles para UID reales sin asignar roles superiores a su autorización.

Las mutaciones relevantes incluyen auditoría atómica. Los electores requieren autorización para tratar sus datos; un integrante sin asignación puede consultar sus propios registros. Los perfiles heredados sin aprobación siguen sujetos a validación del administrador.

## Desarrollo y verificación

```bash
npm ci
npm run check
npm run dev
```

`npm run check` valida TypeScript, pruebas de cálculo y API, arranque de API compilada y compilaciones. `npm run test:rules` ejecuta las pruebas de autorización con los emuladores de Firebase (requiere Java 21). Para la interfaz local con emuladores: `VITE_FIREBASE_EMULATORS=true`, Authentication 9098 y Firestore 8088, proyecto `demo-astrea`. Esa variable no se configura en producción.

Consulte [.env.example](.env.example). `GEMINI_API_KEY` pertenece al servidor y nunca debe llevar prefijo `VITE_`. `GEMINI_MODEL` permite configurar el modelo; el valor inicial es [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), tras comprobar que el proveedor ya no admitía 2.5 Flash para esta cuenta. Los errores temporales tienen reintentos limitados y un segundo modelo, [Gemini 3.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash), configurable mediante `GEMINI_FALLBACK_MODEL`. Los fallos de credenciales no se reintentan. Las integraciones opcionales requieren credenciales y permisos del proveedor; los formularios y simulación no dependen de ellas.

## Publicación

Repositorio: [elchowi31/astrea-suite-electoral](https://github.com/elchowi31/astrea-suite-electoral). Vercel compila con `vercel.json` y sirve la interfaz y `/api` con cabeceras de seguridad. Las reglas se publican por separado en la base nombrada indicada. Los documentos de evidencia permiten reconstruir las estadísticas. Credenciales, datos originales, cachés, pruebas temporales y compilaciones están excluidos de Git.
