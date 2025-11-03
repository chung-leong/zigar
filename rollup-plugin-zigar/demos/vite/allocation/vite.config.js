import react from '@vitejs/plugin-react-swc'
import zigar from 'rollup-plugin-zigar'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    zigar({
      optimize: 'ReleaseSmall',
      embedWASM: true,
      multithreaded: true,
    })
  ],
  server: {
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  base: '/demos/rollup-plugin-zigar/allocation',
  build: {
    emptyOutDir: true,
    outDir: '../../../../../zigar.website/demos/rollup-plugin-zigar/allocation',
  },
})
