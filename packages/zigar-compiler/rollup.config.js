import Replace from '@rollup/plugin-replace';
import NodeResolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.js',
  plugins: [
    Replace({
      preventAssignment: true,
      'process.env.NODE_ENV': '"production"',
      'process.env.ZIGAR_TARGET': '"WASM-COMPTIME"',
    }),
    NodeResolve({}),
  ],
  output: {
    file: './index.js',
    format: 'esm',
  },
};
