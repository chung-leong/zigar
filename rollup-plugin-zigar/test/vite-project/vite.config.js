import { defineConfig } from 'vite'
import React from '@vitejs/plugin-react-swc'
import Zigar from '../../dist/index.js';

export default defineConfig({
  plugins: [
    React(),
    Zigar({ topLevelAwait: false }),
  ],
})
