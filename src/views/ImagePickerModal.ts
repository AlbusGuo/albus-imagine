/**
 * 图片选择器模态框（简化版）
 * 用于在编辑器中快速插入图片
 * 基于 ImageManagerView 的简化版本
 */

import { App, Modal, MarkdownView, setIcon, Notice, ToggleComponent } from "obsidian";
import { ImageItem, ImageManagerSettings, SortOrder, SortField } from "../types/image-manager.types";
import { ImageLoaderService } from "../services/ImageLoaderService";
import { FolderSuggest } from "../components/FolderSuggest";

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
	private imagePosition: "center" | "left" | "right" | "inline" = "center";
	private invertColor = false;
	private imageCaption = "";

	// 多选模式
	private isMultiSelectMode = false;
	private selectedImages: Set<string> = new Set(); // 存储选中图片的名称

	// 虚拟滚动
	private renderedCount = 0;
	private batchSize = 50;
	private isLoadingMore = false;
	private scrollThreshold = 500;

	private imageLoader: ImageLoaderService;
	private headerContainer: HTMLElement;
	private searchContainer: HTMLElement;
	private optionsContainer: HTMLElement;
	private gridContainer: HTMLElement;
	private intersectionObserver: IntersectionObserver | null = null;

	constructor(app: App, settings: ImageManagerSettings) {
		super(app);
		this.settings = settings;
		this.selectedFolder = settings.lastSelectedFolder ?? settings.folderPath ?? "";
		this.imageLoader = new ImageLoaderService(app);
		// 图片选择器不加载自定义文件类型，只加载纯图片
		// this.imageLoader.setCustomFileTypes(settings.customFileTypes || []);
		// 根据设置中的SVG反色选项默认启用反色
		this.invertColor = settings.invertSvgInDarkMode !== false;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("image-picker-container");
		
		// 为模态框添加自定义类名
		this.modalEl.addClass("mod-image-picker");
		
		this.titleEl.setText("选择图片");

		this.initIntersectionObserver();
		this.setupLayout();
		this.loadImages();
	}

	private initIntersectionObserver(): void {
		this.intersectionObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						const imgEl = entry.target as HTMLImageElement;
						const dataSrc = imgEl.getAttribute("data-src");
						if (dataSrc && !imgEl.src) {
							imgEl.src = dataSrc;
							imgEl.removeAttribute("data-src");
							this.intersectionObserver?.unobserve(imgEl);
						}
					}
				});
			},
			{ rootMargin: "200px", threshold: 0.01 }
		);
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
		this.gridContainer.addEventListener("scroll", () => this.handleScroll());
	}

	private renderHeader(): void {
		this.headerContainer.empty();
		const headerRow = this.headerContainer.createDiv("image-manager-header-row");
		const leftSection = headerRow.createDiv("image-manager-header-left");

		const folderBtn = leftSection.createEl("button", { cls: "image-manager-folder-button" });
		const folderIcon = folderBtn.createSpan({ cls: "image-manager-folder-icon" });
		setIcon(folderIcon, "folder");
		folderBtn.createSpan({ 
			text: this.selectedFolder || "所有图片",
			cls: "image-manager-folder-text"
		});
		folderBtn.onclick = () => this.showFolderInput(folderBtn);

		const statsEl = leftSection.createDiv("image-manager-stats");
		statsEl.setText(`共 ${this.images.length} 张`);

		// 右侧：多选和确认按钮
		const rightSection = headerRow.createDiv("image-manager-header-right");

		// 多选模式下的确认按钮
		if (this.isMultiSelectMode) {
			const confirmBtn = rightSection.createEl("button", {
				text: `确认 (${this.selectedImages.size})`,
				cls: "image-manager-check-refs-button",
			});
			// 没有选中图片时禁用
			if (this.selectedImages.size === 0) {
				confirmBtn.disabled = true;
			}
			confirmBtn.onclick = () => this.handleGridInsert();
		}

		// 多选按钮
		const multiSelectBtn = rightSection.createEl("button", {
			text: this.isMultiSelectMode ? "取消" : "多选",
			cls: this.isMultiSelectMode 
				? "image-manager-check-refs-button multi-select-active"
				: "image-manager-check-refs-button",
		});
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
		statsEl.setText(`共 ${this.images.length} 张`);
	}

	private showFolderInput(buttonEl: HTMLElement): void {
		const leftSection = buttonEl.parentElement!;
		const inputContainer = leftSection.createDiv("image-manager-folder-input-container");
		leftSection.insertBefore(inputContainer, buttonEl.nextSibling);
		
		const folderInput = inputContainer.createEl("input", {
			type: "text",
			placeholder: "输入文件夹路径...",
			value: this.selectedFolder,
			cls: "image-manager-folder-input-inline",
		});

		buttonEl.addClass("is-hidden");

		if (this.folderSuggest) {
			this.folderSuggest.destroy();
		}
		this.folderSuggest = new FolderSuggest(this.app, folderInput, (value) => {
			this.selectedFolder = value;
			this.refresh();
		});

		folderInput.addEventListener("input", () => {
			this.selectedFolder = folderInput.value;
		});

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

		folderInput.addEventListener("blur", () => {
			setTimeout(() => {
				inputContainer.remove();
				buttonEl.removeClass("is-hidden");
			}, 200);
		});

		setTimeout(() => folderInput.focus(), 0);
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
		sortControlsEl.createSpan({ text: "排序依据:", cls: "image-manager-sort-label" });
		
		const sortFieldSelect = sortControlsEl.createEl("select", { cls: "image-manager-sort-select" });
		const sortFieldOptions = [
			{ value: "mtime", text: "修改时间" },
			{ value: "ctime", text: "创建时间" },
			{ value: "size", text: "文件大小" },
			{ value: "name", text: "文件名" },
		];
		sortFieldOptions.forEach((opt) => {
			const option = sortFieldSelect.createEl("option", { value: opt.value, text: opt.text });
			if (opt.value === this.sortField) option.selected = true;
		});
		sortFieldSelect.onchange = () => {
			this.sortField = sortFieldSelect.value as SortField;
			this.applyFilters();
			this.renderGrid();
		};

		const sortOrderBtn = sortControlsEl.createEl("button", { cls: "image-manager-sort-order-button" });
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
		button.createSpan({ text: this.sortOrder === "desc" ? "↓ 降序" : "↑ 升序" });
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
		positionGroup.createSpan({ text: "位置：", cls: "option-label" });
		const positionButtons = positionGroup.createDiv("option-buttons");
		
		const positions: Array<{ value: "center" | "left" | "right" | "inline"; label: string }> = [
			{ value: "center", label: "居中" },
			{ value: "left", label: "左侧环绕" },
			{ value: "right", label: "右侧环绕" },
			{ value: "inline", label: "行间" },
		];
		
		positions.forEach((pos) => {
			const btn = positionButtons.createEl("button", {
				text: pos.label,
				cls: "option-button",
			});
			if (this.imagePosition === pos.value) {
				btn.addClass("is-active");
			}
			btn.onclick = () => {
				this.imagePosition = pos.value;
				this.renderOptionsPanel();
			};
		});

		// 反色选项
		const invertGroup = this.optionsContainer.createDiv("option-group");
		invertGroup.createSpan({ text: "反色：", cls: "option-label" });
		const toggleContainer = invertGroup.createDiv("option-toggle");
		new ToggleComponent(toggleContainer)
			.setValue(this.invertColor)
			.onChange((value) => {
				this.invertColor = value;
			});

		// 标题输入
		const captionGroup = this.optionsContainer.createDiv("option-group");
		captionGroup.createSpan({ text: "标题：", cls: "option-label" });
		const captionInput = captionGroup.createEl("input", {
			type: "text",
			placeholder: "输入图片标题（可选）",
			cls: "option-input",
			value: this.imageCaption,
		});
		captionInput.oninput = () => {
			this.imageCaption = captionInput.value;
		};
	}

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
			emptyEl.createSpan({ text: this.images.length === 0 ? "没有找到图片" : "没有符合条件的图片" });
			return;
		}

		let gridEl: HTMLElement | null = append ? this.gridContainer.querySelector(".image-manager-grid") : null;
		if (!gridEl) {
			gridEl = this.gridContainer.createDiv("image-manager-grid");
		}

		const startIndex = this.renderedCount;
		const endIndex = Math.min(startIndex + this.batchSize, this.filteredImages.length);
		const imagesToRender = this.filteredImages.slice(startIndex, endIndex);

		requestAnimationFrame(() => {
			this.renderImageBatch(gridEl!, imagesToRender);
			this.renderedCount = endIndex;
			this.updateLoadMoreIndicator();
		});
	}

	private renderImageBatch(gridEl: HTMLElement, images: ImageItem[]): void {
		images.forEach((image) => {
			const itemEl = gridEl.createDiv("image-manager-grid-item");
			
			// 多选模式下添加选中样式
			if (this.isMultiSelectMode && this.selectedImages.has(image.name)) {
				itemEl.addClass("image-manager-item-selected");
			}
			
			const thumbnailEl = itemEl.createDiv("image-manager-thumbnail");
			
			// 点击选择图片：多选模式下切换选中状态，否则插入单张图片
			thumbnailEl.onclick = () => {
				if (this.isMultiSelectMode) {
					// 多选模式：切换选中状态
					if (this.selectedImages.has(image.name)) {
						this.selectedImages.delete(image.name);
						itemEl.removeClass("image-manager-item-selected");
					} else {
						this.selectedImages.add(image.name);
						itemEl.addClass("image-manager-item-selected");
					}
					// 更新头部按钮状态
					this.renderHeader();
				} else {
					// 普通模式：插入单张图片
					this.handleImageSelect(image);
				}
			};
			thumbnailEl.addClass("cursor-pointer");

			if (!image.coverMissing) {
				const img = thumbnailEl.createEl("img", {
					cls: image.displayFile.extension.toLowerCase() === "svg" ? "image-manager-svg-image" : "image-manager-thumbnail-image",
				});
				
				const resourcePath = this.app.vault.getResourcePath(image.displayFile);
				img.setAttribute("data-src", resourcePath);
				img.alt = image.name;

				if (this.intersectionObserver) {
					this.intersectionObserver.observe(img);
				}
			}

			const formatBadge = thumbnailEl.createDiv({
				text: image.originalFile.extension.toUpperCase(),
				cls: "image-manager-format-badge",
			});
			formatBadge.addClass(image.isCustomType ? "image-manager-agx-format" : "image-manager-other-format");

			const infoEl = itemEl.createDiv("image-manager-image-info");
			infoEl.createDiv({
				text: image.name,
				cls: "image-manager-image-name",
				attr: { title: image.path },
			});

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
		});
	}

	private handleScroll(): void {
		if (this.isLoadingMore || this.renderedCount >= this.filteredImages.length) return;

		const container = this.gridContainer;
		const scrollTop = container.scrollTop;
		const scrollHeight = container.scrollHeight;
		const clientHeight = container.clientHeight;

		if (scrollHeight - scrollTop - clientHeight < this.scrollThreshold) {
			this.loadMoreImages();
		}
	}

	private loadMoreImages(): void {
		if (this.isLoadingMore || this.renderedCount >= this.filteredImages.length) return;
		this.isLoadingMore = true;
		requestAnimationFrame(() => {
			this.renderGrid(true);
			this.isLoadingMore = false;
		});
	}

	private updateLoadMoreIndicator(): void {
		const oldIndicator = this.gridContainer.querySelector(".image-manager-load-more");
		if (oldIndicator) oldIndicator.remove();

		if (this.renderedCount < this.filteredImages.length) {
			const indicator = this.gridContainer.createDiv("image-manager-load-more");
			indicator.setText(`已显示 ${this.renderedCount} / ${this.filteredImages.length} 张图片`);
		}
	}

	private async loadImages(): Promise<void> {
		if (this.isLoading) return;

		this.isLoading = true;
		this.renderGrid();

		try {
			this.images = await this.imageLoader.loadImages(this.selectedFolder);
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
		let filtered = [...this.images];

		if (this.searchQuery) {
			const query = this.searchQuery.toLowerCase();
			filtered = filtered.filter((img) => img.name.toLowerCase().includes(query));
		}

		filtered.sort((a, b) => {
			let compareValue = 0;
			switch (this.sortField) {
				case "mtime": compareValue = a.stat.mtime - b.stat.mtime; break;
				case "ctime": compareValue = a.stat.ctime - b.stat.ctime; break;
				case "size": compareValue = a.stat.size - b.stat.size; break;
				case "name": compareValue = a.name.localeCompare(b.name); break;
			}
			return this.sortOrder === "asc" ? compareValue : -compareValue;
		});

		this.filteredImages = filtered;
	}

	private handleImageSelect(image: ImageItem): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const editor = view.editor;
		if (!editor) return;

		// 构建图片链接
		// 语法规则：
		// - 无标题：![[image|dark|position|size]] 或 ![[image|position|size]]
		// - 有标题：![[image#position#dark|caption|size]] 或 ![[image#position|caption|size]]
		let imageLink = "";
		const fileName = image.name;
		
		if (this.imageCaption) {
			// 有标题：使用 # 语法
			if (this.invertColor) {
				// 位置 + 反色 + 标题：![[image#position#dark|caption]]
				imageLink = `![[${fileName}#${this.imagePosition}#dark|${this.imageCaption}]]`;
			} else {
				// 位置 + 标题：![[image#position|caption]]
				imageLink = `![[${fileName}#${this.imagePosition}|${this.imageCaption}]]`;
			}
		} else {
			// 无标题：使用 | 语法
			if (this.invertColor) {
				// 反色 + 位置：![[image|dark|position]]
				imageLink = `![[${fileName}|dark|${this.imagePosition}]]`;
			} else {
				// 仅位置：![[image|position]]
				imageLink = `![[${fileName}|${this.imagePosition}]]`;
			}
		}

		editor.replaceSelection(imageLink);
		this.close();
	}

	/**
	 * 处理Grid格式插入
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

		// 构建Grid Callout格式
		const imageLinks = Array.from(this.selectedImages)
			.map(name => `![[${name}]]`)
			.join('\n');
		
		const gridContent = `> [!grid]\n> ${imageLinks.split('\n').join('\n> ')}`;

		editor.replaceSelection(gridContent);
		this.close();
	}

	private async refresh(): Promise<void> {
		await this.loadImages();
	}

	private formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + " B";
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
		return (bytes / (1024 * 1024)).toFixed(1) + " MB";
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();

		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect();
			this.intersectionObserver = null;
		}

		if (this.folderSuggest) {
			this.folderSuggest.destroy();
			this.folderSuggest = null;
		}
	}
}
