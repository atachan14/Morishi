# 植物50種 制作リスト

画像未作成。sprite は全件 null。条件・優先度・assetId・輪郭仕様は public/plant-catalog.json が正本。画像の点対称条件は確認待ち。能力補正はありません。

初期サイズ <150%、中盤 150–400%、高成長 >=400%。防御型は最大HPと全攻撃の比、攻撃型は最強属性と射程/速度の比で分岐します。同率属性は火→氷→雷→闇。癒し型の条件は他種から明示的に除外しています。

| 名前 | assetId | 成長帯 / 型 | 見た目 | 輪郭仕様 |
|---|---|---|---|---|
| 若芽 | sprout | any / fallback | cute | 丸い双葉と小さな芽 |
| 火種つぼみ | ember-bud | initial / brawler | cute | 丸い花頭と小さな炭粒 |
| 火花ラッパ | spark-trumpet | initial / archer | cute | 広がる二重ラッパ状の花弁 |
| 灯芯こびと | candle-sprig | initial / swift | cute | 細い葉に囲まれた短い灯芯 |
| 焼瓦花 | brick-petal | initial / defender | cute | 重なる瓦状の厚い花弁 |
| 爆裂キャベツ | blast-cabbage | mid / brawler | grotesque | 裂け目のある重い球状葉 |
| ファイアアーチャー | fire-archer | mid / archer | cute | 細い射出口と弓なりの対葉 |
| ロケット葉 | rocket-leaf | mid / swift | cute | 後ろへ広がる細長い噴射葉 |
| 炉守り花 | kiln-flower | mid / defender | cute | 中央に炉穴を持つ壺状の輪郭 |
| 火山咲き | volcano-bloom | high / brawler | grotesque | 噴火口を囲む大きな肉厚花弁 |
| 砲蓮 | siege-lotus | high / archer | grotesque | 複数の筒が囲む蓮型の花頭 |
| 不死鳥ツル | phoenix-vine | high / swift | cute | 羽状の葉が広がる円形蔓 |
| 玄武岩樹 | basalt-garden | high / defender | grotesque | 岩板を重ねた低い樹冠 |
| 雪豆 | snow-pea | initial / brawler | cute | 雪粒を載せた丸い豆花 |
| 氷笛草 | ice-flute | initial / archer | cute | 細い氷筒と透ける対葉 |
| 霜すべり | frost-skater | initial / swift | cute | 細い刃状葉が広がる浅い花 |
| 氷手袋花 | ice-mitten | initial / defender | cute | 丸い手袋状の厚い葉 |
| 雹玉キャベツ | hail-cabbage | mid / brawler | grotesque | 氷の粒が突き出す球状葉 |
| 水晶アーチャー | crystal-archer | mid / archer | cute | 結晶の射出口と細い対葉 |
| 吹雪羽草 | blizzard-wing | mid / swift | cute | 薄い羽根状の氷葉 |
| 氷河クッション | glacier-cushion | mid / defender | cute | 低く幅広い柔らかな氷花 |
| 氷牙花 | ice-jaw | high / brawler | grotesque | 氷の牙を並べた環状の口 |
| オーロラ塔草 | aurora-spire | high / archer | grotesque | 同心状の細長い結晶花弁 |
| 極光ダンサー | polar-dancer | high / swift | cute | 回転感のある波形の薄葉 |
| マンモス花 | mammoth-flower | high / defender | grotesque | 広い花頭と短い牙状の花弁 |
| 静電つぼみ | static-bud | initial / brawler | cute | 丸い蕾を包む小さな放電葉 |
| アンテナ花 | antenna-flower | initial / archer | cute | 二本の細い受信葉と小花 |
| 雷鳴つぼみ | thunder-bud | initial / swift | cute | 尖った放電葉を持つ小さな蕾 |
| 絶縁ゴム花 | rubber-petal | initial / defender | cute | 丸く厚い絶縁葉の重なり |
| テスラサボテン | tesla-cactus | mid / brawler | grotesque | 多方向に短い導電棘 |
| コイル百合 | coil-lily | mid / archer | cute | 巻いた筒が広がる百合花 |
| 早替えススキ | switchgrass | mid / swift | cute | 鋭い細葉が束になった輪郭 |
| 蓄電ひょうたん | capacitor-gourd | mid / defender | cute | 二重の丸い蓄電房 |
| 雷雲あぎと | storm-maw | high / brawler | grotesque | 放電する歯を持つ環状の口 |
| 稲妻塔花 | lightning-spire | high / archer | grotesque | 太い導電筒と放射状の根 |
| 雷輪草 | thunder-wheel | high / swift | cute | 輪状に連なる細い放電葉 |
| 要塞シダ | fortress-fern | high / defender | grotesque | 重なる装甲状のシダ葉 |
| 墨つぼみ | ink-bud | initial / brawler | cute | 墨色の丸い蕾と短い葉 |
| 夕闇ラッパ | dusk-trumpet | initial / archer | cute | 暗い中心穴を囲む薄い花筒 |
| 影跳び草 | shadow-skipper | initial / swift | cute | 跳ねるような細い対葉 |
| 夜盾花 | night-shield | initial / defender | cute | 丸い盾状の暗色花弁 |
| 飢えツル | hungry-vine | mid / brawler | grotesque | 小さな口を囲む絡まった蔓 |
| 月影アーチャー | moon-archer | mid / archer | cute | 弓形の月葉と細い花筒 |
| 幽灯草 | ghost-wisp | mid / swift | cute | 淡く発光する薄い房葉 |
| 黒絨鎧草 | velvet-armor | mid / defender | cute | 毛羽立った厚い重なり葉 |
| 喰らい蔓 | shadow-maw | high / brawler | grotesque | 中心の大きな口と絡まる根 |
| 深淵の目玉花 | abyss-eye | high / archer | grotesque | 大きな眼状中心と細い筒花弁 |
| 暗黒旋回草 | shade-whirl | high / swift | cute | 渦状に広がる薄い暗色葉 |
| 黒曜蓮 | obsidian-lotus | high / defender | grotesque | 尖った黒い板状の蓮花弁 |
| 癒し蓮 | nurse-flower | any / support | cute | 柔らかな多重花弁と丸い中心 |

検証: 2,048 seed ×手札/敵×9成長段階 =36,864件。全50種に手札由来の到達例、条件重複0。自由成長の投影であり、戦闘を含む単一runで全種に到達する保証ではありません。
