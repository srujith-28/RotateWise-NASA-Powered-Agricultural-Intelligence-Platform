import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiRouter } from './server/routes/api.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const parsedPort = Number.parseInt(process.env.PORT ?? '', 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

  const distDir = path.resolve(__dirname, 'dist');
  const distIndexPath = path.join(distDir, 'index.html');
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (process.env.NODE_ENV !== 'development' && fs.existsSync(distIndexPath));

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', createApiRouter());

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (!fs.existsSync(distIndexPath)) {
      throw new Error(
        `Production frontend build not found at ${distIndexPath}. Run "npm run build" before starting the server.`
      );
    }
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexPath);
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(
      `RotateWise server listening on http://0.0.0.0:${port} (mode=${isProduction ? 'production' : 'development'})`
    );
  });

  server.on('error', (err) => {
    console.error('RotateWise HTTP server failed to start:', err);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('RotateWise server startup failed:', err);
  process.exit(1);
});
