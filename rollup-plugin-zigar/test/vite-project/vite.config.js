import { defineConfig } from 'vite'
import React from '@vitejs/plugin-react-swc'
import Zigar from '../../dist/index.js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    React(),
    Zigar({ optimize: 'ReleaseSmall', topLevelAwait: false }),
  ],
})
