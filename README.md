# Morishi — 配置と観察のローカル試作

Phaser + TypeScriptの小さなプレイアブル。旧Unity版は別フォルダに保全しています。

## 起動

```sh
npm install
npm run dev
```

http://127.0.0.1:8781/ を開きます。localhost限定で、外部には公開しません。ポートが使用中なら起動を停止する設定です。

敵の存在感合計が閾値以下の自由な位置に植物を配置し、「時間を進める」を押してください。停止して考え、次の植物を置けます。新規runは芽の供給が続き、配置力が24ゲーム秒ごと・敵攻略で回復します。植物を選ぶと射程円と能力を表示します。PCでは3Pane、狭い画面では上部のタブで1Paneずつ切り替えます。

```sh
npm test
npm run build
```

原文記録は `docs/restart/2026-10-11-first-concept.md`、今回の仮仕様とテスト手順は `docs/prototype-scope.md`、確認結果と制約は `docs/verification.md` にあります。

可変ステージと継続供給の実装・互換・検証は [docs/stage-supply.md](docs/stage-supply.md) を参照。通常起動は12×9・敵7体の基準盤面で、大きな設定はまだ検証用です。

右の観察Pane（スマホ幅では「敵・観察」タブ）上部の「検証用盤面」から比較36×27・敵24体を選び、「選択した盤面で始める」で試せます。基準盤面へも同じ導線で戻せます。[入口と再開の検証](docs/entry-tail.md)。
