# 栄養マスターと表示行の再整理

3c38ce2からのUIのみの変更。倍率モデルのプレイ接続、Stats計算、ゲーム保存スキーマは変更なし。

- 1行目: 配置可能（配置時）/配置可能/Range/Aura/根。Plant吸収根の独立設定を維持。
- 栄養操作行: 栄養/水分/死体。
- 栄養基礎行: HP/Reg/Aura/根。
- 各属性行: Resist/Power/Tech/Range/Speed。表示パネルの独立Resist行は廃止。Plant詳細の4属性基礎Resistは保持。

ユーザーの4行目/5行目は意味で対応し、実表示は2行目/3行目。空行追加なし。幅は従来の通常5列・従来基礎操作行6列、高さは従来の属性Stats参照行実測（PC/390=26px、320=42px）を維持。

栄養マスターOFFは水分・死体・基礎/属性の全栄養表示を一括抑止。子選択Setは変更せず、子ボタンをdisabled+grayscale。ONへ戻すと選択状態をそのまま反映。Plant吸収根の別トグルやRange/Aura・配置表示は抑止しない。TechはONでも未定義で無効。

表示設定を独立キーmorishi.nutrient-overlays.v1、version=nutrient-overlays-1へ保存。enabledとselectedを分離し、OFF状態も選択も再読込で維持。未知版・不正選択は既定値（栄養ON、root/corpse選択）へ戻す。根/通常ゲーム保存は表示操作前後で不変。

検証: 新マスター回帰テスト1件を追加、行順テスト更新。全332tests成功、tsc --noEmit、本体/root-trial両build成功。隔離Edge1366×900/390×844/320×568で行順・Resist位置・旧寸法・子選択保持・OFF時操作無効・一括抑止・OFFのまま再読込・ON復帰・独立Plant根・通常/根保存非干渉・Runtimeエラー0・横はみ出しなしを検証。OFF/復帰画面も確認。実機スマホではない。

証跡: evidence/ecosystem-v2-nutrient-master。再現: scripts/ecosystem-v2-nutrient-master-check.mjs。以前の栄養6項目1行/Resist独立行の説明は本変更で置き換え。
