![Imagine](https://socialify.git.ci/AlbusGuo/albus-imagine/image?description=1&font=Raleway&forks=1&issues=1&name=1&owner=1&pattern=Circuit+Board&pulls=1&stargazers=1&theme=Light)

[![版本](https://img.shields.io/github/v/release/AlbusGuo/albus-imagine)](https://github.com/AlbusGuo/albus-imagine/releases)
[![下载量](https://img.shields.io/github/downloads/AlbusGuo/albus-imagine/total)](https://github.com/AlbusGuo/albus-imagine/releases)

# Imagine

Imagine 是一款面向 [Obsidian](https://obsidian.md/) 的一体化图片工作流插件。它将图片浏览、引用分析、插入、排版、标题编辑、拖拽缩放、预览和批量文件操作整合在一个本地桌面插件中。

[English](README.md) | [简体中文](README.zh-CN.md)

## 功能亮点

- 在响应式虚拟网格中浏览 Vault 内的图片。
- 按文件名搜索，并按 Vault 文件夹或引用状态筛选。
- 按修改时间、创建时间、文件大小、文件名或引用数量排序。
- 通过 Obsidian 元数据缓存识别普通链接、嵌入和 Frontmatter 链接。
- 在 Obsidian 内完成图片预览、打开、重命名、移动和回收站删除。
- 批量移动或删除选中图片，也可以安全地复查并删除未引用图片。
- 插入单张图片，或通过多选自动生成响应式 Grid Callout。
- 通过 Wiki 链接参数控制居中、左右对齐、左右环绕和行内排版。
- 为图片添加深色主题反色和可编辑标题。
- 在实时预览模式中拖动图片右下角调整尺寸。
- 使用支持缩放和平移的全窗口图片查看器。
- 通过关联封面图片管理非图片源文件。
- 支持 Obsidian 弹出窗口。

## 运行要求与隐私

- Obsidian 1.12.1 或更高版本。
- 仅支持桌面平台: Windows、macOS 和 Linux。
- Imagine 完全在本地运行，不上传 Vault 数据，不收集遥测信息，也不依赖外部服务。

## 安装

### 社区插件市场

Imagine 上架 Obsidian 社区插件市场后:

1. 打开 **设置 → 第三方插件**。
2. 选择 **浏览** 并搜索 `Imagine`。
3. 安装并启用插件。

### BRAT

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat)。
2. 在 BRAT 设置中选择 **Add beta plugin**。
3. 输入 `https://github.com/AlbusGuo/albus-imagine`。
4. 在 **设置 → 第三方插件** 中启用 **Imagine**。

### 手动安装

1. 从最新 [Release](https://github.com/AlbusGuo/albus-imagine/releases) 下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 创建 `<Vault>/.obsidian/plugins/albus-imagine/` 文件夹。
3. 将三个文件放入该文件夹。
4. 重启 Obsidian，并在 **设置 → 第三方插件** 中启用 **Imagine**。

## 快速开始

1. 通过左侧功能区图标或命令面板打开图片管理器。
2. 通过命令面板打开图片插入窗口，将图片插入当前编辑器选区。
3. 在实时预览模式中右键单击 Wiki 链接图片，修改位置、反色、标题或打开源文件。
4. 将鼠标移动到图片右下角附近，拖动以调整图片尺寸。
5. 按住 `Ctrl` 并单击图片，打开 Imagine 全窗口查看器。

## 图片管理器

图片管理器以普通工作区标签页打开，并可随 Obsidian 工作区恢复。

### 浏览与筛选

- 使用路径建议按 Vault 文件夹筛选。
- 按文件名搜索。
- 在全部图片和未引用图片之间切换。
- 按修改时间、创建时间、文件大小、文件名或引用数量升序或降序排列。
- 从图片目录中排除设置的文件夹。
- 必要时手动刷新当前结果。

图片网格采用虚拟化渲染，且只为可见卡片加载媒体资源，因此在图片数量较多时仍能保持流畅。

### 引用分析

Imagine 使用 Obsidian 公开的元数据缓存和已解析链接图。它会识别普通链接、嵌入、引用链接、Frontmatter 链接，以及 Obsidian 已解析计数中包含的其他引用。引用结果会被缓存，并在 Markdown 元数据变化时自动失效。

单击卡片可以打开预览并查看所有可用的引用笔记。单击引用条目会打开对应笔记，并在存在位置信息时跳转到记录位置。

### 文件操作

每张卡片提供以下操作:

- 打开文件。
- 重命名文件。
- 将文件移动到其他 Vault 文件夹。
- 通过 Obsidian 文件管理器将文件移至系统回收站。

多选模式支持批量移动和批量删除。“删除全部未引用”会在确认前重新检查引用，并在真正删除前再次检查，以降低误删刚刚被引用文件的风险。

### 图片预览

预览窗口包含:

- 滚轮缩放、鼠标拖动和双击重置。
- 文件路径、大小、创建时间和修改时间。
- 引用笔记列表。
- 自定义文件类型的源文件和封面文件双栏信息。

## 图片插入窗口

图片插入窗口与管理器共享图片目录、文件夹筛选、搜索、排序、虚拟网格和懒加载机制。

插入单张图片前可以选择:

- 位置: 居中、左对齐、右对齐、左侧环绕、右侧环绕或行间。
- 深色主题反色。
- 可选图片标题。

单击卡片会将 Wiki 嵌入插入当前编辑器选区。多选模式会将普通图片嵌入写入 `[!grid]` Callout:

```markdown
> [!grid]
> ![[photo-1.jpg]]
> ![[photo-2.jpg]]
> ![[photo-3.jpg]]
```

## 图片排版语法

Imagine 将排版参数存储在 Wiki 链接中，并在阅读模式和实时预览模式中保持一致的呈现。

| 参数 | 效果 |
| --- | --- |
| `center` | 块级居中 |
| `align-left` | 块级左对齐，不环绕文字 |
| `align-right` | 块级右对齐，不环绕文字 |
| `left` | 图片左浮动，文字从右侧环绕 |
| `right` | 图片右浮动，文字从左侧环绕 |
| `inline` | 行内图片 |
| `dark` | 在深色主题中对图片反色 |

### 无标题语法

参数以竖线字段的形式跟在文件路径后面:

```markdown
![[diagram.svg|center]]
![[diagram.svg|dark|align-right]]
![[photo.jpg|left|480]]
```

### 带标题语法

位置和反色参数使用 URL 片段，第一个竖线字段作为标题，并继续支持可选尺寸字段:

```markdown
![[architecture.png#center|系统架构]]
![[flowchart.svg#align-right#dark|处理流程|640]]
```

标题显示在图片下方。标题编辑框会与实际标题位置重合，在所有交互状态下保持透明，长文本会自动换行。按 `Enter` 或移出输入焦点时保存，按 `Escape` 取消编辑。

## 图片右键菜单

在实时预览模式中右键单击 Wiki 链接图片，插件会将以下操作加入 Obsidian 原生图片菜单区域:

- **图片位置**: 居中、左对齐、右对齐、左侧环绕或右侧环绕。
- **深色反色**: 切换 `dark` 参数。
- **编辑标题**: 直接编辑图片下方显示的标题。
- **打开源文件**: 打开图片，或打开自定义封面所代表的源文件。

标准文件、链接和删除操作继续由 Obsidian 官方菜单提供。

## 拖拽调整尺寸

实时预览模式中的图片支持拖拽缩放:

1. 将鼠标移动到图片右下角可配置的检测区域内。
2. 水平拖动以调整宽度，并保持原始宽高比。
3. 松开鼠标，将最终宽度写回 Markdown 链接。

Imagine 通过 CodeMirror 事务系统写入修改，因此可以正常使用编辑器的撤销和重做。Callout 内外图片可以分别启用。图片最小宽度为 50 像素，也可以设置步长，让最终宽度吸附到指定像素间隔。

阅读模式、Canvas、插件 Modal 和图片插入窗口中不会启用拖拽缩放。

## 全窗口图片查看器

启用查看器后，按住 `Ctrl` 并单击图片即可打开。查看器支持:

- 以鼠标位置为中心进行滚轮缩放。
- 按住鼠标拖动图片。
- 双击重置图片。
- 单击背景或按 `Escape` 关闭。
- 使用棋盘格背景显示透明图片。

可以通过设置禁用 Obsidian 内置的单击图片查看器，同时保留正常图片选中、右键菜单、拖拽缩放和 Imagine 的 `Ctrl` 单击查看器。

## 自定义文件类型

Imagine 可以使用关联封面图片表示非图片源文件。每种自定义类型包含:

- 源文件扩展名，例如 `pdf`、`psd`、`ai` 或 `blend`。
- 封面图片扩展名，例如 `png` 或 `jpg`。
- 可选封面文件夹。留空时，封面应与源文件位于同一目录。

例如，`Designs/model.blend` 可以使用 `Covers/model.png` 作为可见卡片。重命名、移动和删除操作会同步处理源文件与封面文件。封面缺失时会显示明确提示，不会直接隐藏源文件。

## 支持的图片格式

Imagine 默认识别以下图片扩展名:

`png`、`jpg`、`jpeg`、`gif`、`bmp`、`webp`、`svg`、`ico`、`tif`、`tiff`、`avif`、`heic` 和 `heif`。

其他源文件格式可以通过自定义文件类型设置加入管理器。

## 设置参考

Obsidian 1.13 及更高版本会将 Imagine 设置显示为可搜索的原生页面。Obsidian 1.12 使用兼容的标签页界面。

### 图片管理器

| 设置项 | 默认值 | 作用 |
| --- | --- | --- |
| 显示文件大小 | 开启 | 在图片卡片上显示文件大小 |
| 显示修改时间 | 开启 | 在图片卡片上显示最后修改日期 |
| 默认排序字段 | 修改时间 | 设置管理器初始排序字段 |
| 默认排序顺序 | 降序 | 设置管理器初始排序方向 |
| 排除文件夹 | 空 | 每行填写一个需要排除的 Vault 文件夹路径 |
| 删除确认 | 开启 | 删除文件前显示确认对话框 |
| 深色模式下 SVG 图片反色 | 开启 | 控制插件的深色主题 SVG 反色行为及插入窗口默认值 |

### 图片拖拽

| 设置项 | 默认值 | 作用 |
| --- | --- | --- |
| 启用 Callout 外图片拖拽调整大小 | 开启 | 允许调整 Callout 外图片 |
| 启用 Callout 内图片拖拽调整大小 | 开启 | 允许调整 Callout 内图片 |
| 调整大小的时间间隔 | `0` | 按像素步长吸附，`0` 表示不吸附 |
| 边缘检测区域大小 | `20` | 设置 5 至 150 像素的触发区域 |

### 图片查看器

| 设置项 | 默认值 | 作用 |
| --- | --- | --- |
| 启用图片查看器 | 开启 | 启用 Imagine 的 `Ctrl` 单击查看器 |
| 禁用内置点击查看图片 | 关闭 | 阻止 Obsidian 普通单击图片查看器 |

### 自定义文件类型

添加、编辑或删除源文件扩展名、封面扩展名和封面文件夹映射。

## 限制

- 插件仅支持桌面平台。
- 拖拽调整尺寸和自定义图片右键菜单需要实时预览模式。
- 右键菜单的链接编辑目前仅支持 Wiki 链接图片嵌入，不支持标准 Markdown 图片语法。
- 自定义图片查看器在所有桌面平台上均使用 `Ctrl`。

## 致谢

图片查看器参考了 [Image Toolkit](https://github.com/sissilab/obsidian-image-toolkit)，拖拽调整尺寸参考了 [AttachFlow](https://github.com/Yaozhuwa/AttachFlow)。感谢这些项目的作者和 Obsidian 社区。

## 许可证

Imagine 基于 [GNU Affero General Public License v3.0](LICENSE) 发布。
