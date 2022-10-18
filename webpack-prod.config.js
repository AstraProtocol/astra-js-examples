const webpack = require("webpack");
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = {
  entry: {
    index: "./src/index.js",
  },
  output: {
    publicPath: '/',
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Astra SDK Example',
      filename: "./public/index/html",
      publicPath: '/',
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_DEBUG': 0,
    })
  ],
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [["@babel/preset-react", {"runtime": "automatic"}]],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    fallback: {
      path: false,
      assert: require.resolve("assert/"),
      buffer: require.resolve("buffer/"),
      events: require.resolve("events/"),
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
    },
  },
};
