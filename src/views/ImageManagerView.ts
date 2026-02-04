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

	// 多选模式
	private isMultiSelectMode = false;
	private selectedImages: Set<string> = new Set(); // 存储选中图片的路径

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

	constructor(leaf: WorkspaceLeaf, settings: ImageManagerSettings) {
		super(leaf);
		this.settings = settings;
		// 优先使用上次选择的文件夹，否则使用默认文件夹
		this.selectedFolder = settings.lastSelectedFolder ?? settings.folderPath ?? "";
		this.showUnreferencedOnly = false;
		// 使用默认排序设置
		this.sortField = settings.defaultSortField || "mtime";
		this.sortOrder = settings.defaultSortOrder || "desc";

		// 初始化服务
		this.imageLoader = new ImageLoaderService(this.app);
		this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
		this.imageLoader.setExcludedFolders(settings.excludedFolders || []);
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
		// 优先使用上次选择的文件夹，否则使用默认文件夹
		this.selectedFolder = settings.lastSelectedFolder ?? settings.folderPath ?? "";
		this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
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
		folderBtn.createSpan({ 
			text: this.selectedFolder || "所有图片",
			cls: "image-manager-folder-text"
		});

		// 点击按钮显示输入框
		folderBtn.onclick = () => {
			this.showFolderInput(folderBtn);
		};

		// 清空路径按钮（只在有路径时显示）
		if (this.selectedFolder) {
			const clearBtn = leftSection.createEl("button", {
				cls: "image-manager-clear-folder-button clickable-icon",
				attr: { "aria-label": "清空筛选" },
			});
			setIcon(clearBtn, "x");
			clearBtn.onclick = async () => {
				this.selectedFolder = "";
				await this.refresh();
			};
		}

		// 统计信息
		const statsEl = leftSection.createDiv("image-manager-stats");
		const statsText = `共 ${this.images.length} 张`;
		const filteredText = this.showUnreferencedOnly ? ` | 过滤: ${this.filteredImages.length} 张` : "";
		statsEl.setText(statsText + filteredText);

		// 右侧：操作按钮
		const rightSection = headerRow.createDiv("image-manager-header-right");

		// 多选模式下的批量删除按钮（只有选中图片时才显示）
		if (this.isMultiSelectMode && this.selectedImages.size > 0) {
			const batchDeleteSelectedBtn = rightSection.createEl("button", {
				text: `批量删除 (${this.selectedImages.size})`,
				cls: "image-manager-button batch-delete",
			});
			batchDeleteSelectedBtn.onclick = () => this.handleBatchDeleteSelected();
		}

		// 筛选未引用时的删除全部未引用按钮
		if (this.showUnreferencedOnly && this.filteredImages.length > 0) {
			const deleteAllUnreferencedBtn = rightSection.createEl("button", {
				text: "删除全部未引用",
				cls: "image-manager-button batch-delete",
			});
			deleteAllUnreferencedBtn.onclick = () => this.handleBatchDelete();
		}

		// 多选按钮
		const multiSelectBtn = rightSection.createEl("button", {
			text: this.isMultiSelectMode ? "取消多选" : "多选",
			cls: this.isMultiSelectMode 
				? "image-manager-button active"
				: "image-manager-button",
		});
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
			text: "刷新",
			cls: "image-manager-button",
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
		buttonEl.addClass("is-hidden");

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
				buttonEl.removeClass("is-hidden");
			} else if (e.key === "Escape") {
				inputContainer.remove();
				buttonEl.removeClass("is-hidden");
			}
		});

		// 失焦时隐藏输入框
		folderInput.addEventListener("blur", () => {
			setTimeout(() => {
				inputContainer.remove();
				buttonEl.removeClass("is-hidden");
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

		// 筛选（移到排序前面）
		sortControlsEl.createSpan({ text: "筛选:", cls: "image-manager-sort-label" });
		const filterBtn = sortControlsEl.createEl("button", {
			text: this.showUnreferencedOnly ? "未引用" : "全部",
			cls: this.showUnreferencedOnly
				? "image-manager-button active"
				: "image-manager-button",
		});
		filterBtn.onclick = async () => {
			// 检查是否所有图片都已经检查过引用
			const uncheckedImages = this.images.filter(img => img.references === undefined);
			
			if (!this.showUnreferencedOnly && uncheckedImages.length > 0) {
				// 有未检查的图片，需要检查所有图片的引用
				await this.checkReferences();
			}
			
			this.showUnreferencedOnly = !this.showUnreferencedOnly;
			this.applyFilters();
			this.renderSearchBar(); // 更新筛选按钮文字
			this.renderHeader();
			this.renderGrid();
		};

		// 排序
		sortControlsEl.createSpan({ text: "排序:", cls: "image-manager-sort-label" });
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
			cls: "image-manager-button",
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
		requestAnimationFrame(() => {
			const itemElements = this.renderImageBatch(gridEl!, imagesToRender);
			this.renderedCount = endIndex;
			this.updateLoadMoreIndicator();
			
			// 延迟检查引用，使用 requestIdleCallback 或 setTimeout 确保不阻塞渲染
			if (typeof requestIdleCallback !== 'undefined') {
				requestIdleCallback(() => {
					void this.checkBatchReferences(imagesToRender, itemElements);
				}, { timeout: 2000 });
			} else {
				setTimeout(() => {
					void this.checkBatchReferences(imagesToRender, itemElements);
				}, 100);
			}
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
			// 添加 data-path 属性用于后续查找和删除
			itemEl.setAttribute("data-path", image.path);
			
			// 多选模式下添加选中样式
			if (this.isMultiSelectMode && this.selectedImages.has(image.path)) {
				itemEl.addClass("image-manager-item-selected");
			}

			// 缩略图容器
			const thumbnailEl = itemEl.createDiv("image-manager-thumbnail");
			
			// 单击图片：多选模式下切换选中状态，否则打开预览
			thumbnailEl.onclick = () => {
				if (this.isMultiSelectMode) {
					// 多选模式：切换选中状态
					if (this.selectedImages.has(image.path)) {
						this.selectedImages.delete(image.path);
						itemEl.removeClass("image-manager-item-selected");
					} else {
						this.selectedImages.add(image.path);
						itemEl.addClass("image-manager-item-selected");
					}
					// 更新头部按钮状态
					this.renderHeader();
				} else {
					// 普通模式：打开预览
					this.handlePreview(image);
				}
			};
			thumbnailEl.addClass("cursor-pointer");
			
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
				
				// 本地图片立即加载，不使用懒加载
				const resourcePath = this.app.vault.getResourcePath(image.displayFile);
				img.src = resourcePath;
				img.alt = image.name;
				
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

			// 操作按钮 - hover 显示的图标按钮（在缩略图内左下角）
			const actionsEl = thumbnailEl.createDiv("image-manager-image-actions");

			// 打开按钮
			const openBtn = actionsEl.createEl("button", {
				cls: "image-manager-action-button image-manager-open-button clickable-icon",
				attr: { "aria-label": "打开" },
			});
			setIcon(openBtn, "folder-open");
			openBtn.onclick = (e) => {
				e.stopPropagation();
				this.fileOperations.openFile(image);
			};

			// 重命名按钮
			const renameBtn = actionsEl.createEl("button", {
				cls: "image-manager-action-button image-manager-rename-button clickable-icon",
				attr: { "aria-label": "重命名" },
			});
			setIcon(renameBtn, "pencil");
			renameBtn.onclick = (e) => {
				e.stopPropagation();
				this.handleRename(image);
			};

			// 删除按钮
			const deleteBtn = actionsEl.createEl("button", {
				cls: "image-manager-action-button image-manager-delete-button clickable-icon",
				attr: { "aria-label": "删除" },
			});
			setIcon(deleteBtn, "trash-2");
			deleteBtn.onclick = (e) => {
				e.stopPropagation();
				this.handleDelete(image);
			};

			// 格式标签 - 右上角显示文件类型
			const formatBadge = thumbnailEl.createDiv({
				text: image.originalFile.extension.toUpperCase(),
				cls: "image-manager-format-badge",
			});
			// 自定义类型使用强调色，普通图片使用灰色
			formatBadge.addClass(
				image.isCustomType
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

			// 信息区域（可点击）
			const infoEl = itemEl.createDiv("image-manager-image-info cursor-pointer");
			infoEl.onclick = (e) => {
				e.stopPropagation();
				if (this.isMultiSelectMode) {
					// 多选模式：切换选中状态
					if (this.selectedImages.has(image.path)) {
						this.selectedImages.delete(image.path);
						itemEl.removeClass("image-manager-item-selected");
					} else {
						this.selectedImages.add(image.path);
						itemEl.addClass("image-manager-item-selected");
					}
					this.renderHeader();
				} else {
					// 普通模式：打开预览
					this.handlePreview(image);
				}
			};

			// 文件名
			const nameEl = infoEl.createDiv({
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

		// 创建进度通知
		const progressNotice = new Notice(`正在检查引用... 0/${this.images.length}`, 0);

		try {
			// 重要：接收返回的更新后的图片数组，并传入进度回调
			this.images = await this.referenceChecker.checkReferences(
				this.images,
				(current: number, total: number) => {
					const percentage = Math.round((current / total) * 100);
					progressNotice.setMessage(`正在检查引用... ${current}/${total} (${percentage}%)`);
				}
			);
			
			progressNotice.hide();
			this.applyFilters(); // 重新应用过滤
			this.renderGrid();
			new Notice(`引用检查完成：已检查 ${this.images.length} 张图片`);
		} catch (error) {
			progressNotice.hide();
			new Notice(`检查引用失败: ${error.message}`);
			console.error("Error checking references:", error);
		} finally {
			this.isCheckingReferences = false;
		}
	}

	/**
	 * 检查一批图片的引用并更新显示
	 * 使用更小的批次和异步处理，避免阻塞UI
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
			// 使用更小的批次（每次最多10张），避免长时间阻塞
			const miniBatchSize = 10;
			for (let i = 0; i < needCheckImages.length; i += miniBatchSize) {
				const miniBatch = needCheckImages.slice(i, Math.min(i + miniBatchSize, needCheckImages.length));
				
				// 检查这小批次的引用
				const updatedImages = await this.referenceChecker.checkReferences(miniBatch);
				
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
				
				// 每处理一小批后，给UI线程一些时间
				if (i + miniBatchSize < needCheckImages.length) {
					await new Promise(resolve => setTimeout(resolve, 10));
				}
			}
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
				case "references": {
					const aRefs = a.referenceCount || 0;
					const bRefs = b.referenceCount || 0;
					compareValue = aRefs - bRefs;
					break;
				}
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
				const oldPath = image.path;
				const newPath = image.path.replace(/[^/]+$/, newName);
				
				await this.fileOperations.renameFile(image, newName);
				
				// 更新内存中的图片数据，而不是完全刷新
				this.updateImageAfterRename(oldPath, newPath, newName);
				
				// 重新渲染（不重新加载）
				this.renderHeader();
				this.renderGrid();
			} catch {
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
				// 优化：只从内存中移除，而不是重新加载所有图片
				this.removeImageFromList(image);
			}
		);
		modal.open();
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
		this.referenceChecker.getCache().updateKey(oldPath, newPath);
	}

	/**
	 * 从列表中移除图片（优化后的删除逻辑，保持滚动位置）
	 */
	private removeImageFromList(image: ImageItem): void {
		// 从 images 数组中移除
		this.images = this.images.filter(img => img.path !== image.path);
		// 从 filteredImages 数组中移除
		this.filteredImages = this.filteredImages.filter(img => img.path !== image.path);
		// 从选中列表中移除（如果存在）
		this.selectedImages.delete(image.path);
		// 清除引用缓存
		this.referenceChecker.clearCache();
		
		// 直接从DOM中移除对应元素，而不是重新渲染整个网格
		const gridEl = this.gridContainer.querySelector(".image-manager-grid");
		if (gridEl) {
			const itemEl = gridEl.querySelector(`[data-path="${CSS.escape(image.path)}"]`);
			if (itemEl) {
				itemEl.remove();
				this.renderedCount--;
			}
		}
		
		// 更新加载更多指示器
		this.updateLoadMoreIndicator();
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
			async (onProgress: (current: number, total: number) => void) => {
				const imagesToDelete = [...this.filteredImages];
				const total = imagesToDelete.length;
				let successCount = 0;
				let errorCount = 0;

				// 使用简单的 for 循环逐个删除，比复杂的 Promise.allSettled 更快
				// 分批处理以避免 UI 阻塞
				const batchSize = 10; // 每批处理10个文件
				
				for (let i = 0; i < imagesToDelete.length; i += batchSize) {
					const batch = imagesToDelete.slice(i, Math.min(i + batchSize, imagesToDelete.length));
					
					// 分批并行删除
					const batchPromises = batch.map(async (image) => {
						try {
							await this.fileOperations.deleteFile(image, true);
							return { success: true, image };
						} catch (error) {
							console.error(`删除文件失败: ${image.path}`, error);
							return { success: false, image };
						}
					});
					
					const batchResults = await Promise.all(batchPromises);
					
					// 统计结果
					for (const result of batchResults) {
						if (result.success) {
							successCount++;
							// 立即从内存中移除
							this.removeImageFromMemory(result.image);
						} else {
							errorCount++;
						}
					}
					
					// 更新进度
					onProgress(successCount + errorCount, total);
					
					// 给 UI 一些时间更新
					await new Promise(resolve => setTimeout(resolve, 0));
				}

				// 显示结果
				if (errorCount === 0) {
					new Notice(`成功删除 ${successCount} 张图片`);
				} else {
					new Notice(`删除完成: 成功 ${successCount} 张, 失败 ${errorCount} 张`);
				}
				
				// 更新UI（不刷新，保持滚动位置）
				this.updateLoadMoreIndicator();
				this.renderHeader();
			}
		);
		modal.open();
	}

	/**
	 * 批量删除选中的图片
	 */
	private async handleBatchDeleteSelected(): Promise<void> {
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
				const total = imagesToDelete.length;
				let successCount = 0;
				let errorCount = 0;

				// 分批处理以避免 UI 阻塞
				const batchSize = 10;
				
				for (let i = 0; i < imagesToDelete.length; i += batchSize) {
					const batch = imagesToDelete.slice(i, Math.min(i + batchSize, imagesToDelete.length));
					
					const batchPromises = batch.map(async (image) => {
						try {
							await this.fileOperations.deleteFile(image, true);
							return { success: true, image };
						} catch (error) {
							console.error(`删除文件失败: ${image.path}`, error);
							return { success: false, image };
						}
					});
					
					const batchResults = await Promise.all(batchPromises);
					
					for (const result of batchResults) {
						if (result.success) {
							successCount++;
							this.removeImageFromMemory(result.image);
							this.selectedImages.delete(result.image.path);
						} else {
							errorCount++;
						}
					}
					
					onProgress(successCount + errorCount, total);
					await new Promise(resolve => setTimeout(resolve, 0));
				}

				// 显示结果
				if (errorCount === 0) {
					new Notice(`成功删除 ${successCount} 张图片`);
				} else {
					new Notice(`删除完成: 成功 ${successCount} 张, 失败 ${errorCount} 张`);
				}
				
				// 退出多选模式
				this.isMultiSelectMode = false;
				this.selectedImages.clear();
				
				// 更新UI（不刷新整个视图，保持滚动位置）
				this.updateLoadMoreIndicator();
				this.renderHeader();
			}
		);
		modal.open();
	}

	/**
	 * 从内存中移除图片（不重新加载，用于批量删除）
	 */
	private removeImageFromMemory(image: ImageItem): void {
		this.images = this.images.filter(img => img.path !== image.path);
		this.filteredImages = this.filteredImages.filter(img => img.path !== image.path);
		
		// 直接从DOM中移除对应元素
		const gridEl = this.gridContainer.querySelector(".image-manager-grid");
		if (gridEl) {
			const itemEl = gridEl.querySelector(`[data-path="${CSS.escape(image.path)}"]`);
			if (itemEl) {
				itemEl.remove();
				this.renderedCount--;
			}
		}
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
			const plugin = (this.app as unknown as { plugins: { plugins: { "albus-imagine"?: { loadData: () => Promise<unknown>; saveData: (data: unknown) => Promise<void>; settings: { imageManager: { lastSelectedFolder: string } } } } } }).plugins?.plugins?.["albus-imagine"];
			if (plugin) {
				const data = (await plugin.loadData()) as { imageManager?: { lastSelectedFolder?: string } } || {};
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
