import Replace from '@rollup/plugin-replace';

export default {
  input: './src/index.js',
  plugins: [
    Replace({
      preventAssignment: true,
      'process.env.NODE_ENV': '"production"',
      'process.env.ZIGAR_TARGET': '"WASM-RUNTIME"',
    }),
  ],
  output: {
    file: './dist/index.js',
    format: 'esm',
  },
};
