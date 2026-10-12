# サイズ百分率・表面存在感

現在のWeb v2は sizeModel: percent-1。100%=実直径100、倍率1。200%=実直径200、倍率2。毎秒+1ポイント（0.1秒ごと+0.1）で、複利ではない。対立陣営の体が接触すると成長停止する既存の幾何は維持。

基準値は UnitV2.basis（100%時の値）。currentV2Stats は (basis+bonus)×diameter/100 を MaxHP、HPReg、Power、Range、Speed、4属性Defenseに一度だけ適用。存在感は basis.presenceHalo×diameter/100。presenceHalo は旧保存との互換性のための名前で、新モデルでは100%時の外周到達距離を保持する。Techniqueは未定義のまま「—」。現在HPは倍率で直接変えず、最大HPの増分と再生量を加算する。

合体: 実直径は従来どおり hypot(D1,D2)。各実効Stats（存在感も含む）の和を合体後倍率で割って新basisへ格納。bonusを0にし、固定seed値を重ねない。現在HPは両者の和、MaxHPも両者の和なので負傷量は加算される。以後はそのbasisがサイズに比例して成長。

存在感: S − max(0,中心距離 − 自分の半径 − 相手の半径)。地点probeの相手半径は0。手札配置は相手半径を初期直径/2とし、敵の正のscore合計が0なら許可（別途体の重なりを拒否）。表示円は自分の半径+S、配置禁止円は自分の半径+手札半径+S。負のscoreは残し、正のscoreだけが配置を禁じる。射程/戦闘距離と同じ外周幾何。

新規初期値: 手札100%、敵100/120/140%。Power/Range/Speed/Defense/HPの抽選基準は従来の予算。100%時の外周存在感は7.5〜12（元Halo抽選×3）。手札Range9〜16、敵Range14〜22なので旧Haloを体半径ごと再加算して射程を超える事態を避ける。32 seedの初期円盤で非重複・配置可能点を確認。数値は仮バランスで、人間の面白さは未評価。

旧保存移行: 先にチェックサム/元seed/由来/数値を旧式で検証。raw/fixed、手札、HP、直径、座標、年齢、時計を保持。旧実効値を現在のdiameter/100で割り、新basisへ移す。旧bonusは新basisに含めて0へ整理。存在感は旧Sから自分の半径を引いた外周到達距離に換算するので、地点に対する外側の正領域は維持。旧8の個体は8.0%と表示され、実直径は8のまま。以後の成長と合体は新ルール。元JSONは morishi.element-skills.pre-percent.v1 に一度退避し、previousキーにも退避してからprimaryを書き換える。退避またはprimary保存の失敗で元primaryを保持。移行は重ねても同じ結果。古いecosystem/Unity保存キーに触れない。

50種: 初期<150%、中盤150〜400%、高成長>=400%へ成長帯の閾値だけ合わせた。新規percent生成4096個体×9段階=36,864サンプルで全50種に到達例、条件重複0。最少32個体、手札由来でも最少7個体。自由成長投影であり単一戦闘runで全種が出る保証ではない。画像は未生成。

検証: 245 tests成功、tsc --noEmit/Vite build成功（既存Phaserチャンク容量警告）。隔離Edgeの1366×900、390×844、320×568で新規/旧保存の計6ケース、HP/存在感/属性の実数と表示、100.0%/8.0%表示、PC内SP preview、旧raw退避、10秒進行と再読込の一致を確認。実行時エラー0。localhost:8781/ecosystem-v2.html の既存Viteを使用。実機スマホではない。

証跡: evidence/ecosystem-v2-percent/{tests.txt,coverage.json,browser/browser-check.json}。新モデル用画面QAは scripts/ecosystem-v2-percent-check.mjs。
