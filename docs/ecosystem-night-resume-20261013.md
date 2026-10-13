# 現行Web版の夜間再開検証 — 2026-10-13

対象: http://localhost:8781/ecosystem.html 。再開時HEAD `02bfb5c2bce8ceb3c22fd7a9ff4e641070e54336`。引継ぎの `5e6249e` より後の実装・証跡を確認した。追跡ファイルの未保存差分なし。既存Vite PID9632と既存未追跡証跡は保持。旧Unity調査は対象外。

## 実時間30分

既存 `scripts/ecosystem-session-browser-check.mjs` を1800秒、隔離headless Edgeで単独実行。ユーザーブラウザには触れていない。長時間戦闘を維持する高HP/回復の人工fixture（seed811、25%継承・距離同値・非均等小集団配置）であり、通常プレイ到達履歴や面白さの証明ではない。

- 経過1800.3秒、最終tick17264。停止/再開・手札選択・実入力配置と合体14巡回。
- チェックポイント保存/復元4回、再読込後の状態一致、復元後の再合体一致。
- trustedなvisibilitychangeで非表示停止/復帰3回。非表示中は保存JSON不変、復帰は停止を維持し手動再開。
- 120サンプルで保存状態と純粋モデルの逐次照合が完全一致。フリーズ・実行時エラー・検査失敗0。
- 生存27個体、最終イベント8件・手札6枚・接続DOM468。系譜は配置履歴に応じて増加し最終41ID。
- 保存26,209〜28,330 bytes、最終28,323 bytes。イベントや生存オブジェクトの無制限蓄積は観測されない。
- 巡回1〜14のGC後JSヒープ1,733,112〜2,024,596 bytes、最終1,877,756 bytes。単調な増加なし。GCを含む限定条件の観測であり、リーク不在や24時間安定の保証ではない。
- 最終PC画面1366×768を目視確認。旧ページ保存キーの文字列も維持。

証跡: `evidence/ecosystem-night-resume-20261013/session-check.json`、各cycle JSON、`final-save.json`、`final-screen.png`。

## 全量検証と次工程

267 tests成功、TypeScript型検査とVite production build成功。従来Phaser main bundleの500KB警告は継続。確実な不具合は今回見つからず、ゲームルール/保存形式/Skillカードは変更していない。

最新の別ページ `ecosystem-v2.html` には100体配置・percent Stats・根成長/戦闘接続等の成果がある。根モードの保存・合体・死亡栄養・季節等の不足は `ecosystem-v2-root-combat.md` を現行参照とし、古い `ecosystem-v2-root.md` の未接続記述を現状判定に使わない。今回の30分QA結果をv2根モードへ流用しない。

朝は `ecosystem-morning-play.md` の少数条件比較で、待ち時間、前衛配置の意味、もう一度配置したいかを人間が評価する。実機スマホ・24時間放置・通常runの長期活動・最新v2根モードの30分soakは未確認。公開/push/購入/新規権限変更なし。
追加のスマホ幅回帰: 320×568 / 390×844 / 844×390 の隔離Edgeタッチエミュレーションが成功。drag/pinch/cancel誤配置防止、armed reload、1回だけの配置、勝利/終了制限、破損保存保護、quota失敗と明示再試行を検証。failures/runtimeErrorsとも0。320px画面を目視確認。証跡は同フォルダの mobile/mobile-check.json と18 PNG。実機スマホではない。
