# Revisión y simulación · 9 de octubre de 2026

## Por qué GitHub conservaba una versión antigua

La carpeta no tenía `.git`, historial ni remoto. GitHub mantenía `main` en `82bda51b2930ac55411fee67d134cf8ca2423682`, del 15 de septiembre de 2026. Había despliegues directos a Vercel posteriores: publicar en Vercel no crea commits en GitHub. Se recuperaron el historial y remoto conservando los archivos locales y se incorporó la actualización mediante [PR 1](https://github.com/elchowi31/astrea-suite-electoral/pull/1).

Había 42 archivos modificados o ausentes respecto de GitHub y nuevos archivos de API, publicación y pruebas. Diez módulos históricos ya no tenían uso en la versión local: verificador de paquetes demo, DemoDataModal, DriverBeaconModal, ProspectsElectoralView, SatelliteRadarCanvas, UniversalDataIngestionView, astreaEntrepreneursData, demoPackages, demoPersistence y telemetryService. Siguen recuperables en el historial; no se presentan como funciones activas. La aplicación actual ofrece estadísticas importables, demo aislada, formularios, equipo y escenarios compartidos. La compilación verifica que los imports actuales se resuelvan.

## Fuentes incorporadas

1. [RNEC · Divipole Congreso 2026](https://wapp.registraduria.gov.co/electoral/2026/congreso-de-la-republica/IMG/pdf/Divipole_definitiva_%20Elecciones_Congreso_2026_GEO_CITREP_Exterior_L_V_v5.pdf): 300 puestos, páginas 90–97, agregados para 25 municipios. Censo, electoras, electores y mesas. Astrea: **17.189 electores**; Cesar: **931.353**. Corresponde a la elección del 8 de marzo de 2026, no a una elección futura.
2. [DANE · Proyecciones municipales por área 2018–2042](https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/PPED-AreaMun-2018-2042_VP.xlsx): años 2023, 2026 y 2027, municipios y agregado departamental, basadas en CNPV 2018 con actualización demográfica. Astrea 2026: **22.306 habitantes**, 11.731 en cabecera y 10.575 rurales/centros poblados. Son proyecciones oficiales.
3. [RNEC · Preconteo territorial 2023](https://resultadosprec2023.registraduria.gov.co/): 52 boletines de alcaldías y concejos de los 25 municipios, gobernación y asamblea del Cesar. Se concilian censo, sufragantes, blancos, nulos, no marcados y votos por todas las listas. Astrea Alcaldía 2023: censo **16.558**, sufragantes **11.819**. Es preconteo informativo, no escrutinio definitivo. Gamarra corresponde a octubre de 2023, cuando ganó el voto en blanco, no a la repetición posterior.
4. [RNEC · Curules de concejos 2023](https://www.registraduria.gov.co/IMG/pdf/20230719_curules-concejo.pdf), páginas 11–12, y [curules de asambleas 2023](https://www.registraduria.gov.co/IMG/pdf/20230719_curules-asamblea.pdf), página 1: los 25 concejos y Asamblea del Cesar. Astrea usa **11** curules de referencia, editables para otra elección.

Son **1.073 filas agregadas**, sin cédulas de candidatos ni datos personales. `statistics-evidence.json`, `election-history-evidence.json` y `seats-evidence.json` registran procedencia y controles. La huella de curules corresponde a la transcripción revisada del PDF, no al PDF original. Los scripts `prepare-cesar-statistics.py`, `prepare-cesar-election-history.ts` y `prepare-cesar-seats.py` reconstruyen los catálogos y rechazan cobertura o totales incompletos.

## Gestionar simulaciones

1. Abra **Simulador electoral** y seleccione municipio y cargo. Gobernación, Asamblea y Cámara usan el agregado del Cesar; Alcaldía y Concejo usan el municipio.
2. Revise **Datos reales y fuentes**. Las tasas y listas iniciales proceden del histórico 2023 disponible y se proyectan sobre el censo de referencia 2026. Cámara no tiene histórico cargado: sus supuestos se editan explícitamente.
3. Abra **Gestionar estadísticas, fuentes e importaciones**, descargue la plantilla, cargue CSV, revise la vista previa e incorpore las filas. El catálogo se comparte en Firestore.
4. Otro histórico requiere censo, sufragantes, blancos, nulos, no marcados y votos por todas las listas del mismo territorio, año, cargo y fuente. Los totales deben conciliar. Use municipio `Cesar` para corporaciones departamentales.
5. Marque **Nuestra lista**, ajuste supuestos y pulse **Fijar como escenario base**. Conservador y optimista parten de la misma base: pulsarlos varias veces no acumula multiplicadores.
6. Guarde con nombre. Otro integrante del mismo equipo puede recuperar parámetros y fuentes. Exporte JSON para trasladarlo a otro navegador de la misma organización.

Las fuentes extensas se dividen en documentos pequeños. Las cargas simultáneas usan identificadores distintos. Retirar una fuente del catálogo no borra las copias conservadas por escenarios guardados.

## CSV

```text
municipio,anio,indicador,grupo,valor,cargo,fuente,url,fecha_corte
```

Admite coma o punto y coma y campos entre comillas. Conteos enteros sin separadores de miles; porcentajes con punto decimal o coma entre comillas. `fecha_corte`: `AAAA-MM-DD`; `url`: HTTPS. `grupo` identifica partido/candidatura o edad. `cargo` queda vacío para contexto demográfico o censo general y usa el nombre del selector para históricos.

Indicadores: `censo`, `poblacion`, `poblacion_urbana`, `poblacion_rural`, `electoras`, `electores`, `mesas`, `sufragantes`, `blancos`, `nulos`, `no_marcados`, `votos_partido`, `curules`, `poblacion_edad`, `pobreza_pct`, `desempleo_pct`. Las fuentes importadas se identifican como aportadas por usuarios: validar formato y totales no certifica autenticidad. Edad, pobreza y desempleo se admiten por importación; no hay cifras precargadas ni se inventan valores ausentes.

## Cálculos y verificación

Las listas deben sumar sufragantes menos blancos, nulos y no marcados. **Ajustar al total** conserva proporciones y distribuye residuos de redondeo. Alcaldía/Gobernación usan mayoría relativa. D’Hondt conserva cocientes decimales, exige superar el umbral y bloquea empates en el corte; dos curules usan cociente y residuos. El voto en blanco con mayoría absoluta bloquea la asignación. Referencia: [Constitución, artículo 263](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4125).

Los escenarios muestran consecuencias de supuestos, no intervalos estadísticos ni probabilidades de victoria. La demografía se muestra como contexto y no se convierte automáticamente en intención política.

La validación incluye TypeScript, **26 pruebas** de cálculo, API, fuentes y reglas; arranque de API compilada y compilaciones. Las reglas cubren registro atómico, rechazo de escalamiento, aislamiento de organizaciones, cuentas anónimas/inactivas/heredadas, formularios de integrantes y consentimiento/consulta propia de electores. Las pruebas de interfaz y servicio real comprueban guardados y recuperación. Las cuentas temporales se retiran al terminar.
