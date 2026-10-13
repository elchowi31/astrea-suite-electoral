// Ajusta el proyecto Android generado por Capacitor para el rastreo en segundo plano.
// Uso: npx cap add android && node scripts/setup-android.mjs   (se puede ejecutar varias veces)
import { readFileSync, writeFileSync, existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const root = 'android/app/src/main';
if (!existsSync(root)) { console.error('No existe android/. Ejecute primero: npx cap add android'); process.exit(1); }

// 1. Permisos: ubicación precisa, servicio en primer plano de tipo ubicación y notificación visible.
const manifestPath = join(root, 'AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');
const permissions = ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION', 'POST_NOTIFICATIONS', 'INTERNET'];
for (const permission of permissions) {
  const line = `<uses-permission android:name="android.permission.${permission}" />`;
  if (!manifest.includes(`android.permission.${permission}"`)) manifest = manifest.replace('</manifest>', `    ${line}\n</manifest>`);
}
if (!manifest.includes('android.hardware.location.gps')) manifest = manifest.replace('</manifest>', '    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\n</manifest>');
// Permisos que agrega el plugin de notificaciones y Astrea no usa: se retiran para no tener que justificarlos en Google Play.
if (!manifest.includes('xmlns:tools=')) manifest = manifest.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');
for (const permission of ['SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED']) {
  if (!manifest.includes(`android.permission.${permission}" tools:node="remove"`)) manifest = manifest.replace('</manifest>', `    <uses-permission android:name="android.permission.${permission}" tools:node="remove" />\n</manifest>`);
}
writeFileSync(manifestPath, manifest);

// 2. Textos de la notificación permanente que ve el integrante mientras se registra su recorrido.
const stringsPath = join(root, 'res/values/strings.xml');
let strings = readFileSync(stringsPath, 'utf8');
const entries = {
  capacitor_background_geolocation_notification_channel_name: 'Seguimiento de recorridos',
  capacitor_background_geolocation_notification_color: '#22d3ee',
  capacitor_background_geolocation_notification_icon: 'drawable/ic_tracking',
};
for (const [key, value] of Object.entries(entries)) {
  if (!strings.includes(`name="${key}"`)) strings = strings.replace('</resources>', `    <string name="${key}">${value}</string>\n</resources>`);
}
writeFileSync(stringsPath, strings);

// 3. Ícono adaptativo, ícono clásico y pantalla de arranque de Astrea (resources/android/res reemplaza los de Capacitor).
if (existsSync('resources/android/res')) cpSync('resources/android/res', join(root, 'res'), { recursive: true });
if (existsSync('resources/android/java')) cpSync('resources/android/java', join(root, 'java'), { recursive: true });

// 4. El plugin original usa prioridad alta y un canal de importancia normal.
// Aplicar el cambio en cada compilación también después de npm ci. Un canal nuevo
// permite que la actualización desde 1.0.1 nazca silenciosa: Android conserva las
// propiedades de los canales ya creados. No se oculta el indicador del servicio.
const pluginPath = 'node_modules/@capacitor-community/background-geolocation/android/src/main/java/com/equimaps/capacitor_background_geolocation/BackgroundGeolocation.java';
let plugin = readFileSync(pluginPath, 'utf8');
const changes = [
  ['BackgroundGeolocationService.class.getPackage().getName()', '"astrea_tracking_silent_v1"', 2],
  ['.setPriority(Notification.PRIORITY_HIGH)', '.setPriority(Notification.PRIORITY_LOW)\n                    .setOnlyAlertOnce(true)\n                    .setDefaults(0)\n                    .setSound(null)\n                    .setVibrate(new long[0])\n                    .setShowWhen(false)', 1],
  ['NotificationManager.IMPORTANCE_DEFAULT', 'NotificationManager.IMPORTANCE_LOW', 1],
  ['channel.setSound(null, null);', 'channel.setSound(null, null);\n            channel.setShowBadge(false);', 1],
];
for (const [before, after, expected] of changes) {
  if (plugin.split(after).length - 1 === expected) continue;
  if (plugin.split(before).length - 1 !== expected) throw new Error(`Cambió el plugin de ubicación; revise el canal silencioso: ${before}`);
  plugin = plugin.replaceAll(before, after);
}
writeFileSync(pluginPath, plugin);
console.log('Android listo: permisos, indicador silencioso de seguimiento e ícono configurados.');
