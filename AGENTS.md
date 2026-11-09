# Navegación de Astrea

Esta regla aplica a todos los módulos nuevos y existentes de la aplicación.

- Registrar cada módulo en `src/lib/moduleNavigation.ts` (`MODULE_LABELS`); ese catálogo define `ActiveTab`.
- Usar `navigate` de `useModuleNavigation` en `App.tsx` para menús, tarjetas del dashboard y enlaces entre módulos. Pasarlo por callbacks; evitar estados de navegación global independientes.
- Mantener `PageNavigationBar` al comienzo de `main.app-content`, fuera de `Suspense`. Cada módulo hereda «Volver» y «Tablero principal», incluso mientras carga.
- Conservar la posición de la barra debajo de la cabecera y del estado de seguimiento, sin cubrir controles existentes al desplazarse o cambiar el ancho de pantalla.
- «Volver» regresa al origen del recorrido. «Tablero principal» vuelve a la raíz y reinicia el recorrido. No sustituir un retorno por un destino fijo si existe una página anterior.
- Una pantalla interior o formulario que ocupa una página declara su retorno mediante `usePageBack` de `PageNavigation.tsx`, habilitado solo mientras esa pantalla está abierta. Los diálogos mantienen también su acción de cerrar o cancelar.
- Al cambiar de cuenta, rol u organización se descarta el recorrido anterior. No mezclar navegación ni datos entre organizaciones.
- Conservar `PageScrollRestoration` dentro de `Suspense` para recuperar posición y foco cuando el contenido de destino ya esté listo.
- Comprobar dashboard → módulo → otro módulo → volver → tablero, teclado y un ancho móvil de 335 px. Verificar también el retorno de una pantalla interior antes de salir de su módulo.
