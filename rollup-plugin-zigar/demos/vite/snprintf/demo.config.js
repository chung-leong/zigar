import react from '@vitejs/plugin-react-swc';
import zigar from 'rollup-plugin-zigar';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), zigar({ useLibc: true })],
  build: {
    target: 'es2022',
    outDir: '../../../../../zigar.website/demos/rollup-plugin-zigar/snprintf',
    emptyOutDir: true,
  }
})
