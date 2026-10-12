# Morishi v2: Stats→進化分類・描画asset基盤案

現段階は計画。カタログ判定/画像統合と50画像の取得は未実装。防御の全属性配分は独立修正済み。次に攻撃距離仕様を確定する。「点対象」が180度の点対称か、俯瞰など別の意味かはユーザー確認待ち。形の対称性以外のasset規格は先に共通化できる。

## 分類の契約

- seed種族から能力を決めず、`currentV2Stats`の実効値から名前/画像を選ぶ。
- 候補の条件はall/anyの比較データ。対象はMaxHP/HPReg/diameter/presenceと、4属性のattack/range/speed/defense。Techniqueは未実装なので条件に使わない。
- 優先度降順、同値は安定したid昇順。最低優先度のfallbackを必須にし、条件が該当しない/データが読めない/画像が欠ける場合も既存描画で遊べる。
- 分類で戦闘能力、Skill、成長率、存在感、合体、報酬は変えない。攻撃と治癒のSkill表示を保ち、名前だけで攻撃能力を新設しない。
- 成長/合体/復元でStatsが変われば再評価。分類idは保存の必須項目にせず、保存したStatsから導出する。既存unit id/lineage/selectionを維持する。

## 編集できるデータ

想定ファイルは `public/plant-catalog.json` と `public/assets/plants/<id>.png`。name、priority、conditions、sprite、styleをデータに置く。未知のstat/op、id重複、fallback欠落、asset参照欠落を検証する。次はschema/parser/分類純関数/Canvas adapterを小ロットで作る。以下の閾値は仮例で、配分修正後の分布と画面評価で決める。

```json
{
  "schemaVersion": 1,
  "fallbackId": "sprout",
  "spriteDefaults": {"anchor":[0.5,0.5],"footprintDiameter":0.9},
  "entries": [
    {"id":"sprout", "name":"若芽", "priority":0, "conditions":{"all":[]}, "sprite":"/assets/plants/sprout.png", "style":"cute"},
    {"id":"fire-archer", "name":"ファイアアーチャー", "priority":100,
     "conditions":{"all":[{"stat":"elements.fire.attack","op":">=","value":60},{"stat":"elements.fire.range","op":">=","value":20}]},
     "sprite":"/assets/plants/fire-archer.png", "style":"cute"},
    {"id":"mammoth-flower", "name":"マンモス花", "priority":110,
     "conditions":{"all":[{"stat":"elements.ice.defense","op":">=","value":12},{"stat":"maxHp","op":">=","value":240}]},
     "sprite":"/assets/plants/mammoth-flower.png", "style":"grotesque"}
  ]
}
```

## 画像仕様

俯瞰、512×512、RGBA透過PNG、1種1ファイル、中心アンカー(0.5,0.5)。一枚に複数個体や名前/文字/UIを入れない。外形/根/触手を中心周りの円形フットプリントへ収め、最大外形を同じ割合（例90%）へ揃える。画面では外形のfit率を使って実直径へ合わせる（透明余白込みの画像矩形をそのまま実直径扱いにしない）。当たり判定は既存の円を維持。強い地面影や四角い背景を付けず、可愛い/グロい植物を同じ視点・照明・輪郭コントラストで統一する。厳密な点対称は確認後のprompt条件にする。

最初はfallback＋5種（可愛い/グロい、攻撃/防御系の代表）を生成してサイズ/縮小/巨大化/選択/効果を確認。原本は512px個別PNGで保持。sprite sheetが必要なら16枚ずつ4×4の2048px atlasへ機械的に配置し、切出しはmanifestにx/y/w/hとanchorを記録。画像生成で直接50枚のsheetを一括作らず、個別idとカタログの対応を検証する。

画像は同一originから必要な種類だけlazy decodeし、asset idでキャッシュ。未読込/失敗時は既存circleへfallback。巨大PlantでもCanvas寸法/texture解像度を直径に比例して増やさない。味方/敵の識別枠とSkill色は別に維持する。

## 小ロット→50種

1. 点対称の意味とattack距離案を確定。
2. schema/純関数/境界・優先・tie・fallback・旧save・growth/mergeのテスト。
3. 6種assetを統合しPC/SP320px、ズーム、合体、ロード失敗、効果の視認性をQA。
4. 閾値の到達分布と分類競合を検証し、カタログを12→25→50種へ拡張。
5. 最後に50件のid/名前/条件/優先/assetの整合性を検証。画像未取得を実装済みとして扱わない。

攻撃不発は短射程・中心距離・接触停止の相互作用。進化の見た目だけでこの問題を隠さず、戦闘仕様の判断とart生成を独立して進める。