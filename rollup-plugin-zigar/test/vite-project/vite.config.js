import React from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import Zigar from '../../dist/index.js';

export default defineConfig({
  plugins: [
    React(),
    Zigar({ topLevelAwait: false, useLibc: true }),
  ],
})
