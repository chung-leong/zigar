import StripCode from 'rollup-plugin-strip-code';

export default {
  input: './src/index.js',
  plugins: [
    StripCode({
      start_comment: 'DEV-TEST',
      end_comment: 'DEV-TEST-END'
    }),
    StripCode({
      start_comment: 'NODE-ONLY',
      end_comment: 'NODE-ONLY-END'
    }),
    StripCode({
      start_comment: 'COMPTIME-ONLY',
      end_comment: 'COMPTIME-ONLY-END'
    })
  ],
  output: {
    file: './dist/index.js',
    format: 'esm',
  },
};
