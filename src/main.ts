import { Plugin, WorkspaceLeaf } from "obsidian";
import { NativePluginSettingTab } from "./settings/NativePluginSettingTab";
import SettingsStore from "./settings/SettingsStore";
import { IPluginSettings } from "./types/types";
import { ImageManagerView, IMAGE_MANAGER_VIEW_TYPE } from "./views/ImageManagerView";
import { ImagePickerModal } from "./views/ImagePickerModal";
import { ResizeHandler } from "./handlers";
import { ImageViewerManager } from "./views/ImageViewerManager";
import { ImageContextMenu } from "./services/ImageContextMenu";
import "./styles";

export default class AlbusFigureManagerPlugin extends Plugin {
	settings: IPluginSettings;
	readonly settingsStore = new SettingsStore(this);
	private resizeHandler: ResizeHandler | null = null;
	private imageViewerManager: ImageViewerManager | null = null;
	private imageContextMenu: ImageContextMenu | null = null;

	async onload() {
		await this.settingsStore.loadSettings();

		// 初始化SVG反色CSS类
		this.updateSvgInvertClass();

		// 初始化图片调整大小处理器
		if (this.settings.imageResize?.dragResize) {
			this.initializeResizeHandler();
		}

		// 初始化图片查看器
		if (this.settings.imageViewer?.triggerMode !== 'off') {
			this.initializeImageViewer();
		}

		// 初始化图片上下文菜单
		this.initializeContextMenu();

		// 注册视图
		this.registerView(
			IMAGE_MANAGER_VIEW_TYPE,
			(leaf) => new ImageManagerView(leaf, this.settings.imageManager || {}, this.settings.imageViewer?.quickPreview || 'off')
		);

		// 添加功能区图标 - 打开图片管理器
		const ribbonIconEl = this.addRibbonIcon(
			"images",
			"图片管理器",
			(evt: MouseEvent) => {
				void this.openImageManager();
			}
		);
		ribbonIconEl.addClass("albus-figure-manager-ribbon-icon");

		// 添加命令 - 打开图片管理器
		this.addCommand({
			id: "open-image-manager",
			name: "打开图片管理器",
			callback: () => {
				void this.openImageManager();
			},
		});

		// 添加命令 - 插入图片
		this.addCommand({
			id: "insert-image",
			name: "插入图片",
			callback: () => {
				this.openImagePicker();
			},
		});

		// 添加设置选项卡
		this.addSettingTab(new NativePluginSettingTab(this));

		// 监听新窗口打开事件（用于图片查看器）
		this.registerEvent(
			this.app.workspace.on('window-open', (workspaceWindow, window) => {
				if (this.imageViewerManager) {
					this.imageViewerManager.refreshViewTrigger(window.document);
				}
			})
		);
	}

	/**
	 * 初始化图片调整大小处理器
	 */
	private initializeResizeHandler(): void {
		if (!this.settings.imageResize) return;

		this.resizeHandler = new ResizeHandler(this, this.settings.imageResize);
		
		// 注册主文档事件
		this.resizeHandler.registerDocument(document);

		// 监听新窗口打开事件
		this.registerEvent(
			this.app.workspace.on('window-open', (workspaceWindow, window) => {
				if (this.resizeHandler) {
					this.resizeHandler.registerDocument(window.document);
				}
			})
		);
	}

	/**
	 * 初始化图片查看器
	 */
	private initializeImageViewer(): void {
		if (!this.settings.imageViewer) return;

		this.imageViewerManager = new ImageViewerManager(this.app, this.settings.imageViewer);
		this.imageViewerManager.initialize();
	}

	/**
	 * 初始化图片上下文菜单
	 */
	private initializeContextMenu(): void {
		if (!this.settings.imageManager) return;

		this.imageContextMenu = new ImageContextMenu(
			this.app,
			this,
			this.settings.imageManager
		);
		this.addChild(this.imageContextMenu);
		this.imageContextMenu.registerContextMenuListener();
	}

	/**
	 * 打开图片管理器
	 */
	async openImageManager(): Promise<void> {
		const { workspace } = this.app;

		// 检查是否已有打开的视图
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(IMAGE_MANAGER_VIEW_TYPE);

		if (leaves.length > 0) {
			// 如果已存在，激活它
			leaf = leaves[0];
			workspace.revealLeaf(leaf);
		} else {
			// 在中间窗口创建新的视图（而非侧边栏）
			leaf = workspace.getLeaf('tab');
			if (leaf) {
				await leaf.setViewState({
					type: IMAGE_MANAGER_VIEW_TYPE,
					active: true,
				});
				workspace.revealLeaf(leaf);
			}
		}
	}

	/**
	 * 打开图片选择器
	 */
	openImagePicker(): void {
		const modal = new ImagePickerModal(this.app, this.settings.imageManager || {});
		modal.open();
	}

	onunload() {
		// 清理工作
		this.resizeHandler = null;
		
		if (this.imageViewerManager) {
			this.imageViewerManager.cleanup();
			this.imageViewerManager = null;
		}

		if (this.imageContextMenu) {
			this.imageContextMenu = null;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// 更新SVG反色CSS类
		this.updateSvgInvertClass();
		
		// 更新调整大小处理器设置
		if (this.settings.imageResize?.dragResize) {
			if (!this.resizeHandler) {
				// 如果启用了拖拽调整但处理器未初始化，则初始化
				this.initializeResizeHandler();
			} else {
				// 更新现有处理器的设置
				this.resizeHandler.updateSettings(this.settings.imageResize);
			}
		} else {
			// 禁用时清除处理器
			if (this.resizeHandler) {
				this.resizeHandler = null;
			}
		}


		// 更新图片查看器设置
		if (this.settings.imageViewer && this.settings.imageViewer.triggerMode !== 'off') {
			if (!this.imageViewerManager) {
				this.initializeImageViewer();
			} else {
				this.imageViewerManager.updateSettings(this.settings.imageViewer);
				this.imageViewerManager.refreshViewTrigger();
			}
		} else {
			// 关闭时清除管理器
			if (this.imageViewerManager) {
				this.imageViewerManager.cleanup();
				this.imageViewerManager = null;
			}
		}
		
		// 通知所有打开的图片管理器视图更新设置
		const leaves = this.app.workspace.getLeavesOfType(IMAGE_MANAGER_VIEW_TYPE);
		leaves.forEach(leaf => {
			const view = leaf.view;
			if (view instanceof ImageManagerView) {
				view.updateSettings(this.settings.imageManager || {}, this.settings.imageViewer?.quickPreview || 'off');
			}
		});
	}

	/**
	 * 更新SVG反色CSS类
	 */
	private updateSvgInvertClass(): void {
		const shouldInvert = this.settings.imageManager?.invertSvgInDarkMode !== false;
		if (shouldInvert) {
			document.body.removeClass('afm-no-svg-invert');
		} else {
			document.body.addClass('afm-no-svg-invert');
		}
	}
}
