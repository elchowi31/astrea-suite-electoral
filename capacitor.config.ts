import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App nativa de Astrea (Android; iOS requiere Mac y cuenta de Apple).
 * IMPORTANTE: `appId` es el identificador permanente en Google Play. Una vez publicada la app no se puede cambiar.
 */
const config: CapacitorConfig = {
  appId: 'co.proyectosconenergia.astrea',
  appName: 'Astrea Suite',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  android: {
    // Requerido por el plugin de geolocalización: evita que las posiciones se detengan tras 5 minutos en segundo plano.
    useLegacyBridge: true,
    allowMixedContent: false,
  },
};

export default config;
