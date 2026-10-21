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
              const data = JSON.parse(body);
              const jsonPath = path.resolve(__dirname, 'src/data/saved_presets.json');
              fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

              // Also write directly into src/data/presets.ts so git instantly tracks changes
              if (data.creatures && data.weapons && data.buildings && data.crewConfig) {
                const tsPath = path.resolve(__dirname, 'src/data/presets.ts');
                const tsContent = `import { WeaponDef, CreatureDef, BuildingDef, CrewSimulationConfig } from '../types/combat';

export const DEFAULT_CREW_CONFIG: CrewSimulationConfig = ${JSON.stringify(data.crewConfig, null, 2)};

export const DEFAULT_WEAPONS: WeaponDef[] = ${JSON.stringify(data.weapons, null, 2)};

export const DEFAULT_CREATURES: CreatureDef[] = ${JSON.stringify(data.creatures, null, 2)};

export const DEFAULT_BUILDINGS: BuildingDef[] = ${JSON.stringify(data.buildings, null, 2)};
`;
                fs.writeFileSync(tsPath, tsContent, 'utf-8');
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, path: jsonPath }));
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
