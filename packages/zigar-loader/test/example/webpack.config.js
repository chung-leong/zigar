const { resolve } = require('path');

module.exports = {
  mode: 'development',
  entry: './test.mjs',
  target: 'node',
  output: {
    filename: 'result.js',
    path: resolve('./output'),
  },
  module: {
    rules: [
      {
        test: /\.zig$/,
        loader: '../../dist/index.js',
        exclude: /node_modules/,
      },
    ]
  },
};
