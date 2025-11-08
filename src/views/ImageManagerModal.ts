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
		this.selectedFolder = settings.folderPath || "";
		this.showUnreferencedOnly = settings.defaultFilterUnreferenced || false;

		// Initialize services
		this.imageLoader = new ImageLoaderService(app);
		this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
		this.referenceChecker = new ReferenceCheckService(app);
		this.fileOperations = new FileOperationService(app);
		this.fileOperations.setFileOpenModes(settings.fileOpenModes || {});
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

		// 头部
		this.headerContainer = contentEl.createDiv();
		this.headerComponent = new HeaderComponent(this.headerContainer);
		this.headerComponent.setEventHandlers({
			onCheckReferences: () => this.checkReferences(),
			onToggleUnreferencedFilter: () => this.toggleUnreferencedFilter(),
		});

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
		try {
			await this.fileOperations.deleteFile(
				image,
				this.settings.confirmDelete !== false
			);
			// 清除缓存
			this.referenceChecker.getCache().delete(image.path);
			this.imageLoadCache.delete(image.path);
			// 重新加载
			await this.loadImages();
		} catch (error) {
			// Error already handled in service
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
