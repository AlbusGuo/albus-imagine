/**
 * 图片管理器视图 - 使用经典的 Obsidian ItemView
 */

import { ItemView, Menu, Notice, setIcon, WorkspaceLeaf } from "obsidian";
import {
	ImageItem,
	ImageManagerSettings,
	SortField,
	SortOrder,
} from "../types/image-manager.types";
import { ImageLoaderService } from "../services/ImageLoaderService";
import { ReferenceCheckService } from "../services/ReferenceCheckService";
import { FileOperationService } from "../services/FileOperationService";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { RenameModal } from "./RenameModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { BatchDeleteConfirmModal } from "./BatchDeleteConfirmModal";
import { FolderSuggest } from "../components/FolderSuggest";
import { FolderPickerModal } from "./FolderPickerModal";
import { ViewportGrid, ViewportGridController } from "../components/ViewportGrid";
import { ViewportMediaController, ViewportMediaLoader } from "../components/ViewportMediaLoader";
import { ImageCatalogService } from "../services/ImageCatalogService";
import { createImageManagerCard, updateImageManagerReferenceBadge } from "../components/ImageManagerCard";
import { filterAndSortImages } from "../utils/imageCollection";

interface ManagerImageController extends ViewportGridController<ImageItem>, ViewportMediaController { }

export const IMAGE_MANAGER_VIEW_TYPE = "image-manager-view";

export class ImageManagerView extends ItemView {
	private settings: ImageManagerSettings;
	private selectedFolder: string;
	private images: ImageItem[] = [];
	private filteredImages: ImageItem[] = [];
	private searchQuery = "";
	private sortField: SortField = "mtime";
	private sortOrder: SortOrder = "desc";
	private showUnreferencedOnly = false;
	private isLoading = false;
	private isCheckingReferences = false;
	private referenceGeneration = 0;
	private referenceCheckPending = false;
	private folderSuggest: FolderSuggest | null = null;

	// 多选模式
	private isMultiSelectMode = false;
	private selectedImages: Set<string> = new Set(); // 存储选中图片的路径

	// Services
	private imageLoader: ImageLoaderService;
	private referenceChecker: ReferenceCheckService;
	private fileOperations: FileOperationService;

	private renderGeneration = 0;
	private refreshPending = false;
	private isClosed = false;
	private readonly persistSelectedFolder: (folder: string) => Promise<void>;

	// Container elements
	private headerContainer: HTMLElement;
	private searchContainer: HTMLElement;
	private gridContainer: HTMLElement;
	private gridEl: HTMLElement;
	private gridStateEl: HTMLElement;
	private viewportGrid: ViewportGrid<ImageItem, ManagerImageController> | null = null;
	private mediaLoader: ViewportMediaLoader<ManagerImageController> | null = null;
	private visibleReferenceFrame: number | null = null;
	private visibleReferenceControllers: readonly ManagerImageController[] = [];
	private pendingReferencePaths = new Set<string>();

	constructor(
		leaf: WorkspaceLeaf,
		settings: ImageManagerSettings,
		persistSelectedFolder: (folder: string) => Promise<void>,
		imageCatalog: ImageCatalogService,
		referenceChecker: ReferenceCheckService,
	) {
		super(leaf);
		this.persistSelectedFolder = persistSelectedFolder;
		this.settings = settings;
		// 优先使用上次选择的文件夹, 否则使用默认文件夹
		this.selectedFolder = settings.lastSelectedFolder ?? settings.folderPath ?? "";
		this.showUnreferencedOnly = false;
		// 使用默认排序设置
		this.sortField = settings.defaultSortField || "mtime";
		this.sortOrder = settings.defaultSortOrder || "desc";

		// 初始化服务
		this.imageLoader = new ImageLoaderService(this.app, imageCatalog);
		this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
		this.imageLoader.setExcludedFolders(settings.excludedFolders || []);
		this.referenceChecker = referenceChecker;
		this.fileOperations = new FileOperationService(this.app);
	}

	getViewType(): string {
		return IMAGE_MANAGER_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "图片管理器";
	}

	getIcon(): string {
		return "images";
	}

	async onOpen(): Promise<void> {
		this.isClosed = false;
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("image-manager-container");

		this.setupLayout();
		await Promise.resolve();
		this.loadImages();
	}

	onClose(): Promise<void> {
		this.isClosed = true;
		this.renderGeneration++;
		if (this.visibleReferenceFrame !== null) {
			this.contentEl.ownerDocument.defaultView?.cancelAnimationFrame(this.visibleReferenceFrame);
			this.visibleReferenceFrame = null;
		}
		this.viewportGrid?.destroy();
		this.viewportGrid = null;
		this.mediaLoader?.destroy();
		this.mediaLoader = null;
		this.pendingReferencePaths.clear();
		this.folderSuggest?.close();
		this.folderSuggest = null;
		this.contentEl.empty();
		return Promise.resolve();
	}

	/**
	 * 更新设置
	 */
	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
		this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
		this.imageLoader.setExcludedFolders(settings.excludedFolders || []);
		// 重新加载图片以应用新设置
		void this.loadImages();
	}

	/**
	 * 设置布局
	 */
	private setupLayout(): void {
		const { contentEl } = this;

		// 创建头部容器
		this.headerContainer = contentEl.createDiv("image-manager-header");
		this.renderHeader();

		// 创建搜索排序栏容器
		this.searchContainer = contentEl.createDiv("image-manager-search");
		this.renderSearchBar();

		// 创建网格容器 - 使用 grid-panel 包裹
		const gridPanel = contentEl.createDiv("image-manager-grid-panel");
		this.gridContainer = gridPanel;
		this.gridStateEl = gridPanel.createDiv("image-manager-grid-state");
		this.gridEl = gridPanel.createDiv("image-manager-grid");
		this.mediaLoader = new ViewportMediaLoader(this.gridEl);
		this.viewportGrid = new ViewportGrid({
			viewportEl: this.gridContainer,
			gridEl: this.gridEl,
			getKey: (image) => image.path,
			// 引用检查只替换引用字段时保留现有卡片; 真实文件或元数据变化则重建.
			shouldReuse: (previous, next) =>
				previous.originalFile === next.originalFile &&
				previous.displayFile === next.displayFile &&
				previous.stat === next.stat &&
				previous.name === next.name,
			create: (image) => this.createImageController(image),
			update: (controller, image) => {
				controller.item = image;
				controller.element.toggleClass(
					"image-manager-item-selected",
					this.isMultiSelectMode && this.selectedImages.has(image.path),
				);
				this.updateReferenceDisplay(controller.element, image);
			},
			onVisibleChange: (controllers) => this.handleVisibleControllers(controllers),
			minimumItemWidth: 160,
			compactItemWidth: 120,
			estimatedItemHeight: 205,
			gap: 12,
			padding: 16,
			overscanRows: 5,
		});
	}

	/**
	 * 渲染头部
	 */
	private renderHeader(): void {
		this.headerContainer.empty();

		// 单行布局: 统计 + 按钮
		const headerRow = this.headerContainer.createDiv("image-manager-header-row");

		// 左侧: 文件夹输入 + 统计信息
		const leftSection = headerRow.createDiv("image-manager-header-left");

		// 文件夹路径输入框 (始终可见, 附带 AbstractInputSuggest)
		const folderInputContainer = leftSection.createDiv("image-manager-folder-input-container");
		const folderInput = folderInputContainer.createEl("input", {
			type: "text",
			placeholder: "按文件夹筛选...",
			value: this.selectedFolder,
			cls: "image-manager-folder-input",
		});

		// 清空按钮 (只在有路径时显示)
		if (this.selectedFolder) {
			const clearBtn = folderInputContainer.createEl("button", {
				cls: "image-manager-folder-clear clickable-icon",
				attr: { "aria-label": "清空筛选" },
			});
			setIcon(clearBtn, "x");
			clearBtn.onclick = async () => {
				this.selectedFolder = "";
				await this.refresh();
			};
		}

		// 创建 AbstractInputSuggest
		if (this.folderSuggest) {
			this.folderSuggest.close();
		}
		this.folderSuggest = new FolderSuggest(this.app, folderInput, (value) => {
			this.selectedFolder = value;
			void this.refresh();
		});

		// 回车键确认手动输入
		folderInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.selectedFolder = folderInput.value;
				void this.refresh();
			}
		});

		// 统计信息
		const statsEl = leftSection.createDiv("image-manager-stats");
		statsEl.createSpan({ text: `${this.images.length}`, cls: "image-manager-stats-number" });
		statsEl.createSpan({ text: " 张图片", cls: "image-manager-stats-label" });
		if (this.showUnreferencedOnly) {
			statsEl.createSpan({ text: " / ", cls: "image-manager-stats-sep" });
			statsEl.createSpan({ text: `筛选 ${this.filteredImages.length}`, cls: "image-manager-stats-number" });
			statsEl.createSpan({ text: " 张", cls: "image-manager-stats-label" });
		}
		if (this.isMultiSelectMode) {
			statsEl.createSpan({ text: " / ", cls: "image-manager-stats-sep" });
			statsEl.createSpan({ text: `${this.selectedImages.size}`, cls: "image-manager-stats-number" });
			statsEl.createSpan({ text: " 张已选", cls: "image-manager-stats-label" });
		}

		// 右侧: 操作按钮
		const rightSection = headerRow.createDiv("image-manager-header-right");

		// 删除按钮逻辑: 多选优先于筛选
		if (this.isMultiSelectMode && this.selectedImages.size > 0) {
			// 多选模式且有选中项: 批量移动
			const batchMoveSelectedBtn = rightSection.createEl("button", {
				cls: "clickable-icon",
				attr: { "aria-label": `移动选中 (${this.selectedImages.size})` },
			});
			setIcon(batchMoveSelectedBtn, "folder-tree");
			batchMoveSelectedBtn.onclick = () => this.handleBatchMoveSelected();

			// 多选模式且有选中项: 批量删除
			const batchDeleteSelectedBtn = rightSection.createEl("button", {
				cls: "clickable-icon image-manager-destructive-icon",
				attr: { "aria-label": `删除选中 (${this.selectedImages.size})` },
			});
			setIcon(batchDeleteSelectedBtn, "trash-2");
			batchDeleteSelectedBtn.onclick = () => this.handleBatchDeleteSelected();
		} else if (this.showUnreferencedOnly && this.filteredImages.length > 0) {
			// 筛选模式且没有多选: 删除全部未引用
			const deleteAllUnreferencedBtn = rightSection.createEl("button", {
				cls: "clickable-icon image-manager-destructive-icon",
				attr: { "aria-label": "删除全部未引用" },
			});
			setIcon(deleteAllUnreferencedBtn, "trash-2");
			deleteAllUnreferencedBtn.onclick = () => this.handleBatchDelete();
		}

		// 多选按钮
		const multiSelectBtn = rightSection.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": this.isMultiSelectMode ? "取消多选" : "多选" },
		});
		setIcon(multiSelectBtn, this.isMultiSelectMode ? "x-square" : "copy-check");
		if (this.isMultiSelectMode) {
			multiSelectBtn.addClass("is-active");
		}
		multiSelectBtn.setAttribute("aria-pressed", String(this.isMultiSelectMode));
		multiSelectBtn.onclick = () => {
			this.isMultiSelectMode = !this.isMultiSelectMode;
			if (!this.isMultiSelectMode) {
				// 退出多选模式时清空选中
				this.selectedImages.clear();
			}
			this.renderHeader();
			this.renderGrid();
		};

		// 刷新按钮
		const refreshBtn = rightSection.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "刷新" },
		});
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.onclick = () => { void this.refresh(); };
	}



	/**
	 * 渲染搜索栏
	 */
	private renderSearchBar(): void {
		this.searchContainer.empty();
		this.searchContainer.addClass("image-manager-search-sort-bar");

		const searchBoxEl = this.searchContainer.createDiv("image-manager-search-box");

		// 搜索输入框
		const searchInput = searchBoxEl.createEl("input", {
			type: "text",
			placeholder: "搜索图片...",
			value: this.searchQuery,
			cls: "image-manager-search-input",
		});
		searchInput.oninput = () => {
			this.searchQuery = searchInput.value;
			this.applyFilters();
			this.renderGrid();
		};

		// 排序和过滤控制区域
		const sortControlsEl = this.searchContainer.createDiv("image-manager-sort-controls");

		// 筛选 (移到排序前面)
		const filterBtn = sortControlsEl.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": this.showUnreferencedOnly ? "显示全部" : "筛选未引用" },
		});
		setIcon(filterBtn, this.showUnreferencedOnly ? "filter-x" : "filter");
		if (this.showUnreferencedOnly) {
			filterBtn.addClass("is-active");
		}
		filterBtn.onclick = async () => {
			// 检查是否所有图片都已经检查过引用
			const uncheckedImages = this.images.filter(img => img.references === undefined);

			if (!this.showUnreferencedOnly && uncheckedImages.length > 0) {
				// 有未检查的图片, 需要检查所有图片的引用
				await this.checkReferences();
			}

			this.showUnreferencedOnly = !this.showUnreferencedOnly;
			this.applyFilters();
			this.renderSearchBar(); // 更新筛选按钮文字
			this.renderHeader();
			this.renderGrid();
		};

		// 排序字段
		const sortFieldBtn = sortControlsEl.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "排序方式" },
		});
		setIcon(sortFieldBtn, "arrow-up-narrow-wide");
		sortFieldBtn.onclick = (evt) => {
			const menu = new Menu();
			const sortFieldOptions: { value: SortField; text: string; }[] = [
				{ value: "mtime", text: "修改时间" },
				{ value: "ctime", text: "创建时间" },
				{ value: "size", text: "文件大小" },
				{ value: "name", text: "文件名" },
				{ value: "references", text: "引用数量" },
			];
			sortFieldOptions.forEach((opt) => {
				menu.addItem((item) => {
					item.setTitle(opt.text)
						.setChecked(this.sortField === opt.value)
						.onClick(async () => {
							this.sortField = opt.value;

							// 和筛选按钮相同的逻辑: 选择引用排序时, 若有未检查的图片则先检查
							if (opt.value === "references") {
								const uncheckedImages = this.images.filter(img => img.references === undefined);
								if (uncheckedImages.length > 0) {
									await this.checkReferences();
								}
							}

							this.applyFilters();
							this.renderGrid();
						});
				});
			});
			menu.showAtMouseEvent(evt);
		};

		// 排序顺序
		const sortOrderBtn = sortControlsEl.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": this.sortOrder === "desc" ? "降序" : "升序" },
		});
		this.updateSortOrderButton(sortOrderBtn);
		sortOrderBtn.onclick = () => {
			this.sortOrder = this.sortOrder === "asc" ? "desc" : "asc";
			this.updateSortOrderButton(sortOrderBtn);
			this.applyFilters();
			this.renderGrid();
		};
	}

	/**
	 * 更新排序顺序按钮
	 */
	private updateSortOrderButton(button: HTMLElement): void {
		button.empty();
		if (this.sortOrder === "desc") {
			setIcon(button, "arrow-down");
			button.setAttribute("aria-label", "降序");
		} else {
			setIcon(button, "arrow-up");
			button.setAttribute("aria-label", "升序");
		}
	}

	/**
	 * 渲染网格
	 */
	private renderGrid(): void {
		if (!this.viewportGrid) return;
		this.gridStateEl.empty();
		if (this.isLoading) {
			this.gridEl.hide();
			this.viewportGrid.setItems([]);
			const loadingEl = this.gridStateEl.createDiv("image-manager-loading-state");
			loadingEl.createDiv("image-manager-loading-spinner");
			loadingEl.createSpan({ text: "加载中..." });
			return;
		}
		if (this.filteredImages.length === 0) {
			this.gridEl.hide();
			this.viewportGrid.setItems([]);
			const emptyEl = this.gridStateEl.createDiv("image-manager-empty-state");
			emptyEl.createSpan({
				text: this.images.length === 0 ? "没有找到图片" : "没有符合条件的图片",
			});
			if (this.images.length === 0) {
				const hintEl = emptyEl.createDiv("image-manager-empty-hint");
				hintEl.createSpan({ text: "提示: 请检查文件夹路径设置" });
			}
			return;
		}
		this.gridEl.show();
		this.viewportGrid.setItems(this.filteredImages);
	}

	private createImageController(image: ImageItem): ManagerImageController {
		let controller: ManagerImageController;
		const { element, imageEl } = createImageManagerCard(
			this.app,
			this.contentEl.ownerDocument,
			image,
			this.settings,
			{
				isSelected: (path) => this.selectedImages.has(path),
				isMultiSelect: () => this.isMultiSelectMode,
				onToggleSelection: (_item, card) => this.toggleSelection(controller.item, card),
				onPreview: () => this.handlePreview(controller.item),
				onOpen: () => this.fileOperations.openFile(controller.item),
				onRename: () => this.handleRename(controller.item),
				onMove: () => this.handleMove(controller.item),
				onDelete: () => void this.handleDelete(controller.item),
			},
		);
		controller = {
			element,
			item: image,
			hasPendingMedia: () => Boolean(imageEl?.dataset.src),
			loadMedia: () => {
				const source = imageEl?.dataset.src;
				if (!imageEl || !source) return;
				imageEl.onload = () => imageEl.addClass("is-loaded");
				imageEl.src = source;
				delete imageEl.dataset.src;
			},
		};
		return controller;
	}

	private toggleSelection(image: ImageItem, element: HTMLElement): void {
		if (this.selectedImages.has(image.path)) this.selectedImages.delete(image.path);
		else this.selectedImages.add(image.path);
		element.toggleClass("image-manager-item-selected", this.selectedImages.has(image.path));
		this.renderHeader();
	}

	private handleVisibleControllers(controllers: readonly ManagerImageController[]): void {
		this.mediaLoader?.sync(controllers);
		this.visibleReferenceControllers = controllers;
		if (this.visibleReferenceFrame !== null) return;
		const ownerWindow = this.contentEl.ownerDocument.defaultView;
		if (!ownerWindow) return;
		this.visibleReferenceFrame = ownerWindow.requestAnimationFrame(() => {
			this.visibleReferenceFrame = null;
			const visible = this.visibleReferenceControllers.filter((controller) => controller.element.isConnected);
			void this.checkBatchReferences(
				visible.map((controller) => controller.item),
				visible.map((controller) => ({ image: controller.item, element: controller.element })),
				this.renderGeneration,
				this.referenceGeneration,
			);
		});
	}

	/**
	 * 加载图片
	 */
	private loadImages(): void {
		if (this.isClosed) return;
		if (this.isLoading) {
			this.refreshPending = true;
			return;
		}

		this.renderGeneration++;
		this.referenceGeneration++;
		// 图片或自定义封面变化后, 同一路径可能已对应不同的引用目标, 不能复用旧缓存.
		this.pendingReferencePaths.clear();
		this.isLoading = true;
		this.renderGrid(); // 显示加载状态

		try {
			this.images = this.imageLoader.loadImages(this.selectedFolder);

			this.applyFilters();
			this.renderHeader();
		} catch (error) {
			new Notice(`加载图片失败: ${error instanceof Error ? error.message : String(error)}`);
			console.error("Error loading images:", error);
		} finally {
			this.isLoading = false;
			// 重要: 加载完成后必须再次渲染以显示图片
			this.renderGrid();
			if (this.refreshPending) {
				this.refreshPending = false;
				queueMicrotask(() => this.loadImages());
			} else if (this.showUnreferencedOnly || this.sortField === "references") {
				void this.checkReferences();
			}
		}
	}

	/**
	 * 检查引用
	 */
	private async checkReferences(): Promise<void> {
		if (this.images.length === 0) return;
		if (this.isCheckingReferences) {
			this.referenceCheckPending = true;
			return;
		}

		this.isCheckingReferences = true;
		const generation = this.referenceGeneration;

		// 创建进度通知
		const progressNotice = new Notice(`正在检查引用... 0/${this.images.length}`, 0);

		try {
			// 重要: 接收返回的更新后的图片数组, 并传入进度回调
			const checkedImages = await this.referenceChecker.checkReferences(
				this.images,
				(current: number, total: number) => {
					const percentage = Math.round((current / total) * 100);
					progressNotice.setMessage(`正在检查引用... ${current}/${total} (${percentage}%)`);
				}
			);
			if (generation !== this.referenceGeneration || this.isClosed) return;
			this.images = checkedImages;

			progressNotice.hide();
			this.applyFilters(); // 重新应用过滤
			this.renderHeader(); // 更新过滤数量显示
			this.renderGrid();
			new Notice(`引用检查完成: 已检查 ${this.images.length} 张图片`);
		} catch (error) {
			progressNotice.hide();
			new Notice(`检查引用失败: ${error instanceof Error ? error.message : String(error)}`);
			console.error("Error checking references:", error);
		} finally {
			progressNotice.hide();
			this.isCheckingReferences = false;
			if (this.referenceCheckPending && !this.isClosed) {
				this.referenceCheckPending = false;
				void this.checkReferences();
			}
		}
	}

	private async getCurrentUnreferencedImages(): Promise<ImageItem[]> {
		const generation = ++this.referenceGeneration;
		const checkedImages = await this.referenceChecker.checkReferences(this.images, undefined, true);
		if (generation !== this.referenceGeneration || this.isClosed) return [];
		this.images = checkedImages;
		this.applyFilters();
		return [...this.filteredImages];
	}

	/**
	 * 检查一批图片的引用并更新显示
	 * 使用更小的批次和异步处理, 避免阻塞 UI
	 */
	private async checkBatchReferences(
		images: ImageItem[],
		elements: Array<{ image: ImageItem, element: HTMLElement; }>,
		renderGeneration: number,
		referenceGeneration: number,
	): Promise<void> {
		if (
			this.isClosed ||
			renderGeneration !== this.renderGeneration ||
			referenceGeneration !== this.referenceGeneration
		) return;
		// 过滤出还没有检查过引用的图片
		const needCheckImages = images.filter(
			(img) => img.references === undefined && !this.pendingReferencePaths.has(img.path),
		);

		if (needCheckImages.length === 0) {
			return; // 已经检查过了, 无需重复检查
		}

		needCheckImages.forEach((image) => this.pendingReferencePaths.add(image.path));
		try {
			// 使用更小的批次 (每次最多 10 张), 避免长时间阻塞
			const miniBatchSize = 10;
			for (let i = 0; i < needCheckImages.length; i += miniBatchSize) {
				if (
					this.isClosed ||
					renderGeneration !== this.renderGeneration ||
					referenceGeneration !== this.referenceGeneration
				) return;
				const miniBatch = needCheckImages.slice(i, Math.min(i + miniBatchSize, needCheckImages.length));

				// 检查这小批次的引用
				const updatedImages = await this.referenceChecker.checkReferences(miniBatch);
				if (
					this.isClosed ||
					renderGeneration !== this.renderGeneration ||
					referenceGeneration !== this.referenceGeneration
				) return;

				// 更新主数组中的引用信息
				updatedImages.forEach(updatedImg => {
					const currentImage = this.images.find(img => img.path === updatedImg.path);
					if (!currentImage) return;
					currentImage.references = updatedImg.references;
					currentImage.referenceCount = updatedImg.referenceCount;
				});

				// 更新 DOM 显示引用信息
				elements.forEach(({ image, element }) => {
					const updatedImg = updatedImages.find(img => img.path === image.path);
					if (updatedImg && updatedImg.references !== undefined) {
						this.updateReferenceDisplay(element, updatedImg);
					}
				});

				// 每处理一小批后, 给 UI 线程一些时间
				if (i + miniBatchSize < needCheckImages.length) {
					await new Promise(resolve => (this.containerEl.ownerDocument.defaultView ?? window).setTimeout(resolve, 10));
				}
			}
		} catch (error) {
			console.error("批量检查引用失败:", error);
		} finally {
			if (referenceGeneration === this.referenceGeneration) {
				needCheckImages.forEach((image) => this.pendingReferencePaths.delete(image.path));
			}
		}
	}

	/**
	 * 更新元素的引用显示
	 */
	private updateReferenceDisplay(itemEl: HTMLElement, image: ImageItem): void {
		updateImageManagerReferenceBadge(itemEl, image);
	}

	/**
	 * 应用过滤和排序
	 */
	private applyFilters(): void {
		this.filteredImages = filterAndSortImages(this.images, {
			query: this.searchQuery,
			unreferencedOnly: this.showUnreferencedOnly,
			sortField: this.sortField,
			sortOrder: this.sortOrder,
		});
	}

	/**
	 * 处理预览
	 */
	private handlePreview(image: ImageItem): void {
		// 从主数组中获取最新的图片数据 (包含最新的引用信息)
		const currentImage = this.images.find(img => img.path === image.path) || image;

		new ImagePreviewModal(
			this.app,
			currentImage,
			currentImage.references || [],
			(img) => this.app.vault.getResourcePath(img.displayFile),
			(filePath, position) => { void this.fileOperations.openReferenceFile(filePath, position); }
		).open();
	}

	/**
	 * 处理重命名
	 */
	private handleRename(image: ImageItem): void {
		new RenameModal(this.app, image, async (newName) => {
			const oldPath = image.path;
			const newPath = image.path.replace(/[^/]+$/, newName);
			await this.fileOperations.renameFile(image, newName);
			this.updateImageAfterRename(oldPath, newPath, newName);
			this.applyFilters();
			this.renderHeader();
			this.renderGrid();
		}).open();
	}

	/**
	 * 处理移动
	 */
	private handleMove(image: ImageItem): void {
		new FolderPickerModal(this.app, (folder) => {
			void (async () => {
				try {
					const oldPath = image.path;
					const newPath = await this.fileOperations.moveFile(image, folder.path);
					if (!newPath) return; // 文件已在目标文件夹中

					// 判断新路径是否仍在当前筛选目录内
					const stillInFilter = !this.selectedFolder ||
						newPath.startsWith(this.selectedFolder + "/");

					if (stillInFilter) {
						// 仍在筛选范围内, 更新内存数据
						this.updateImageAfterMove(oldPath, newPath);
					} else {
						// 移出筛选范围, 从列表移除
						this.images = this.images.filter((img) => img.path !== oldPath);
					}
					this.applyFilters();
					this.renderHeader();
					this.renderGrid();
				} catch {
					// 错误已在 service 中处理
				}
			})();
		}).open();
	}

	/**
	 * 处理删除
	 */
	private async handleDelete(image: ImageItem): Promise<void> {
		// 如果设置中禁用了确认, 直接删除
		if (this.settings.confirmDelete === false) {
			try {
				await this.fileOperations.deleteFile(image);
				// 优化: 只从内存中移除, 而不是重新加载所有图片
				this.removeImageFromList(image);
			} catch {
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
				// 优化: 只从内存中移除, 而不是重新加载所有图片
				this.removeImageFromList(image);
			}
		);
		modal.open();
	}

	/**
	 * 更新移动后的图片数据
	 */
	private updateImageAfterMove(oldPath: string, newPath: string): void {
		const newName = newPath.substring(newPath.lastIndexOf("/") + 1);
		this.updateImageAfterRename(oldPath, newPath, newName);
	}

	/**
	 * 更新重命名后的图片数据
	 */
	private updateImageAfterRename(oldPath: string, newPath: string, newName: string): void {
		// 更新 images 数组中的图片信息
		const imageIndex = this.images.findIndex(img => img.path === oldPath);
		if (imageIndex !== -1) {
			this.images[imageIndex] = {
				...this.images[imageIndex],
				path: newPath,
				name: newName,
			};
		}

		// 更新 filteredImages 数组
		const filteredIndex = this.filteredImages.findIndex(img => img.path === oldPath);
		if (filteredIndex !== -1) {
			this.filteredImages[filteredIndex] = {
				...this.filteredImages[filteredIndex],
				path: newPath,
				name: newName,
			};
		}

		// 更新引用缓存的键
		this.referenceChecker.updateCacheKey(oldPath, newPath);
		if (this.selectedImages.delete(oldPath)) this.selectedImages.add(newPath);
		if (this.pendingReferencePaths.delete(oldPath)) this.pendingReferencePaths.add(newPath);
	}

	/**
	 * 从列表中移除图片 (优化后的删除逻辑, 保持滚动位置)
	 */
	private removeImageFromList(image: ImageItem): void {
		// 从 images 数组中移除
		this.images = this.images.filter(img => img.path !== image.path);
		// 从 filteredImages 数组中移除
		this.filteredImages = this.filteredImages.filter(img => img.path !== image.path);
		// 从选中列表中移除 (如果存在)
		this.selectedImages.delete(image.path);
		this.referenceChecker.removeCacheKey(image.path);

		this.viewportGrid?.setItems(this.filteredImages);
		// 更新头部统计信息
		this.renderHeader();
	}

	/**
	 * 批量删除未引用图片
	 */
	private handleBatchDelete(): void {
		if (this.filteredImages.length === 0) {
			new Notice("没有要删除的图片");
			return;
		}

		void (async () => {
			const initialCandidates = await this.getCurrentUnreferencedImages();
			if (initialCandidates.length === 0) {
				new Notice("重新检查后没有未引用图片");
				this.renderHeader();
				this.renderGrid();
				return;
			}
			const modal = new BatchDeleteConfirmModal(
				this.app,
				initialCandidates,
				async (onProgress: (current: number, total: number) => void) => {
					const candidatePaths = new Set(initialCandidates.map((image) => image.path));
					const imagesToDelete = (await this.getCurrentUnreferencedImages())
						.filter((image) => candidatePaths.has(image.path));
					if (imagesToDelete.length === 0) {
						new Notice("最终检查后没有可安全删除的图片");
						return;
					}
					await this.deleteImageBatch(imagesToDelete, onProgress);
				}
			);
			modal.open();
		})();
	}

	/**
	 * 批量删除选中的图片
	 */
	private handleBatchDeleteSelected(): void {
		if (this.selectedImages.size === 0) {
			new Notice("没有选中的图片");
			return;
		}

		// 获取选中的图片对象
		const imagesToDelete = this.images.filter(img => this.selectedImages.has(img.path));

		// 显示批量删除确认模态框
		const modal = new BatchDeleteConfirmModal(
			this.app,
			imagesToDelete,
			async (onProgress: (current: number, total: number) => void) => {
				await this.deleteImageBatch(imagesToDelete, onProgress);
				this.isMultiSelectMode = false;
				this.selectedImages.clear();
				this.renderHeader();
			}
		);
		modal.open();
	}

	/**
	 * 批量移动选中的图片
	 */
	private handleBatchMoveSelected(): void {
		if (this.selectedImages.size === 0) {
			new Notice("没有选中的图片");
			return;
		}

		const imagesToMove = this.images.filter(img => this.selectedImages.has(img.path));

		new FolderPickerModal(this.app, (folder) => {
			void (async () => {
				const total = imagesToMove.length;
				let successCount = 0;
				let errorCount = 0;

				const progressNotice = new Notice(`正在移动... 0/${total}`, 0);

				for (const image of imagesToMove) {
					try {
						const oldPath = image.path;
						const newPath = await this.fileOperations.moveFile(image, folder.path, true);
						if (newPath) {
							const stillInFilter = !this.selectedFolder ||
								newPath.startsWith(this.selectedFolder + "/");

							if (stillInFilter) {
								this.updateImageAfterMove(oldPath, newPath);
							} else {
								this.images = this.images.filter(img => img.path !== oldPath);
							}
							successCount++;
						} else {
							// 文件已在目标文件夹中, 视为跳过
							successCount++;
						}
					} catch {
						errorCount++;
					}
					this.selectedImages.delete(image.path);
					progressNotice.setMessage(`正在移动... ${successCount + errorCount}/${total}`);
				}

				progressNotice.hide();
				if (errorCount === 0) {
					new Notice(`成功移动 ${successCount} 张图片`);
				} else {
					new Notice(`移动完成: 成功 ${successCount} 张, 失败 ${errorCount} 张`);
				}

				// 退出多选模式
				this.isMultiSelectMode = false;
				this.selectedImages.clear();

				this.applyFilters();
				this.renderHeader();
				this.renderGrid();
			})();
		}).open();
	}

	/**
	 * 从内存中移除图片 (不重新加载, 用于批量删除)
	 */
	private removeImageFromMemory(image: ImageItem): void {
		this.images = this.images.filter(img => img.path !== image.path);
		this.filteredImages = this.filteredImages.filter(img => img.path !== image.path);
		this.selectedImages.delete(image.path);
		this.referenceChecker.removeCacheKey(image.path);
	}

	private async deleteImageBatch(
		images: ImageItem[],
		onProgress: (current: number, total: number) => void,
	): Promise<void> {
		let successCount = 0;
		let errorCount = 0;
		const batchSize = 10;
		for (let offset = 0; offset < images.length; offset += batchSize) {
			const results = await Promise.all(
				images.slice(offset, offset + batchSize).map(async (image) => {
					try {
						await this.fileOperations.deleteFile(image, true);
						return { image, success: true };
					} catch (error) {
						console.error(`删除文件失败: ${image.path}`, error);
						return { image, success: false };
					}
				}),
			);
			for (const result of results) {
				if (result.success) {
					successCount += 1;
					this.removeImageFromMemory(result.image);
				} else {
					errorCount += 1;
				}
			}
			onProgress(successCount + errorCount, images.length);
			await new Promise<void>((resolve) => (this.containerEl.ownerDocument.defaultView ?? window).setTimeout(resolve, 0));
		}

		new Notice(errorCount === 0
			? `成功删除 ${successCount} 张图片`
			: `删除完成: 成功 ${successCount} 张, 失败 ${errorCount} 张`);
		this.viewportGrid?.setItems(this.filteredImages);
		this.renderHeader();
	}

	/**
	 * 刷新视图
	 */
	async refresh(): Promise<void> {
		this.loadImages();
		await this.persistSelectedFolder(this.selectedFolder);
	}

	/**
	 * 由 Vault 文件变更触发的刷新 (不保存文件夹选择状态)
	 * 供 main.ts 中 Vault 事件监听调用
	 */
	refreshFromVault(): void {
		this.loadImages();
	}

	invalidateReferences(clearSharedCache = true): void {
		this.referenceGeneration++;
		if (clearSharedCache) this.referenceChecker.clearCache();
		this.pendingReferencePaths.clear();
		this.images.forEach((image) => {
			image.references = undefined;
			image.referenceCount = undefined;
		});
		this.applyFilters();
		this.renderHeader();
		this.viewportGrid?.refreshVisible();
		if (this.showUnreferencedOnly || this.sortField === "references") {
			void this.checkReferences();
		}
	}

	/**
	 * 关闭视图时清理资源
	 */
	onunload(): void {
		// 清理 FolderSuggest
		if (this.folderSuggest) {
			this.folderSuggest.close();
			this.folderSuggest = null;
		}
		this.viewportGrid?.destroy();
		this.viewportGrid = null;
		this.mediaLoader?.destroy();
		this.mediaLoader = null;
	}
}
