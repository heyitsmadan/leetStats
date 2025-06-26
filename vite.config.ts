import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' assert { type: 'json' }; // Import your manifest

export default defineConfig({
    plugins: [
    crx({ manifest }),
    ],
    build: {
    outDir: 'dist', // The output directory for your bundled extension
    sourcemap: 'inline', // Helpful for debugging
    },
});
    