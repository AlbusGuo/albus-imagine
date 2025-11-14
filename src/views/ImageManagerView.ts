/**
 * 图片管理器视图 - 使用经典的 Obsidian ItemView
 */

import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
import {
	ImageItem,
	ImageManagerSettings,
	SortOrder,
	SortField,
} from "../types/image-manager.types";
import { ImageLoaderService } from "../services/ImageLoaderService";
import { ReferenceCheckService } from "../services/ReferenceCheckService";
import { FileOperationService } from "../services/FileOperationService";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { RenameModal } from "./RenameModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { FolderSuggest } from "../components/FolderSuggest";

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
	private folderSuggest: FolderSuggest | null = null;

	// 虚拟滚动相关
	private renderedCount = 0;
	private batchSize = 50; // 每批次渲染的图片数量
	private isLoadingMore = false;
	private scrollThreshold = 300; // 距离底部多少像素时开始加载

	// Services
	private imageLoader: ImageLoaderService;
	private referenceChecker: ReferenceCheckService;
	private fileOperations: FileOperationService;

	// Container elements
	private headerContainer: HTMLElement;
	private searchContainer: HTMLElement;
	private gridContainer: HTMLElement;

	constructor(leaf: WorkspaceLeaf, settings: ImageManagerSettings) {
		super(leaf);
		this.settings = settings;
		this.selectedFolder = settings.folderPath || "";
		this.showUnreferencedOnly = settings.defaultFilterUnreferenced || false;

		// 初始化服务
		this.imageLoader = new ImageLoaderService(this.app);
		this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
		this.referenceChecker = new ReferenceCheckService(this.app);
		this.fileOperations = new FileOperationService(this.app);
		this.fileOperations.setFileOpenModes(settings.fileOpenModes || {});
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
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("image-manager-container");

		this.setupLayout();
		await this.loadImages();
	}

	async onClose(): Promise<void> {
		// 清理工作
		this.contentEl.empty();
	}

	/**
	 * 更新设置
	 */
	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
		this.selectedFolder = settings.folderPath || "";
		this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
		this.fileOperations.setFileOpenModes(settings.fileOpenModes || {});
		// 重新加载图片以应用新设置
		this.loadImages();
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

		// 添加滚动监听实现增量加载
		this.gridContainer.addEventListener("scroll", () => this.handleScroll());
	}

	/**
	 * 渲染头部
	 */
	private renderHeader(): void {
		this.headerContainer.empty();

		// 单行布局：统计 + 按钮
		const headerRow = this.headerContainer.createDiv("image-manager-header-row");

		// 左侧：文件夹按钮 + 统计信息
		const leftSection = headerRow.createDiv("image-manager-header-left");

		// 文件夹选择按钮
		const folderBtn = leftSection.createEl("button", {
			cls: "image-manager-folder-button",
		});
		const folderIcon = folderBtn.createSpan({ cls: "image-manager-folder-icon" });
		setIcon(folderIcon, "folder");
		const folderText = folderBtn.createSpan({ 
			text: this.selectedFolder || "所有图片",
			cls: "image-manager-folder-text"
		});

		// 点击按钮显示输入框
		folderBtn.onclick = () => {
			this.showFolderInput(folderBtn);
		};

		// 统计信息
		const statsEl = leftSection.createDiv("image-manager-stats");
		const statsText = `共 ${this.images.length} 张`;
		const filteredText = this.showUnreferencedOnly ? ` | 过滤: ${this.filteredImages.length} 张` : "";
		statsEl.setText(statsText + filteredText);

		// 右侧：操作按钮
		const rightSection = headerRow.createDiv("image-manager-header-right");

		// 引用检查状态提示
		if (this.isCheckingReferences) {
			const statusEl = rightSection.createEl("span", {
				text: "正在检查引用...",
				cls: "image-manager-checking-status",
			});
		}

		// 筛选按钮
		const filterBtn = rightSection.createEl("button", {
			text: "仅未引用",
			cls: this.showUnreferencedOnly
				? "image-manager-filter-button image-manager-filter-button-active"
				: "image-manager-filter-button",
		});
		filterBtn.onclick = () => {
			this.showUnreferencedOnly = !this.showUnreferencedOnly;
			this.applyFilters();
			this.renderHeader();
			this.renderGrid();
		};

		// 刷新按钮
		const refreshBtn = rightSection.createEl("button", {
			text: "刷新",
			cls: "image-manager-check-refs-button",
		});
		refreshBtn.onclick = () => this.refresh();
	}

	/**
	 * 显示文件夹输入框
	 */
	private showFolderInput(buttonEl: HTMLElement): void {
		// 创建输入框容器
		const inputContainer = buttonEl.parentElement!.createDiv("image-manager-folder-input-container");
		
		const folderInput = inputContainer.createEl("input", {
			type: "text",
			placeholder: "输入文件夹路径...",
			value: this.selectedFolder,
			cls: "image-manager-folder-input-inline",
		});

		// 隐藏按钮，显示输入框
		buttonEl.style.display = "none";

		// 创建FolderSuggest
		if (this.folderSuggest) {
			this.folderSuggest.destroy();
		}
		this.folderSuggest = new FolderSuggest(this.app, folderInput, (value) => {
			this.selectedFolder = value;
			this.refresh();
		});

		// 输入事件
		folderInput.addEventListener("input", () => {
			this.selectedFolder = folderInput.value;
		});

		// 回车键确认
		folderInput.addEventListener("keydown", async (e) => {
			if (e.key === "Enter") {
				await this.refresh();
				inputContainer.remove();
				buttonEl.style.display = "";
			} else if (e.key === "Escape") {
				inputContainer.remove();
				buttonEl.style.display = "";
			}
		});

		// 失焦时隐藏输入框
		folderInput.addEventListener("blur", () => {
			setTimeout(() => {
				inputContainer.remove();
				buttonEl.style.display = "";
			}, 200);
		});

		// 自动聚焦
		setTimeout(() => folderInput.focus(), 0);
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

		// 排序依据
		sortControlsEl.createSpan({ text: "排序依据:", cls: "image-manager-sort-label" });
		const sortFieldSelect = sortControlsEl.createEl("select", {
			cls: "image-manager-sort-select",
		});
		const sortFieldOptions = [
			{ value: "mtime", text: "修改时间" },
			{ value: "ctime", text: "创建时间" },
			{ value: "size", text: "文件大小" },
			{ value: "name", text: "文件名" },
			{ value: "references", text: "引用数量" },
		];
		sortFieldOptions.forEach((opt) => {
			const option = sortFieldSelect.createEl("option", {
				value: opt.value,
				text: opt.text,
			});
			if (opt.value === this.sortField) {
				option.selected = true;
			}
		});
		sortFieldSelect.onchange = () => {
			this.sortField = sortFieldSelect.value as SortField;
			this.applyFilters();
			this.renderGrid();
		};

		// 排序顺序
		const sortOrderBtn = sortControlsEl.createEl("button", {
			cls: "image-manager-sort-order-button",
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
			button.createSpan({ text: "↓ 降序" });
		} else {
			button.createSpan({ text: "↑ 升序" });
		}
	}

	/**
	 * 渲染网格
	 */
	/**
	 * 渲染网格
	 */
	private renderGrid(append: boolean = false): void {
		if (!append) {
			this.gridContainer.empty();
			this.renderedCount = 0;
		}

		if (this.isLoading && !append) {
			const loadingEl = this.gridContainer.createDiv("image-manager-loading-state");
			loadingEl.createDiv("image-manager-loading-spinner");
			loadingEl.createSpan({ text: "加载中..." });
			return;
		}

		if (this.filteredImages.length === 0 && !append) {
			const emptyEl = this.gridContainer.createDiv("image-manager-empty-state");
			emptyEl.createSpan({
				text: this.images.length === 0 ? "没有找到图片" : "没有符合条件的图片",
			});
			if (this.images.length === 0) {
				const hintEl = emptyEl.createDiv("image-manager-empty-hint");
				hintEl.createSpan({ text: "提示：请检查文件夹路径设置" });
			}
			return;
		}

		// 查找或创建网格容器
		let gridEl: HTMLElement | null = null;
		if (append) {
			gridEl = this.gridContainer.querySelector(".image-manager-grid");
		}
		if (!gridEl) {
			gridEl = this.gridContainer.createDiv("image-manager-grid");
		}

		// 计算本次要渲染的图片范围
		const startIndex = this.renderedCount;
		const endIndex = Math.min(startIndex + this.batchSize, this.filteredImages.length);
		const imagesToRender = this.filteredImages.slice(startIndex, endIndex);

		// 渲染图片
		imagesToRender.forEach((image) => {
			const itemEl = gridEl.createDiv("image-manager-grid-item");

			// 缩略图容器
			const thumbnailEl = itemEl.createDiv("image-manager-thumbnail");
			
			// 单击图片打开预览
			thumbnailEl.onclick = () => {
				this.handlePreview(image);
			};
			thumbnailEl.style.cursor = "pointer";
			
			// 检查封面是否缺失
			if (image.coverMissing) {
				// 显示占位图标
				const placeholderDiv = thumbnailEl.createDiv({
					cls: "image-manager-cover-missing",
				});
				const contentWrapper = placeholderDiv.createDiv({
					cls: "image-manager-cover-missing-content",
				});
				const iconDiv = contentWrapper.createEl("span", {
					cls: "image-manager-cover-missing-icon",
				});
				// 使用 Obsidian 的 setIcon 添加图标
				setIcon(iconDiv, "file-x");
				contentWrapper.createEl("span", {
					text: "封面缺失",
					cls: "image-manager-cover-missing-text",
				});
			} else {
				const img = thumbnailEl.createEl("img", {
					cls: image.displayFile.extension.toLowerCase() === "svg" ? "image-manager-svg-image" : "image-manager-thumbnail-image",
				});
				
				// 设置图片源
				const resourcePath = this.app.vault.getResourcePath(image.displayFile);
				img.src = resourcePath;
				img.alt = image.name;
				
				// 添加加载错误处理
				img.onerror = () => {
					console.error("Failed to load image:", image.path);
					img.src = ""; // 清空src避免持续报错
					thumbnailEl.createDiv({
						text: "加载失败",
						cls: "image-load-error",
					});
				};
			}

			// 格式标签 - 右上角显示文件类型
			const formatBadge = thumbnailEl.createDiv({
				text: image.originalFile.extension.toUpperCase(),
				cls: "image-manager-format-badge",
			});
			// AGX 和自定义类型使用强调色，普通图片使用灰色
			formatBadge.addClass(
				image.isAgx || image.isCustomType
					? "image-manager-agx-format"
					: "image-manager-other-format"
			);

			// 引用标签 - 统一放在左上角
			if (image.references) {
				const refCount = image.referenceCount || 0;
				const refBadge = thumbnailEl.createDiv({
					text: refCount === 0 ? "未引用" : `${refCount} 引用`,
					cls: "image-manager-reference-badge",
				});
				if (refCount > 0) {
					refBadge.addClass("image-manager-reference-badge-has-refs");
				}
			}

			// 信息区域
			const infoEl = itemEl.createDiv("image-manager-image-info");

			// 文件名
			infoEl.createDiv({
				text: image.name,
				cls: "image-manager-image-name",
				attr: { title: image.path },
			});

			// 元数据 - 统一字体大小，文件大小居左，日期居右
			const metaEl = infoEl.createDiv("image-manager-image-meta");
			if (this.settings.showFileSize) {
				metaEl.createSpan({
					text: this.formatFileSize(image.stat.size),
					cls: "image-manager-meta-item image-manager-meta-size",
				});
			}
			if (this.settings.showModifiedTime) {
				metaEl.createSpan({
					text: new Date(image.stat.mtime).toLocaleDateString(),
					cls: "image-manager-meta-item image-manager-meta-date",
				});
			}

			// 操作按钮
			const actionsEl = itemEl.createDiv("image-manager-image-actions");

			const openBtn = actionsEl.createEl("button", {
				text: "打开",
				cls: "image-manager-action-button image-manager-open-button",
			});
			openBtn.onclick = (e) => {
				e.stopPropagation();
				this.fileOperations.openFile(image);
			};

			const renameBtn = actionsEl.createEl("button", {
				text: "重命名",
				cls: "image-manager-action-button image-manager-rename-button",
			});
			renameBtn.onclick = (e) => {
				e.stopPropagation();
				this.handleRename(image);
			};

			const deleteBtn = actionsEl.createEl("button", {
				text: "删除",
				cls: "image-manager-action-button image-manager-delete-button",
			});
			deleteBtn.onclick = (e) => {
				e.stopPropagation();
				this.handleDelete(image);
			};
		});

		this.renderedCount = endIndex;

		// 更新加载更多指示器
		this.updateLoadMoreIndicator();
	}

	/**
	 * 处理滚动事件
	 */
	private handleScroll(): void {
		if (this.isLoadingMore || this.renderedCount >= this.filteredImages.length) {
			return;
		}

		const container = this.gridContainer;
		const scrollTop = container.scrollTop;
		const scrollHeight = container.scrollHeight;
		const clientHeight = container.clientHeight;

		// 当滚动到接近底部时加载更多
		if (scrollHeight - scrollTop - clientHeight < this.scrollThreshold) {
			this.loadMoreImages();
		}
	}

	/**
	 * 加载更多图片
	 */
	private loadMoreImages(): void {
		if (this.isLoadingMore || this.renderedCount >= this.filteredImages.length) {
			return;
		}

		this.isLoadingMore = true;
		
		// 使用 requestAnimationFrame 避免阻塞
		requestAnimationFrame(() => {
			this.renderGrid(true); // append = true
			this.isLoadingMore = false;
		});
	}

	/**
	 * 更新"加载更多"指示器
	 */
	private updateLoadMoreIndicator(): void {
		// 移除旧的指示器
		const oldIndicator = this.gridContainer.querySelector(".image-manager-load-more");
		if (oldIndicator) {
			oldIndicator.remove();
		}

		// 如果还有更多内容，添加指示器
		if (this.renderedCount < this.filteredImages.length) {
			const indicator = this.gridContainer.createDiv("image-manager-load-more");
			indicator.setText(`已显示 ${this.renderedCount} / ${this.filteredImages.length} 张图片`);
		}
	}

	/**
	 * 加载图片
	 */
	private async loadImages(): Promise<void> {
		if (this.isLoading) return;

		this.isLoading = true;
		this.renderGrid(); // 显示加载状态

		try {
			this.images = await this.imageLoader.loadImages(this.selectedFolder);
			
			// 自动检查引用
			if (this.images.length > 0) {
				this.isCheckingReferences = true;
				this.renderHeader();
				this.images = await this.referenceChecker.checkReferences(this.images);
				this.isCheckingReferences = false;
			}
			
			this.applyFilters();
			this.renderHeader();
		} catch (error) {
			new Notice(`加载图片失败: ${error.message}`);
			console.error("Error loading images:", error);
		} finally {
			this.isLoading = false;
			// 重要：加载完成后必须再次渲染以显示图片
			this.renderGrid();
		}
	}

	/**
	 * 检查引用
	 */
	private async checkReferences(): Promise<void> {
		if (this.isCheckingReferences || this.images.length === 0) return;

		this.isCheckingReferences = true;
		this.renderHeader();

		try {
			// 重要：接收返回的更新后的图片数组
			this.images = await this.referenceChecker.checkReferences(this.images);
			this.applyFilters(); // 重新应用过滤
			this.renderGrid();
			new Notice(`引用检查完成：已检查 ${this.images.length} 张图片`);
		} catch (error) {
			new Notice(`检查引用失败: ${error.message}`);
			console.error("Error checking references:", error);
		} finally {
			this.isCheckingReferences = false;
			this.renderHeader();
		}
	}

	/**
	 * 应用过滤和排序
	 */
	private applyFilters(): void {
		let filtered = [...this.images];

		// 搜索过滤
		if (this.searchQuery) {
			const query = this.searchQuery.toLowerCase();
			filtered = filtered.filter((img) =>
				img.name.toLowerCase().includes(query)
			);
		}

		// 未引用过滤
		if (this.showUnreferencedOnly) {
			filtered = filtered.filter(
				(img) => !img.referenceCount || img.referenceCount === 0
			);
		}

		// 排序
		filtered.sort((a, b) => {
			let compareValue = 0;

			switch (this.sortField) {
				case "mtime":
					compareValue = a.stat.mtime - b.stat.mtime;
					break;
				case "ctime":
					compareValue = a.stat.ctime - b.stat.ctime;
					break;
				case "size":
					compareValue = a.stat.size - b.stat.size;
					break;
				case "name":
					compareValue = a.name.localeCompare(b.name);
					break;
				case "references":
					const aRefs = a.referenceCount || 0;
					const bRefs = b.referenceCount || 0;
					compareValue = aRefs - bRefs;
					break;
			}

			return this.sortOrder === "asc" ? compareValue : -compareValue;
		});

		this.filteredImages = filtered;
	}

	/**
	 * 处理预览
	 */
	private handlePreview(image: ImageItem): void {
		new ImagePreviewModal(
			this.app,
			image,
			image.references || [],
			(img) => this.app.vault.getResourcePath(img.displayFile),
			(filePath) => this.fileOperations.openReferenceFile(filePath)
		).open();
	}

	/**
	 * 处理重命名
	 */
	private handleRename(image: ImageItem): void {
		new RenameModal(this.app, image, async (newName) => {
			try {
				await this.fileOperations.renameFile(image, newName);
				await this.refresh();
			} catch (error) {
				// 错误已在 service 中处理
			}
		}).open();
	}

	/**
	 * 处理删除
	 */
	private async handleDelete(image: ImageItem): Promise<void> {
		// 如果设置中禁用了确认，直接删除
		if (this.settings.confirmDelete === false) {
			try {
				await this.fileOperations.deleteFile(image);
				await this.refresh();
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
				await this.refresh();
			}
		);
		modal.open();
	}

	/**
	 * 刷新视图
	 */
	async refresh(): Promise<void> {
		// 清除引用缓存以确保重新检查
		this.referenceChecker.clearCache();
		await this.loadImages();
	}

	/**
	 * 格式化文件大小
	 */
	private formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + " B";
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
		return (bytes / (1024 * 1024)).toFixed(1) + " MB";
	}

	/**
	 * 关闭视图时清理资源
	 */
	onunload(): void {
		// 清理FolderSuggest
		if (this.folderSuggest) {
			this.folderSuggest.destroy();
			this.folderSuggest = null;
		}
	}
}
