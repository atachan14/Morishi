# 現行仕様と確定UI（307ec2eからの変更）

## 現行コードの回答

sizeは表示上%だが実装値は直径。`bodyRadius(diameter)=diameter/2`。size100%は半径50、200%は100。0/-100は未対応。size0半径100等および全倍率Statsの0=補正なしは追加承認済み。共通倍率はx>=0で1+x/100、x<0で1/(1-x/100)。今回はUI先行で、Base値/初期生成/保存移行を別段階にするため現行式を保持。実HP等の絶対値を0基準にする意味ではない。

戦闘は中心距離から攻撃側・対象側の両半径を引いた外周間距離`d=max(0,D-ra-rb)`を使用。距離係数は`max(0,1-d/Range)`。双方size100、Range100なら中心距離150で係数0.5、200で0。対象sizeが異なれば境界も変わる。これはResist軽減前の割合。Range円の描画は攻撃側半径+Rangeで、対象の中心位置までの最終ヒット境界ではない。

Powerは攻撃量の絶対値。Speedは回数/秒、時計にSpeed×0.1を加算。Rangeは外周間の距離。根モードの攻撃量は`Power×発動回数/(1+同属性Resist/100)×距離係数`。通常モードはResist基準70。回復はPower×0.5×発動回数×係数、Resistは使わない。Tech/Techniqueは型・計算未実装、表示は未定義。Skillはkind/element/keyのみでBaseDamage/Base頻度/BaseRangeはない。Stats100を一律1倍と扱う仕組みではない。

根モード: 消費した通常/追加栄養×対応gainをStatsに加算。sizeは消費水分×sizePerWater（既定0.25）を加算。既定消費は昼2水分/秒、夜0、水不足・接触で制限。sizeを掛けてStatsを一括再計算する方式ではない。通常percentモデル:（basis+bonus）×size/100、size+1point/秒を接触で制限。旧sizeモデルの式も残るため根モードと混同しない。

Aura地点値はpercentモデルで`presence-max(0,中心距離-自身半径-候補半径)`。対象選択時の候補半径は省略の0で、攻撃側半径をAura順位へ加算しない。旧sizeモデルでは中心距離を引く。負の地点値もある。配置判定は敵ごとの正値だけの合計が0（加えて体の非重複・配置力等）。攻撃対象はRange内でAura地点値が最大、同点はidの小さい敵。全候補のAura地点値が負でも選ぶ。根Statsや通常保存の能力値そのものの負値は未対応。

外周距離>=Rangeの対象は候補外で時計を消費しない。Range内ならPower0や丸めでdamage0でも発動・時計消費・演出通知する（現行ready判定はdamage>0条件なし）。回復は範囲内かつHP不足の味方全員。

根拠: `src/eco-contract.ts` bodyRadius、`src/eco-v2-foundation.ts` currentV2Stats/v2SurfaceDistance/v2DistanceCoefficient/v2PresenceAt、`src/eco-v2-game.ts` stepV2Core、`src/eco-root-trial.ts` stepRootTrial、`src/eco-v2-save.ts` validate、`src/eco-v2-contract.ts` Skill。

## 今回のUI

- Resist4属性値をPlant基礎Statsへ移動。属性StatsはPower/Technique/Range/Speed。能力計算は同じ。
- 詳細の敵/味方#見出しを削除、種族名行に`種族名 #id`。カードの番号は手札のindex+1（配置済みidとは別）。
- size/Range/AuraをUI表記に採用。保存・内部のdiameter/presence/defense等のキーは保持。
- 表示1行目は配置可能（配置時）/配置可能/Range/Aura。Range/Auraは両陣営同時操作。旧片陣営設定は読み込み時に保持、初回ボタン操作で双方ON、次回双方OFF。
- 配置可能（配置時）はarmed（配置先選択中）のみ表示する独立設定。通常配置可能は常時表示で、両者はOR。キャンセル/配置成功/復元後の非armedで条件表示は消える。既存areaキーは維持、任意areaPlacementキーを表示設定だけに追加。ゲーム保存スキーマは変更なし。
- 表示ボタンは全行共通4列のセル幅・40px高さ。長い配置時ラベルは改行して同寸法に収める。基礎の6項目は折り返す。

共通倍率案の承認は受領したが今回のUIではゲームバランス、ターゲット、減衰、成長、負値、Skill基礎値、Tech用途を変更しない。foundationの差分はエラーメッセージのsize表記のみ。

## 検証

独立配置時設定・常時OR・旧設定JSON互換・片陣営設定から双方ON/OFFを回帰テスト。隔離Edgeで1366×900/390×844/320×568、種族id・Resist基礎値・表示同寸法・両陣営切替・配置待ち/解除・設定復元・ゲーム保存非干渉を確認。人工fixtureは前回のroot-infoを再使用しバランス結果に含めない。実機スマホではない。

結果証跡は`evidence/ecosystem-v2-ui-controls`。画面QAスクリプトは`scripts/ecosystem-v2-ui-controls-check.mjs`。Base値・初期生成・保存移行と実機での操作感は今後の確認事項。

最終結果: 全320tests成功（失敗0）、tsc --noEmit成功、本体とroot-trialの両ビルド成功。PC/SP3幅とも全表示ボタンの高さ40px・行間の幅差1px未満、配置時ラベルがボタン内に収まる。Runtimeエラー0。通常/根ゲーム保存は表示操作前後で同一。

## 無駄打ち構想との未一致

ユーザー意図は、距離よりAuraが強い敵を狙い、敵がいる限り遠方へも無駄打ちし続けるゲーム性。現行stepV2CoreはRange内でのみ対象を選ぶため、この構想とは未一致。今回この条件は新設も変更もせず、効果ゼロを理由に発動禁止する条件も追加しない。水分消費導入時のバランス、Tech水分コスト、Aura0下限は未決定。共通倍率と実効値を区別して次段階で設計する。
