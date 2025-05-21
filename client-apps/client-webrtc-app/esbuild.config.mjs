import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

esbuild
    .build({
        entryPoints: ['src/main.ts'], // Adjust if entry file is different
        bundle: true,
        outfile: 'dist/bundle.js',
        platform: 'browser',
        format: 'esm',
        alias: {
            '@rooms-models': resolve(__dirname, '../../packages/shared-models/rooms-models/src'),
            '@rooms/rooms-client': resolve(__dirname, '../../packages/client-libs/rooms-client/src')
        },
        tsconfig: './tsconfig.json'
    })
    .catch(() => process.exit(1));