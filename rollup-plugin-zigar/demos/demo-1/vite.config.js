import { defineConfig } from 'vite'
import React from '@vitejs/plugin-react-swc'
import Zigar from 'rollup-plugin-zigar';

export default defineConfig({
  plugins: [
    React(),
    Zigar({ topLevelAwait: false }),
  ],
  build: {
    emptyOutDir: true,
    outDir: '../../../docs/demo-1',
  },
})
