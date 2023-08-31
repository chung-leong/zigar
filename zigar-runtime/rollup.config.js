import Replace from '@rollup/plugin-replace';

export default {
  input: './src/index.js',
  plugins: [
    Replace({
      preventAssignment: true,
      'process.env.ZIGAR_TARGET': '"WASM-RUNTIME"',
      'process.env.ZIGAR_DEV': 'false',
    }),
  ],
  output: {
    file: './dist/index.js',
    format: 'esm',
  },
};
