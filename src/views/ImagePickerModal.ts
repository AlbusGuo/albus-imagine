/**
 * 图片选择器模态框（简化版）
 * 用于在编辑器中快速插入图片
 * 基于 ImageManagerView 的简化版本
 */

import { App, MarkdownView, Menu, Modal, Notice, setIcon, ToggleComponent } from "obsidian";
import { ImageItem, ImageManagerSettings, SortField, SortOrder } from "../types/image-manager.types";
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

		// 阻止 Modal 自动聚焦到搜索框（会弹出联想输入法弹窗影响体验）
		window.requestAnimationFrame(() => {
			if (activeDocument.activeElement instanceof HTMLElement) {
				activeDocument.activeElement.blur();
			}
		});
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

		// 文件夹路径输入框（始终可见，附带 AbstractInputSuggest）
		const folderInputContainer = leftSection.createDiv("image-manager-folder-input-container");
		const folderInput = folderInputContainer.createEl("input", {
			type: "text",
			placeholder: "按文件夹筛选...",
			value: this.selectedFolder,
			cls: "image-manager-folder-input",
		});

		// 清空按钮（只在有路径时显示）
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

		// 右侧：多选和确认按钮
		const rightSection = headerRow.createDiv("image-manager-header-right");

		// 多选模式下的确认按钮
		if (this.isMultiSelectMode) {
			const confirmBtn = rightSection.createEl("button", {
				cls: "clickable-icon",
				attr: { "aria-label": `确认插入 (${this.selectedImages.size})` },
			});
			setIcon(confirmBtn, "check");
			if (this.selectedImages.size > 0) {
				confirmBtn.createSpan({ text: `${this.selectedImages.size}`, cls: "image-manager-icon-badge" });
			}
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
			const sortFieldOptions: { value: SortField; text: string }[] = [
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
			this.renderedCount = 0;
		}

		if (this.isLoading && !append) {
			this.gridContainer.empty();
			const loadingEl = this.gridContainer.createDiv("image-manager-loading-state");
			loadingEl.createDiv("image-manager-loading-spinner");
			loadingEl.createSpan({ text: "加载中..." });
			return;
		}

		if (this.filteredImages.length === 0 && !append) {
			this.gridContainer.empty();
			const emptyEl = this.gridContainer.createDiv("image-manager-empty-state");
			emptyEl.createSpan({ text: this.images.length === 0 ? "没有找到图片" : "没有符合条件的图片" });
			return;
		}

		const startIndex = this.renderedCount;
		const endIndex = Math.min(startIndex + this.batchSize, this.filteredImages.length);
		const imagesToRender = this.filteredImages.slice(startIndex, endIndex);

		window.requestAnimationFrame(() => {
			// 在同一帧内清空旧内容并插入新内容，避免闪烁
			let gridEl: HTMLElement | null = null;
			if (append) {
				gridEl = this.gridContainer.querySelector(".image-manager-grid");
			} else {
				this.gridContainer.empty();
			}
			if (!gridEl) {
				gridEl = this.gridContainer.createDiv("image-manager-grid");
			}

			this.renderImageBatch(gridEl, imagesToRender);
			this.renderedCount = endIndex;
			this.isLoadingMore = false;
			this.updateLoadMoreIndicator();

			// 自动加载：若内容未溢出容器但仍有更多图片，则继续加载
			window.requestAnimationFrame(() => {
				if (
					this.renderedCount < this.filteredImages.length &&
					this.gridContainer.scrollHeight <= this.gridContainer.clientHeight
				) {
					this.loadMoreImages();
				}
			});
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
				img.onload = () => img.addClass("is-loaded");

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
		this.renderGrid(true); // isLoadingMore 在 renderGrid 的 rAF 回调中重置
	}

	private updateLoadMoreIndicator(): void {
		const oldIndicator = this.gridContainer.querySelector(".image-manager-load-more");
		if (oldIndicator) oldIndicator.remove();

		if (this.renderedCount < this.filteredImages.length) {
			const indicator = this.gridContainer.createDiv("image-manager-load-more");
			indicator.setText(`已显示 ${this.renderedCount} / ${this.filteredImages.length} 张图片`);
		}
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
			new Notice(`加载图片失败: ${error instanceof Error ? error.message : String(error)}`);
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
			if (compareValue === 0) {
				compareValue = a.path.localeCompare(b.path);
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

	private refresh(): void {
		this.loadImages();
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
			this.folderSuggest.close();
			this.folderSuggest = null;
		}
	}
}
