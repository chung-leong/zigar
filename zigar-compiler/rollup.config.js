import NodeResolve from '@rollup/plugin-node-resolve';
import Replace from '@rollup/plugin-replace';


export default [
  {
    input: './src/index.js',
    plugins: [
      NodeResolve({}),
      Replace({
        preventAssignment: true,
        values: {
          'process.env.DEV': 'false',
        },
      })
    ],
    output: {
      file: './dist/index.js',
      format: 'esm',
    },
  },
  {
    input: './src/transpiler.js',
    plugins: [
      NodeResolve({}),
      Replace({
        preventAssignment: true,
        values: {
          'process.env.DEV': 'false',
          // env vars used in the code of zigar-runtime
          'process.env.TARGET': '"wasm"',
          'process.env.BITS': '"32"',
          'process.env.MIXIN': '"track"',
        },
      })
    ],
    output: {
      file: './dist/transpiler.js',
      format: 'esm',
    },
  }
];
