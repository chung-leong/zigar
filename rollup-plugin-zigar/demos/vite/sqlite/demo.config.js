import react from '@vitejs/plugin-react-swc';
import zigar from 'rollup-plugin-zigar';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    zigar({ optimize: 'ReleaseSmall' })
  ],
  build: {
    outDir: '../../../../../zigar.website/demos/rollup-plugin-zigar/sqlite',
    emptyOutDir: true,
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  assetsInclude: [ '**/*.db' ],
})
