# カメラ操作・開始演出 — 2026-10-11

`63ea0ce` の減衰場・時間送りに続くcamera工程。新規runは全体を約200ms表示し、約500msでseed由来の合法候補付近へ1.8倍ズームして停止。その後に配置・進行・camera操作が有効になる。`introView` の表示専用hashはgame生成RNGを消費せず、combat stateは変更しない。表示候補は合法点だが、端のpan制限で注視中心は近傍へclampされる。

wheelはcursor付近を保ちつつ拡縮（1〜3倍）。左drag／1本指dragでpan。盤面の外側を見せない範囲に中心を制限する。8CSSpxを超える移動はpanとして扱い、タップ配置をcancel。戻りdragでも配置しない。multitouch／右click／長押し／resize／Pane／背景移行の既存取消は維持。中断後に古いdragが続かないようtrackingを確認する。touch向けに＋／−／全体のcameraボタンも設置。pinch zoomは未実装。

描画とpointerは同じcameraのworld変換を使用。画面のclient座標、canvas letterbox、view中心、zoomを順に変換する。resizeやPane再表示でもworld座標を保存し、画面pixel位置を保存しない。

## 保存と復帰

snapshot-4はview中心x/yとzoomをchecksum対象に保存。pan終了・wheel・cameraボタン・背景移行でviewを保存する。saved runは停止状態で同じviewへ戻し、開始演出を繰り返さない。不正viewは復元しない。camera以前の**同rules snapshot-3**はgame stateをそのまま復元し、全体viewを補う。異なるrulesのsnapshot-2／runtime-1は前工程どおり保護する。

開始演出中は表示時間をvisibilityに合わせて止め、長い背景時間を演出／gameplayへ持ち越さない。通常プレイと時間送りは背景で停止し、明示的に再開する。

## 検証

- **64単体テスト成功、build成功**。camera pan/zoom clamp、world→screen→world、resize、表示hash非破壊、view保存、異常view拒否、同rules snapshot-3の復元を含む。Phaserの既存bundleサイズ警告は残る。
- 隔離Edge **1366×768／1920×1080／390×844／320×740**：実wheelで拡大してからfractional新規配置。実PointerEventをcamera変換した座標とsaved actionが一致。
- 実mouse／touch dragでpanし、余計な配置なし。pan後のunit選択、view完全復元、zoom維持のresizeとmobile Pane切替を確認。
- 変化までの開始／event停止、即取消、4倍進行、停止、保存再読込、実tab hidden/returnでcatch-upなし。即取消はDOM handlerを同じ評価内で2回呼ぶ方法、それ以外の配置・zoom・pan・送り開始はCDPの実入力。
- screenshotsで開始停止後のPC画面・mobile pan画面・小幅表示を目視確認。赤い禁止面は描画近似、cursor判定は解析値。

既存の利用者browser・認証・永続設定は未操作。新しい専用一時profileのheadless Edgeを閉じてprofileをcleanup。依存追加なし。実機スマホ／Safari、初見理解、操作感、P=2／X=1.5／24秒回復のバランスは未確認。

再実行はdev server起動中に `node scripts/camera-browser-check.mjs <出力先>`。最新report／画像は `docs/evidence/camera/`。旧 `browser-check.mjs` と `field-browser-check.mjs` は当時のcameraなし検証用履歴であり、最新UIにはcamera版を使う。

旧Unity・restart原文は保全。local commitのみ、公開／pushなし。
