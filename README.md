![](https://socialify.git.ci/AlbusGuo/albus-imagine/image?description=1&font=Raleway&forks=1&issues=1&language=1&name=1&owner=1&pattern=Plus&pulls=1&stargazers=1&theme=Light)

一个功能全面的 Obsidian 图片管理插件，提供图片管理、快速插入、拖拽调整、查看预览等多种功能。

[![版本](https://img.shields.io/github/v/release/AlbusGuo/albus-imagine)](https://github.com/AlbusGuo/albus-imagine/releases)
[![下载](https://img.shields.io/github/downloads/AlbusGuo/albus-imagine/total)](https://github.com/AlbusGuo/albus-imagine/releases)

> 本项目部分功能参考插件 [Image Toolkit](https://github.com/sissilab/obsidian-image-toolkit) 与 [AttachFlow](https://github.com/Yaozhuwa/AttachFlow)，感谢社区插件的开源分享！

## ✨ 核心功能

### 📁 图片管理器

- **文件夹筛选**：按文件夹浏览图片，支持路径建议
- **按文件名搜索**：根据文件名快速搜索图片
- **多维度排序**：按创建时间、修改时间、文件大小、文件名排序
- **引用检查**：显示每张图片的引用次数，筛选未引用图片
- **批量操作**：支持批量删除（带加载动画和进度提示）
- **文件操作**：重命名、删除、预览、打开图片

### 🖼️ 图片选择器
- **快速插入**：通过命令面板快速打开图片选择器
- **插图选项**：
  - 位置选择：居中、左侧环绕、右侧环绕
  - 反色开关：在深色模式下反色显示（SVG 图片）
  - 标题输入：为图片添加标题说明
- **灵活布局**：响应式网格，自动调整每行图片数量
- **即时预览**：懒加载缩略图，流畅浏览体验

### 🔍 图片预览
- **大图查看**：点击图片即可在模态框中预览
- **缩放功能**：鼠标滚轮缩放，点击重置
- **详细信息**：显示文件大小、修改时间、引用列表
- **引用跳转**：点击引用直接跳转到对应文件位置

### 📐 图片调整
- **拖拽调整**：在编辑器中拖拽图片边缘调整尺寸
- **实时预览**：拖拽时即时显示尺寸
- **智能更新**：自动更新 Markdown 中的尺寸参数
- **可配置**：支持关闭拖拽功能，调整边缘检测范围

### 🎨 图片排版
通过简单的参数实现丰富的图片排版效果：

**位置控制**：
```markdown
![[image.png|center]]      # 居中
![[image.png|left]]         # 左侧环绕
![[image.png|right]]        # 右侧环绕
![[image.png|inline]]       # 内联显示
```

**深色模式反色**：
```markdown
![[image.png|dark|center]]  # 反色 + 居中
```

**添加标题**：
```markdown
![[image.png#center|这是图片标题]]              # 居中 + 标题
![[image.png#center#dark|这是图片标题]]         # 居中 + 反色 + 标题
```

### ⚙️ 自定义文件类型
- 支持添加自定义文件类型（如设计文件、3D 模型等）
- 配置文件扩展名和对应的封面文件
- 指定封面文件所在文件夹
- 在图片管理器中统一管理

## 📦 支持的图片格式

插件默认支持以下图片格式：

**常见格式**：PNG, JPG, JPEG, GIF, BMP, WebP, SVG

**专业格式**：TIFF, TIF, ICO

**新一代格式**：AVIF, HEIC, HEIF

## 🚀 快速开始

### 安装

#### 从 Obsidian 社区插件市场安装（还未上架）
1. 打开 Obsidian 设置
2. 进入 **第三方插件** → **浏览**
3. 搜索 "Imagine"
4. 点击安装并启用

#### 使用 BRAT 插件安装
1. 安装 [BRAT 插件](https://github.com/TfTHacker/obsidian42-brat)
2. 打开 BRAT 插件设置
3. 点击 "Add a plugin repository"
4. 输入插件仓库地址：`https://github.com/AlbusGuo/albus-imagine`
5. 点击 "Add Plugin" 并等待安装完成
6. 在社区插件列表中启用 "Imagine"

#### 手动安装
1. 下载 [最新版本](https://github.com/AlbusGuo/albus-imagine/releases)
2. 解压到 `.obsidian/plugins/albus-imagine/` 文件夹
3. 重启 Obsidian
4. 在设置中启用插件

### 使用

#### 打开图片管理器
- 点击左侧边栏的图片图标
- 或使用命令面板：`图片管理器: 打开`

#### 快速插入图片
- 使用命令面板：`插入图片`
- 选择图片并配置位置、反色、标题等选项
- 点击图片即可插入到编辑器光标位置

#### 调整图片尺寸
- 在编辑器中悬停到图片边缘
- 光标变为调整大小样式时，拖拽即可调整
- 释放鼠标后自动更新 Markdown

## ⚙️ 设置选项

### 图片管理器
- **默认文件夹路径**：设置默认显示的图片文件夹
- **显示文件大小**：在缩略图上显示文件大小
- **显示修改时间**：在缩略图上显示修改时间
- **删除前确认**：删除文件前显示确认对话框
- **SVG 反色**：深色模式下自动反色 SVG 图片

### 图片调整
- **启用拖拽调整**：开启/关闭拖拽调整尺寸功能
- **边缘检测范围**：调整拖拽热区大小（默认 20px）
- **调整间隔**：设置尺寸调整的步长

### 自定义文件类型
- 添加自定义文件类型配置
- 为每种类型设置扩展名、封面扩展名、封面文件夹

## 🎯 使用场景

### 📝 写作与笔记
- 快速插入图片并配置排版
- 管理笔记中的所有图片资源
- 清理未使用的图片文件

### 🎨 设计与创作
- 管理设计素材和插图
- 调整图片尺寸以适配排版
- 通过自定义文件类型管理设计源文件

### 📚 知识库管理
- 检查图片引用关系
- 清理冗余图片文件
- 统一管理图片资源

### 🌙 深色模式适配
- SVG 图片自动反色
- 灵活控制单个图片的反色效果



## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 🙏 致谢

感谢 Obsidian 社区的支持和反馈！

---

如果这个插件对你有帮助，请考虑给项目点个 ⭐️！
