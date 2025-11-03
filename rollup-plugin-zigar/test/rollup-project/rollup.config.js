import Zigar from '../../dist/index.js';

export default {
  input: './sha1.zig',
  plugins: [
    Zigar({ nodeCompat: true }),
  ],
  output: {
    file: './sha1.js',
    format: 'esm',
  },
};
