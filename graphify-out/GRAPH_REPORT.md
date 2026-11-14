# Astrea — grafo estructural de respaldo

Packet: repo-structure-packet. Modo: structural-fallback.

302 archivos; 793 referencias explícitas. Alcance: src, api, tests y docs.

Se revisó el grafo original del 11 de noviembre (436 nodos y 1.416 relaciones). Este respaldo actualizado registra referencias de archivos; no sustituye su análisis semántico ni acredita funcionamiento en producción.

## Dependencias con más referencias

| Archivo | Referencias entrantes |
| --- | --- |
| `src/types.ts` | 92 |
| `src/lib/firebase.ts` | 43 |
| `src/lib/operations.ts` | 23 |
| `src/lib/territorialMaps.ts` | 22 |
| `src/data/demoSeed.ts` | 20 |
| `src/lib/geographicImport.ts` | 18 |
| `src/lib/requestAgent.ts` | 18 |
| `src/components/common/EditRecordButton.tsx` | 18 |
| `src/lib/routeTracking.ts` | 17 |
| `src/components/operations/OperationsContext.tsx` | 17 |
| `src/lib/trackingPermissions.ts` | 16 |
| `src/lib/offlineMutations.ts` | 15 |
| `src/lib/deviceStorage.ts` | 12 |
| `src/lib/serialization.ts` | 12 |
| `src/lib/permissions.ts` | 12 |
| `src/server/requestAgent.ts` | 12 |
| `src/components/operations/OperationsUI.tsx` | 10 |
| `src/lib/movementTracking.ts` | 10 |
| `src/lib/livePosition.ts` | 9 |
| `src/lib/saveVerification.ts` | 9 |

## Recorridos de revisión

- Navegación: App → moduleNavigation/useModuleNavigation → Sidebar/PageNavigation.
- Finanzas: FinancesView y CampaignCostsReportView → tipos y persistencia; unificar con serviceCosts.
- Datos: formularios → firebase/recordEditing → offlineMutations → reglas y auditoría.
- Operación: OperationsProvider → stores transaccionales → reglas → pruebas de concurrencia.

Consultar graph.html por nombre de archivo; graph.json conserva las referencias para refrescos posteriores.
