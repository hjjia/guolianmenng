# 游戏主题交付规范

一个主题由美术素材和游戏身份配置组成。美术人员只需使用 `game-themes/<主题ID>/` 下的分类目录；项目内的 Cocos 路径和 `.meta` 文件由切换脚本维护。

各主题的上架表单文案和平台提交资料统一记录在 [上架文案.md](上架文案.md)。

## 目录和命名

```text
game-themes/pet/
├── theme.json             游戏名、内部 gameId、微信/字节 AppID
├── branding/              游戏内 Logo、登录背景、加载素材
│   ├── logo.png           中文登录横幅，599×272
│   ├── logo-en.png        英文登录横幅，599×272
│   ├── login-bg.jpg       登录背景，720×1280
│   └── editor-splash.png  Cocos 构建启动图，599×272
├── pieces/                棋子，文件名与当前美术资源一致
│   ├── cake01.png         普通状态，86×86
│   ├── cake01Light.png    选中状态，100×100
│   └── ...                萌宠主题提供 cake01～cake32
├── backgrounds/           场景背景
├── ui/                    界面、按钮、弹窗等
├── effects/               特效和动画图片
├── fonts/                 字体图片
├── audio/                 音乐、音效
└── publishing/            平台上传附件，非游戏内资源
    └── icon-512.png       方形应用图标，512×512
```

每个分类目录只有文件，没有更深的子目录。基础 `fruit` 主题提供工程现有的全部 **322 个图片和音频资源**；其他主题只需提供需要更换的文件。完整文件名、目标路径及图片尺寸在 [tools/theme-slots.json](../tools/theme-slots.json)。可以打开 `fruit` 对照样图、文件名和尺寸。新增可替换资源时，先把它加入映射表，并补一份 `fruit` 基础资源。

基础工程有 `cake01`～`cake11`；萌宠主题已有 **32 组、64 张**独立棋子图片。`cake12` 起会随所选主题自动加入 Cocos 资源目录；切回水果主题时，脚本会移走自己生成的附加棋子，并暂存编辑器生成的 `.meta` 以便切回。新增 `cake33` 时只需提交 `cake33.png` 和 `cake33Light.png` 两张同尺寸图片，编号必须连续。

`theme.json` 的 `pieceCount` 决定随机生成的关卡可使用前多少种棋子，当前两套主题都设为 8，以保持原玩法。需要让未来关卡使用全部萌宠棋子时，把萌宠主题的 `pieceCount` 改为 32，并在编辑器重新导入后测试关卡。CSV 中已有的前 50 关仍按关卡表使用前 8 种。

替换图片必须保持映射表里的像素尺寸和文件格式。九宫格边距、图集内透明留白、序列帧画面顺序应与原图兼容。音频文件名及格式保持一致。不要交付或覆盖 `.meta`、Prefab、Scene。`npm run theme:validate -- pet` 会检查尺寸、缺失的基础文件和未登记的文件；九宫格拉伸效果仍需在 Cocos 中人工预览。

## 游戏身份

每个主题的 `theme.json` 包含：

```json
{
  "id": "pet",
  "displayName": "萌宠消消岛",
  "projectName": "PetCrush",
  "gameId": "pet",
  "pieceCount": 8,
  "pieceName": "萌宠图案",
  "shareTitle": "萌宠消消岛 - 一起来消除吧！",
  "platforms": {
    "wechatgame": { "appId": null },
    "bytedance-mini-game": { "appId": null }
  }
}
```

- `id` 是主题目录名；`gameId` 是游戏内部身份，用于区分本地存档。已发布后不要随意更改。
- `displayName` 是游戏显示名；`projectName` 是编辑器工程名；`shareTitle` 是微信分享标题。
- `pieceCount` 是随机关卡可用的棋子编号上限，至少为 8，不得大于主题实际提供的连续棋子数量。
- `pieceName` 是玩家在道具说明里看到的对象称呼，例如水果主题填“水果”，萌宠主题填“萌宠图案”；以后新增主题时也要填写，切换主题会同步更新这些说明。
- 微信 AppID 和字节 AppID 是两个独立值。申请到后填入对应平台；未知时写 `null`。切换主题会清空该平台遗留的旧 AppID，并在终端提醒填写，避免把萌宠误发到水果游戏账号。
- 一个主题只有一份 `theme.json`，其中 `platforms.wechatgame.appId` 和 `platforms["bytedance-mini-game"].appId` 分别管理两个平台。填写后运行 `npm run select:<主题ID>`，脚本会将两个值分别写入对应平台的 Cocos 构建配置；在编辑器 Build 面板再选择微信小游戏或字节小游戏。不需要在切换主题时指定平台。AppID 请改在 `theme.json`，不要只改编辑器中的临时值；切换主题会重新写入配置。
- `package.json` 里的项目 UUID 属于 Cocos 工程，多个主题共用这一工程；它不是平台 AppID。
- 微信和字节的广告位、分享图片等若后续接入，应按平台增加到 `theme.json`，不要在公共代码写死。

## Logo 和方形图标

`branding/logo.png` 和 `branding/logo-en.png` 对应登录场景的两张横幅图片；`branding/editor-splash.png` 对应构建设置中的启动图。它们都是不同的资源槽位。

`publishing/icon-512.png` 是申请/上传微信或字节小游戏时供平台使用的**方形应用图标**；它不会自动替换游戏内 Logo，也不会被 Cocos 打进场景。每个平台的实际上传规格应以其后台要求为准。

微信游戏审核用的实机截图也可按 `wechat-scene-01.png` 等名称放在同一主题的 `publishing/` 目录。该目录接受 JPG、JPEG、PNG 图片，不参与游戏资源同步或打包；截图具体要求见 [上架文案.md](上架文案.md)。

萌宠主题现已提供 `branding/logo.png`、`branding/logo-en.png` 和 `branding/editor-splash.png`，分别用于中文横幅、英文横幅和构建启动图。

萌宠登录背景来自源资料中的 `assets/loginBg.jpg`，原图 1024×1826；已转换为 `branding/login-bg.jpg` 的 720×1280，约从 601 KiB 降至 186 KiB。以后交付登录背景请优先提供 720×1280 JPG。

## 使用

在项目根目录执行，建议先关闭 Cocos Creator：

```bash
npm run select:pet
```

这一个命令会校验主题、压缩所选图片并同步到工程。然后打开 Cocos Creator，等待资源导入完成后预览或在 Build 面板选择平台构建。`select` 不指定构建平台。切回水果主题：

```bash
npm run select:fruit
```

`npm run theme:list` 可以查看主题；`npm run theme:validate -- pet` 只校验资源，不同步。新增主题时，可参照本机 `/Users/jia/Documents/图片资料/萌宠消消岛/` 的独立交付包，在其同级目录生成新游戏文件夹。文件夹中的 `主题资源/` 与 `game-themes/<主题ID>/` 同结构；在工程根目录运行 `npm run theme:import -- "/完整路径/新游戏文件夹"`，脚本会复制、校验并切换。交付文件夹可以叫中文名，但目标目录使用 `主题资源/theme.json` 的英文 `id`：例如 `海洋消消乐/` 中 `"id": "ocean"`，会导入 `game-themes/ocean/`，并自动添加 `npm run select:ocean`。方形图标的各个尺寸保留在交付包的 `logo-sizes/`，只有 512 PNG 同步到主题的 `publishing/icon-512.png`。

已有主题更新资源时，不要使用 `theme:import`。关闭 Cocos Creator 后执行：

```bash
npm run theme:update -- "/完整素材目录" <主题ID>
```

素材目录可以是包含 `主题资源/` 的交付根目录，或主题资源目录本身。例如：

```bash
npm run theme:update -- "/Users/jia/Documents/图片资料/果联盟/新版UI/果联萌美术v2" fruit
```

命令会递归同步 `audio/`、`backgrounds/`、`branding/`、`effects/`、`fonts/`、`pieces/`、`publishing/`、`ui/` 等目录中的图片和音频，不删除旧文件，也不会复制 `.meta`。如果源 `theme.json` 的 `id` 与指定主题 ID 一致，配置文件也会参与更新；ID 不一致时会跳过配置，避免把其他主题的身份覆盖进来。所有变更会先备份再进行完整主题校验，校验失败时自动恢复，校验成功后自动切换到指定主题。

### 同一平台保留多套构建包

切换主题后，在 Cocos **Build Path 右侧的输出名输入框**手动填写 `<主题ID>-<平台>`。Cocos 新建任务时可能自动生成 `wechatgame-001` 之类的名称；`select` 无法替新任务锁定这个输入框。`Name` 是游戏名称，不是输出目录名。构建路径左侧保持项目的 `build/` 即可。例如：

| 操作 | Cocos 构建平台 | 输出目录 |
| --- | --- | --- |
| `npm run select:fruit` 后构建 | 微信小游戏 | `build/fruit-wechatgame/` |
| `npm run select:pet` 后构建 | 微信小游戏 | `build/pet-wechatgame/` |
| `npm run select:pet` 后构建 | 字节小游戏 | `build/pet-bytedance-mini-game/` |

每次切换主题时，先关闭 Cocos Creator，执行对应的 `select` 命令，再打开编辑器，在 **Build 面板新建构建任务**、选择平台，把 Build Path 右侧的输出名改为表中的名称后构建。不要直接点旧构建任务的“重新构建”；旧任务保存了上一次的构建参数，可能仍指向旧目录。两个主题的同平台目录互不覆盖。`build/` 已被 Git 忽略，需长期留存或交付时请另行备份构建包；同一主题、同一平台再次构建会更新它自己的目录。平台 AppID 仍取当前主题 `theme.json` 中的对应值。

`select` 会自动从水果基础主题和当前主题中选出要使用的图片，在临时目录压缩，再将压缩版直接同步到 Cocos 的 `assets/` 目标目录；主题目录里的原图保持不变。压缩文件名、格式和像素尺寸均保持一致。对 PNG 会比较调色板压缩和保留完整透明度的轻量颜色量化，选取满足画质检查且体积更小的版本；JPEG 也会进行检查。脚本只接受节省至少 15%、平均可见颜色误差不超过 2.5/255 且透明度误差通过检查的压缩版；其他图片按原图复制。再次切换时会从原图重新生成，发现画质问题可以调整压缩规则并重新切换。`npm run theme:optimize -- pet --balanced` 可只预估压缩收益，不修改任何资源。脚本需要本机安装 `ffmpeg`。最终小游戏包体大小仍要以 Cocos 针对目标平台的构建结果为准。

当前执行 `npm run select:pet`，所选图片和音频原图约 10.01 MiB，压缩并同步到工程后约 6.96 MiB。`publishing/icon-512.png` 不属于游戏内资源，不计入这两项。萌宠仍复用部分水果主题资源；未通过画质检查的图片会保留原图。若实际构建包体仍超限，需要结合构建结果逐项处理主包资源或拆分资源包。

切换时，脚本对每个基础槽位选用该主题图片或 `fruit` 图片，以防上一个主题的图片残留。直接改 `assets/` 下这些图片会在下次切换时被主题源文件覆盖；基础美术修改应同步改 `game-themes/fruit/`。

## 萌宠示例的来源与范围

萌宠素材原稿保存在 `/Users/jia/Documents/图片资料/萌宠消消岛/原始资料/pet-theme-v2`；可交给大模型的独立交付目录为同级 `萌宠消消岛/`，其中 `主题资源/` 与本工程 `game-themes/pet/` 对应，详细出图要求见该目录的 `README.md`。32 组 86×86 / 100×100 棋子、登录背景、Logo、其他场景背景、弹窗和提示图已接入。原始资料中的 224×224 大头像、合成图和 ZIP 是另外一套导出，不作为棋子重复打包。微信 AppID 已配置，字节小游戏 AppID 仍待提供。

`pet` 中的 `common-commonImgTitle1/2.png`、`bonusTimeImg02.png` 和三个 `homeImg02.png` 槽位现已与水果原图不同；三个 `homeImg02.png` 使用同一张萌宠小窝图。`common-commonRectangle09.png` 是通用底板，`fight-showTarget-homeImg03.png` 是通用小圆点，本次均无需重画。`showTargetCake.prefab` 和 `linkItem.prefab` 的默认 `cake01` 已直接引用 `pieces/cake01.png`；无需单独生成动画目录的 `cake01`。开始按钮、地图入口、转盘、默认头像、人物动画、签到、道具和商店购买文字等 36 张可见 UI 原图已按槽位复制到 `pet/`，并同步到独立交付包；这些文件目前仍是**水果版参考图**，生成新主题时应重新设计，不能当作已完成的萌宠美术。通用特效继续由基础主题复用。
