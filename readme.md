# TL;DR
KUE-CHIP2, 3 用のアセンブラです.
TypeScript で書いているので, cli/ブラウザともに実行できます.

# 使い方
## node の実行環境を準備
nodebrew の例

1. nodebrew をインストール
```
curl -L git.io/nodebrew | perl - setup
```

2. node のパスを通す
```
echo 'export PATH=$HOME/.nodebrew/current/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

3. node をインストール
```
nodebrew install-binary stable
nodebrew use v1X.X.X
```

4. アセンブラのインストール
事前にトランスパイルしているのでそのまま使えます.
```
git clone <url> kueasm
cd kueasm
cp ./dist/cli.js <パスの通っているディレクトリ>/kueasm
```

## docker
```
docker run -it node bash
```


# 開発者向けメモ
package.json に書いている通り, 以下のコマンドが実行できます.
```
npm run test       # テスト実行
npm run build      # トランスパイル (下記の :cli と :web を実行)
npm run build:cli  # CLI 用にトランスパイル
npm run build:web  # web 用にトランスパイル

npm run autotest   # ファイル更新を監視して自動でテスト実行
```

## ツール類
- テスト: ava
- ビルド: gulp
- バンドラ: webpack

`./node_modules/.bin/` 以下に ava や gulp の symlink が配置されます

### ava
```
./node_modules/.bin/ava ./test/*.ts --fail-fast -v
```

### gulp
使えるタスク名 (コマンド)
```
gulp test
gulp watch-and-test
```

### webpack
そのままトランスパイルすると require 時のパス解決ができないので,
cli/web 用にそれぞれバンドラで 1 ファイルにまとめる.
cli/web で設定ファイル (webpack.config.xxx.js) が別になっている.


# 各ファイル
## ソースコード
```
- src/cli.ts:               node 用アセンブラのエントリポイント
- src/web.ts:               web 用アセンブラのエントリポイント
- lib/kueasm.ts:            アセンブラ本体. 全体の制御 + アセンブラへの疑似命令の処理
- lib/instruction.ts:       1 命令 (アセンブリ 1 行) に相当するオブジェクト
- lib/parser.ts             パーサ
- lib/util.ts:              雑多なユーティリティ関数
- lib/{web,node}/logger.ts: cli/ブラウザに合わせて適切なロギングを行う
```

## 設定
```
- package.json:          npm
- tslint.json:           tslint の設定
- tsconfig.json:         ts-loader のトランスパイル設定 (node 用)
- tsconfig.web.json:     ts-loader のトランスパイル設定 (node 用を web 用にオーバーライトする差分)
- webpack.config.cli.js: webpack で cli 用の js を作成する時の設定
- webpack.config.web.js: webpack で web 用の js を作成する時の設定
- gulpfile.js:           gulp の設定 (Makefile 的なやつ)

```


# tips
## web UI で自動アセンブル
F12 等で developer tool を開いて以下を実行
```
$('#input-assembly').on('keyup', () => $('#btn-assemble').click())
```


