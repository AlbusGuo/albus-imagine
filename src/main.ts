import { type Editor, normalizePath, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { NativePluginSettingTab } from "./settings/NativePluginSettingTab";
import SettingsStore from "./settings/SettingsStore";
import { IPluginSettings } from "./types/types";
import {
	IMAGE_MANAGER_VIEW_TYPE,
	ImageManagerVaultChange,
	ImageManagerView,
} from "./views/ImageManagerView";
import { ResizeHandler } from "./handlers/ResizeHandler";
import { ImageViewerManager } from "./views/ImageViewerManager";
import { ImageContextMenu } from "./services/ImageContextMenu";
import { ImageManagerSettings, SUPPORTED_IMAGE_EXTENSIONS } from "./types/image-manager.types";
import { ImageCatalogService } from "./services/ImageCatalogService";
import { ReferenceCheckService } from "./services/ReferenceCheckService";
import { ImageLayoutStateManager } from "./services/ImageLayoutStateManager";
import { ViewIconService } from "./services/ViewIconService";
import { ImagePickerIntegration } from "./integrations/ImagePickerIntegration";
import "./styles";

export default class AlbusFigureManagerPlugin extends Plugin {
	settings: IPluginSettings;
	readonly settingsStore = new SettingsStore(this);
	private readonly imageCatalog = new ImageCatalogService(this.app);
	private readonly referenceIndex = new ReferenceCheckService(this.app);
	private resizeHandler: ResizeHandler | null = null;
	private imageViewerManager: ImageViewerManager | null = null;
	private imageLayoutStateManager: ImageLayoutStateManager | null = null;
	private viewIconService: ViewIconService | null = null;
	private workspaceDocuments = new Set<Document>();
	private hasCompletedInitialLinkResolution = false;
	private readonly pendingVaultChanges = new Map<string, ImageManagerVaultChange>();
	private imagePickerIntegration: ImagePickerIntegration | null = null;

	async onload() {
		await this.settingsStore.loadSettings();
		const viewIconService = new ViewIconService(
			this.app,
			this.manifest.id,
			() => this.refreshImageManagerIcons(),
		);
		this.viewIconService = viewIconService;
		this.imagePickerIntegration = new ImagePickerIntegration(
			this,
			() => this.settings.imageManager || {},
			this.imageCatalog,
			this.referenceIndex,
			viewIconService,
		);
		this.imagePickerIntegration.register();
		void this.syncRequiredViewIcons();
		this.app.workspace.onLayoutReady(() => { void this.syncRequiredViewIcons(); });
		this.workspaceDocuments.add(document);
		this.app.workspace.iterateAllLeaves((leaf) => {
			this.workspaceDocuments.add(leaf.view.containerEl.ownerDocument);
		});

		// 初始化 SVG 反色 CSS 类
		this.updateSvgInvertClass();

		// 初始化图片调整大小处理器
		if (this.settings.imageResize?.dragResizeGeneral || this.settings.imageResize?.dragResizeCallout) {
			this.initializeResizeHandler();
		}

		// 初始化图片查看器
		if (this.settings.imageViewer && (
			this.settings.imageViewer.enabled ||
			this.settings.imageViewer.clickBehavior !== "obsidian"
		)) {
			this.initializeImageViewer();
		}

		// 初始化图片上下文菜单
		this.initializeContextMenu();

		// 将图片参数同步为容器状态类, 避免高成本的 CSS :has() 选择器
		this.imageLayoutStateManager = new ImageLayoutStateManager();
		this.addChild(this.imageLayoutStateManager);
		this.workspaceDocuments.forEach((doc) => this.imageLayoutStateManager?.registerDocument(doc));

		// 注册视图
		this.registerView(
			IMAGE_MANAGER_VIEW_TYPE,
			(leaf) => new ImageManagerView(
				leaf,
				this.settings.imageManager || {},
				(patch) => this.saveImageManagerSettings(patch),
				(sourceImage) => this.openManagerImageViewer(sourceImage),
				viewIconService,
				this.imageCatalog,
				this.referenceIndex,
			)
		);

		// 添加功能区图标 - 打开图片管理器
		const ribbonIconEl = this.addRibbonIcon(
			"images",
			"附件管理",
			() => {
				void this.openImageManager();
			}
		);
		ribbonIconEl.addClass("albus-figure-manager-ribbon-icon");

		// 添加命令 - 打开图片管理器
		this.addCommand({
			id: "open-image-manager",
			name: "打开附件管理",
			callback: () => {
				void this.openImageManager();
			},
		});

		// 添加命令 - 插入图片
		this.addCommand({
			id: "insert-image",
			name: "插入图片",
			editorCallback: (editor, context) => {
				this.openImagePicker(editor, context.file?.path ?? "");
			},
		});

		// 添加设置选项卡
		this.addSettingTab(new NativePluginSettingTab(this));

		this.registerEvent(this.app.workspace.on("window-open", (_workspaceWindow, win) => {
			this.workspaceDocuments.add(win.document);
			this.resizeHandler?.registerDocument(win.document);
			this.imageViewerManager?.refreshViewTrigger(win.document);
			this.imageLayoutStateManager?.registerDocument(win.document);
			this.updateSvgInvertClass(win.document);
		}));
		this.registerEvent(this.app.workspace.on("window-close", (_workspaceWindow, win) => {
			this.imageLayoutStateManager?.unregisterDocument(win.document);
			this.workspaceDocuments.delete(win.document);
		}));

		// 监听 Vault 文件变更事件, 实时更新图片管理器视图
		this.registerVaultChangeListeners();
	}

	/**
	 * 初始化图片调整大小处理器
	 */
	private initializeResizeHandler(): void {
		if (!this.settings.imageResize || this.resizeHandler) return;

		this.resizeHandler = new ResizeHandler(this, this.settings.imageResize);
		this.addChild(this.resizeHandler);
		this.workspaceDocuments.forEach((doc) => this.resizeHandler?.registerDocument(doc));
	}

	/**
	 * 初始化图片查看器
	 */
	private initializeImageViewer(): void {
		if (!this.settings.imageViewer) return;

		this.imageViewerManager = new ImageViewerManager(this.settings.imageViewer);
		this.imageViewerManager.initialize();
		this.workspaceDocuments.forEach((doc) => this.imageViewerManager?.refreshViewTrigger(doc));
	}

	private openManagerImageViewer(sourceImage: HTMLImageElement): void {
		if (!this.imageViewerManager) {
			this.imageViewerManager = new ImageViewerManager(this.settings.imageViewer ?? {
				enabled: false,
				clickBehavior: "obsidian",
			});
			this.imageViewerManager.initialize();
		}
		this.imageViewerManager.open(sourceImage, true);
	}

	/**
	 * 初始化图片上下文菜单
	 */
	private initializeContextMenu(): void {
		if (!this.settings.imageManager) return;

		const imageContextMenu = new ImageContextMenu(
			this.app,
			this.settings.imageManager
		);
		this.addChild(imageContextMenu);
		imageContextMenu.registerContextMenuListener();
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
			// 如果已存在, 激活它
			leaf = leaves[0];
			await workspace.revealLeaf(leaf);
		} else {
			// 在中间窗口创建新的视图 (而非侧边栏)
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
	openImagePicker(editor: Editor, sourcePath: string): void {
		this.imagePickerIntegration?.openInsert(editor, sourcePath);
	}

	onunload() {
		this.imagePickerIntegration?.closeAll();
		this.imagePickerIntegration = null;
		this.disposeResizeHandler();
		if (this.imageLayoutStateManager) {
			this.removeChild(this.imageLayoutStateManager);
			this.imageLayoutStateManager = null;
		}

		if (this.imageViewerManager) {
			this.imageViewerManager.cleanup();
		this.imageViewerManager = null;
		}
		this.viewIconService?.destroy();
		this.viewIconService = null;

		if (this.vaultChangeTimer !== null) {
			window.clearTimeout(this.vaultChangeTimer);
			this.vaultChangeTimer = null;
		}
		this.pendingVaultChanges.clear();
		this.workspaceDocuments.forEach((doc) => doc.body.removeClass("afm-no-svg-invert"));
		this.workspaceDocuments.clear();
	}

	async saveSettings() {
		await this.saveData(this.settings);

		// 更新 SVG 反色 CSS 类
		this.updateSvgInvertClass();

		// 更新调整大小处理器设置
		if (this.settings.imageResize?.dragResizeGeneral || this.settings.imageResize?.dragResizeCallout) {
			if (!this.resizeHandler) {
				// 如果启用了拖拽调整但处理器未初始化, 则初始化
				this.initializeResizeHandler();
			} else {
				// 更新现有处理器的设置
				this.resizeHandler.updateSettings(this.settings.imageResize);
			}
		} else {
			this.disposeResizeHandler();
		}

		// 更新图片查看器设置
		if (this.settings.imageViewer && (
			this.settings.imageViewer.enabled ||
			this.settings.imageViewer.clickBehavior !== "obsidian"
		)) {
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
	 * 更新 SVG 反色 CSS 类
	 */
	private updateSvgInvertClass(targetDocument?: Document): void {
		const shouldInvert = this.settings.imageManager?.invertSvgInDarkMode !== false;
		const documents: Iterable<Document> = targetDocument ? [targetDocument] : this.workspaceDocuments;
		for (const doc of documents) {
			doc.body.toggleClass("afm-no-svg-invert", !shouldInvert);
		}
	}

	private disposeResizeHandler(): void {
		if (!this.resizeHandler) return;
		this.removeChild(this.resizeHandler);
		this.resizeHandler = null;
	}

	private async saveImageManagerSettings(patch: Partial<ImageManagerSettings>): Promise<void> {
		if (!this.settings.imageManager) return;
		Object.assign(this.settings.imageManager, patch);
		if (patch.lastSelectedFolder !== undefined) {
			this.settings.imageManager.lastSelectedFolder = patch.lastSelectedFolder
				? normalizePath(patch.lastSelectedFolder)
				: "";
		}
		await this.saveData(this.settings);
		if (patch.filterPresets !== undefined) void this.syncRequiredViewIcons();
	}

	private syncRequiredViewIcons(): Promise<void> {
		const icons = (this.settings.imageManager?.filterPresets ?? [])
			.map((view) => view.icon ?? "layout-grid");
		return this.viewIconService?.syncRequiredIcons(icons) ?? Promise.resolve();
	}

	private refreshImageManagerIcons(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(IMAGE_MANAGER_VIEW_TYPE)) {
			if (leaf.view instanceof ImageManagerView) leaf.view.refreshIcons();
		}
	}

	/**
	 * 注册 Vault 文件变更事件监听
	 * 当图片或自定义文件类型发生创建, 删除, 重命名时, 实时更新所有已打开的图片管理器视图
	 */
	private registerVaultChangeListeners(): void {
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile) {
					this.imageCatalog.upsert(file);
					if (this.isRelevantFile(file)) this.scheduleViewRefresh({ type: "create", file });
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) {
					this.imageCatalog.remove(file.path);
					this.notifyReferencePaths(this.referenceIndex.removeSource(file.path));
					this.referenceIndex.removeCacheKey(file.path);
					if (this.isRelevantFile(file)) this.scheduleViewRefresh({ type: "delete", file });
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) this.imageCatalog.rename(file, oldPath);
				if (file instanceof TFile) this.notifyReferencePaths(this.referenceIndex.renamePath(oldPath, file.path));
				if (file instanceof TFile && (this.isRelevantFile(file) || this.isRelevantPath(oldPath))) {
					this.scheduleViewRefresh({ type: "rename", file, oldPath });
				}
			})
		);
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile && this.isRelevantFile(file)) {
					this.imageCatalog.upsert(file);
					this.scheduleViewRefresh({ type: "modify", file });
				}
			})
		);

		this.registerEvent(this.app.metadataCache.on("resolve", (file) => {
			if (!this.hasCompletedInitialLinkResolution) return;
			this.notifyReferencePaths(this.referenceIndex.refreshSource(file));
		}));
		this.registerEvent(this.app.metadataCache.on("resolved", () => {
			if (this.hasCompletedInitialLinkResolution) return;
			this.hasCompletedInitialLinkResolution = true;
			if (this.app.workspace.getLeavesOfType(IMAGE_MANAGER_VIEW_TYPE).length === 0) return;
			void this.referenceIndex.rebuild().then((paths) => this.notifyReferencePaths(paths));
		}));
		this.registerEvent(this.app.metadataCache.on("deleted", (file) => {
			this.notifyReferencePaths(this.referenceIndex.removeSource(file.path));
		}));
	}

	/**
	 * 判断文件是否为插件关注的文件类型 (标准图片格式 + 用户自定义文件类型)
	 */
	private isRelevantFile(file: TFile): boolean {
		return this.isRelevantExtension(file.extension);
	}

	private isRelevantPath(path: string): boolean {
		const fileName = path.substring(path.lastIndexOf("/") + 1);
		const extensionIndex = fileName.lastIndexOf(".");
		return extensionIndex >= 0 && this.isRelevantExtension(fileName.substring(extensionIndex + 1));
	}

	private isRelevantExtension(extension: string): boolean {
		const ext = extension.toLowerCase();

		// 标准图片扩展名
		if ((SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
			return true;
		}

		// 用户自定义文件类型 (含封面文件)
		const managerSettings = this.settings.imageManager;
		const customTypes = [
			...(managerSettings?.customFileTypes ?? []),
			...(managerSettings?.filterPresets ?? []).flatMap((view) => view.mappings ?? []),
		];
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
	 * 防抖调度视图刷新 (200ms 内的多次变更合并为一次刷新)
	 */
	private scheduleViewRefresh(change: ImageManagerVaultChange): void {
		const key = change.oldPath ?? change.file.path;
		const existing = this.pendingVaultChanges.get(key);
		this.pendingVaultChanges.set(key, existing?.type === "rename"
			? { ...existing, file: change.file }
			: change);
		if (this.vaultChangeTimer !== null) {
			window.clearTimeout(this.vaultChangeTimer);
		}
		this.vaultChangeTimer = window.setTimeout(() => {
			this.vaultChangeTimer = null;
			const changes = Array.from(this.pendingVaultChanges.values());
			this.pendingVaultChanges.clear();
			this.notifyImageManagerViews(changes);
		}, 200);
	}

	private notifyReferencePaths(paths: ReadonlySet<string>): void {
		if (paths.size === 0) return;
		for (const leaf of this.app.workspace.getLeavesOfType(IMAGE_MANAGER_VIEW_TYPE)) {
			if (leaf.view instanceof ImageManagerView) void leaf.view.refreshReferencePaths(paths);
		}
	}

	/**
	 * 通知所有打开的图片管理器视图刷新
	 */
	private notifyImageManagerViews(changes: readonly ImageManagerVaultChange[]): void {
		const leaves = this.app.workspace.getLeavesOfType(IMAGE_MANAGER_VIEW_TYPE);
		leaves.forEach(leaf => {
			const view = leaf.view;
			if (view instanceof ImageManagerView) {
				view.applyVaultChanges(changes);
			}
		});
	}
}
