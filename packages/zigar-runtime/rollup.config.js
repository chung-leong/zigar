import Replace from '@rollup/plugin-replace';

export default {
  input: 'src/index.js',
  plugins: [
    Replace({
      preventAssignment: true,
      'process.env.NODE_ENV': '"production"',
      'process.env.NODE_ZIG_TARGET': '"WASM-RUNTIME"',
    }),
  ],
  output: {
    file: './index.js',
    format: 'esm',
  },
};
