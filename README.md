# Variant

一个专业的多功能设计工具插件项目，同时提供 **MasterGo** 与 **Figma** 两个版本。
Figma 与 MasterGo 共用同一套前端界面（`Variant/src/ui`），插件主线程代码分别位于
`Variant/figma` 与 `Variant/mastergo`。

## 项目特性

- 多功能设计工具集合：资源位创建/导出、商店图、组件库、H5 奖品/一级标替换、工具箱
- 多平台支持：Figma / MasterGo 共用前端，按平台注入各自的主线程实现
- 统一消息层：UI 与主线程通过 `MessageType` 通信（`Variant/src/messages`）
- Monorepo：npm workspaces 管理 `Variant/src`、`Variant/figma`、`Variant/mastergo`
- 主题单一来源：跟随系统 + 用户手动记忆（`data-theme`）

## 技术栈

- 前端框架：Vue 3 + TypeScript
- 构建工具：Webpack 5（Figma）+ Vite（MasterGo）
- UI 组件库：Vant UI
- CSS 预处理器：Less
- 状态管理：Pinia
- 表格处理：xlsx；图片压缩：upng-js（mastergo 依赖，已存在）

## 开发指南

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- MasterGo Desktop（调试 MasterGo 插件）；Figma Desktop（调试 Figma 插件）

### 常用命令

```bash
# 安装全部依赖
npm run install:all

# 开发（MasterGo + Figma）
npm run dev

# 构建（两个平台）
npm run build

# 单独构建
npm run build:mastergo
npm run build:figma

# 代码检查 / 清理
npm run lint
npm run clean
```

## 功能说明（MasterGo 端）

### 资源位

- **创建**：图片切片、表格创建等资源位生产工具；图片切片按整数像素切割并吸收取整余数，避免切片接缝。
- **导出（渠道导出）**：在画布选中画板后点击「点击导入」，逐张扫描并预览；
  - 「按渠道分组」开关默认开启：按图层名识别渠道（内置渠道关键词，未识别归「未分类」），按
    `渠道/[组件描述/]文件名` 打包 ZIP；同一「渠道 + 组件描述」只有 ≥2 个资源时才建二级目录；
  - 关闭开关后为「平铺导出」：ZIP 内不再建渠道目录，仅保留文件名，兼容旧导出习惯；
  - 每行可设置目标体积（`500k` 形式，留空不压缩）与 jpg/png；被判为 JPG 但含透明像素时自动改用 PNG；
  - 压缩失败不丢图（回退导出原图并提示大小未达标）；单文件直接下载。
- 页面提供「显隐安全区」按钮（与插件菜单同一处理器）。

### 商店图

- **设计 / 导出 / 配套**：沿用既有商店图生产流程（导出页复用旧导出组件）。

### 组件库

- 团队库组件批量导入；导入成功后按渠道名把素材包裹进「区域（Section，运行时缺少 API 时回退 Frame）」，
  区域背景 `#3D3D3D`、四周外扩 400px，保持素材相对位置。
- 自动排版采用两级分组 + 套件配对：按组件描述分组，组内「正式图 + 预览图」成套左右相邻，
  超出单行宽度自动换行；正式/预览按名称归一化、尺寸完全相同优先、尺寸最接近兜底配对。
- 转组件时精确写入宽高并与原画板尺寸校验；尺寸不一致先修正一次，仍不一致则回滚原始画板并保留原状。
- 批量导入会根据文本自动识别渠道资源位；**用户手动选择过渠道后不再被自动识别覆盖**，
  多渠道时仅提示手动选择。

### H5（奖品替换 / 一级标替换）

- **奖品替换**：选中 H5 奖品组件，按选中顺序每行一个奖品；按完整名称匹配奖品变体，
  同步更新命名「奖品名称」的文本属性/图层；输入行多于选中实例时自动补建实例；
  「仅文案更新、图片未替换」会单独提示。
- **一级标替换**：查找选中组件（含嵌套实例）中名为「一级标」的可见文本属性/文本图层，按行替换；
  隐藏图层及隐藏父级不参与；「提取命名」可把现有可见一级标按从上到下、从左到右回填输入框（不改画布）。
- 旧的「H5 一键切图 / 按钮尺寸拓展」页面已下线（MasterGo 端入口移除，仅 Figma 端保留历史处理器）。

### 工具箱

**快捷操作**：填充组件、自动排列、整数像素、简单约束、批量组件、批量水印。

**实用工具**：

- **批量产出**：把「数据流 / 批量按钮 / 批量延展」收进一个页面的三个模式（KeepAlive 缓存，切换不丢状态）。
- **批量命名**：固定文本、自动序号、统一命名（按类别筛选后同名分组批量改名）。
- **通用替换**：文本替换 / 图片替换 / 图层名替换；可填属性名过滤，每行一个目标值。
- **实例适配**：直接选中实例后「适配」——宽高设为所属最外层画板/组件容器宽高（非等比）、
  约束设为水平/垂直跟随缩放、贴齐容器左上角；每个实例独立校验，失败恢复原状并计入跳过，
  成功后合并为一次可撤销操作。「按名称选中」仅用于按实例名完全匹配并选中，不参与适配过滤。
- **批量切换实例**：
  - **新版规则（默认）**：由目标组件新建实例，按旧实例宽高上限等比缩放（contain）并在旧框内居中，
    图层命名为目标组件名；校验通过后删除旧实例，失败删除新实例并保留旧实例（回显原因）。
  - **旧版模式（每行勾选 / 表头全选）**：优先直接更换组件引用并**保留旧图层名**；
    无直接切换方法时新建实例并复制旧位置、宽高。
  - 实例名为 `背景`（可带 `0-`、`1_` 等数字前缀）时，新版规则下按所属画板 cover 铺满并居中。
  - 删除同名实例后仅本地移除该行；删除失败会刷新列表，避免列表与画布不一致。
- **一键抠图**：选中带图片填充的图层，自动识别背景类型（边缘纯色 / 圆角白卡白底）并去底，
  结果作为新图层放回原图右侧（原图不改）；多图可切换、容差可微调。
- **PSD转换**：见下节。

### PSD 转换

- 入口在工具箱；页面使用 iframe 内联原独立插件（psd-2-mastergo）的打包界面，
  通过 `PSD_TO_PLUGIN / PSD_TO_UI` 透明转发消息，并把宿主主题变量同步给 iframe。
- 支持：PSD/PSB 导入为 MasterGo 原生图层（组/文本/矢量/位图/蒙版/剪贴/效果）、图层整理与导出回 PSD。
- 限制：仅 RGB 8 位、单边 ≤ 30000px、文件 ≤ 2GiB、图层 ≤ 5000；导出 PSD 时形状/描边按位图写入。
- 说明：界面与主线程逻辑来自外部工程的构建产物（`psd-ui.html`、`psd-convert.ts` 带 `@ts-nocheck`），
  仓库内没有其源工程，后续维护需回到原工程修改后重新产物化。

### 窗口与主题

- 面板默认 405×680；右下角拖拽手柄可自由调整窗口大小（最小 300×320，移动事件按帧合并）。
- 明暗模式：首次按系统主题渲染，用户手动切换后写入 storage（key：`theme_mode`），下次打开还原；
  不再跟随 MasterGo 编辑器主题（插件端不再下发主题消息）。

## 存储与消息约定（MasterGo）

- UI 与主线程通过消息 `type: 'storage'` 读写 `clientStorage`：
  `data: { _id, key, method: 'getAsync' | 'setAsync' | 'deleteAsync' | 'keysAsync', data? }`，
  主线程回传 `sendMsgToUI('storage', { _id, data })`；
  `Variant/src/ui/utils/storage.ts` 已内置适配（`setAsync` 会先做 JSON 深拷贝）。
- 消息类型集中定义在 `Variant/src/messages/messageType.ts`；主线程处理器在
  `Variant/mastergo/src/plugin/index.ts` 统一注册（支持数组/单对象混合）。
- 选区变化只推送轻量字段 `{ id, type, name }`；需要完整信息（图层类型、组件实例数等）的页面
  使用 `SELECTION_INFO_REQ / SELECTION_INFO` 主动查询。

## 主题与样式

- 主题变量通过 `Variant/src/ui/styles/index.css` 注入，切换方式：
  `document.documentElement.setAttribute('data-theme', 'light' | 'dark')`。
- 主题唯一来源：`Variant/src/ui/utils/theme.ts`（系统主题读取 + 写入 + storage key）。
- 美术工具页面使用 `styles/art.css` 设计系统（含深色变量映射）。

## 项目结构

```text
Variant/
├── package.json                  # 根：npm workspaces 与统一脚本
├── Variant/
│   ├── src/                      # 共用前端界面与消息层
│   │   ├── messages/             # MessageType、sender、消息监听
│   │   ├── plugin/utils.ts       # 插件侧共用工具
│   │   ├── component-library/    # 组件库共享逻辑（导入失败、背景实例名等）
│   │   ├── types/                # 共享类型与 ?raw 资源声明
│   │   └── ui/
│   │       ├── App.vue           # 导航、主题、窗口拖拽
│   │       ├── pages/
│   │       │   ├── art/          # 渠道导出、H5 替换、统一命名、通用替换
│   │       │   ├── psd/          # PSD 转换（index.vue + psd-ui.html 产物）
│   │       │   ├── cut/cutout.vue# 一键抠图
│   │       │   ├── create/       # 资源位创建
│   │       │   ├── component-library/
│   │       │   ├── toolbox/      # 工具箱各工具页
│   │       │   └── ...           # 商店图/导出/配套等
│   │       ├── components/       # 通用组件（TabInput、TabTextarea 等）
│   │       ├── utils/            # storage、theme、上传等
│   │       ├── styles/           # index.css/components.css/art.css
│   │       ├── store/            # Pinia（组件库目录）
│   │       └── ui.ts             # UI 入口（Vant 注册、首帧主题）
│   ├── mastergo/
│   │   ├── manifest.json         # MasterGo 插件清单
│   │   └── src/plugin/
│   │       ├── index.ts          # 处理器注册、菜单命令、选区推送
│   │       ├── messages/         # 各功能处理器（art-tools/psd/cutout/...）
│   │       └── utils/            # node-utils（trySet/resizeNode/collectTextNodes）
│   └── figma/                    # Figma 主线程与 UI 构建
├── package-lock.json
└── README.md
```

## 已知限制

- PSD 转换的界面与主线程逻辑为外部工程构建产物，未包含其源码与构建配置。
- Figma 端仍保留旧 H5 切图/按钮尺寸拓展的主线程处理器，但共用 UI 已无对应入口。
- `psd-convert.ts` 使用 `@ts-nocheck`，静态类型保护有限。
