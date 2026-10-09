# Astrea Suite Electoral

Plataforma web multi‑tenant para dirección administrativa y operación territorial. Centraliza candidatos, líderes, votantes con consentimiento, transporte, finanzas, propuestas, documentos, Google Workspace e inteligencia asistida; todos los datos de negocio se aíslan mediante `tenantId`.

## Arquitectura

- React 19 + TypeScript + Vite, con interfaz responsive y navegación móvil.
- Firebase Authentication para sesiones verificadas.
- Cloud Firestore para datos en tiempo real, auditoría y aislamiento por organización.
- API serverless de Vercel para Gemini, protegida con ID token de Firebase y límite por usuario.
- Google Workspace por OAuth de cada usuario; no se comparten credenciales de Drive entre tenants.
- Google Maps opcional; solo muestra coordenadas registradas, nunca puntos simulados.

El espacio operativo contiene estructura, líderes, electores, transporte, mapa y proyecciones. El espacio administrativo contiene organizaciones, candidatos, finanzas, documentos, integraciones, propuestas, IA y usuarios. La visibilidad final depende del rol y de las reglas de Firestore.

## Servicios iniciales de bajo costo

La primera etapa puede funcionar con Firebase Spark, Vercel Hobby y las cuotas gratuitas disponibles de Gemini y Google Workspace APIs. Revise periódicamente cuotas y condiciones del proveedor. Google Maps es opcional y puede requerir una cuenta de facturación aun cuando el consumo quede dentro del crédito o umbral gratuito vigente.

Servicios que debe habilitar en el proyecto de Google/Firebase:

1. Authentication: Email/Password y Google.
2. Cloud Firestore en modo Native.
3. Google Forms API, Google Sheets API, Google Calendar API y Google Drive API.
4. Gemini API, si se utilizará el módulo de inteligencia.
5. Maps JavaScript API, solo si se utilizará el mapa.

## Configuración local

Requisitos: Node.js 20, 22 o 24 y npm.

```bash
npm ci
cp .env.example .env.local
npm run check
npm run dev
```

Complete las variables de `.env.local`. No suba secretos al repositorio ni exponga `GEMINI_API_KEY` con el prefijo `VITE_`.

## Firestore

La plataforma utiliza la base **nombrada** `ai-studio-astreasuiteelect-5da3410d-4b0c-4301-8bd6-083fbb5c653b` del proyecto `gen-lang-client-0498782352`, no `(default)`. La interfaz toma ese identificador de `firebase-applet-config.json`; la API usa el mismo valor, salvo una configuración explícita de `FIRESTORE_DATABASE_ID` en el servidor. Los perfiles existentes deben conservarse en esa base.

**No publique todavía los archivos locales de reglas e índices.** Son una propuesta de endurecimiento y no equivalen a la política actualmente publicada en la base nombrada. Antes de desplegarlos debe conciliar ambas políticas, comprobar los perfiles existentes y validar acceso y aislamiento en un entorno de prueba. Cambiar las reglas de `(default)` no corrige el acceso a los perfiles de la plataforma.

Las reglas actuales de producción exigen un perfil activo, la versión de acceso aprobada y pertenencia al tenant para acceder a los datos operativos. La interfaz y la API añaden comprobaciones de rol; ninguna debe sustituir las reglas de la base. Antes de producción, configure políticas de retención, copias de seguridad, aviso de privacidad y responsables de tratamiento de datos.

### Aprovisionamiento de usuarios

El registro público está deshabilitado deliberadamente. Un identificador de
tenant en una URL no prueba pertenencia a una organización. El administrador
debe crear cada cuenta e invitarla mediante un servicio confiable con Firebase
Admin SDK, y crear el perfil correspondiente en `usuarios/{uid}` con el
`tenantId`, rol y estado aprobados. Solo después de ese paso funcionarán el
inicio de sesión por correo o Google.

### Colección de presentación `demo`

Cuando un tenant todavía no tiene información operativa, un usuario autenticado puede crear desde la interfaz `demo/{tenantId}-presentacion`. El documento contiene candidatos, territorios, líderes, gastos, aportes, vehículos y votantes totalmente ficticios, identificados con prefijo `demo-` y dominios `.invalid`.

- La aplicación no mezcla demo con colecciones reales.
- Al aparecer información operativa real, la demostración se desactiva automáticamente.
- Los registros demo son de solo lectura en los módulos operativos.
- Un responsable autorizado puede usar **Eliminar demo** para borrar solamente ese documento.
- Eliminar la colección `demo` no modifica candidatos, votantes, finanzas, usuarios ni auditoría reales.

## Variables

Consulte [.env.example](./.env.example). En Vercel, `GEMINI_API_KEY`, `FIREBASE_PROJECT_ID` y `FIRESTORE_DATABASE_ID` son variables del servidor. Si no se sobrescribe el identificador de base, la API utiliza el mismo que la interfaz. Las variables `VITE_*` se incorporan al frontend durante la compilación y no deben contener secretos.

## Simulación con fuentes reales del Cesar

El simulador incorpora el censo de referencia de la Divipole del Congreso 2026
y proyecciones DANE de población por área para los 25 municipios del Cesar.
Permite importar estadísticas agregadas en CSV, aplicar históricos conciliados,
editar supuestos, comparar escenarios y guardar/exportar escenarios por
organización en el navegador. Los históricos electorales y la sincronización
entre equipos quedan pendientes de fuentes y persistencia compartida.

Consulte [la revisión y guía de simulación](docs/REVISION-Y-SIMULACION.md) para
ver diferencias con GitHub, fuentes, formato CSV y límites de los cálculos.

## Verificación del proyecto

```bash
npm run lint
npm run build
npm run start
```

Después de desplegar, valide al menos: carga pública, login, aislamiento de dos tenants, alta de líder, alta de vehículo, consentimiento de elector, gasto financiero, creación de evento Workspace, llamada de IA autenticada y comportamiento móvil.

## Despliegue en Vercel

Importe el proyecto o ejecute `vercel --prod`. Configure las variables de entorno antes de promover a producción. La aplicación usa `vercel.json` para el build de Vite, funciones `/api`, fallback SPA y cabeceras de seguridad.

## Decisiones de seguridad

- No hay autenticación anónima, perfiles simulados ni cambio de rol desde almacenamiento local.
- Los endpoints de IA exigen token Firebase válido.
- Las mutaciones relevantes escriben un evento en `/auditoria` mediante batch atómico.
- El mapa, panel e insights se calculan con datos observados del tenant y muestran falta de evidencia cuando corresponde.
- Drive se conecta por OAuth individual con alcance de archivos creados/abiertos por la aplicación.
