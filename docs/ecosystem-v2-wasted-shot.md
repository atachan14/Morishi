# 無駄撃ち本体接続と残タスク確認

UI行マスター7bbda18を完了後、docs/ecosystem-v2-correction.md・ecosystem-v2-ui-requirements-audit.md・morning-play記録と現行contract/foundation/game/mainを照合。

## 今回の小さい到達点

新規Web runのGenerationConfigにtargetPolicy=aura-any-distance-1を明示。攻撃は距離で候補を除外せず敵全体のAura地点順位（同点id）で対象を選ぶ。範囲外は既存距離係数0で効果0、発動時計と演出通知は通常通り消費。全候補のAura地点値が負でも選ぶ。水分コスト/Tech/Aura正値フィルタを追加しない。回復は従来の範囲内・HP不足味方全員のまま。

旧保存でtargetPolicyがないrunは従来の射程内候補を維持。読み込み時に方針を自動書き換えない。保存checksumは明示方針を含み、凍結seedのconfigとして復元できる。新規方針でRNG消費を増やさず、同seedの初期配置・body size・fixed Statsは一致。Web本体の初回生成と「新しい庭」に接続し、helperのみの追加ではない。

新4tests: 強い遠方Auraへ0damage発動/時計消費、旧方針の近接選択と候補なし時計保持、全候補負Auraでもroot発動/追加水分なし、保存方針往復/初期値一致。全337tests、型検査、本体/root-trial build成功。隔離Edgeで旧fixtureの方針なしを確認し、PCの新しい庭（通常100体・半径2400）を作成して保存/runtimeに新方針が入ることを確認。PC/SP390/320、SP確認モードの行マスター検証も再実行。実機スマホではない。証跡evidence/ecosystem-v2-wasted-shot、再現scripts/ecosystem-v2-wasted-shot-check.mjs。

## 残タスク（実装状態と判断点）

- 共通M、0基準の本体半径100/Aura到達200/根到達200、有限負値、逆変換、版分離・原本バックアップ: 6d0643bで実装・検証済み。
- 共通幾何基準のゲーム計算/UI値への全面接続: まだ未実装。現行庭のsizeは旧直径%表示、Aura/根は実効値で動く。0補正の新規種は半径/到達が大きく変わるため、未承認の新規初期分布を勝手に選ばない。
- 旧実効値の継承: 非0・根外端>本体・surface Auraのroot保存は逆変換プレビューで維持可能。それ以外（実効Aura0/本体内根/旧中心距離Aura/通常モード根なし）は失敗停止して旧モデルを保持。自動フォールバック数値は未決定。
- 成長/合体: 現行は実効値の加算・面積合成。補正値へ直接加算すると結果が変わる。実効演算後に逆変換する移行を採るか、補正演算へ変更するかを決める必要がある。
- Power/Speed/RangeのSkill Base、Tech水分Cost、Aura0以下の候補制約: 未承認。今回変更なし。
- 残る人間評価: 新しい無駄撃ちの操作感・待ち時間・面白さ、実機スマホ。長時間QAの旧記録は保持し、新方針の長時間実プレイ完了とは扱わない。

次の具体的設計は「既存runは実効値を保った逆変換を使い、0基準表示だけ先に接続するか」。実効0と旧モデルの表現を決めてから、保存版・出生・成長・合体を一段ずつ接続する。新規分布/栄養gainの再調整は別段階。旧Unity調査は今回の成果に含めない。
