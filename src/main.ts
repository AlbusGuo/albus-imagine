import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { NativePluginSettingTab } from "./settings/NativePluginSettingTab";
import SettingsStore from "./settings/SettingsStore";
import { IPluginSettings } from "./types/types";
import { IMAGE_MANAGER_VIEW_TYPE, ImageManagerView } from "./views/ImageManagerView";
import { ImagePickerModal } from "./views/ImagePickerModal";
import { ResizeHandler } from "./handlers";
import { ImageViewerManager } from "./views/ImageViewerManager";
import { ImageContextMenu } from "./services/ImageContextMenu";
import { SUPPORTED_IMAGE_EXTENSIONS } from "./types/image-manager.types";
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
		if (this.settings.imageResize?.dragResizeGeneral || this.settings.imageResize?.dragResizeCallout) {
			this.initializeResizeHandler();
		}

		// 初始化图片查看器
		if (this.settings.imageViewer?.enabled) {
			this.initializeImageViewer();
		}

		// 初始化图片上下文菜单
		this.initializeContextMenu();

		// 注册视图
		this.registerView(
			IMAGE_MANAGER_VIEW_TYPE,
			(leaf) => new ImageManagerView(leaf, this.settings.imageManager || {})
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

		// 监听 Vault 文件变更事件，实时更新图片管理器视图
		this.registerVaultChangeListeners();
	}

	/**
	 * 初始化图片调整大小处理器
	 */
	private initializeResizeHandler(): void {
		if (!this.settings.imageResize) return;

		this.resizeHandler = new ResizeHandler(this, this.settings.imageResize);
		
		// 注册主文档事件
		this.resizeHandler.registerDocument(activeDocument);

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
			await workspace.revealLeaf(leaf);
		} else {
			// 在中间窗口创建新的视图（而非侧边栏）
			leaf = workspace.getLeaf('tab');
			if (leaf) {
				await leaf.setViewState({
					type: IMAGE_MANAGER_VIEW_TYPE,
					active: true,
				});
				await workspace.revealLeaf(leaf);
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
		if (this.settings.imageResize?.dragResizeGeneral || this.settings.imageResize?.dragResizeCallout) {
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
		if (this.settings.imageViewer?.enabled) {
			if (!this.imageViewerManager) {
				this.initializeImageViewer();
			} else {
				this.imageViewerManager.updateSettings(this.settings.imageViewer);
				this.imageViewerManager.refreshViewTrigger();
			}
		} else {
			// 禁用时清除管理器
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
				view.updateSettings(this.settings.imageManager || {});
			}
		});
	}

	/**
	 * 更新SVG反色CSS类
	 */
	private updateSvgInvertClass(): void {
		const shouldInvert = this.settings.imageManager?.invertSvgInDarkMode !== false;
		if (shouldInvert) {
			activeDocument.body.removeClass('afm-no-svg-invert');
		} else {
			activeDocument.body.addClass('afm-no-svg-invert');
		}
	}

	/**
	 * 注册 Vault 文件变更事件监听
	 * 当图片或自定义文件类型发生创建、删除、重命名时，实时更新所有已打开的图片管理器视图
	 */
	private registerVaultChangeListeners(): void {
		const handleVaultChange = (file: TFile) => {
			if (this.isRelevantFile(file)) {
				this.scheduleViewRefresh();
			}
		};

		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile) {
					handleVaultChange(file);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) {
					handleVaultChange(file);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file) => {
				if (file instanceof TFile) {
					handleVaultChange(file);
				}
			})
		);
	}

	/**
	 * 判断文件是否为插件关注的文件类型（标准图片格式 + 用户自定义文件类型）
	 */
	private isRelevantFile(file: TFile): boolean {
		const ext = file.extension.toLowerCase();

		// 标准图片扩展名
		if ((SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
			return true;
		}

		// 用户自定义文件类型（含封面文件）
		const customTypes = this.settings.imageManager?.customFileTypes || [];
		for (const ct of customTypes) {
			if (
				ct.fileExtension.toLowerCase() === ext ||
				ct.coverExtension.toLowerCase() === ext
			) {
				return true;
			}
		}

		return false;
	}

	/** Vault 变更防抖定时器 */
	private vaultChangeTimer: number | null = null;

	/**
	 * 防抖调度视图刷新（200ms 内的多次变更合并为一次刷新）
	 */
	private scheduleViewRefresh(): void {
		if (this.vaultChangeTimer !== null) {
			window.clearTimeout(this.vaultChangeTimer);
		}
		this.vaultChangeTimer = window.setTimeout(() => {
			this.vaultChangeTimer = null;
			this.notifyImageManagerViews();
		}, 200);
	}

	/**
	 * 通知所有打开的图片管理器视图刷新
	 */
	private notifyImageManagerViews(): void {
		const leaves = this.app.workspace.getLeavesOfType(IMAGE_MANAGER_VIEW_TYPE);
		leaves.forEach(leaf => {
			const view = leaf.view;
			if (view instanceof ImageManagerView) {
				view.refreshFromVault();
			}
		});
	}
}
