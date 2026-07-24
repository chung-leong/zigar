import react from '@vitejs/plugin-react';
import zigar from 'rollup-plugin-zigar';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), zigar()],
})
