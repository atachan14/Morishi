# 入力・保存・同tick境界の追加検証 — 2026-10-11

`2bfe921` の新ルールに対する追加探索。P=2、X=1.5、回復24秒、戦闘、save schemaは変更していない。

## 修正した不足

- **旧保存置換の取消がなかった**：新seed／入力seedは旧rawを退避して直ちに置換していた。保護された不明／旧ルール保存の置換前だけnative confirmを追加。取消なら新stateを作らず、主保存・backupとも不変。通常runのrestartには確認を増やしていない。
- **パン取消時の視点保存が遅れる経路**：第二指でdragを破棄、盤面外操作、tracking取消、Pane、resizeの直後にviewがまだ保存されない場合があった。これらの境界で現在viewを保存。元から正常なpagehideでは保存していたため、すべてのreloadで視点を失う不具合だったとは主張しない。今回の修正は取消時点の即時snapshotを確実にする。

## 実Edgeの検証

`scripts/edge-browser-check.mjs`。専用一時profileのheadless Edgeで1366/1920/390/320すべて通過、実行時エラー0。利用者browser・永続設定・認証は未操作。

- 実wheelで**最大3倍**へ拡大、mouse／touch pan後にworld座標で選択。余計な配置なし。拡大したfractional新規配置も実PointerEvent変換と一致。
- mouse panの最中にwidth変更、touch panの最中に第二指を追加して取消。取消直後のsaveに新viewが入り、配置数は不変。そのviewを再読込後も復元。
- 旧snapshot-2形式fixtureを新document開始時に投入。native confirm **取消／承認を各4回**記録。取消で主raw・backup raw不変、承認で旧rawをbackupして新runへ。fixtureをreload直前に書くだけでは既存pagehide保存で上書きされるため、新document初期化で投入する検証方法に修正した。
- 承認後の開始演出中に実clickとwheelを送信してもtick/配置数0。実tab切替でhiddenにすると演出も停止し、保存内容が不変。return後に演出完了、combat tickは0のまま。
- Pane／resize、通常4倍速／停止／復元、背景復帰、event送り停止、同一評価内の送り即取消も再確認。速度selectと送り即取消はDOM handler経路、zoom/pan/配置/旧保存確認/背景切替は実入力・実tab経路。

最新reportは `docs/evidence/edges/browser.json`。native dialog応答はreportのdialogsに記録。新documentでのテストfixture操作は隔離context内だけで行い、利用者saveには触れない。

## 原子的な順序とsave

**67テスト成功、build成功**。新規の3回帰は件数目的の重複ではなく、以下の組合せを確認：

1. tick240で回復と撃破が同時に起こるfixture。完全なstepが終わってから停止し、配置力は両方の増加を反映。停止理由は撃破、snapshot復元は参照stepと完全一致。
2. 同tickが最後の敵の撃破なら終局が優先され、追加tickなし。
3. 1tick進んだskipを取消→camera込み保存→復元→再開。失われたtickや二重進行なし。

初手／成熟後の退避点は既存1024seedテスト、sum密集／解析閾値境界／死亡解放は既存fieldテストで再確認。仮値の連続balance変更はしていない。

## 次にユーザー判断が必要な点

実機スマホ／Safari、初見の読み取り、pan/zoomの操作感、P/Xと回復間隔、長期戦の許容は引き続き未判断。旧384run探索は新規仕様の240秒時点で370run未終了だったため、機械的整合性と遊びのテンポの受入を分ける。ここで勝率やテンポの改善を捏造しない。

旧Unity・restart原文は維持。local commitのみ、公開／pushなし。
