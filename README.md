# Variant

一个包含两个独立设计工具插件的项目：ChannelFlex 和 H5tools。这些工具分别提供 Figma 和 MasterGo 两个版本，为设计师提供强大的设计辅助功能。

## 项目特性

- 🎨 **ChannelFlex** - 灵活的设计通道管理工具
- 🛠️ **H5tools** - 专业的H5页面设计工具
- 🔄 **多平台支持** - 同时支持 Figma 和 MasterGo 平台
- 🏗️ **共用前端架构** - Figma和MasterGo版本共用同一套前端界面
- 🔌 **平台适配层** - 通过适配层实现跨平台兼容
- 📦 **统一依赖管理** - ChannelFlex和H5tools共用所有依赖
- 🚀 **Monorepo架构** - 使用workspace管理多个子项目
- 🔧 **完善的开发工具配置**
- 📚 **详细的文档说明**

## 技术栈

- **前端框架**: Vue 3 + TypeScript
- **构建工具**: Webpack 5 (Figma) + Vite (MasterGo)
- **UI组件库**: Vant UI
- **CSS预处理器**: Less
- **代码规范**: ESLint + Prettier
- **依赖管理**: npm workspaces
- **状态管理**: Pinia
- **拖拽功能**: vuedraggable
- **工具库**: VueUse
- **Excel处理**: xlsx

## 技术特性

### 🏗️ 架构设计

- **Monorepo架构**：使用npm workspaces统一管理多个子项目
- **跨平台兼容**：同一套前端代码适配Figma和MasterGo两个平台
- **模块化设计**：清晰的目录结构和组件划分
- **类型安全**：全面使用TypeScript确保代码质量

### 🎨 UI/UX特性

- **现代化界面**：基于Vant UI组件库的移动端设计
- **响应式布局**：适配不同尺寸的设计工具窗口
- **自定义滚动条**：美观的滚动条样式提升用户体验
- **数据持久化**：标签页切换时保持数据状态

### 🧩 Shared UI（shared-ui）

- 统一的 UI 组件与样式来源，供 ChannelFlex 与 H5tools 复用
- 提供组件：`DataFileDropZone`、`ConfigSelector`、`DraggableList`
- 提供 hooks：`usePopup`、`useSetting`、`useStandardConfigs`
- 提供样式：`shared-ui/styles/index.css`（含 GitHub Light/Dark 主题变量与 Vant 覆盖）

### 🔧 开发体验

- **热重载**：开发模式下实时预览代码变更
- **代码规范**：ESLint + Prettier确保代码一致性
- **构建优化**：Webpack 5 + Vite双构建工具优化
- **调试友好**：详细的日志和错误提示

## 快速开始

### 🚀 5分钟快速体验

1. **克隆并安装**

   ```bash
   git clone https://github.com/kw-96/Variant.git
   cd Variant
   npm run install:all
   ```

2. **构建H5tools**

   ```bash
   npm run build:h5tools:mastergo
   ```

3. **在MasterGo中测试**
   - 打开MasterGo桌面应用
   - 导入 `H5tools/mastergo/dist` 目录
   - 体验H5一键切图和按钮尺寸拓展功能

4. **在 H5tools 引用 shared-ui（本地路径）**

   - 在 H5tools 中直接通过相对路径引用组件与样式（本仓库已按此方式接入）：

   ```ts
   // 入口样式（示例：H5tools/src/ui/ui.ts）
   import '../../../shared-ui/styles/index.css';

   // 组件与 hooks（示例）
   import { ConfigSelector } from '../../../shared-ui';
   import { providePopup } from '../../../shared-ui/hooks/usePopup';
   import useSetting from '../../../shared-ui/hooks/useSetting';
   ```

   - 事件命名约定：
     - `ConfigSelector`：`@add-config`、`@remove-config`、`@switch-platform`
     - `DataFileDropZone`：`@files`、`@confirm`
     - `DraggableList`：`@copy-item`、`@delete-item`、`@add-item`

   - 空状态仅由 `ConfigSelector` 内部渲染 `<van-empty>`，上层请勿重复实现。

## 开发指南

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Figma Desktop App（用于 Figma 插件开发）
- MasterGo Desktop App（用于 MasterGo 插件开发）

### 开发流程

1. **克隆项目**

   ```bash
   git clone https://github.com/kw-96/Variant.git
   cd Variant
   ```

2. **安装依赖**

   ```bash
   # 一键安装所有依赖（推荐）
   npm run install:all
   
   # 或者手动安装
   npm install
   ```

3. **开发模式**

   ```bash
   # 启动所有工具和平台
   npm run dev
   
   # 启动特定工具
   npm run dev:channelflex    # ChannelFlex所有平台
   npm run dev:h5tools        # H5tools所有平台
   
   # 启动特定工具特定平台
   npm run dev:channelflex:figma
   npm run dev:channelflex:mastergo
   npm run dev:h5tools:figma
   npm run dev:h5tools:mastergo
   ```

4. **构建项目**

   ```bash
   # 构建所有工具的所有版本
   npm run build
   
   # 构建特定工具的所有版本
   npm run build:channelflex    # ChannelFlex的Figma和MasterGo版本
   npm run build:h5tools        # H5tools的Figma和MasterGo版本
   
   # 构建特定工具的特定版本
   npm run build:channelflex:figma      # ChannelFlex Figma版本
   npm run build:channelflex:mastergo   # ChannelFlex MasterGo版本
   npm run build:h5tools:figma          # H5tools Figma版本
   npm run build:h5tools:mastergo       # H5tools MasterGo版本
   ```

5. **代码检查**

   ```bash
   # 检查所有代码
   npm run lint
   
   # 清理所有依赖
   npm run clean
   ```

## 工具介绍

### ChannelFlex

- **功能描述**：灵活的设计通道管理工具，帮助设计师高效管理设计资源和工作流程
- **支持平台**：Figma、MasterGo
- **架构说明**：Figma版本和MasterGo版本共用同一套前端界面，通过平台适配层实现跨平台兼容
- **主要特性**：
  - 设计通道的创建和管理
  - 资源组织和分类
  - 团队协作功能
  - 版本控制和同步

### H5tools

- **功能描述**：专业的H5页面设计工具，专注于移动端H5页面的快速设计和开发
- **支持平台**：Figma、MasterGo
- **架构说明**：Figma版本和MasterGo版本共用同一套前端界面，通过平台适配层实现跨平台兼容
- **主要特性**：
  - **H5一键切图**：智能识别设计稿中的元素，一键生成多尺寸切图
  - **按钮尺寸拓展**：根据设计规范自动生成不同尺寸的按钮变体
  - **规范配置管理**：支持导入Excel配置文件，管理设计规范
  - **实时预览**：在设计过程中实时预览生成效果
  - **批量操作**：支持批量处理多个元素，提高工作效率

#### 存储与消息约定（MasterGo）

- UI 与主线程通过消息 `type: 'storage'` 进行数据读写：
  - `data: { _id, key, method: 'getAsync' | 'setAsync' | 'deleteAsync' | 'keysAsync', data? }`
  - 主线程使用 `mg.clientStorage[method](key, data)` 执行，并回传 `sendMsgToUI('storage', { _id, data })`
- `shared-ui/utils/storage.ts` 已内置适配，确保：
  - `type` 为小写 `'storage'`
  - `setAsync` 使用 `JSON.parse(JSON.stringify(value))` 以避免 postMessage 深拷贝报错

#### 主题与样式

- 主题变量通过 `shared-ui/styles/index.css` 注入
- 切换通过 `document.documentElement.setAttribute('data-theme', 'light' | 'dark')` 实现
- 针对 Vant 组件的颜色覆盖已统一在样式中处理

## 功能演示

### H5tools 使用场景

#### 🎯 H5一键切图

- **场景**：设计师需要为不同设备生成多尺寸的切图
- **操作**：选择设计元素 → 配置尺寸规范 → 一键生成切图
- **效果**：自动生成适配不同屏幕尺寸的切图文件

#### 📱 按钮尺寸拓展

- **场景**：根据设计规范生成不同尺寸的按钮变体
- **操作**：选择按钮元素 → 设置拓展规则 → 批量生成按钮
- **效果**：自动生成符合设计规范的按钮尺寸变体

#### 📊 规范配置管理

- **场景**：团队需要统一的设计规范和尺寸标准
- **操作**：导入Excel配置文件 → 管理规范设置 → 应用到设计流程
- **效果**：确保设计输出的一致性和规范性

## 项目结构

```t
Variant/
├── package.json              # 🎯 根目录：统一管理所有依赖
├── shared-ui/                # 
│   ├── components/           # 
│   ├── directives/           # 
│   ├── hooks/                # 
│   ├── styles/               # 
│   ├── types/                # 
│   ├── utils/                # 
├── ChannelFlex/              # ChannelFlex 工具目录
│   ├── src/                  # 共用前端界面源码
│   │   └── package.json      # 仅包含lint脚本
│   ├── figma/                # Figma 平台适配层
│   │   ├── src/
│   │   │   ├── plugin/       # Figma插件逻辑
│   │   │   └── messages/      # Figma消息通信
│   │   ├── manifest.json     # Figma插件配置
│   │   ├── webpack.config.js # Figma构建配置
│   │   └── package.json      # 仅包含Figma特定依赖
│   └── mastergo/             # MasterGo 平台适配层
│       ├── src/
│       │   ├── plugin/       # MasterGo插件逻辑
│       │   └── messages/     # MasterGo消息通信
│       ├── manifest.json     # MasterGo插件配置
│       ├── vite.config.ts    # MasterGo构建配置
│       └── package.json      # 仅包含MasterGo特定依赖
├── H5tools/                  # H5tools 工具目录
│   ├── src/                  # 共用前端界面源码
│   │   ├── ui/               # 用户界面
│   │   │   ├── components/   # 组件库
│   │   │   │   ├── standard-size.vue    # 规范尺寸配置组件
│   │   │   │   ├── add-size-config.vue  # 添加尺寸配置组件
│   │   │   │   └── size-config.vue      # 尺寸配置管理组件
│   │   │   ├── pages/        # 页面组件
│   │   │   │   ├── cut/                 # H5一键切图页面
│   │   │   │   └── button-size-expansion/ # 按钮尺寸拓展页面
│   │   │   ├── js/           # JavaScript逻辑
│   │   │   │   ├── hooks/               # Vue组合式API钩子
│   │   │   │   ├── storage/             # 数据存储管理
│   │   │   │   └── utils/               # 工具函数
│   │   │   ├── store/        # 状态管理（Pinia）
│   │   │   └── styles/       # 样式文件
│   │   │       ├── reset.css            # 重置样式
│   │   │       └── common.less          # 通用样式
│   │   ├── messages/         # 消息通信模块
│   │   │   ├── message.ts               # 消息处理核心
│   │   │   ├── messageType.ts           # 消息类型定义
│   │   │   └── sender.ts                # 消息发送器
│   │   ├── config/           # 配置文件
│   │   └── package.json      # 仅包含lint脚本
│   ├── figma/                # Figma 平台适配层
│   │   ├── src/
│   │   │   ├── plugin/       # Figma插件逻辑
│   │   │   │   ├── index.ts             # 插件入口
│   │   │   │   ├── core.ts              # 核心功能
│   │   │   │   ├── utils.ts             # 工具函数
│   │   │   │   └── messages/            # 消息处理器
│   │   │   └── messages/     # Figma消息通信
│   │   ├── manifest.json     # Figma插件配置
│   │   ├── webpack.config.js # Figma构建配置
│   │   ├── tsconfig.json     # TypeScript配置
│   │   └── package.json      # 仅包含Figma特定依赖
│   └── mastergo/             # MasterGo 平台适配层
│       ├── src/
│       │   ├── plugin/       # MasterGo插件逻辑
│       │   │   ├── index.ts             # 插件入口
│       │   │   ├── core.ts              # 核心功能
│       │   │   ├── utils.ts             # 工具函数
│       │   │   └── messages/            # 消息处理器
│       │   └── messages/     # MasterGo消息通信
│       ├── index.html        # MasterGo UI入口
│       ├── manifest.json     # MasterGo插件配置
│       ├── vite.config.ts    # MasterGo构建配置
│       ├── tsconfig.json     # TypeScript配置
│       └── package.json      # 仅包含MasterGo特定依赖
├── docs/                     # 文档目录
├── tests/                    # 测试文件
├── logs/                     # 日志文件
├── DEPENDENCIES.md           # 依赖管理指南
└── README.md                 # 项目说明

## 近期变更要点（与 shared-ui 接入相关）

- 统一空状态：仅在 `ConfigSelector` 内部渲染 `<van-empty>`
- 事件命名统一：`add-config/remove-config/switch-platform` 等
- 存储消息类型统一为小写 `'storage'`
- 修复 Excel 字段兼容：支持 `name/名称`、`w/宽度`、`h/高度`
- 修复 UI 数据流：`size-config.vue` 直接使用 `useStandardConfigs` 返回的 `configs`
```

## 依赖管理

Variant采用**项目根目录统一管理**的依赖架构，ChannelFlex和H5tools共用所有依赖：

### 🎯 架构优势

- **依赖统一管理**：避免版本冲突和重复安装
- **磁盘空间节省**：减少node_modules重复
- **维护性提升**：依赖版本在根目录统一控制
- **开发效率**：一键安装和构建命令

### 📦 安装方式

```bash
# 一键安装所有依赖（推荐）
npm run install:all

# 或者手动安装
npm install
```

### 🔧 开发命令

```bash
# 启动所有工具的所有版本
npm run dev

# 启动特定工具的所有版本
npm run dev:channelflex        # ChannelFlex的Figma和MasterGo版本
npm run dev:h5tools           # H5tools的Figma和MasterGo版本

# 启动特定工具的特定版本
npm run dev:channelflex:figma      # ChannelFlex Figma版本
npm run dev:channelflex:mastergo   # ChannelFlex MasterGo版本
npm run dev:h5tools:figma          # H5tools Figma版本
npm run dev:h5tools:mastergo       # H5tools MasterGo版本

# 构建所有工具的所有版本
npm run build

# 构建特定工具的所有版本
npm run build:channelflex     # ChannelFlex的Figma和MasterGo版本
npm run build:h5tools         # H5tools的Figma和MasterGo版本

# 构建特定工具的特定版本
npm run build:channelflex:figma      # ChannelFlex Figma版本
npm run build:channelflex:mastergo   # ChannelFlex MasterGo版本
npm run build:h5tools:figma          # H5tools Figma版本
npm run build:h5tools:mastergo       # H5tools MasterGo版本

# 代码检查
npm run lint                  # 检查所有代码
npm run clean                 # 清理所有依赖
```

详细的依赖管理指南请查看 [DEPENDENCIES.md](DEPENDENCIES.md)

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

如有问题或建议，请通过以下方式联系：

- 创建 Issue
- 发送邮件

---

⭐ 如果这个项目对您有帮助，请给它一个星标！
