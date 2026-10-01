/**
 * 中文翻译
 */

export const zhCN = {
	// Settings tabs
	"settings.tab.imageManager": "图片管理器",
	"settings.tab.imageResize": "图片拖拽",
	"settings.tab.imageViewer": "图片查看器",
	"settings.tab.customFileTypes": "自定义文件类型",

	// Settings page descriptions
	"settings.page.imageManager.desc": "图片列表, 排序, 引用显示和删除行为",
	"settings.page.imageResize.desc": "实时预览中的图片拖拽调整",
	"settings.page.imageViewer.desc": "快捷查看和内置图片灯箱行为",
	"settings.page.customFileTypes.desc": "为非图片文件配置预览封面",

	// Image Manager settings
	"settings.imageManager.showFileSize": "显示文件大小",
	"settings.imageManager.showFileSize.desc": "在图片卡片上显示文件大小信息",
	"settings.imageManager.showModifiedTime": "显示修改时间",
	"settings.imageManager.showModifiedTime.desc":
		"在图片卡片上显示最后修改时间",
	"settings.imageManager.defaultSortField": "默认排序字段",
	"settings.imageManager.defaultSortField.desc":
		"打开图片管理器时的默认排序方式",
	"settings.imageManager.defaultSortOrder": "默认排序顺序",
	"settings.imageManager.defaultSortOrder.desc":
		"打开图片管理器时的默认排序顺序",
	"settings.imageManager.excludedFolders": "排除文件夹",
	"settings.imageManager.excludedFolders.desc":
		"在图片管理器中排除这些文件夹",
	"settings.imageManager.excludedFolders.placeholder":
		"输入要排除的文件夹路径, 每行一个",
	"settings.imageManager.confirmDelete": "删除确认",
	"settings.imageManager.confirmDelete.desc": "删除文件前显示确认对话框",
	"settings.imageManager.invertSvgInDarkMode": "深色模式下 SVG 图片反色",
	"settings.imageManager.invertSvgInDarkMode.desc":
		"在深色主题下对 SVG 图片进行反色处理, 使其更适配深色背景",

	// Sort field options
	"sort.field.mtime": "修改时间",
	"sort.field.ctime": "创建时间",
	"sort.field.size": "文件大小",
	"sort.field.name": "文件名",
	"sort.field.references": "引用数量",

	// Sort order options
	"sort.order.desc": "降序",
	"sort.order.asc": "升序",

	// Image Resize settings
	"settings.imageResize.dragResizeGeneral": "启用 callout 外图片拖拽调整大小",
	"settings.imageResize.dragResizeGeneral.desc":
		"是否允许通过拖拽 callout 外图片边缘来调整图片大小",
	"settings.imageResize.dragResizeCallout": "启用 callout 内图片拖拽调整大小",
	"settings.imageResize.dragResizeCallout.desc":
		"是否允许通过拖拽 callout 内图片边缘来调整图片大小",
	"settings.imageResize.resizeInterval": "调整大小的时间间隔",
	"settings.imageResize.resizeInterval.desc":
		"拖动调整最小刻度, 0 表示不对齐刻度",
	"settings.imageResize.resizeInterval.placeholder": "0",
	"settings.imageResize.resizeInterval.error": "请输入非负整数",
	"settings.imageResize.edgeSize": "边缘检测区域大小",
	"settings.imageResize.edgeSize.desc":
		"鼠标在图片边缘多少像素内可以触发调整大小",

	// Image Viewer settings
	"settings.imageViewer.enabled": "启用图片查看器",
	"settings.imageViewer.enabled.desc":
		"在所有位置启用 Ctrl+Click 查看图片功能",
	"settings.imageViewer.disableNative": "禁用内置点击查看图片",
	"settings.imageViewer.disableNative.desc":
		"阻止内置图片灯箱响应普通点击, 不影响右键菜单, 拖拽缩放或本插件的快捷查看",

	// Custom File Types settings
	"settings.customFileTypes.empty": "暂无自定义文件类型",
	"settings.customFileTypes.empty.desc": "添加后可为非图片文件指定预览封面.",
	"settings.customFileTypes.type": "类型",
	"settings.customFileTypes.fileExtension.placeholder": "文件扩展名 (如 PDF)",
	"settings.customFileTypes.coverExtension.placeholder":
		"封面扩展名 (如 JPG)",
	"settings.customFileTypes.coverFolder.placeholder": "封面文件夹 (可选)",
	"settings.customFileTypes.delete.tooltip": "删除此类型",
	"settings.customFileTypes.add": "添加文件类型",
	"settings.customFileTypes.add.desc":
		"设置源文件扩展名, 封面扩展名和可选封面文件夹.",
	"settings.customFileTypes.add.button": "添加",

	// Image Picker Modal
	"picker.title": "选择图片",
	"picker.folder.placeholder": "按文件夹筛选...",
	"picker.folder.clear": "清空筛选",
	"picker.search.placeholder": "搜索图片...",
	"picker.refresh": "刷新",
	"picker.multiSelect": "多选",
	"picker.cancelMultiSelect": "取消多选",
	"picker.confirmInsert": "确认插入 ({count})",
	"picker.position": "位置",
	"picker.positionLabel": "位置:",
	"picker.position.center": "居中",
	"picker.position.alignLeft": "左对齐",
	"picker.position.alignRight": "右对齐",
	"picker.position.left": "左侧环绕",
	"picker.position.right": "右侧环绕",
	"picker.position.inline": "行间",
	"picker.invertColor": "深色反色",
	"picker.invertLabel": "反色:",
	"picker.caption": "图注",
	"picker.captionLabel": "标题:",
	"picker.caption.placeholder": "输入图片标题 (可选)",
	"picker.noImages": "没有找到图片",
	"picker.noMatchingImages": "没有符合条件的图片",
	"picker.loading": "加载中...",
	"picker.insertSelected": "插入 {count} 张图片",
	"picker.selectImages": "选择要插入的图片",
	"picker.selectAtLeastOne": "请至少选择一张图片",
	"picker.loadFailed": "加载图片失败: {message}",
	"picker.stats.images": " 张图片",
	"picker.stats.selected": " 张已选",
	"picker.sortBy": "排序方式",

	// Image Preview Modal
	"preview.loadError": "图片加载失败",
	"preview.loadError.hint": "文件可能已损坏, 过大或格式不支持",
	"preview.details": "详细信息",
	"preview.sourceFile": "源文件",
	"preview.coverFile": "封面文件",
	"preview.path": "路径",
	"preview.size": "大小",
	"preview.createdTime": "创建时间",
	"preview.modifiedTime": "修改时间",
	"preview.type": "类型",
	"preview.coverMissing": "封面缺失",
	"preview.backlinks": "引用笔记",
	"preview.noBacklinks": "暂无引用",

	// Rename Modal
	"rename.title": "重命名文件",
	"rename.fileName": "文件名",
	"rename.fileName.placeholder": "输入文件名",
	"rename.cancel": "取消",
	"rename.confirm": "重命名",
	"rename.renaming": "正在重命名...",
	"rename.error.empty": "文件名不能为空",

	// Delete Confirm Modal
	"delete.title": "删除图片",
	"delete.confirmMessage": "确定要删除文件 ",
	"delete.questionMark": " 吗?",
	"delete.message": "确定要将此文件移至回收站吗?",
	"delete.message.file": "文件: {file}",
	"delete.warning": "此操作无法撤销.",
	"delete.cancel": "取消",
	"delete.confirm": "删除",
	"delete.deleting": "正在删除...",

	// Batch Delete Confirm Modal
	"batchDelete.title": "批量删除图片",
	"batchDelete.confirmPrefix": "确认要删除 ",
	"batchDelete.imagesCount": " 张图片",
	"batchDelete.questionMark": " 吗?",
	"batchDelete.customFilesInfo":
		"其中 {customCount} 张特殊图片包含封面, 共删除 {totalFiles} 个文件.",
	"batchDelete.totalFilesInfo": "共删除 {totalFiles} 个文件.",
	"batchDelete.progress": "删除进度",
	"batchDelete.message": "确定要将 {count} 个文件移至回收站吗?",
	"batchDelete.warning": "此操作无法撤销.",
	"batchDelete.cancel": "取消",
	"batchDelete.confirm": "删除全部",
	"batchDelete.deleting": "正在删除...",

	// Folder Picker Modal
	"folderPicker.title": "选择文件夹",
	"folderPicker.placeholder": "选择目标文件夹...",
	"folderPicker.cancel": "取消",
	"folderPicker.confirm": "选择",

	// Image Manager View
	"manager.title": "图片管理器",
	"manager.folder.placeholder": "按文件夹筛选...",
	"manager.folder.clear": "清空筛选",
	"manager.search.placeholder": "搜索图片...",
	"manager.refresh": "刷新",
	"manager.unreferenced": "未引用",
	"manager.noImages": "没有找到图片",
	"manager.noMatchingImages": "没有符合条件的图片",
	"manager.loading": "加载中...",
	"manager.selectAll": "全选",
	"manager.deselectAll": "取消全选",
	"manager.batchMove": "移动选中 ({count})",
	"manager.batchDelete": "删除选中 ({count})",
	"manager.deleteAllUnreferenced": "删除全部未引用",
	"manager.multiSelect": "多选",
	"manager.cancelMultiSelect": "取消多选",
	"manager.showAll": "显示全部",
	"manager.filterUnreferenced": "筛选未引用",
	"manager.sortBy": "排序方式",
	"manager.stats.images": " 张图片",
	"manager.stats.filtered": "筛选",
	"manager.loadFailed": "加载图片失败: {message}",

	// Image Context Menu
	"contextMenu.position": "图片位置",
	"contextMenu.position.center": "居中",
	"contextMenu.position.alignLeft": "左对齐",
	"contextMenu.position.alignRight": "右对齐",
	"contextMenu.position.wrapLeft": "左环绕",
	"contextMenu.position.wrapRight": "右环绕",
	"contextMenu.invertDark": "深色反色",
	"contextMenu.openSource": "打开源文件",

	// Notices and messages
	"notice.imageInserted": "图片已插入",
	"notice.imagesInserted": "已插入 {count} 张图片",
	"notice.fileRenamed": "文件已重命名",
	"notice.fileMoved": "文件已移动",
	"notice.fileDeleted": "文件已删除",
	"notice.filesDeleted": "已删除 {count} 个文件",
	"notice.operationFailed": "操作失败",
	"notice.noImagesSelected": "未选择图片",
	"notice.loadFailed": "加载图片失败: {message}",
	"notice.checkingReferences": "正在检查引用... {current}/{total}",
	"notice.referencesChecked": "引用检查完成: 已检查 {count} 张图片",
	"notice.checkReferencesFailed": "检查引用失败: {message}",
	"notice.noImagesToDelete": "没有要删除的图片",
	"notice.noUnreferencedAfterCheck": "重新检查后没有未引用图片",
	"notice.noSafeToDelete": "最终检查后没有可安全删除的图片",
	"notice.moving": "正在移动... {current}/{total}",
	"notice.moveSuccess": "成功移动 {count} 张图片",
	"notice.moveComplete": "移动完成: 成功 {success} 张, 失败 {failed} 张",
	"notice.deleteSuccess": "成功删除 {count} 张图片",
	"notice.deleteComplete": "删除完成: 成功 {success} 张, 失败 {failed} 张",

	// Common
	"common.kb": "KB",
	"common.close": "关闭",
	"common.save": "保存",
	"common.cancel": "取消",
	"common.confirm": "确认",
	"common.loading": "加载中...",
	"common.error": "错误",

	// Main plugin
	"main.ribbonIcon": "图片管理器",
	"main.commandOpenManager": "打开图片管理器",
	"main.commandInsertImage": "插入图片",

	// Components
	"component.imageNotAvailable": "图片所在窗口不可用",
	"component.imageTitle": "图片标题",
	"component.coverMissing": "封面缺失",
	"component.loadFailed": "加载失败",
	"component.open": "打开",
	"component.rename": "重命名",
	"component.move": "移动",
	"component.delete": "删除",
	"component.unreferenced": "未引用",
	"component.references": "{count} 引用",

	// Services - Context Menu
	"contextMenu.imagePosition": "图片位置",
	"contextMenu.center": "居中",
	"contextMenu.alignLeft": "左对齐",
	"contextMenu.alignRight": "右对齐",
	"contextMenu.floatLeft": "左侧环绕",
	"contextMenu.floatRight": "右侧环绕",
	"contextMenu.inline": "行间",
	"contextMenu.darkModeInvert": "深色反色",
	"contextMenu.editCaption": "编辑标题",
	"contextMenu.captionPlaceholder": "输入图片标题 (留空删除)",
	"contextMenu.openSourceFile": "打开源文件",

	// Services - Notices
	"service.cannotGetImagePath": "无法获取图片路径",
	"service.useInEditMode": "请在编辑模式下使用",
	"service.imageNotFound": "未找到图片链接",
	"service.positionUpdated": "图片位置: {position}",
	"service.invertCanceled": "已取消反色",
	"service.invertEnabled": "已启用反色",
	"service.fileNotExist": "文件不存在",
	"service.cannotFindContainer": "无法找到图片容器",
	"service.linkChanged": "图片链接已变化, 标题未保存",
	"service.notSupportedEnvironment": "当前环境不支持使用系统默认应用打开",
	"service.fileRenameSuccess": "文件重命名成功",
	"service.fileDeleteSuccess": "文件删除成功",
	"service.fileAlreadyInFolder": "文件已在该文件夹中",
	"service.fileMoveSuccess": "文件移动成功",
	"service.multipleLinksFound": "找到多个相同图片链接, 请手动调整大小",
	"service.linkNotFoundManual": "未找到当前图片链接, 请手动调整大小",
	"service.linkNotUnique": "当前图片链接不唯一, 已取消操作以避免修改错误链接",

	// Errors - Console
	"error.batchCheckFailed": "批量检查引用失败:",
	"error.checkReferenceFailed": "检查引用时出错:",
	"error.rollbackFailed": "文件操作回滚失败:",
	"error.cannotParseResource": "无法解析图片资源地址:",
	"error.cannotLocateFromDOM": "无法从编辑器 DOM 定位图片:",

	// Manager View
	"managerView.hintCheckPath": "提示: 请检查文件夹路径设置",
} as const;
