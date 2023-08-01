import Replace from '@rollup/plugin-replace';
import NodeResolve from '@rollup/plugin-node-resolve';

export default [
  {
    input: './src/index.js',
    plugins: [
      Replace({
        preventAssignment: true,
        'process.env.ZIGAR_TARGET': '"WASM-COMPTIME"',
      }),
      NodeResolve({}),
    ],
    output: {
      file: './dist/index.js',
      format: 'esm',
    },
  },
  {
    input: './src/index.js',
    plugins: [
      Replace({
        preventAssignment: true,
        'process.env.ZIGAR_TARGET': '"WASM-COMPTIME"',
      }),
      NodeResolve({}),
    ],
    output: {
      file: './dist/index.cjs',
      format: 'commonjs',
    },
  }
];
