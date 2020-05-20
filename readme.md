# TL;DR
KUE-CHIP2, 3 用のアセンブラです.
TypeScript で書いているので, cli/ブラウザともに実行できます.

package.json に書いている通り, 以下のコマンドが実行できます.
```
npm run build  # トランスパイル
npm run test   # テスト実行

npm run autobuild  # ファイル更新を監視して自動でトランスパイル
npm run autotest   # ファイル更新を監視して自動でテスト実行
```


# ツール類
- テスト: ava
- ビルド: gulp

`./node_modules/.bin/` 以下に ava や gulp のリンクが配置されます

gulp で使えるタスク名 (コマンド)
```
gulp build
gulp watch-and-build
gulp test
gulp watch-and-test
```


# web で自動アセンブル
F12
```
$('#input-assembly').on('keyup', () => $('#btn-assemble').click())
```


lib/kueasm.ts:      アセンブラ本体. 全体の制御 + アセンブラへの疑似命令の処理
lib/instruction.ts: 1 命令 (アセンブリ 1 行) に相当するオブジェクト
lib/parser.ts       パーサ
lib/logger.ts:      cli/ブラウザに合わせて適切なロギングを提供する
lib/util.ts:        雑多なユーティリティ関数
