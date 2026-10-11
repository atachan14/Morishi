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

新しい遊び比較runは、撃破後に手札へ入る芽だけへplayer倍率を適用します。既存手札と配置済み個体の基礎能力は維持し、成長は続きます。旧保存runは元のルールで再開します。詳細と暫定値は [docs/hand-entry-boost.md](docs/hand-entry-boost.md)。

## 直径・属性対応・独立時計の比較版

[http://127.0.0.1:8781/ecosystem.html](http://127.0.0.1:8781/ecosystem.html) から独立した庭を試せます。既存runは元ページに保持し、比較版は別の保存キーを使います。個体別の属性→能力の1対1対応、実直径の成長と接触吸収、手札入りでの基礎能力固定、独立したドロー／配置力時計を実装しています。自然成長上限や倍率、時計間隔は仮値です。

仮仕様・理由・将来のスキルカード枠は [docs/ecosystem-prototype.md](docs/ecosystem-prototype.md)、検証は [docs/ecosystem-verification.md](docs/ecosystem-verification.md) を参照してください。


比較版の最新安定化では、全滅時に停止して再配置を案内し、待っても変化しない庭を止めます。[継続と配置不能の確認](docs/ecosystem-stability.md)、[具体的な配置試遊](docs/ecosystem-play-record.md)。新しい庭は局所射程で開始し、観察Paneから初回の広域射程も選べます。保存済みの庭は元の射程を維持。[局所射程と保存互換の比較](docs/ecosystem-local-range.md)。

吸収集中・分散・前後配置の原因と比較は [docs/ecosystem-roles.md](docs/ecosystem-roles.md)。観察Paneの「新しい庭の比較設定」から全能力25%継承／全能力25%＋存在感同値なら近い相手を選べます。標準は従来の100%継承のままです。

存在感の標的順・前衛の具体例・代価は [docs/ecosystem-targets.md](docs/ecosystem-targets.md)。標準と旧runはID同値を維持。新案は同値だけ距離→IDで決め、射程外は候補に含めません。

朝は [短い比較試遊](docs/ecosystem-morning-play.md) から。自動保存・吸収後の詳細・有限な弾表示の修正と、ゲーム時間／実時間を分けた確認は [長期安定性](docs/ecosystem-long-stability.md)。148テスト、PC/スマホ幅の操作検証を通過。

配置を続ける6条件の保存再生、手動の試遊地点、同条件リトライ、候補の攻撃・被弾表示は [能動試遊の記録](docs/ecosystem-active-trial.md)。

成熟敵への即死と停滞を、合法配置・射程・成長・新札で分析し、既存ルールでの育成候補探索を加えた記録は [立て直しの比較](docs/ecosystem-recovery.md)。
