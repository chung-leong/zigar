import NodeResolve from '@rollup/plugin-node-resolve';
import Replace from '@rollup/plugin-replace';

const input = './src/index.js';
const plugins = [
  NodeResolve({}),
  Replace({
    preventAssignment: true,
    values: {
      'process.env.DEV': 'false',
      'process.env.TARGET': '"wasm"',
      'process.env.MIXIN': '""',
    },
  })
];

export default [
  {
    input,
    plugins,
    output: {
      file: './dist/index.js',
      format: 'esm',
    },
  },
  {
    input,
    plugins,
    output: {
      file: './dist/index.cjs',
      format: 'commonjs',
    },
  }
];
