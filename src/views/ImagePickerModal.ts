/**
 * 图片选择器模态框 (简化版)
 * 用于在编辑器中快速插入图片
 * 基于 ImageManagerView 的简化版本
 */

import { App, DropdownComponent, MarkdownView, Menu, Modal, Notice, setIcon, TextComponent, ToggleComponent } from "obsidian";
import { ImageItem, ImageManagerSettings, SortField, SortOrder } from "../types/image-manager.types";
import { ImageLoaderService } from "../services/ImageLoaderService";
import { FolderSuggest } from "../components/FolderSuggest";
import { ViewportGrid, ViewportGridController } from "../components/ViewportGrid";
import { ViewportMediaController, ViewportMediaLoader } from "../components/ViewportMediaLoader";
import { ImageCatalogService } from "../services/ImageCatalogService";
import { buildImageLink, ImagePosition } from "../utils/imageLink";
import { createImagePickerCard } from "../components/ImagePickerCard";
import { filterAndSortImages } from "../utils/imageCollection";

interface PickerImageController extends ViewportGridController<ImageItem>, ViewportMediaController {
	imageEl: HTMLImageElement | null;
}

export class ImagePickerModal extends Modal {
	private settings: ImageManagerSettings;
	private selectedFolder: string;
	private images: ImageItem[] = [];
	private filteredImages: ImageItem[] = [];
	private searchQuery = "";
	private sortField: SortField = "mtime";
	private sortOrder: SortOrder = "desc";
	private isLoading = false;
	private folderSuggest: FolderSuggest | null = null;

	// 插图选项
	private imagePosition: ImagePosition = "center";
	private invertColor = false;
	private imageCaption = "";

	// 多选模式
	private isMultiSelectMode = false;
	private selectedImages: Set<string> = new Set();

	// 虚拟滚动
	private imageLoader: ImageLoaderService;
	private headerContainer: HTMLElement;
	private searchContainer: HTMLElement;
	private optionsContainer: HTMLElement;
	private gridContainer: HTMLElement;
	private gridEl: HTMLElement;
	private gridStateEl: HTMLElement;
	private viewportGrid: ViewportGrid<ImageItem, PickerImageController> | null = null;
	private mediaLoader: ViewportMediaLoader<PickerImageController> | null = null;

	constructor(app: App, settings: ImageManagerSettings, imageCatalog: ImageCatalogService) {
		super(app);
		this.settings = settings;
		this.selectedFolder = settings.lastSelectedFolder ?? settings.folderPath ?? "";
		this.imageLoader = new ImageLoaderService(app, imageCatalog);
		// 图片选择器不加载自定义文件类型, 只加载纯图片
		// this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
		// 保持原有行为: 全局 SVG 深色反色开启时, 插入选项默认同步开启.
		this.invertColor = settings.invertSvgInDarkMode !== false;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("image-picker-container");

		// 为模态框添加自定义类名
		this.modalEl.addClass("mod-image-picker");

		this.titleEl.setText("选择图片");

		this.setupLayout();
		this.loadImages();

		// 阻止 Modal 自动聚焦到搜索框 (会弹出联想输入法弹窗影响体验)
		this.modalEl.ownerDocument.defaultView?.requestAnimationFrame(() => {
			const activeElement = this.modalEl.ownerDocument.activeElement;
			if (activeElement instanceof HTMLElement) {
				activeElement.blur();
			}
		});
	}

	private setupLayout(): void {
		const { contentEl } = this;

		this.headerContainer = contentEl.createDiv("image-manager-header");
		this.renderHeader();

		this.searchContainer = contentEl.createDiv("image-manager-search");
		this.renderSearchBar();

		// 插图选项面板
		this.optionsContainer = contentEl.createDiv("image-picker-options");
		this.renderOptionsPanel();

		const gridPanel = contentEl.createDiv("image-manager-grid-panel");
		this.gridContainer = gridPanel;
		this.gridStateEl = gridPanel.createDiv("image-manager-grid-state");
		this.gridEl = gridPanel.createDiv("image-manager-grid");
		this.mediaLoader = new ViewportMediaLoader(this.gridEl);
		this.viewportGrid = new ViewportGrid({
			viewportEl: this.gridContainer,
			gridEl: this.gridEl,
			getKey: (image) => image.path,
			create: (image) => this.createImageController(image),
			update: (controller, image) => {
				controller.item = image;
				controller.element.toggleClass(
					"image-manager-item-selected",
					this.isMultiSelectMode && this.selectedImages.has(image.path),
				);
			},
			onVisibleChange: (controllers) => this.mediaLoader?.sync(controllers),
			minimumItemWidth: 130,
			estimatedItemHeight: 205,
			gap: 12,
			padding: 16,
			overscanRows: 4,
		});
	}

	private renderHeader(): void {
		this.headerContainer.empty();
		const headerRow = this.headerContainer.createDiv("image-manager-header-row");
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
			clearBtn.onclick = () => {
				this.selectedFolder = "";
				this.refresh();
			};
		}

		if (this.folderSuggest) {
			this.folderSuggest.close();
		}
		this.folderSuggest = new FolderSuggest(this.app, folderInput, (value) => {
			this.selectedFolder = value;
			this.refresh();
		});

		folderInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.selectedFolder = folderInput.value;
				this.refresh();
			}
		});

		const statsEl = leftSection.createDiv("image-manager-stats");
		statsEl.createSpan({ text: `${this.images.length}`, cls: "image-manager-stats-number" });
		statsEl.createSpan({ text: " 张图片", cls: "image-manager-stats-label" });
		if (this.isMultiSelectMode) {
			statsEl.createSpan({ text: " / ", cls: "image-manager-stats-sep" });
			statsEl.createSpan({ text: `${this.selectedImages.size}`, cls: "image-manager-stats-number" });
			statsEl.createSpan({ text: " 张已选", cls: "image-manager-stats-label" });
		}

		// 右侧: 多选和确认按钮
		const rightSection = headerRow.createDiv("image-manager-header-right");

		// 多选模式下的确认按钮
		if (this.isMultiSelectMode) {
			const confirmBtn = rightSection.createEl("button", {
				cls: "clickable-icon",
				attr: { "aria-label": `确认插入 (${this.selectedImages.size})` },
			});
			setIcon(confirmBtn, "check");
			// 没有选中图片时禁用
			if (this.selectedImages.size === 0) {
				confirmBtn.disabled = true;
			}
			confirmBtn.onclick = () => this.handleGridInsert();
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
			this.renderOptionsPanel();
			this.renderGrid();
		};
	}


	private renderSearchBar(): void {
		this.searchContainer.empty();
		this.searchContainer.addClass("image-manager-search-sort-bar");

		const searchBoxEl = this.searchContainer.createDiv("image-manager-search-box");
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

		const sortControlsEl = this.searchContainer.createDiv("image-manager-sort-controls");

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
			];
			sortFieldOptions.forEach((opt) => {
				menu.addItem((item) => {
					item.setTitle(opt.text)
						.setChecked(this.sortField === opt.value)
						.onClick(() => {
							this.sortField = opt.value;
							this.applyFilters();
							this.renderGrid();
						});
				});
			});
			menu.showAtMouseEvent(evt);
		};

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

	private renderOptionsPanel(): void {
		this.optionsContainer.empty();

		// 多选模式下隐藏所有选项
		if (this.isMultiSelectMode) {
			this.optionsContainer.addClass("is-hidden");
			return;
		}

		this.optionsContainer.removeClass("is-hidden");

		// 位置选择
		const positionGroup = this.optionsContainer.createDiv("option-group");
		positionGroup.createSpan({ text: "位置:", cls: "option-label" });
		new DropdownComponent(positionGroup)
			.addOption("center", "居中")
			.addOption("align-left", "左对齐")
			.addOption("align-right", "右对齐")
			.addOption("left", "左侧环绕")
			.addOption("right", "右侧环绕")
			.addOption("inline", "行间")
			.setValue(this.imagePosition)
			.onChange((value) => {
				this.imagePosition = value as ImagePosition;
			});

		// 反色选项
		const invertGroup = this.optionsContainer.createDiv("option-group");
		invertGroup.createSpan({ text: "反色:", cls: "option-label" });
		const toggleContainer = invertGroup.createDiv("option-toggle");
		new ToggleComponent(toggleContainer)
			.setValue(this.invertColor)
			.onChange((value) => {
				this.invertColor = value;
			});

		// 标题输入
		const captionGroup = this.optionsContainer.createDiv("option-group");
		captionGroup.createSpan({ text: "标题:", cls: "option-label" });
		new TextComponent(captionGroup)
			.setPlaceholder("输入图片标题 (可选)")
			.setValue(this.imageCaption)
			.onChange((value) => {
				this.imageCaption = value;
			});
	}

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
			emptyEl.createSpan({ text: this.images.length === 0 ? "没有找到图片" : "没有符合条件的图片" });
			return;
		}
		this.gridEl.show();
		this.viewportGrid.setItems(this.filteredImages);
	}

	private createImageController(image: ImageItem): PickerImageController {
		let controller: PickerImageController;
		const { element, imageEl } = createImagePickerCard(
			this.app,
			this.modalEl.ownerDocument,
			image,
			this.settings,
			this.isMultiSelectMode && this.selectedImages.has(image.path),
			(card) => {
				const currentImage = controller.item;
				if (!this.isMultiSelectMode) {
					this.handleImageSelect(currentImage);
					return;
				}
				if (this.selectedImages.has(currentImage.path)) this.selectedImages.delete(currentImage.path);
				else this.selectedImages.add(currentImage.path);
				card.toggleClass("image-manager-item-selected", this.selectedImages.has(currentImage.path));
				this.renderHeader();
			},
		);
		controller = {
			element,
			item: image,
			imageEl,
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

	private loadImages(): void {
		if (this.isLoading) return;

		this.isLoading = true;
		this.renderGrid();

		try {
			this.images = this.imageLoader.loadImages(this.selectedFolder);
			this.applyFilters();
			this.renderHeader();
		} catch (error) {
			new Notice(`加载图片失败: ${error.message}`);
		} finally {
			this.isLoading = false;
			this.renderGrid();
		}
	}

	private applyFilters(): void {
		this.filteredImages = filterAndSortImages(this.images, {
			query: this.searchQuery,
			unreferencedOnly: false,
			sortField: this.sortField,
			sortOrder: this.sortOrder,
		});
	}

	private handleImageSelect(image: ImageItem): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const editor = view.editor;
		if (!editor) return;

		const imageLink = buildImageLink(this.app.metadataCache, image.originalFile, view.file?.path ?? "", {
			position: this.imagePosition,
			dark: this.invertColor,
			caption: this.imageCaption,
		});

		editor.replaceSelection(imageLink);
		this.close();
	}

	/**
	 * 处理 Grid 格式插入
	 */
	private handleGridInsert(): void {
		if (this.selectedImages.size === 0) {
			new Notice("请至少选择一张图片");
			return;
		}

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const editor = view.editor;
		if (!editor) return;

		// 构建 Grid Callout 格式
		const imageLinks = Array.from(this.selectedImages)
			.map((path) => this.app.vault.getFileByPath(path))
			.filter((file): file is import("obsidian").TFile => file !== null)
			.map((file) => `![[${this.app.metadataCache.fileToLinktext(file, view.file?.path ?? "")}]]`)
			.join('\n');

		const gridContent = `> [!grid]\n> ${imageLinks.split('\n').join('\n> ')}`;

		editor.replaceSelection(gridContent);
		this.close();
	}

	private refresh(): void {
		this.loadImages();
	}

	onClose(): void {
		this.viewportGrid?.destroy();
		this.viewportGrid = null;
		this.mediaLoader?.destroy();
		this.mediaLoader = null;
		const { contentEl } = this;
		contentEl.empty();

		if (this.folderSuggest) {
			this.folderSuggest.close();
			this.folderSuggest = null;
		}
	}
}
