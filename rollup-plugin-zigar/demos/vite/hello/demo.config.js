import react from '@vitejs/plugin-react-swc';
import zigar from 'rollup-plugin-zigar';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), zigar()],
  build: {
    outDir: '../../../../../zigar.website/demos/rollup-plugin-zigar/hello',
    emptyOutDir: true,
  },
  server: {
    open: true,
  },
})
