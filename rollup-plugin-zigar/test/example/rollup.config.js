import Zigar from '../../dist/index.js';
import NodeResolve from '@rollup/plugin-node-resolve';

export default {
  input: './test.js',
  plugins: [
    Zigar({ useReadFile: true }),
    NodeResolve(),
  ],
  output: {
    file: './output/result.js',
    format: 'esm',
  },
};
