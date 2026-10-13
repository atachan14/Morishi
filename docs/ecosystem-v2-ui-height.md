# 表示ボタン寸法の訂正（68b6473から）

ユーザー訂正: 幅は変更前へ戻し、高さだけ以前の属性Stats表示ボタンに合わせる。

通常表示行は307ec2eの5列、基礎行(data-row=2)は6列へ復元。前コミットで加えた4列・全幅同寸法化と40px固定を取り消した。4項目の内容、Range/Aura両陣営同時、配置時/常時の独立設定、Resist基礎表示、種族#idは保持。Stats計算変更なし。

以前の属性行（Power/Resist/Tech/Range/Speed、font12px、padding4px 6px）の非表示・操作不能な参照行を同じ表示欄幅で測定し、その高さだけを全表示ボタンへ適用。ResizeObserverと表示開閉時の計測で幅・文字折り返しに追従。参照行はaria-hidden、tabIndex=-1、pointer-events:none。ゲームモデルや保存に関与しない。配置時ラベルは小さめの2行で収める。

隔離Edgeの実測:

| viewport | 復元した1行目button幅 | 旧属性行と同じ高さ |
|---|---:|---:|
|1366×900|151.515625px|26px|
|390×844|73.1875px|26px|
|320×568|59.1875px|42px|

全表示行の列数[5,6,5,5,5,5,5]、各button高が参照行と一致、配置時ラベル収まり、切替/保存復元/ゲーム保存非干渉、Runtimeエラー0、横はみ出しなしを確認。実機スマホではない。関連表示/根戦闘テスト9/9、tsc --noEmit、本体/root-trial build成功。今回の変更は表示寸法のみなので全320testsの再実行はせず、前コミットの全量成功を保持。

証跡: evidence/ecosystem-v2-ui-height。再現: scripts/ecosystem-v2-ui-height-check.mjs。

前のdocs/ecosystem-v2-ui-controls.mdに記載した4列/40px仕様は、この訂正で置き換えられる。共通Stats倍率やBase案は今回変更しない。
