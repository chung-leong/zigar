const path = require('path');
const htmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, '../../../../../zigar.website/demos/webpack/filter'),
    filename: 'bundle.js',
  },
  plugins: [
    new htmlWebpackPlugin({
      template: 'src/index.html',
    }),
  ],
  devServer: {
    port: 3030,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: [ 'style-loader', 'css-loader' ],
      },
      {
        test: /\.zig$/,
        exclude: /node_modules/,
        use: 'zigar-loader',
      },
      {
        test: /\.(png|jpe?g|gif)$/i,
        use: 'file-loader',
      },
    ],
  },
};
