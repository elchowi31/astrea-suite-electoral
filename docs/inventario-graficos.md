# Inventario de gráficos de Astrea

Actualizado: 13 de octubre de 2026. 32 visualizaciones, incluidas 10 minibarras de saldo por rubro. El inventario también está disponible dentro de **Datos de prueba → Inventario de gráficos** y muestra si cada fuente tiene registros.

Se conserva la línea gráfica oscura. Las categorías tienen colores diferentes y estables; las series de estado mantienen un significado consistente. Las tablas y porcentajes de progreso no se contabilizan como gráficos adicionales.

| # | Módulo | Visualización | Tipo |
|---|---|---|---|
| 1 | Inicio | Validaciones por fecha de registro | Minigráfico |
| 2 | Inicio | Registros asociados al indicador de metas | Minigráfico |
| 3 | Inicio | Costo por registro validado por fecha | Minigráfico |
| 4 | Inicio | Gasto total por fecha | Minigráfico |
| 5 | Inicio | Metas, reportes y validación por líder o aspirante | Barras agrupadas |
| 6 | Inicio | Altas y validación actual por fecha | Áreas |
| 7 | Inicio | Costos por recurso | Barras por categoría |
| 8 | Inicio · indicadores | Salud operativa | Indicador circular |
| 9 | Control administrativo | Gastos pagados por fecha | Minigráfico |
| 10 | Control administrativo | Gastos pendientes por fecha | Minigráfico |
| 11 | Control administrativo | Gastos aprobados por pagar por fecha | Minigráfico |
| 12 | Control administrativo | Pendientes de pago por fecha y estado | Áreas apiladas |
| 13 | Control administrativo | Gastos por estado o fase | Barras por categoría |
| 14 | Transporte | Personas sin cupo, asignadas y llegadas | Barras apiladas |
| 15 | Transporte | Meta frente a embarcados y comando sin transporte | Barras agrupadas y apiladas |
| 16 | Solicitudes | Necesidades presupuestadas por recurso | Barras por categoría |
| 17 | Desempeño territorial | Metas y compromisos por municipio | Barras agrupadas |
| 18 | Desempeño territorial | Gasto por componente en el territorio seleccionado | Dona |
| 19 | Finanzas | Aportes frente a gastos por rubro | Barras agrupadas |
| 20 | Finanzas | Aportes en efectivo y por clase de especie | Dona |
| 21 | Finanzas | Evolución conjunta de aportes y gastos | Áreas |
| 22 | Simulador estadístico | Resultados del escenario por lista | Barras por lista |
| 23 | Finanzas | Saldo o déficit · Transporte y Movilización | Minibarra de saldo |
| 24 | Finanzas | Saldo o déficit · Alimentación y Refrigerios | Minibarra de saldo |
| 25 | Finanzas | Saldo o déficit · Combustible | Minibarra de saldo |
| 26 | Finanzas | Saldo o déficit · Sedes y Logística | Minibarra de saldo |
| 27 | Finanzas | Saldo o déficit · Material Impreso y Camisetas | Minibarra de saldo |
| 28 | Finanzas | Saldo o déficit · Publicidad y Propaganda | Minibarra de saldo |
| 29 | Finanzas | Saldo o déficit · Eventos, Mítines y Tarimas | Minibarra de saldo |
| 30 | Finanzas | Saldo o déficit · Honorarios y Testigos Electorales | Minibarra de saldo |
| 31 | Finanzas | Saldo o déficit · Tecnología y Asesoría Jurídica | Minibarra de saldo |
| 32 | Finanzas | Saldo o déficit · Caja Menor e Imprevistos | Minibarra de saldo |

## Datos y alcance

Los escenarios personales generan líderes, aspirantes, personas, gastos, aportes de siete tipos, diez rubros financieros, solicitudes de los catorce recursos, vehículos, jornadas, viajes, planillas, comités y tareas. Los gráficos leen esas mismas fichas editables: los cambios se guardan en Firestore y persisten al volver a entrar. Los filtros pueden dejar una vista sin datos; el sistema no inventa valores para ocultarlo. El simulador estadístico conserva sus referencias publicadas y los supuestos del escenario.

Se eliminaron las repeticiones del comparativo territorial y la dona de gastos en el tablero general. El gráfico de cumplimiento de la jornada aparece en Transporte; Inicio muestra sus indicadores y tabla de control. El minigráfico de costo unitario calcula gasto dividido por registros validados, con huecos cuando falta denominador. Los minigráficos administrativos distinguen pagados, pendientes y aprobados; la serie grande muestra obligaciones pendientes por estado.

## Meta y movilización

Cada persona tiene una ficha de planilla por jornada. **Embarcados + personas registradas solo en comando = avance único**. Una identidad registrada en ambos canales cuenta una vez. Veinte embarcados y veintitrés adicionales en comando producen cuarenta y tres registros. Reservas, llegadas y regresos son métricas logísticas independientes y no se añaden otra vez al avance. El registro no acredita un voto emitido.

La sala de seguimiento compara las metas de cada líder, su suma y las metas propias de los aspirantes. Conserva porcentajes superiores al 100%. Las declaraciones acumuladas antiguas se muestran como referencia y no se suman a las planillas identificadas. Las correcciones mantienen revisión y auditoría; las cuentas solo acceden a las planillas de su ámbito autorizado.

## Edición y conversión

**Datos de prueba → Editar datos de prueba** permite editar fichas, metas, presupuestos y demás campos. También están disponibles los botones Editar de cada módulo y la planilla de jornada. Los nombres de personas son naturales; el origen sintético se identifica en el entorno completo.

Para incorporar una ficha corregida a los datos reales, abra Editar, active **Guardar esta ficha como registro real**, reemplace nombres y contactos, seleccione vínculos reales y confirme la información. Las personas requieren autorización y no quedan verificadas automáticamente. Gastos y aportes conservan su flujo de revisión. La ficha queda enlazada al registro creado para impedir una conversión duplicada. Los viajes, solicitudes, planillas y reportes reales se diligencian en sus formularios operativos; no se convierten automáticamente desde una demostración.
