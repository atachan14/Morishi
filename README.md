# Morishi — 配置と観察のローカル試作

Phaser + TypeScriptの小さなプレイアブル。旧Unity版は別フォルダに保全しています。

## 起動

```sh
npm install
npm run dev
```

http://127.0.0.1:8781/ を開きます。localhost限定で、外部には公開しません。ポートが使用中なら起動を停止する設定です。

明るい左端の自由な位置に植物を配置し、「時間を進める」を押してください。停止して考え、増えた領域に次の植物を置けます。植物を選ぶと射程円と能力を表示します。PCでは3Pane、狭い画面では上部のタブで1Paneずつ切り替えます。

```sh
npm test
npm run build
```

原文記録は `docs/restart/2026-10-11-first-concept.md`、今回の仮仕様とテスト手順は `docs/prototype-scope.md`、確認結果と制約は `docs/verification.md` にあります。
