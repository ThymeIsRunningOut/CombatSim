import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function localPresetsPersistencePlugin(): Plugin {
  return {
    name: 'local-presets-persistence',
    configureServer(server) {
      server.middlewares.use('/api/save-presets', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const filePath = path.resolve(__dirname, 'src/data/saved_presets.json');
              fs.writeFileSync(filePath, body, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, path: filePath }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        }
      });

      server.middlewares.use('/api/load-presets', (req, res) => {
        if (req.method === 'GET') {
          const filePath = path.resolve(__dirname, 'src/data/saved_presets.json');
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(fs.readFileSync(filePath, 'utf-8'));
          } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: 'No saved presets file found' }));
          }
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localPresetsPersistencePlugin()],
  base: './',
});
