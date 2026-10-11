# 約200体の全体描画を再利用する局所改善

2026-10-11、2e745a6の自然到達checkpointを再利用。新たな長期simulationや大量個体fixtureは回していません。ゲームルール・供給・simulation・保存形式は変更せず、表示サイズも36×27・敵24体の仮設定のままです。

短いCPU samplingで、主な負荷はPhaserのGraphicsWebGLRenderer、円や輪郭のbatchLine/batchQuad、fill pathの三角形分割でした。停止中でも同じ幾何を毎frame展開していました。TextStyle.setFontSizeはPhaser3.90側で同じ値を無視するため、文字textureの再生成が主因という仮説は採用しませんでした。赤い存在感面は既にcacheされていますが、成熟後も毎tickで再計算されていました。

変更は2点です。盤面のGraphics結果をPhaser標準RenderTextureの1面へ保持し、視覚入力に差分があるときだけ更新します。ID文字は従来のTextのままです。存在感面は敵の生存・座標・存在感距離・成長率とcameraが変わったときに更新します。既存の96×72の標本化・閾値・正確な配置判定は変更しません。個体数や線の数を減らしたり、HP・ID・成熟・射程・攻撃線・存在感情報を省略したりしていません。

cacheキーはHP、個体の追加/消滅、stats、成長、直近発射線の期限、territory、camera、viewport、選択、hover、配置力、次カード、終了状態を含みます。捕獲pulseが動いている間は毎frame更新し、消えた時にも残像を消します。成熟後のage増加だけでは再描画しません。simulationのClock/stepは毎frame従来どおり進みます。camera/resizeでtextureも更新します。PhaserのRESTORE_WEBGLイベントでGPU資源復元後にも再描画し、scene終了時にlistenerを解除します。

同じseed20261011・197味方＋5敵・全体camera（x18,y13.5,zoom1）、同じviewport、同じ保存ファイルで比較しました。peak checkpointには若い最後の味方が1体、最終checkpointには全て成熟済みの個体が残っています。各区間1.5秒、sampling profilerを外したframe間隔95%点です。warmupで既存の捕獲pulseが終わるのを待っています。

| 場面 | 変更前 PC / 縦長 | 変更後 PC / 縦長 |
|---|---:|---:|
| peak・停止 | 33.5 / 33.5ms | 16.8 / 16.8ms |
| peak・4倍速成長中 | 33.5 / 33.5ms | 33.3 / 33.3ms |
| 全個体成熟・停止 | 33.5 / 33.5ms | 16.8 / 16.8ms |
| 全個体成熟・4倍速 | 33.5 / 33.4ms | 16.8 / 16.8ms |

停止中と成熟済み進行中は約30fpsから約60fpsへ改善。多数個体が成長/戦闘して見た目を頻繁に更新する場合の約30fpsは残ります。そこまで解消するには個体単位などへ描画を細分化する検討が必要ですが、重なり順やcache管理の変更範囲が広がるので今回は進めていません。sampling中の最大間隔にはProfilerの開始/終了に由来する大きな停止が混ざるため、性能比較には上表の非sampling区間を使用しています。

Graphicsの輪郭を保つためcacheを2倍解像度で描き、表示時に元の大きさへ戻します。幾何・色・文字位置・数値は同じですが、輪郭のアンチエイリアスにpixel差があり、完全なpixel一致ではありません。同じ停止画面をPC/縦長で見比べ、差分領域は盤面内に限られ、side Pane等は完全一致。形、ID、HP、成熟円、赤い面が保たれていることを画像で確認しました。600×450盤面ならRGBA1面は2倍解像度で約4.3MB相当になり、速度と引き換えにcache用textureを保持します。

82単体テスト・production build成功（既存のchunkサイズ警告のみ）。新しいcache検証は成熟中/後の敵存在感、敵消滅、HP、camera/viewport、選択/hover、発射線の期限を対象にしています。既存の短い実UI検証を再利用し、2seed×PC1366×768/縦長390×844で配置・敵/味方情報・4倍速・停止・時間送り・別敵群への再配置・ズーム/パンを通過。描画画像も確認、実行時エラー0でした。WebGLを無効にした同じEdgeのCanvas fallbackも2viewportで描画と進行を確認しました。WEBGL_lose_contextで実際にGPU contextを失わせ復元し、2viewportともpaused stateの維持と、盤面PNGのpixel完全一致を確認しています。

実機スマホ/Safariや多数が密集して継続戦闘する状態は未確認のままです。今回の改善はユーザーテストの操作感判断と独立しており、盤面サイズや新しい遊びの正式化はしていません。

証拠は `docs/evidence/render/`。`before.json` / `after.json` が非sampling比較、`profile-before.json` / `profile-after.json` がCPU内訳、停止画像は同じ自然peak、`mature-checkpoint.json` は元の自然残存runの最終状態です。再確認例（localhost:8781を起動済みとする）：

```text
node scripts/render-profile.mjs OUTPUT_DIRECTORY docs/evidence/endless/20261011-safe-retention-peak.json docs/evidence/render/mature-checkpoint.json --no-profile
node scripts/render-profile.mjs PROFILE_DIRECTORY
node scripts/render-profile.mjs CANVAS_DIRECTORY docs/evidence/render/mature-checkpoint.json --no-profile --canvas
node scripts/context-browser-check.mjs CONTEXT_DIRECTORY
```

旧rendererとの比較は2e745a6の `src/main.ts`、改良rendererはこのcommitを使います。比較中のsource差替えは復元済み。push・公開・Unity起動はしていません。
