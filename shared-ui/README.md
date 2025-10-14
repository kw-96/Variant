# 共享UI库

基于H5tools提取的Vue组件库，为Variant项目提供统一的UI组件和样式系统。

## 特性

- 🎨 **GitHub配色方案**：使用经过验证的GitHub配色，提供专业的视觉体验
- 🌓 **主题切换**：支持浅色和深色模式的无缝切换
- 🧩 **组件化**：提供可复用的Vue组件和hooks
- 📱 **响应式**：适配不同屏幕尺寸
- 🔧 **TypeScript**：完整的类型定义支持

## 目录结构

```
shared-ui/
├── components/           # 通用组件目录
│   ├── DataFileDropZone.vue  # 数据文件拖拽组件
│   ├── DraggableList.vue     # 可拖拽列表组件
│   └── ConfigSelector.vue    # 配置选择器组件
├── styles/              # 样式系统
│   ├── variables.css    # GitHub配色方案
│   ├── reset.css        # 基础样式重置
│   ├── components.css   # Vant组件覆盖
│   └── index.css        # 样式入口文件
├── hooks/               # Vue组合式函数
│   ├── usePopup.ts      # 弹窗管理（从H5tools提取）
│   ├── useSetting.ts    # 设置管理（从H5tools提取）
│   └── useStandardConfigs.ts # 标准配置管理（从H5tools提取）
├── directives/          # Vue指令
│   └── input-dblclick-select.ts # 双击选择指令（从H5tools提取）
├── utils/               # 工具函数
│   ├── common.ts        # 通用工具（从H5tools提取）
│   └── storage.ts       # 存储适配器（从H5tools提取）
├── types/               # TypeScript类型
│   └── ui.ts            # UI相关类型定义
├── package.json         # 包配置
├── index.ts             # 主入口文件
├── index.d.ts           # TypeScript声明文件
└── README.md            # 使用文档
```

## 使用方法

### 1. 导入样式（本仓库内本地引用）

```typescript
import '../../shared-ui/styles/index.css';
```

### 2. 使用组件（本仓库内本地引用）

```typescript
import { DataFileDropZone, DraggableList, ConfigSelector } from '../../shared-ui';

// 数据文件拖拽组件
<DataFileDropZone 
  placeholder="请拖拽数据文件（支持多个）到此处"
  :accept="['.xlsx', '.xls']"
  @files="handleFiles"
  @confirm="handleConfirm"
/>

// 可拖拽列表组件
<DraggableList
  v-model:items="listItems"
  :disabled="false"
  :showSelectAll="true"
  @copy-item="copyItem"
  @delete-item="deleteItem"
/>

// 配置选择器组件
<ConfigSelector
  :configs="configs"
  :editMode="false"
  @switch-platform="switchPlatform"
  @add-config="addConfig"
>
  <template #default="{ config }">
    <!-- 配置内容 -->
  </template>
</ConfigSelector>
```

### 3. 使用Hooks（本仓库内本地引用）

```typescript
import { usePopup, useSetting, useStandardConfigs } from '../../shared-ui';

// 弹窗管理
const { showPopup, hidePopup } = usePopup();

// 设置管理
const { settingData, saveSettingData } = useSetting('key', getDefaultSetting);

// 标准配置管理
const { configs, activeConfig, switchPlatform, addStandard, removeStandard } = useStandardConfigs('key', [], false);
```

### 4. 使用工具函数（本仓库内本地引用）

```typescript
import { deepCopy, generateRandomId, storage } from '../../shared-ui';

// 深拷贝
const cloned = deepCopy(original);

// 生成随机ID
const id = generateRandomId();

// 存储操作
await storage.setAsync('key', data);
const data = await storage.getAsync('key');
```

### 5. 使用指令（本仓库内本地引用）

```typescript
import { inputDblclickSelect } from '../../shared-ui';

// 在Vue应用中注册指令
app.directive('input-dblclick-select', inputDblclickSelect);
```

## 事件与空状态约定

- `ConfigSelector`：
  - 事件：`@add-config`、`@remove-config`、`@switch-platform`
  - 空状态：内部渲染 `<van-empty>`，上层无需重复渲染
- `DataFileDropZone`：事件 `@files`、`@confirm`
- `DraggableList`：事件 `@copy-item`、`@delete-item`、`@add-item`

## 主题系统

### GitHub配色方案

- **浅色模式**：使用GitHub Light主题配色
- **深色模式**：使用GitHub Dark主题配色
- **自动切换**：支持系统主题检测和手动切换

### CSS变量

所有颜色都通过CSS变量管理，确保主题切换的一致性：

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --text-primary: #24292f;
  --text-secondary: #656d76;
  --button-primary-bg: #0969da;
  --border-color: #d0d7de;
}

html[data-theme='dark'] {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --text-primary: #f0f6fc;
  --text-secondary: #8b949e;
  --button-primary-bg: #2f81f7;
  --border-color: #30363d;
}
```

## 开发指南

### 添加新组件

1. 在 `components/` 目录下创建组件
2. 在 `types/ui.ts` 中添加类型定义
3. 更新 `index.ts` 导出新组件

## 存储与消息约定（MasterGo）

- UI 与主线程以 `type: 'storage'` 通讯：
  - `data: { _id, key, method: 'getAsync' | 'setAsync' | 'deleteAsync' | 'keysAsync', data? }`
  - 主线程应回传 `sendMsgToUI('storage', { _id, data })`
- `utils/storage.ts` 已内置：
  - `setAsync` 使用 `JSON.parse(JSON.stringify(value))` 以避免 `postMessage` 克隆报错
  - 仅使用小写 `'storage'` 作为消息类型

### 添加新样式

1. 在 `styles/` 目录下创建样式文件
2. 在 `styles/index.css` 中导入新样式
3. 确保使用CSS变量而非硬编码颜色

### 添加新Hook

1. 在 `hooks/` 目录下创建Hook文件
2. 在 `index.ts` 中导出新Hook
3. 添加相应的TypeScript类型定义

## 许可证

MIT License