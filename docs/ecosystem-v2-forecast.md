後続の [最終再検証と配置比較](ecosystem-v2-regression-comparison.md)、[分割時間送り](ecosystem-v2-chunked-time.md) を参照。

現行本体の長期観測と修正は [根・雨・成長の観測](ecosystem-v2-balance-observation.md) を参照。

# v2 独立天気予報UI

対象は http://localhost:8781/ecosystem-v2.html のrootモード。Forestの「天気予報」から入ると実ゲームを停止してMainへ移動する。青い外枠、手札の上の日付・降雨バー・操作列と「天気予報終了」で表示する。

予報はweatherのコピーと独立tickのみを動かす。実ゲームの時間、植物、水、手札、保存データを変更しない。終了で元の視点・手札表示・選択状態を戻し、ゲームは停止を維持する。予報中の保存ハンドラーも書き込まない。古い天気なしroot saveでは天気開始後に利用できる。

範囲は入場時tickの過去3600～未来14400（下限0）。表示時刻では過去6時間～未来24時間。小送り10ticksは表示1分、大送り600ticksは表示1時間。再生速度は1/2/4/10倍、範囲末端で停止。日付は既存の仮想UTC日付であり現実の日付ではない。

太い降雨バーは128点の全域推定降雨量。8×8のweatherSummaryを使い、植物が実際に受け取る水量ではない。降雨0は黒、枠は黒、カーソルは赤。盤上の雨位置・濃さは既存weatherAtのseed/tickから再現する。停止中は毎フレーム再描画しない。

## 検証

全298 tests、型検査、通常buildとroot-trial build成功。隔離headless Edgeの1366×900、390×844、320×568で操作と画面を確認。実機スマホではない。

独立再生・全速度・日付跨ぎ・上下限・複数雨・雨0・繰り返し入退場・実ゲーム再生中の入場停止を検証。全モデルJSONと全localStorageキーが予報中および終了後に不変。保存、新規run、通常送り、天気切替の直接ハンドラー呼び出しでも不変。雨0バーの画素はRGBA(0,0,0,255)。実行時エラー0。

証跡: [browser-check.json](../evidence/ecosystem-v2-forecast/browser/browser-check.json)、同フォルダ12画面、[tests.txt](../evidence/ecosystem-v2-forecast/tests.txt)。人間の面白さ評価、実機操作、長時間メモリ傾向は今回の予報UI検証では未確認。