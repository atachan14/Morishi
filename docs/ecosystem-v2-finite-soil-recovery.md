# 土壌拡張の復旧・検証

復旧開始時HEADはa904a94。e37831b以降に6fc305f（0基準判断記録）とa904a94（有限支持の吸収・保存codec）がcommit済みだった。残った7ファイルの差分と土壌生成器・テスト・検証scriptを復旧し、元の未追跡証跡を保持した。追跡差分と全未追跡ファイルのコピーはC:/Users/user/Documents/Codex/2026-10-14/task-2/recovery。履歴reset、原本削除、pushは行っていない。既存Vite PID9632、port8781を継続使用。

新規runのみsoilLayout=finite-scattered-2を付与。各20 Statに独立した3地点をseedから生成。局所profileは合計1へ正規化し、各Statの未正規化強度×半径²の総和を等しく保つ。seed424の支持加重平均は4.56〜5.63%、最大/最小1.234でおおむね公平。既存runの再配置は行わない。

初期カメラ半径の110%以上・生成半径×2.5+400・最低6400の最大値まで支持1、その外側は1.4倍半径で支持0になるsmoothstep。吸収offer、容量、実受入雨、水分表示、栄養表示に同じ支持を使用。root生成上限8000、通常100000。sample間隔最大140、セル上限20000。セーブは有限recipeと動的在庫を保持し、新版element-root-save-2、旧版は旧式のまま読戻し。

## 検証

全344 tests成功（fail0）、tsc --noEmit、本体Vite build、独立root-trial build成功。既存Phaser chunk容量警告は継続。tests/eco-v2-soil-generation.test.tsは支持境界・正規化・公平な総強度・実吸収・保存と次tick一致・旧fixture不変を検証。

敵100体・20tickの単独計測（Windows、seed424）:

|生成半径|セル|tick中央値 / p95|保存bytes|warm保存ms|
|---|---:|---:|---:|---:|
|2400|4096|18.50 / 30.09ms|418476|37.09|
|4000|3721|18.09 / 22.08ms|409994|32.09|
|8000|10404|45.32 / 64.11ms|492444|68.22|

8000で通常10tick/sのモデル処理目安内だが、8倍再生の実時間維持や大きく成長した終盤、実機スマホの快適さは保証しない。有限の上限と分割送りを維持。

隔離Edgeの1366×900、390×844、320×568で初期カメラ全域が支持1、外周pan、root上限8000/通常100000、保存再読込完全一致、旧normal raw不変、横overflowなし、runtimeErrors0。PC/SP画像を目視確認。実機スマホではない。

証跡: evidence/ecosystem-v2-finite-soil/benchmark.json、benchmark-output.txt、tests.txt、root-build.txt、browser/browser-check.json、各PNG。再実行: TypeScript test compile後、scripts/ecosystem-v2-finite-soil-check.mjs と scripts/ecosystem-v2-finite-soil-browser-check.mjs。
