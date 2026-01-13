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
import { BatchDeleteConfirmModal } from "./BatchDeleteConfirmModal";
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
	private scrollThreshold = 500; // 距离底部多少像素时开始加载（增大以提前加载）

	// Services
	private imageLoader: ImageLoaderService;
	private referenceChecker: ReferenceCheckService;
	private fileOperations: FileOperationService;

	// Container elements
	private headerContainer: HTMLElement;
	private searchContainer: HTMLElement;
	private gridContainer: HTMLElement;

	// 懒加载
	private intersectionObserver: IntersectionObserver | null = null;

	constructor(leaf: WorkspaceLeaf, settings: ImageManagerSettings) {
		super(leaf);
		this.settings = settings;
		// 优先使用上次选择的文件夹，否则使用默认文件夹
		this.selectedFolder = settings.lastSelectedFolder ?? settings.folderPath ?? "";
		this.showUnreferencedOnly = settings.defaultFilterUnreferenced || false;

		// 初始化服务
		this.imageLoader = new ImageLoaderService(this.app);
		this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
		this.referenceChecker = new ReferenceCheckService(this.app);
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
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("image-manager-container");

		this.initIntersectionObserver();
		this.setupLayout();
		await this.loadImages();
	}

	async onClose(): Promise<void> {
		// 清理工作
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect();
			this.intersectionObserver = null;
		}
		this.contentEl.empty();
	}

	/**
	 * 初始化 IntersectionObserver 用于懒加载
	 */
	private initIntersectionObserver(): void {
		this.intersectionObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						const imgEl = entry.target as HTMLImageElement;
						const dataSrc = imgEl.getAttribute("data-src");
						if (dataSrc && !imgEl.src) {
							// 开始加载图片
							imgEl.src = dataSrc;
							imgEl.removeAttribute("data-src");
							// 加载后停止观察
							this.intersectionObserver?.unobserve(imgEl);
						}
					}
				});
			},
			{
				// 提前 200px 开始加载
				rootMargin: "200px",
				threshold: 0.01,
			}
		);
	}

	/**
	 * 更新设置
	 */
	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
		// 优先使用上次选择的文件夹，否则使用默认文件夹
		this.selectedFolder = settings.lastSelectedFolder ?? settings.folderPath ?? "";
		this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
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

		// 批量删除按钮（仅在筛选未引用时显示）
		if (this.showUnreferencedOnly && this.filteredImages.length > 0) {
			const batchDeleteBtn = rightSection.createEl("button", {
				text: "批量删除",
				cls: "image-manager-check-refs-button",
			});
			batchDeleteBtn.style.background = "var(--text-error)";
			batchDeleteBtn.style.color = "var(--text-on-accent)";
			batchDeleteBtn.style.borderColor = "var(--text-error)";
			batchDeleteBtn.onclick = () => this.handleBatchDelete();
		}

		// 筛选按钮
		const filterBtn = rightSection.createEl("button", {
			text: "仅未引用",
			cls: this.showUnreferencedOnly
				? "image-manager-filter-button image-manager-filter-button-active"
				: "image-manager-filter-button",
		});
		filterBtn.onclick = async () => {
			// 检查是否所有图片都已经检查过引用
			const uncheckedImages = this.images.filter(img => img.references === undefined);
			
			if (uncheckedImages.length > 0) {
				// 有未检查的图片，需要检查所有图片的引用
				await this.checkReferences();
			}
			
			this.showUnreferencedOnly = !this.showUnreferencedOnly;
			this.applyFilters();
			this.renderHeader();
			this.renderGrid();
		}

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
		const leftSection = buttonEl.parentElement!;
		
		// 创建输入框容器，插入到按钮位置
		const inputContainer = leftSection.createDiv("image-manager-folder-input-container");
		
		// 将输入框容器插入到按钮之后、统计信息之前
		leftSection.insertBefore(inputContainer, buttonEl.nextSibling);
		
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

		// 使用 requestAnimationFrame 批量渲染，避免阻塞
		requestAnimationFrame(async () => {
			const itemElements = this.renderImageBatch(gridEl!, imagesToRender);
			this.renderedCount = endIndex;
			this.updateLoadMoreIndicator();
			
			// 渲染后立即检查这批图片的引用
			await this.checkBatchReferences(imagesToRender, itemElements);
		});
	}

	/**
	 * 渲染一批图片
	 * @returns 返回渲染的元素数组，用于后续更新引用信息
	 */
	private renderImageBatch(gridEl: HTMLElement, images: ImageItem[]): Array<{image: ImageItem, element: HTMLElement}> {
		const renderedItems: Array<{image: ImageItem, element: HTMLElement}> = [];
		
		images.forEach((image) => {
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
				
				// 懒加载：使用 data-src 而不是直接设置 src
				const resourcePath = this.app.vault.getResourcePath(image.displayFile);
				img.setAttribute("data-src", resourcePath);
				img.alt = image.name;

				// 将图片元素加入 IntersectionObserver
				if (this.intersectionObserver) {
					this.intersectionObserver.observe(img);
				}
				
				// 添加加载错误处理，防止循环加载
				let loadFailed = false;
				img.onerror = () => {
					if (loadFailed) return; // 防止重复处理
					loadFailed = true;
					console.warn(`图片加载失败: ${image.path}`);
					// 清空 src 防止持续尝试加载
					img.src = "";
					img.style.display = "none";
					// 显示错误占位符
					const errorDiv = thumbnailEl.createDiv("image-manager-cover-missing");
					const contentWrapper = errorDiv.createDiv("image-manager-cover-missing-content");
					const iconDiv = contentWrapper.createEl("span", { cls: "image-manager-cover-missing-icon" });
					setIcon(iconDiv, "alert-circle");
					contentWrapper.createEl("span", {
						text: "加载失败",
						cls: "image-manager-cover-missing-text",
					});
				};

				// 添加加载超时处理（10秒）
				const loadTimeout = setTimeout(() => {
					if (!img.complete && !loadFailed) {
						console.warn(`图片加载超时: ${image.path}`);
						img.onerror?.(new Event("error"));
					}
				}, 10000);

				// 加载成功时清除超时
				img.onload = () => {
					clearTimeout(loadTimeout);
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
			
			// 收集渲染的元素
			renderedItems.push({ image, element: itemEl });
		});
		
		return renderedItems;
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
			
			// 不自动检查引用，等用户需要时再检查
			// 这样可以大幅提升初始化速度
			
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
	 * 检查一批图片的引用并更新显示
	 */
	private async checkBatchReferences(
		images: ImageItem[],
		elements: Array<{image: ImageItem, element: HTMLElement}>
	): Promise<void> {
		// 过滤出还没有检查过引用的图片
		const needCheckImages = images.filter(img => img.references === undefined);
		
		if (needCheckImages.length === 0) {
			return; // 已经检查过了，无需重复检查
		}
		
		try {
			// 批量检查引用
			const updatedImages = await this.referenceChecker.checkReferences(needCheckImages);
			
			// 更新主数组中的引用信息
			updatedImages.forEach(updatedImg => {
				const index = this.images.findIndex(img => img.path === updatedImg.path);
				if (index !== -1) {
					this.images[index] = updatedImg;
				}
			});
			
			// 更新DOM显示引用信息
			elements.forEach(({ image, element }) => {
				const updatedImg = updatedImages.find(img => img.path === image.path);
				if (updatedImg && updatedImg.references !== undefined) {
					this.updateReferenceDisplay(element, updatedImg);
				}
			});
		} catch (error) {
			console.error("批量检查引用失败:", error);
		}
	}
	
	/**
	 * 更新元素的引用显示
	 */
	private updateReferenceDisplay(itemEl: HTMLElement, image: ImageItem): void {
		const thumbnailEl = itemEl.querySelector(".image-manager-thumbnail");
		if (!thumbnailEl) return;
		
		// 检查是否已经有引用标签
		const existingBadge = thumbnailEl.querySelector(".image-manager-reference-badge");
		if (existingBadge) {
			existingBadge.remove();
		}
		
		// 添加引用标签
		const refCount = image.referenceCount || 0;
		const refBadge = thumbnailEl.createDiv({
			text: refCount === 0 ? "未引用" : `${refCount} 引用`,
			cls: "image-manager-reference-badge",
		});
		if (refCount > 0) {
			refBadge.addClass("image-manager-reference-badge-has-refs");
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
		// 从主数组中获取最新的图片数据（包含最新的引用信息）
		const currentImage = this.images.find(img => img.path === image.path) || image;
		
		new ImagePreviewModal(
			this.app,
			currentImage,
			currentImage.references || [],
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
		// 清除引用缓存
		this.referenceChecker.clearCache();
		// 重新渲染网格（只渲染，不重新加载）
		this.renderGrid();
		// 更新头部统计信息
		this.renderHeader();
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
		
		// 保存当前选择的文件夹
		await this.saveLastSelectedFolder();
	}

	/**
	 * 保存上次选择的文件夹
	 */
	private async saveLastSelectedFolder(): Promise<void> {
		try {
			// 直接使用 Obsidian 的数据持久化 API
			const plugin = (this.app as any).plugins?.plugins?.["albus-imagine"];
			if (plugin) {
				const data = await plugin.loadData() || {};
				if (!data.imageManager) {
					data.imageManager = {};
				}
				data.imageManager.lastSelectedFolder = this.selectedFolder;
				await plugin.saveData(data);
				// 更新内存中的设置
				plugin.settings.imageManager.lastSelectedFolder = this.selectedFolder;
			}
		} catch (error) {
			console.error("保存文件夹选择失败:", error);
		}
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
