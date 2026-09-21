const path = require('path');

const SRC_DIR = path.join(__dirname, 'react-client/src');
const DIST_DIR = path.join(__dirname, 'react-client/dist');

module.exports = (_env, argv) => ({
  entry: path.join(SRC_DIR, 'index.jsx'),
  output: {
    filename: 'bundle.js',
    path: DIST_DIR,
    publicPath: '/',
  },
  mode: argv.mode || 'development',
  devtool: argv.mode === 'production' ? false : 'source-map',
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        include: SRC_DIR,
        use: 'babel-loader',
      },
      {
        test: /\.(s*)css$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
});
