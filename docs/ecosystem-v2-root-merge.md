# v2根モードの合体接続

死亡栄養の次段階は [v2死亡栄養](ecosystem-v2-root-corpse.md) を参照。本書は合体接続時の記録。

対象: http://localhost:8781/ecosystem-v2.html 。Settingで「根成長を試す（保存なし）」をONにし、新規作成する。基準実装は `02bfb5c`。`cfb88f3` は別ページの30分QA記録であり、この合体実装の成果ではない。既存成果を保持したまま、本変更を追加した。

## 現在の合体規則

同陣営の実身体接触を成長前・成長後に既存受け手選択（大きい身体、同値は小さいID）で合体する。

- 貯水と個体容量を加算。A水30/容量100＋B水50/容量100＝水80/容量200。吸水の空き判定とUIも個体容量を使用する。
- 水中成分mixと未消費の有限bonusは各成分を加算する。合体時に消費・生成・土壌への返還をしない。
- 根の広がりは**仮の面積加算**。根半径を `hypot(rA,rB)` にする。`eco-root-trial.ts` の `ROOT_MERGE_SPREAD` / `mergedRootRadius` に分離し、最終ルールの確定扱いにしない。
- 身体直径も面積保存。rootDataの実効Statsは加算し、根だけ上記の半径規則。現在HPは加算し、新MaxHPで上限を取る。サイズからStatsを再乗算しない。既存Skillキー統合、受け手時計、系譜・敵由来を保つ。
- 同じ処理内でRootPlantの水・容量・mix・bonus・Stats・HP・サイズ・位置を同期し、donorをruntimeとUnit両方から除去する。成長前に接触済みのdonorは吸水しない。成長後に接触したdonorは通常の成長処理まで参加し、その後の攻撃には参加しない。
- 合体は死亡ではない。retiredWater/retiredBonus、死亡報酬、死亡栄養は合体では増やさない。本当の死亡時の既存処理だけを維持する。
- 敵接触は身体/能力成長とその水消費を停止する。吸水は合体後の個体容量まで続く。狭い隙間では両者の半径増分の合計を抑える。系譜上限で合体できない同陣営接触は成長を保護停止する。

## 検証の入口

固有テストは `tests/eco-v2-root-merge.test.ts`。30+50/100+100、mix/bonus保存、傷と翌tickのStats、時計とdonor除去、3体連続合体、成長後合体、容量200と満杯時分配、敵接触、敵由来と実死亡、狭い隙間を確認する。既存 `eco-v2-root-combat.test.ts` の合体保護期待は合体期待へ更新した。

画面QAは `scripts/ecosystem-v2-root-merge-check.mjs`。隔離EdgeのPC1366×900・SP390×844/320×568で通常の新規root runを作成し、手札を実入力で2体配置、昼の成長で合体し、夜の次tickまでHP/MaxHP/サイズ/貯水/容量200を追跡する。旧primary保存を変えないことも照合する。実機スマホではない。

死亡栄養の土壌還元・root run保存/移行・天候/季節・新しいSkillは実装しない。根モードは引き続き保存なし。pushなし。
最終検証: **276 tests成功**、型検査成功、本体と独立root-trialのproduction build成功。根合体PC/SP3ケースはdonor除去・容量200表示・夜の水増加・HP一致・旧保存不変が成功、runtimeErrors 0。PC/320px画像を目視確認。証跡は `evidence/ecosystem-v2-root-merge/browser/browser-check.json` と9 PNG。既存根戦闘の画面回帰は同フォルダ `combat-regression` に記録。従来Phaser main bundleの500KB警告は継続。