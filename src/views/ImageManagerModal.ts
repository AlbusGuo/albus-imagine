/**
 * 图片管理器主视图Modal
 */

import { App, Modal, Notice } from "obsidian";
import {
	ImageItem,
	ImageManagerSettings,
	SortOrder,
} from "../types/image-manager.types";
import { ImageLoaderService } from "../services/ImageLoaderService";
import { ReferenceCheckService } from "../services/ReferenceCheckService";
import { FileOperationService } from "../services/FileOperationService";
import { ImageFilterService } from "../services/ImageFilterService";
import { ImageGridComponent } from "../components/ImageGridComponent";
import { SearchSortBarComponent } from "../components/SearchSortBarComponent";
import { HeaderComponent } from "../components/HeaderComponent";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { RenameModal } from "./RenameModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { BatchDeleteConfirmModal } from "./BatchDeleteConfirmModal";
import { ImageLoadCache } from "../models/ImageLoadCache";

export class ImageManagerModal extends Modal {
	private settings: ImageManagerSettings;
	private selectedFolder: string;
	private images: ImageItem[] = [];
	private filteredImages: ImageItem[] = [];
	private searchQuery = "";
	private sortOrder: SortOrder = "desc";
	private showUnreferencedOnly = false;
	private isLoading = false;
	private isCheckingReferences = false;

	// Services
	private imageLoader: ImageLoaderService;
	private referenceChecker: ReferenceCheckService;
	private fileOperations: FileOperationService;
	private imageFilter: ImageFilterService;
	private imageLoadCache: ImageLoadCache;

	// Components
	private headerComponent: HeaderComponent;
	private searchSortBar: SearchSortBarComponent;
	private imageGrid: ImageGridComponent;

	// Container elements
	private headerContainer: HTMLElement;
	private searchContainer: HTMLElement;
	private gridContainer: HTMLElement;

	constructor(app: App, settings: ImageManagerSettings) {
		super(app);
		this.settings = settings;
		// 优先使用上次选择的文件夹，否则使用默认文件夹
		this.selectedFolder = settings.lastSelectedFolder ?? settings.folderPath ?? "";
		this.showUnreferencedOnly = settings.defaultFilterUnreferenced || false;

		// Initialize services
		this.imageLoader = new ImageLoaderService(app);
		this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
		this.referenceChecker = new ReferenceCheckService(app);
		this.fileOperations = new FileOperationService(app);
		this.imageFilter = new ImageFilterService();
		this.imageLoadCache = new ImageLoadCache();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("image-manager-container");

		this.setupLayout();
		this.loadImages();
	}

	/**
	 * 设置布局
	 */
	private setupLayout(): void {
		const { contentEl } = this;

		// 头部（带文件夹选择器）
		this.headerContainer = contentEl.createDiv();
		this.headerComponent = new HeaderComponent(this.headerContainer, true, this.app);
		this.headerComponent.setEventHandlers({
			onCheckReferences: () => this.checkReferences(),
			onToggleUnreferencedFilter: () => this.toggleUnreferencedFilter(),
			onBatchDelete: () => this.handleBatchDelete(),
			onFolderChange: (folder) => this.handleFolderChange(folder),
		});
		// 设置初始文件夹值
		this.headerComponent.setFolderValue(this.selectedFolder);

		// 搜索和排序栏
		this.searchContainer = contentEl.createDiv();
		this.searchSortBar = new SearchSortBarComponent(this.searchContainer);
		this.searchSortBar.setEventHandlers({
			onSearchChange: (query) => this.handleSearchChange(query),
			onSortChange: (order) => this.handleSortChange(order),
		});

		// 图片网格
		const gridPanel = contentEl.createDiv({
			cls: "image-manager-grid-panel",
		});

		const gridHeader = gridPanel.createDiv({
			cls: "image-manager-grid-header",
		});
		gridHeader.createEl("h3", { text: "图片文件" });
		gridHeader.createDiv({
			cls: "image-manager-format-info",
			text: "支持 PNG, JPG, JPEG, GIF, BMP, WEBP, SVG, AGX",
		});

		this.gridContainer = gridPanel.createDiv();
		this.imageGrid = new ImageGridComponent(this.gridContainer);
		this.imageGrid.setEventHandlers({
			onImageClick: (image) => this.openImagePreview(image),
			onImageDoubleClick: (image) => this.handleDoubleClick(image),
			onOpenClick: (image) => this.openFile(image),
			onRenameClick: (image) => this.openRenameModal(image),
			onDeleteClick: (image) => this.deleteFile(image),
		});
	}

	/**
	 * 加载图片
	 */
	private async loadImages(): Promise<void> {
		this.isLoading = true;
		this.imageGrid.showLoading();

		try {
			this.images = await this.imageLoader.loadImages(
				this.selectedFolder,
				this.sortOrder
			);

			// 自动检查引用
			if (this.images.length > 0) {
				this.isCheckingReferences = true;
				this.headerComponent.setCheckingState(true);
				this.images = await this.referenceChecker.checkReferences(
					this.images
				);
				this.isCheckingReferences = false;
				this.headerComponent.setCheckingState(false);
			}

			this.applyFilters();
			this.updateStats();
		} catch (error) {
			console.error("加载图片时出错:", error);
			new Notice(`加载图片失败: ${error.message}`);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * 检查引用
	 */
	private async checkReferences(): Promise<void> {
		if (this.isCheckingReferences || this.images.length === 0) return;

		this.isCheckingReferences = true;
		this.headerComponent.setCheckingState(true);

		try {
			this.images = await this.referenceChecker.checkReferences(
				this.images
			);
			this.applyFilters();
			this.updateStats();
			new Notice("引用检查完成");
		} catch (error) {
			console.error("检查引用时出错:", error);
			new Notice(`检查引用失败: ${error.message}`);
		} finally {
			this.isCheckingReferences = false;
			this.headerComponent.setCheckingState(false);
		}
	}

	/**
	 * 应用筛选
	 */
	private applyFilters(): void {
		this.filteredImages = this.imageFilter.applyFilters(
			this.images,
			this.searchQuery,
			this.showUnreferencedOnly
		);

		this.imageGrid.render(this.filteredImages, (image) =>
			this.imageLoader.getImageResourcePath(image.displayFile)
		);
	}

	/**
	 * 更新统计信息
	 */
	private updateStats(): void {
		const unreferenced = this.images.filter(
			(img) => img.referenceCount === 0
		).length;

		this.headerComponent.updateStats(
			this.images.length,
			this.filteredImages.length,
			unreferenced
		);
	}

	/**
	 * 处理搜索变化
	 */
	private handleSearchChange(query: string): void {
		this.searchQuery = query;
		this.applyFilters();
	}

	/**
	 * 处理排序变化
	 */
	private async handleSortChange(order: SortOrder): Promise<void> {
		this.sortOrder = order;
		await this.loadImages();
	}

	/**
	 * 处理文件夹变化
	 */
	private async handleFolderChange(folder: string): Promise<void> {
		this.selectedFolder = folder;
		await this.loadImages();
		
		// 保存当前选择的文件夹
		await this.saveLastSelectedFolder();
	}

	/**
	 * 保存上次选择的文件夹
	 */
	private async saveLastSelectedFolder(): Promise<void> {
		try {
			const plugin = (this.app as any).plugins?.plugins?.["albus-imagine"];
			if (plugin) {
				// 直接更新 settings 对象并保存
				if (!plugin.settings.imageManager) {
					plugin.settings.imageManager = {};
				}
				plugin.settings.imageManager.lastSelectedFolder = this.selectedFolder;
				await plugin.saveSettings();
				console.log("已保存文件夹选择:", this.selectedFolder);
			} else {
				console.error("无法获取插件实例");
			}
		} catch (error) {
			console.error("保存文件夹选择失败:", error);
		}
	}

	/**
	 * 切换未引用筛选
	 */
	private toggleUnreferencedFilter(): void {
		this.showUnreferencedOnly = !this.showUnreferencedOnly;
		this.headerComponent.setFilterButtonActive(this.showUnreferencedOnly);
		this.applyFilters();
	}

	/**
	 * 打开图片预览
	 */
	private openImagePreview(image: ImageItem): void {
		const references = image.references || [];
		const modal = new ImagePreviewModal(
			this.app,
			image,
			references,
			(img) => this.imageLoader.getImageResourcePath(img.displayFile),
			(filePath) => this.fileOperations.openReferenceFile(filePath)
		);
		modal.open();
	}

	/**
	 * 处理双击 - 不再触发打开操作
	 */
	private handleDoubleClick(image: ImageItem): void {
		// 双击功能已移除，现在通过点击预览或使用打开按钮
	}

	/**
	 * 打开文件
	 */
	private async openFile(image: ImageItem): Promise<void> {
		try {
			await this.fileOperations.openFile(image);
		} catch (error) {
			new Notice(`打开文件失败: ${error.message}`);
		}
	}

	/**
	 * 打开重命名Modal
	 */
	private openRenameModal(image: ImageItem): void {
		const modal = new RenameModal(this.app, image, async (newName) => {
			try {
				await this.fileOperations.renameFile(image, newName);
				// 清除缓存
				this.referenceChecker.getCache().delete(image.path);
				this.imageLoadCache.delete(image.path);
				// 重新加载
				await this.loadImages();
			} catch (error) {
				// Error already handled in service
			}
		});
		modal.open();
	}

	/**
	 * 删除文件
	 */
	private async deleteFile(image: ImageItem): Promise<void> {
		// 如果设置中禁用了确认，直接删除
		if (this.settings.confirmDelete === false) {
			try {
				await this.fileOperations.deleteFile(image);
				// 优化：只从内存中移除，而不是重新加载所有图片
				this.removeImageFromList(image);
			} catch (error) {
				// 错误已在 service 中处理
			}
			return;
		}

		// 显示确认模态框
		const extraMessage = this.fileOperations.getDeleteExtraMessage(image);
		const modal = new DeleteConfirmModal(
			this.app,
			image,
			extraMessage,
			async () => {
				await this.fileOperations.deleteFile(image);
				// 优化：只从内存中移除，而不是重新加载所有图片
				this.removeImageFromList(image);
			}
		);
		modal.open();
	}

	/**
	 * 从列表中移除图片（优化后的删除逻辑）
	 */
	private removeImageFromList(image: ImageItem): void {
		// 从 images 数组中移除
		this.images = this.images.filter(img => img.path !== image.path);
		// 从 filteredImages 数组中移除
		this.filteredImages = this.filteredImages.filter(img => img.path !== image.path);
		// 清除缓存
		this.referenceChecker.getCache().delete(image.path);
		this.imageLoadCache.delete(image.path);
		// 重新渲染（使用组件方式）
		this.imageGrid.render(this.filteredImages, (img) =>
			this.imageLoader.getImageResourcePath(img.displayFile)
		);
		// 更新头部统计
		this.headerComponent.updateStats(
			this.images.length,
			this.filteredImages.length
		);
	}

/**
 * 批量删除未引用图片
 */
private async handleBatchDelete(): Promise<void> {
	if (this.filteredImages.length === 0) {
		new Notice("没有要删除的图片");
		return;
	}

	// 显示批量删除确认模态框
	const modal = new BatchDeleteConfirmModal(
		this.app,
		this.filteredImages,
		async () => {
			const total = this.filteredImages.length;
			const notice = new Notice(`正在删除 ${total} 张图片...`, 0);

			// 使用 Promise.allSettled 并行删除以提高性能
			const deletePromises = this.filteredImages.map(image => 
				this.fileOperations.deleteFile(image, true) // 使用静默模式
					.then(() => ({ status: 'success' as const, image }))
					.catch((error) => ({ status: 'error' as const, image, error }))
			);

			const results = await Promise.allSettled(deletePromises);
			
			// 统计结果
			let successCount = 0;
			let errorCount = 0;
			
			for (const result of results) {
				if (result.status === 'fulfilled' && result.value.status === 'success') {
					successCount++;
				} else {
					errorCount++;
					if (result.status === 'fulfilled' && result.value.status === 'error') {
						console.error(`删除文件失败: ${result.value.image.path}`, result.value.error);
					}
				}
			}

			notice.hide();

			// 显示结果
			if (errorCount === 0) {
				new Notice(`成功删除 ${successCount} 张图片`);
			} else {
				new Notice(`删除完成: 成功 ${successCount} 张, 失败 ${errorCount} 张`);
			}

			// 刷新列表
			await this.loadImages();
		}
	);
	modal.open();
}

onClose(): void {
	if (this.headerComponent) {
		this.headerComponent.destroy();
	}
	const { contentEl } = this;
	contentEl.empty();
}
}