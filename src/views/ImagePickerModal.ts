import { App, DropdownComponent, type Editor, Modal, Notice, TextComponent, ToggleComponent } from "obsidian";
import {
	IMAGE_CARD_PROPERTY_ORDER,
	ImageCardProperty,
	ImageFilterPreset,
	ImageItem,
	ImageManagerLayout,
	ImageManagerSettings,
	ImageSortRule,
} from "../types/image-manager.types";
import { ImageLoaderService } from "../services/ImageLoaderService";
import { ReferenceCheckService } from "../services/ReferenceCheckService";
import { ImageThumbnailService } from "../services/ImageThumbnailService";
import { ViewIconService } from "../services/ViewIconService";
import { ViewportGrid, ViewportGridController } from "../components/ViewportGrid";
import { ViewportMasonry } from "../components/ViewportMasonry";
import { ViewportMediaController, ViewportMediaLoader } from "../components/ViewportMediaLoader";
import { ImageCatalogService } from "../services/ImageCatalogService";
import { buildImageLink, ImagePosition } from "../utils/imageLink";
import { createImagePickerCard } from "../components/ImagePickerCard";
import { ImagePickerToolbar } from "../components/ImagePickerToolbar";
import { filterAndSortImages } from "../utils/imageCollection";

interface PickerImageController extends ViewportGridController<ImageItem>, ViewportMediaController {
	imageEl: HTMLImageElement | null;
}

export type ImagePickerAction =
	| { kind: "insert"; editor: Editor; sourcePath: string; }
	| {
		kind: "select";
		multiple: boolean;
		onSelect: (paths: string[]) => void | Promise<void>;
	};

export class ImagePickerModal extends Modal {
	private readonly views: ImageFilterPreset[];
	private activeViewId: string;
	private images: ImageItem[] = [];
	private filteredImages: ImageItem[] = [];
	private searchQuery = "";
	private cardProperties: ImageCardProperty[] = [];
	private sortRules: ImageSortRule[] = [];
	private readonly cardSize = 120;
	private layoutMode: ImageManagerLayout = "grid";
	private renderedLayoutMode: ImageManagerLayout | null = null;
	private isLoading = false;
	private loadPending = false;
	private isClosed = false;
	private imagePosition: ImagePosition = "center";
	private invertColor = false;
	private imageCaption = "";
	private isMultiSelectMode = false;
	private readonly selectedImages = new Set<string>();
	private readonly imageLoader: ImageLoaderService;
	private readonly thumbnailService = new ImageThumbnailService();
	private toolbar: ImagePickerToolbar | null = null;
	private optionsContainer!: HTMLElement;
	private gridContainer!: HTMLElement;
	private gridEl!: HTMLElement;
	private gridStateEl!: HTMLElement;
	private viewport: ViewportGrid<ImageItem, PickerImageController> | ViewportMasonry<ImageItem, PickerImageController> | null = null;
	private mediaLoader: ViewportMediaLoader<PickerImageController> | null = null;

	constructor(
		app: App,
		settings: ImageManagerSettings,
		imageCatalog: ImageCatalogService,
		private readonly referenceChecker: ReferenceCheckService,
		private readonly iconService: ViewIconService,
		private readonly action: ImagePickerAction,
	) {
		super(app);
		this.views = (settings.filterPresets ?? []).map((view) => cloneView(view));
		if (this.views.length === 0) this.views.push(createFallbackView(settings));
		this.activeViewId = settings.activeFilterId && this.views.some((view) => view.id === settings.activeFilterId)
			? settings.activeFilterId
			: this.views[0].id;
		this.imageLoader = new ImageLoaderService(app, imageCatalog);
		this.invertColor = settings.invertSvgInDarkMode !== false;
		this.isMultiSelectMode = action.kind === "select" && action.multiple;
		this.applyViewState();
	}

	onOpen(): void {
		this.isClosed = false;
		this.contentEl.addClass("image-picker-container", "image-manager-container");
		this.modalEl.addClass("mod-image-picker");
		this.titleEl.setText("选择图片");
		this.setupLayout();
		void this.loadImages();
		this.modalEl.ownerDocument.defaultView?.requestAnimationFrame(() => {
			const activeElement = this.modalEl.ownerDocument.activeElement;
			if (activeElement instanceof HTMLElement) activeElement.blur();
		});
	}

	private setupLayout(): void {
		this.toolbar = new ImagePickerToolbar(this.contentEl, this.iconService, {
			onSelectView: (id) => this.selectView(id),
			onSearchChange: (query) => {
				this.searchQuery = query;
				this.updateQueryResult();
			},
			onToggleMultiSelect: () => this.setMultiSelectMode(!this.isMultiSelectMode),
			onInsertSelected: () => { void this.handleGridInsert(); },
		}, this.getToolbarState());
		this.optionsContainer = this.contentEl.createDiv("bases-search-row image-picker-options");
		this.renderOptionsPanel();
		this.gridContainer = this.contentEl.createDiv("image-manager-grid-panel afm-manager-view");
		this.gridStateEl = this.gridContainer.createDiv("image-manager-grid-state");
		this.gridEl = this.gridContainer.createDiv("image-manager-grid afm-manager-cards-container");
		this.mediaLoader = new ViewportMediaLoader(this.gridEl);
		this.createViewport();
	}

	private createViewport(): void {
		this.viewport?.destroy();
		this.gridEl.empty();
		const common = {
			viewportEl: this.gridContainer,
			gridEl: this.gridEl,
			getKey: (image: ImageItem): string => image.path,
			create: (image: ImageItem): PickerImageController => this.createImageController(image),
			update: (controller: PickerImageController, image: ImageItem): void => {
				controller.item = image;
				controller.element.toggleClass(
					"image-manager-item-selected",
					this.isMultiSelectMode && this.selectedImages.has(image.path),
				);
			},
			onVisibleChange: (controllers: readonly PickerImageController[]): void => {
				this.mediaLoader?.sync(controllers);
			},
			minimumItemWidth: this.cardSize,
			minimumColumns: 6,
			gap: 12,
			padding: 12,
			maxDetachedItems: 20,
		};
		this.viewport = this.layoutMode === "masonry"
			? new ViewportMasonry({
				...common,
				getEstimatedHeight: (_image: ImageItem, width: number, aspectRatio: number): number => {
					const details = this.cardProperties.filter((property) =>
						property !== "extension" && property !== "references").length;
					return width / aspectRatio + (details > 0 ? details * 24 + 16 : 0);
				},
				overscanPixels: this.gridContainer.clientHeight,
			})
			: new ViewportGrid({ ...common, estimatedItemHeight: 246, overscanRows: 3 });
		this.renderedLayoutMode = this.layoutMode;
		this.viewport.setItems(this.filteredImages);
	}

	private getToolbarState() {
		return {
			views: this.views,
			activeViewId: this.activeViewId,
			resultCount: this.filteredImages.length,
			totalCount: this.images.length,
			searchQuery: this.searchQuery,
			isMultiSelect: this.isMultiSelectMode,
			selectedCount: this.selectedImages.size,
			selectionActionLabel: this.action.kind === "select" ? "选择" : "插入",
			selectionActionAriaLabel: this.action.kind === "select" ? "确认选择附件" : "插入选中附件",
		};
	}

	private selectView(id: string): void {
		if (!this.views.some((view) => view.id === id)) return;
		const previousMappings = JSON.stringify(this.getActiveView().mappings ?? []);
		this.activeViewId = id;
		this.applyViewState();
		this.viewport?.setItems([]);
		this.setMultiSelectMode(this.action.kind === "select" && this.action.multiple);
		if (previousMappings !== JSON.stringify(this.getActiveView().mappings ?? [])) void this.loadImages();
		else this.updateQueryResult();
	}

	private applyViewState(): void {
		const view = this.getActiveView();
		this.cardProperties = orderProperties(view.properties ?? ["name", "size", "mtime"]);
		this.sortRules = (view.sort ?? [{ field: "mtime", order: "desc" }]).map((rule) => ({ ...rule }));
		this.layoutMode = view.layout === "masonry" ? "masonry" : "grid";
		this.imageLoader.setCustomFileTypes(view.mappings ?? []);
		this.contentEl?.toggleClass("afm-manager-no-svg-invert", view.invertSvgInDarkMode === false);
		if (this.viewport && this.renderedLayoutMode !== this.layoutMode) this.createViewport();
		else this.viewport?.setMinimumItemWidth(this.cardSize);
	}

	private getActiveView(): ImageFilterPreset {
		return this.views.find((view) => view.id === this.activeViewId) ?? this.views[0];
	}

	private renderOptionsPanel(): void {
		this.optionsContainer.empty();
		const hidden = this.action.kind === "select" || this.isMultiSelectMode;
		this.optionsContainer.toggleClass("is-hidden", hidden);
		if (hidden) return;
		const positionGroup = this.optionsContainer.createDiv("option-group mod-position");
		positionGroup.createSpan({ text: "位置:", cls: "option-label" });
		new DropdownComponent(positionGroup)
			.addOption("center", "居中")
			.addOption("align-left", "左对齐")
			.addOption("align-right", "右对齐")
			.addOption("left", "左侧环绕")
			.addOption("right", "右侧环绕")
			.addOption("inline", "行间")
			.setValue(this.imagePosition)
			.onChange((value) => { this.imagePosition = value as ImagePosition; });
		const invertGroup = this.optionsContainer.createDiv("option-group mod-invert");
		invertGroup.createSpan({ text: "反色:", cls: "option-label" });
		new ToggleComponent(invertGroup.createDiv("option-toggle"))
			.setValue(this.invertColor)
			.onChange((value) => { this.invertColor = value; });
		const captionGroup = this.optionsContainer.createDiv("option-group mod-caption");
		captionGroup.createSpan({ text: "标题:", cls: "option-label" });
		new TextComponent(captionGroup)
			.setPlaceholder("输入图片标题 (可选)")
			.setValue(this.imageCaption)
			.onChange((value) => { this.imageCaption = value; });
	}

	private async loadImages(): Promise<void> {
		if (this.isLoading) {
			this.loadPending = true;
			return;
		}
		this.isLoading = true;
		this.renderGrid();
		try {
			this.images = await this.imageLoader.loadImagesTimeSliced("");
			if (this.isClosed) return;
			this.images = await this.referenceChecker.checkReferences(this.images);
			if (this.isClosed) return;
			this.updateQueryResult();
		} catch (error) {
			new Notice(`加载附件失败: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			this.isLoading = false;
			if (!this.isClosed) {
				this.renderGrid();
				if (this.loadPending) {
					this.loadPending = false;
					void this.loadImages();
				}
			}
		}
	}

	private updateQueryResult(): void {
		const view = this.getActiveView();
		this.filteredImages = filterAndSortImages(this.images, {
			query: this.searchQuery,
			unreferencedOnly: view.unreferencedOnly === true,
			filter: view,
			sortField: this.sortRules[0]?.field ?? "name",
			sortOrder: this.sortRules[0]?.order ?? "asc",
			sortRules: this.sortRules,
		});
		this.toolbar?.update(this.getToolbarState());
		this.renderGrid();
	}

	private renderGrid(): void {
		if (!this.viewport) return;
		this.gridStateEl.empty();
		if (this.isLoading) {
			this.gridEl.hide();
			this.viewport.setItems([]);
			const loading = this.gridStateEl.createDiv("image-manager-loading-state");
			loading.createDiv("image-manager-loading-spinner");
			loading.createSpan({ text: "正在加载附件..." });
			return;
		}
		if (this.filteredImages.length === 0) {
			this.gridEl.hide();
			this.viewport.setItems([]);
			this.gridStateEl.createDiv({
				cls: "image-manager-empty-state",
				text: this.images.length === 0 ? "没有找到附件" : "没有符合条件的附件",
			});
			return;
		}
		this.gridEl.show();
		this.viewport.setItems(this.filteredImages);
	}

	private createImageController(image: ImageItem): PickerImageController {
		let controller: PickerImageController;
		const { element, imageEl } = createImagePickerCard(
			this.app,
			this.modalEl.ownerDocument,
			image,
			this.cardProperties,
			this.isMultiSelectMode && this.selectedImages.has(image.path),
			(card) => {
				const current = controller.item;
				if (!this.isMultiSelectMode) {
					void this.handleSingle(current);
					return;
				}
				if (this.selectedImages.has(current.path)) this.selectedImages.delete(current.path);
				else this.selectedImages.add(current.path);
				card.toggleClass("image-manager-item-selected", this.selectedImages.has(current.path));
				this.toolbar?.update(this.getToolbarState());
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
				imageEl.onload = () => {
					imageEl.addClass("is-loaded");
					if (this.viewport instanceof ViewportMasonry && imageEl.naturalHeight > 0) {
						this.viewport.setItemAspectRatio(controller.item.path, imageEl.naturalWidth / imageEl.naturalHeight);
					}
				};
				this.thumbnailService.load(imageEl, source, controller.item.displayFile.extension.toLowerCase());
				delete imageEl.dataset.src;
			},
		};
		return controller;
	}

	private setMultiSelectMode(enabled: boolean): void {
		this.isMultiSelectMode = enabled;
		if (!enabled) this.selectedImages.clear();
		this.contentEl.toggleClass("is-multi-select", enabled);
		this.renderOptionsPanel();
		this.toolbar?.update(this.getToolbarState());
		this.viewport?.refreshVisible();
	}

	private async handleSingle(image: ImageItem): Promise<void> {
		const file = image.isCustomType ? image.displayFile : image.originalFile;
		if (this.action.kind === "select") {
			await this.commitSelection([file.path]);
			return;
		}
		const link = buildImageLink(this.app.metadataCache, file, this.action.sourcePath, {
			position: this.imagePosition,
			dark: this.invertColor,
			caption: this.imageCaption,
		});
		this.action.editor.replaceSelection(link);
		this.close();
	}

	private async handleGridInsert(): Promise<void> {
		if (this.selectedImages.size === 0) return;
		const files = Array.from(this.selectedImages)
			.map((path) => this.images.find((image) => image.path === path))
			.filter((image): image is ImageItem => Boolean(image))
			.map((image) => image.isCustomType ? image.displayFile : image.originalFile);
		if (this.action.kind === "select") {
			await this.commitSelection(files.map((file) => file.path));
			return;
		}
		const { editor, sourcePath } = this.action;
		const links = files
			.map((file) => `![[${this.app.metadataCache.fileToLinktext(file, sourcePath)}]]`)
			.join("\n");
		editor.replaceSelection(`> [!grid]\n> ${links.split("\n").join("\n> ")}`);
		this.close();
	}

	private async commitSelection(paths: string[]): Promise<void> {
		if (this.action.kind !== "select" || paths.length === 0) return;
		try {
			await this.action.onSelect(paths);
			if (!this.isClosed) this.close();
		} catch (error) {
			if (!this.isClosed) {
				new Notice(`处理所选图片失败: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	onClose(): void {
		this.isClosed = true;
		this.toolbar?.destroy();
		this.toolbar = null;
		this.viewport?.destroy();
		this.viewport = null;
		this.mediaLoader?.destroy();
		this.mediaLoader = null;
		this.thumbnailService.destroy();
		this.contentEl.empty();
	}
}

function cloneView(view: ImageFilterPreset): ImageFilterPreset {
	return JSON.parse(JSON.stringify(view)) as ImageFilterPreset;
}

function createFallbackView(settings: ImageManagerSettings): ImageFilterPreset {
	return {
		id: "picker-default",
		name: "视图",
		icon: "layout-grid",
		cardSize: 200,
		layout: "grid",
		invertSvgInDarkMode: settings.invertSvgInDarkMode !== false,
		properties: settings.allViewProperties ?? ["name", "size", "mtime"],
		sort: settings.allViewSort ?? [{ field: "mtime", order: "desc" }],
		filter: { id: "picker-filter", match: "all", children: [] },
		mappings: [],
	};
}

function orderProperties(properties: readonly ImageCardProperty[]): ImageCardProperty[] {
	const selected = new Set(properties);
	return IMAGE_CARD_PROPERTY_ORDER.filter((property) => selected.has(property));
}
