import { defineConfig } from 'vite'
import React from '@vitejs/plugin-react-swc'
import Zigar from 'rollup-plugin-zigar';

export default defineConfig({
  plugins: [
    React(),
    Zigar({ topLevelAwait: false }),
  ],
  base: '/zigar/demo-1',
  build: {
    emptyOutDir: true,
    outDir: '../../../docs/demo-1',
  },
})
