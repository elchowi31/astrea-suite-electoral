# Revisión de archivos y simulación · 9 de octubre de 2026

## Por qué GitHub conservaba una versión antigua

La carpeta de trabajo no tenía `.git`, historial ni remoto. GitHub mantenía
`main` en `82bda51b2930ac55411fee67d134cf8ca2423682`, del 15 de septiembre de
2026. La documentación local registra despliegues directos a Vercel de una
versión posterior. Publicar archivos a Vercel no crea commits en GitHub.

Antes de esta revisión había 42 archivos modificados o ausentes respecto de
GitHub, además de archivos nuevos de API, despliegue y pruebas. Se recuperó
el historial y el remoto sin sobrescribir los archivos de trabajo. Los cambios
se preparan en `codex/cesar-data-simulation` para revisión; no se reemplaza
automáticamente `main` ni se publica producción.

## Archivos presentes y módulos ausentes

La versión local pasó inicialmente TypeScript y sus nueve pruebas existentes.
Esto confirma que sus imports actuales se resuelven; no confirma que conserve
todas las funciones históricas ni los flujos externos autenticados.

Diez archivos presentes en GitHub ya estaban ausentes de la carpeta:

| Archivo | Función histórica |
| --- | --- |
| `scripts/verify-demo-packages.ts` | Verificación de paquetes demo |
| `src/components/DemoDataModal.tsx` | Gestión histórica de paquetes demo |
| `src/components/DriverBeaconModal.tsx` | Seguimiento de conductores |
| `src/components/ProspectsElectoralView.tsx` | Prospectos |
| `src/components/SatelliteRadarCanvas.tsx` | Radar visual |
| `src/components/UniversalDataIngestionView.tsx` | Importación universal |
| `src/data/astreaEntrepreneursData.ts` | Catálogo histórico de emprendedores |
| `src/data/demoPackages.ts` | Paquetes demo |
| `src/lib/demoPersistence.ts` | Persistencia histórica de demo |
| `src/lib/telemetryService.ts` | Telemetría |

Permanecen recuperables en el historial de Git. Esta actualización añade
importación de estadísticas agregadas y escenarios; no declara restaurados
prospectos, telemetría ni la importación histórica de datos personales.

## Fuentes realmente incorporadas

1. [RNEC · Divipole definitiva Congreso 2026](https://wapp.registraduria.gov.co/electoral/2026/congreso-de-la-republica/IMG/pdf/Divipole_definitiva_%20Elecciones_Congreso_2026_GEO_CITREP_Exterior_L_V_v5.pdf).
   Se sumaron 300 puestos del Cesar, páginas 90–97, para 25 municipios.
   Incluye censo, electoras, electores y mesas. Astrea: **17.189 electores**;
   Cesar: **931.353**. El documento corresponde a la elección del 8 de marzo
   de 2026; su tabla no declara una fecha adicional de corte. No se presenta
   como censo vigente para una elección futura.
2. [DANE · Proyecciones municipales de población por área 2018–2042](https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/PPED-AreaMun-2018-2042_VP.xlsx),
   publicado en la página de proyecciones el 8 de agosto de 2025, basado en
   CNPV 2018 con actualización demográfica. Se incorporaron 2023, 2026 y
   2027 para los 25 municipios y el agregado departamental. Astrea 2026:
   **22.306 habitantes**, 11.731 en cabecera y 10.575 rurales/centros poblados.
   Son proyecciones oficiales de población, no conteos del censo electoral.

El archivo `statistics-evidence.json` conserva las huellas SHA-256 de los
documentos y los controles de extracción. `scripts/prepare-cesar-statistics.py`
permite reconstruir el catálogo con Python, `pypdf` y `openpyxl`. Los originales
y la caché quedan excluidos de Git. Si cambia el formato del PDF, la extracción
debe revisarse; las comprobaciones impiden aceptar una cobertura incompleta.

## Cómo gestionar la simulación

1. Abra **Simulador electoral** y seleccione municipio y cargo. Gobernación,
   Asamblea y Cámara utilizan el agregado del Cesar; Alcaldía y Concejo usan
   el municipio.
2. Revise **Datos reales y fuentes** y pulse **Usar censo de referencia**.
   Cambiar el año de población no cambia silenciosamente el censo ya aplicado.
3. Abra **Gestionar estadísticas, fuentes e importaciones**. Descargue la
   plantilla, cargue el CSV y revise sus primeras filas antes de incorporarlo.
4. Para usar un histórico, cargue censo, sufragantes, blancos, nulos, no
   marcados y votos por lista/candidatura del mismo territorio, año, cargo y
   fuente. El sistema exige que todos los totales concilien. Use una fila con
   municipio `Cesar` cuando el resultado sea departamental.
5. Aplique el histórico como base. Sus tasas de participación y proporciones
   de votos se proyectan sobre el censo de referencia disponible. Seleccione
   **Nuestra lista**, ajuste parámetros y pulse **Fijar como escenario base**.
6. Compare escenarios. Conservador y optimista usan supuestos explícitos
   desde la misma base; pulsar varias veces no acumula multiplicadores.
7. Guarde un nombre y recupere el escenario después. Exporte JSON para
   trasladar parámetros y fuentes a otro navegador de la misma organización.

## Formato CSV

Columnas obligatorias, en este orden:

```text
municipio,anio,indicador,grupo,valor,cargo,fuente,url,fecha_corte
```

Se admiten coma o punto y coma como delimitadores y campos entre comillas.
Los valores de conteo son enteros sin separadores de miles. Los porcentajes
usan punto decimal o coma dentro de un campo entre comillas.

Indicadores: `censo`, `poblacion`, `poblacion_urbana`, `poblacion_rural`,
`electoras`, `electores`, `mesas`, `sufragantes`, `blancos`, `nulos`,
`no_marcados`, `votos_partido`, `poblacion_edad`, `pobreza_pct`, `desempleo_pct`.
El campo `grupo` se usa para partidos/candidaturas o grupos de edad; los otros
indicadores requieren un total. `cargo` queda vacío para contexto demográfico
o censo general y usa el nombre del selector para resultados históricos.
`fecha_corte` usa `AAAA-MM-DD`; `url` requiere HTTPS. Cada fuente aportada
permanece identificada como pendiente de verificación, aunque su enlace sea
oficial.

## Cálculos y límites

- No se asignan curules si los votos por listas no concilian con sufragantes
  menos blancos, nulos y no marcados. **Ajustar al total** conserva proporciones
  y reparte los residuos de redondeo.
- Alcaldía/Gobernación usan mayoría relativa; no tienen un umbral ficticio
  del 40%. D'Hondt conserva los cocientes decimales y bloquea empates en el
  corte. La excepción de dos curules utiliza cociente y residuos. Referencia:
  [Constitución, artículo 263](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4125).
- No se calcula una cifra repartidora a partir del censo solamente. Requiere
  votos por todas las listas. Las curules iniciales del selector son una
  referencia editable y deben confirmarse por corporación y año.
- Los escenarios no son intervalos estadísticos ni probabilidades de victoria.
  La demografía no se transforma automáticamente en preferencias políticas.
- **Pendiente de fuentes**: resultados definitivos por lista y candidato,
  participación histórica, grupos de edad, pobreza y desempleo. Se pueden
  importar; no se rellenan con cifras inventadas. Los datos electorales de
  presentación y otros catálogos heredados siguen siendo ficticios o supuestos
  donde así se indica.
- El guardado es local por organización. Falta sincronización de escenarios
  entre usuarios/equipos mediante una colección y reglas de acceso validadas.
  Las reglas locales de Firestore siguen pendientes de conciliación con
  producción y no se despliegan en esta revisión.

## Verificación de esta actualización

- TypeScript, 17 pruebas automatizadas, arranque de la API compilada y
  compilaciones de frontend/servidor completados con `npm run check`.
- Interfaz local verificada en escritorio (1440 px) y móvil (390 px), sin
  errores de ejecución observados ni desbordamiento horizontal de la página.
- Comprobados: escenarios repetidos sin acumulación, guardar/recuperar,
  censo departamental correcto, bloqueo de exportaciones inconsistentes e
  importación/aplicación de un histórico de prueba claramente identificado.
- El flujo de prueba usa estadísticas públicas y un espacio de presentación
  local; no escribe en Firebase ni prueba sesiones autenticadas de producción.
