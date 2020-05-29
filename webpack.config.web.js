const path = require('path')

module.exports = {
  mode:   'development',      // "production" | "development" | "none"
  target: 'web',              // web ブラウザ用に pack
  entry:  './src/web.ts',     // エントリーポイント
  cache:  true,               // webpack watch したときに差分ビルドができる
  output: {
    path: path.join(__dirname, "./dist"),
    filename: "web.js"
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
          configFile: 'tsconfig.web.json',   // web 用の tsconfig を使う
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
      '@envlib': path.resolve(__dirname, './lib/web/'),
    },
  },
  node: {
    fs: 'empty',             // web 版では fs を使わない (使えない)
  }
}

