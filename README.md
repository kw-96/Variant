# Variant

一个包含两个独立设计工具插件的项目：ChannelFlex 和 H5tools。这些工具分别提供 Figma 和 MasterGo 两个版本，为设计师提供强大的设计辅助功能。

## 项目特性

- 🎨 **ChannelFlex** - 灵活的设计通道管理工具
- 🛠️ **H5tools** - 专业的H5页面设计工具
- 🔄 **多平台支持** - 同时支持 Figma 和 MasterGo 平台
- 📦 **模块化架构** - 每个工具独立开发和部署
- 🔧 **完善的开发工具配置**
- 📚 **详细的文档说明**

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
   npm install
   ```

3. **开发模式**
   ```bash
   # 开发 ChannelFlex Figma 版本
   npm run dev:channelflex:figma
   
   # 开发 ChannelFlex MasterGo 版本
   npm run dev:channelflex:mastergo
   
   # 开发 H5tools Figma 版本
   npm run dev:h5tools:figma
   
   # 开发 H5tools MasterGo 版本
   npm run dev:h5tools:mastergo
   ```

4. **构建项目**
   ```bash
   npm run build
   ```

## 工具介绍

### ChannelFlex
- **功能描述**：灵活的设计通道管理工具，帮助设计师高效管理设计资源和工作流程
- **支持平台**：Figma、MasterGo
- **主要特性**：
  - 设计通道的创建和管理
  - 资源组织和分类
  - 团队协作功能
  - 版本控制和同步

### H5tools
- **功能描述**：专业的H5页面设计工具，提供丰富的交互组件和模板
- **支持平台**：Figma、MasterGo
- **主要特性**：
  - H5页面快速搭建
  - 丰富的组件库
  - 交互效果预览
  - 代码生成和导出

## 项目结构

```
Variant/
├── channelflex/         # ChannelFlex 工具目录
│   ├── figma/          # Figma 版本
│   └── mastergo/        # MasterGo 版本
├── h5tools/            # H5tools 工具目录
│   ├── figma/          # Figma 版本
│   └── mastergo/       # MasterGo 版本
├── docs/               # 文档目录
├── tests/              # 测试文件
├── logs/               # 日志文件
└── README.md           # 项目说明
```

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
