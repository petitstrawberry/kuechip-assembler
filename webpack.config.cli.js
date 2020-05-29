const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = {
  mode:   'development',      // "production" | "development" | "none"
  target: 'node',             // node 用に pack
  entry:  './src/cli.ts',     // エントリーポイント
  cache:  true,               // webpack watch したときに差分ビルドができる
  output: {
    path: path.join(__dirname, "./dist"),
    filename: "cli.js"
  },
  module: {
    rules: [
      {
        test: /\.ts$/,                       // 拡張子 .ts の場合
        loader: 'ts-loader',                 // TypeScript をトランスパイルする
        exclude: [
          /node_modules/,
        ],
        options: {
          configFile: 'tsconfig.json',
        },
      },
      {
        enforce: 'pre',                      // 事前に
        test:    /\.ts$/,                    // 拡張子 .ts の場合
        loader:  'tslint-loader',            // lint する
        options: {
          configFile: './tslint.json',
          typeCheck:   true,                 // airbnb スタイルガイドに従う
        },
      },
    ],
  },
  resolve: {
    modules: [
      "node_modules",        // node_modules 内も対象とする
    ],
    extensions: [
      '.ts',
      '.js',                 // node_modulesのライブラリ読み込みに必要
    ],
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@envlib': path.resolve(__dirname, './lib/node/'),
    },
  },
  externals: [ nodeExternals() ],
}

