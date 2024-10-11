import NodeResolve from '@rollup/plugin-node-resolve';
import Zigar from '../../dist/index.js';

export default {
  input: './test.js',
  plugins: [
    Zigar({ nodeCompat: true }),
    NodeResolve(),
  ],
  output: {
    file: './output/result.js',
    format: 'esm',
  },
};
