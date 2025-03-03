import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import zigar from 'rollup-plugin-zigar';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    zigar({ topLevelAwait: false, useLibc: true, multithreaded: true }),
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
})
