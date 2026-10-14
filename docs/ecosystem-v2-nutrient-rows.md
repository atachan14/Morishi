# 栄養行マスター

0f0eb7cからの表示変更。行は「栄養/水分/死体」「基本/HP/Reg/Aura/根」「炎/Resist/Power/Tech/Range/Speed」、氷/電/闇も同様。枠内で各行の項目数に均等割付（3/5/6列）。高さは従来属性Stats基準を維持。不要な説明・空行なし。

全体enabled、行rows、個別selectedを別保存。全体OFFで全子操作disabled/gray。行OFFでその行の個別操作disabled/gray。選択は消さず、全体/行ONで復帰。水分/死体は従来の独立用途と全体OFF対象を維持し、基本/属性行マスターには従属しない。Plant吸収根は別設定。Techは未定義のまま無効。

独立nutrient-overlays-1保存へrowsを任意追加。旧設定のrows欠落は全行ONとして移行し、enabled/selectedは保持。不正rowsは既定へ戻す。ゲーム保存・計算は変更なし。

検証: 全333tests、型検査、両build成功。隔離EdgeのPC/390/320、およびPCのSP確認モードで確認。基本/炎OFFと個別選択維持、別属性表示、水分/死体の独立、全体OFFのまま再読込、全体ON後も行OFF保持、行ONで個別復帰、旧保存互換、Plant根独立、ゲーム保存不変、Runtimeエラー0。実機スマホではない。SP確認モードの3Pane横スクロールは既存仕様。

証跡: evidence/ecosystem-v2-nutrient-rows。再現: scripts/ecosystem-v2-nutrient-rows-check.mjs。
