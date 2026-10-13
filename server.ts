import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import apiHandler from './api/index.ts';
import vercelConfig from './vercel.json' with { type: 'json' };
import { config } from 'dotenv';

config({ path: '.env.local', override: true, quiet: true });

const app = express();
const parsedPort = Number(process.env.PORT || 3000);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
const currentModulePath = fileURLToPath(import.meta.url);
const isProduction = process.env.NODE_ENV === 'production'
  || (path.basename(currentModulePath) === 'server.mjs' && path.basename(path.dirname(currentModulePath)) === 'build');
// Una sola política de seguridad: la misma de Vercel (incluye OSRM para rutas y gstatic para Google Maps).
const productionContentSecurityPolicy = vercelConfig.headers.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy')!.value;

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (isProduction) res.setHeader('Content-Security-Policy', productionContentSecurityPolicy);
  next();
});

// Local development uses the exact same API handler as the Vercel function.
// This keeps authentication, request limits, and error handling consistent.
app.all(/^\/api(?:\/.*)?$/, (req, res) => {
  void apiHandler(req, res).catch((error: unknown) => {
    console.error('Unhandled API error:', error);
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Error interno.' });
  });
});

async function configureFrontend() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        const template = await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(templatePath, 'utf-8'));
        res.status(200).set('Content-Type', 'text/html').end(template);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
    return;
  }

  const distPath = path.join(process.cwd(), 'dist');
  app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  // Archivos de la raíz de dist: service worker, manifiesto, iconos y CSV de ejemplo. Sin ellos la app no se instala ni funciona sin conexión.
  app.use(express.static(distPath, { index: false, setHeaders: (res, filePath) => {
    if (filePath.endsWith('service-worker.js')) { res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Service-Worker-Allowed', '/'); }
    if (filePath.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json');
  } }));
  app.get(/.*/, (req, res) => {
    if (path.extname(req.path) && req.path !== '/index.html') {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

export async function startServer() {
  await configureFrontend();
  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`Astrea Suite Electoral disponible en http://localhost:${PORT}`);
  });
}

export default app;

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === currentModulePath;
if (isMainModule) {
  void startServer();
}
