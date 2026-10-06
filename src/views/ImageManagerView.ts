import { ItemView, Menu, Notice, TFile, WorkspaceLeaf } from "obsidian";
import {
	CustomFileTypeConfig,
	IMAGE_CARD_PROPERTY_ORDER,
	ImageCardProperty,
	ImageFilterField,
	ImageFilterGroup,
	ImageFilterPreset,
	ImageFilterRule,
	ImageGroupBy,
	ImageGroupField,
	ImageItem,
	ImageManagerLayout,
	ImageManagerSettings,
	ImageSortRule,
} from "../types/image-manager.types";
import { ImageLoaderService } from "../services/ImageLoaderService";
import { ReferenceCheckService } from "../services/ReferenceCheckService";
import { FileOperationService } from "../services/FileOperationService";
import { RenameModal } from "./RenameModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { BatchDeleteConfirmModal } from "./BatchDeleteConfirmModal";
import { FolderPickerModal } from "./FolderPickerModal";
import { ViewportGrid, ViewportGridController } from "../components/ViewportGrid";
import { ViewportMasonry } from "../components/ViewportMasonry";
import { GroupedImageViewport } from "../components/GroupedImageViewport";
import { ViewportMediaController, ViewportMediaLoader } from "../components/ViewportMediaLoader";
import { ImageCatalogService } from "../services/ImageCatalogService";
import {
	createImageManagerCard,
	updateImageManagerReferenceBadge,
	updateImageManagerSelectionState,
} from "../components/ImageManagerCard";
import { filterAndSortImages, filterImages } from "../utils/imageCollection";
import { collectImageGroups, getGroupFieldLabel, orderImageGroups } from "../utils/imageGrouping";
import { ImageManagerToolbar, ImageManagerToolbarState } from "../components/ImageManagerToolbar";
import { ImageThumbnailService } from "../services/ImageThumbnailService";
import { ImageClipboardService } from "../services/ImageClipboardService";
import { ViewIconService } from "../services/ViewIconService";

interface ManagerImageController extends ViewportGridController<ImageItem>, ViewportMediaController {
	closeMenus: () => void;
	dispose: () => void;
}

export const IMAGE_MANAGER_VIEW_TYPE = "image-manager-view";

export interface ImageManagerVaultChange {
	type: "create" | "modify" | "delete" | "rename";
	file: TFile;
	oldPath?: string;
}

export class ImageManagerView extends ItemView {
	private settings: ImageManagerSettings;
	private selectedFolder: string;
	private images: ImageItem[] = [];
	private filteredImages: ImageItem[] = [];
	private filterPresets: ImageFilterPreset[];
	private activeFilterId: string;
	private searchQuery = "";
	private sortRules: ImageSortRule[];
	private groupBy: ImageGroupBy | undefined;
	private groupOrder: string[] | undefined;
	private readonly collapsedGroups = new Set<string>();
	private cardProperties: ImageCardProperty[];
	private cardSize = 200;
	private invertSvgInDarkMode = true;
	private currentMappings: CustomFileTypeConfig[] = [];
	private layoutMode: ImageManagerLayout = "grid";
	private renderedLayoutMode: ImageManagerLayout | null = null;
	private renderedGroupField: ImageGroupField | null = null;
	private viewFilter: ImageFilterGroup;
	private showUnreferencedOnly: boolean;
	private isLoading = false;
	private isCheckingReferences = false;
	private referenceCheckPending = false;
	private referenceGeneration = 0;
	private refreshPending = false;
	private isClosed = false;
	private isMultiSelectMode = false;
	private readonly selectedImages = new Set<string>();
	private readonly imageLoader: ImageLoaderService;
	private readonly referenceChecker: ReferenceCheckService;
	private readonly fileOperations: FileOperationService;
	private readonly thumbnailService = new ImageThumbnailService();
	private readonly clipboardService = new ImageClipboardService(this.app);
	private toolbar: ImageManagerToolbar | null = null;
	private gridContainer!: HTMLElement;
	private gridEl!: HTMLElement;
	private gridStateEl!: HTMLElement;
	private viewportGrid: ViewportGrid<ImageItem, ManagerImageController> | ViewportMasonry<ImageItem, ManagerImageController> | GroupedImageViewport<ManagerImageController> | null = null;
	private mediaLoader: ViewportMediaLoader<ManagerImageController> | null = null;
	private visibleControllers: readonly ManagerImageController[] = [];
	private migratedLegacyFolder = false;
	private filterPersistTimer: number | null = null;
	private pendingScrollRatio: number | null = null;
	private referenceMenu: Menu | null = null;
	private referenceMenuAnchor: HTMLElement | null = null;
	private lastClosedReferenceAnchor: HTMLElement | null = null;
	private lastReferenceMenuCloseTime = 0;

	constructor(
		leaf: WorkspaceLeaf,
		settings: ImageManagerSettings,
		private readonly persistManagerSettings: (patch: Partial<ImageManagerSettings>) => Promise<void>,
		private readonly openImageViewer: (sourceImage: HTMLImageElement) => void,
		private readonly viewIconService: ViewIconService,
		imageCatalog: ImageCatalogService,
		referenceChecker: ReferenceCheckService,
	) {
		super(leaf);
		this.settings = settings;
		this.selectedFolder = settings.lastSelectedFolder ?? settings.folderPath ?? "";
		this.filterPresets = cloneFilters(settings.filterPresets ?? []);
		if (this.filterPresets.length === 0) this.filterPresets.push(createInitialView(settings));
		const activeFilterId = settings.activeFilterId;
		this.activeFilterId = activeFilterId && this.filterPresets.some((view) => view.id === activeFilterId)
			? activeFilterId
			: this.filterPresets[0].id;
		this.sortRules = (settings.allViewSort ?? [{ field: "mtime", order: "desc" }]).map((rule) => ({ ...rule }));
		this.groupBy = undefined;
		this.groupOrder = undefined;
		this.cardProperties = orderCardProperties(settings.allViewProperties ?? ["name", "size", "mtime"]);
		this.viewFilter = createLegacyFilterGroup(
			"active-filter",
			settings.allViewFilterMatch ?? "all",
			settings.allViewFilterRules ?? [],
		);
		this.showUnreferencedOnly = settings.allViewUnreferencedOnly === true;
		this.imageLoader = new ImageLoaderService(this.app, imageCatalog);
		this.referenceChecker = referenceChecker;
		this.fileOperations = new FileOperationService(this.app);
		this.migrateLegacyFolderFilter();
		this.applyActiveViewState();
	}

	getViewType(): string {
		return IMAGE_MANAGER_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "附件管理";
	}

	getIcon(): string {
		return "images";
	}

	getEphemeralState(): Record<string, unknown> {
		const container = this.gridContainer;
		const scroll = container?.scrollHeight > 0 ? container.scrollTop / container.scrollHeight : 0;
		return { scroll };
	}

	setEphemeralState(state: unknown): void {
		if (!state || typeof state !== "object" || !("scroll" in state)) return;
		const scroll = (state as { scroll?: unknown }).scroll;
		if (typeof scroll !== "number" || !Number.isFinite(scroll)) return;
		this.pendingScrollRatio = Math.min(1, Math.max(0, scroll));
		this.restorePendingScroll();
	}

	async onOpen(): Promise<void> {
		this.isClosed = false;
		this.contentEl.empty();
		this.contentEl.addClass("image-manager-container", "afm-manager-root");
		this.contentEl.toggleClass("is-multi-select", this.isMultiSelectMode);
		this.applyViewAppearance();
		this.setupLayout();
		if (this.migratedLegacyFolder) {
			await this.persistManagerSettings({
				lastSelectedFolder: "",
				filterPresets: cloneFilters(this.filterPresets),
				activeFilterId: this.activeFilterId,
			});
		}
		await this.loadImages();
	}

	onClose(): Promise<void> {
		this.isClosed = true;
		this.referenceGeneration += 1;
		if (this.filterPersistTimer !== null) {
			this.contentEl.ownerDocument.defaultView?.clearTimeout(this.filterPersistTimer);
			this.filterPersistTimer = null;
			void this.persistFilters();
		}
		this.toolbar?.destroy();
		this.toolbar = null;
		this.viewportGrid?.destroy();
		this.viewportGrid = null;
		this.mediaLoader?.destroy();
		this.mediaLoader = null;
		this.gridContainer?.removeEventListener("scroll", this.handleViewScroll);
		this.visibleControllers = [];
		this.thumbnailService.destroy();
		this.referenceMenu?.close();
		this.referenceMenu = null;
		this.referenceMenuAnchor = null;
		this.contentEl.empty();
		return Promise.resolve();
	}

	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
		this.filterPresets = cloneFilters(settings.filterPresets ?? []);
		if (this.filterPresets.length === 0) this.filterPresets.push(createInitialView(settings));
		const activeFilterId = settings.activeFilterId;
		this.activeFilterId = activeFilterId && this.filterPresets.some((view) => view.id === activeFilterId)
			? activeFilterId
			: this.filterPresets[0].id;
		this.applyActiveViewState();
		void this.loadImages();
	}

	private setupLayout(): void {
		this.toolbar = new ImageManagerToolbar(this.app, this.contentEl, this.viewIconService, {
			onCreateFilter: () => this.createFilter(),
			onSelectFilter: (id) => this.selectFilter(id),
			onSaveFilter: (filter) => this.saveFilter(filter),
			onDuplicateFilter: (id) => this.duplicateFilter(id),
			onDeleteFilter: (id) => this.deleteFilter(id),
			onReorderFilters: (ids) => this.reorderFilters(ids),
			onSortChange: (rules) => {
				this.sortRules = rules;
				this.persistCurrentViewState();
				if (rules.some((rule) => rule.field === "references") && this.images.some((image) => image.references === undefined)) {
					void this.checkReferences(false);
				}
				this.updateQueryResult();
			},
			onGroupChange: (groupBy, groupOrder) => this.updateGrouping(groupBy, groupOrder),
			onGroupOrderChange: (order) => this.updateGrouping(this.groupBy, order),
			getAllGroups: () => this.getAllGroups(),
			onSearchChange: (query) => {
				this.searchQuery = query;
				this.updateQueryResult();
			},
			onPropertiesChange: (properties) => {
				this.cardProperties = orderCardProperties(properties);
				this.persistCurrentViewState();
				this.renderToolbar();
				this.viewportGrid?.setItems([]);
				this.renderGrid();
			},
			onToggleUnreferenced: () => {
				this.showUnreferencedOnly = !this.showUnreferencedOnly;
				this.persistCurrentViewState();
				if (this.showUnreferencedOnly && this.images.some((image) => image.references === undefined)) {
					void this.checkReferences(false);
				}
				this.updateQueryResult();
			},
			onToggleMultiSelect: () => this.toggleMultiSelect(),
			onMoveSelected: () => this.handleBatchMoveSelected(),
			onDeleteSelected: () => this.handleBatchDeleteSelected(),
			onMappingsChange: (mappings) => {
				this.currentMappings = mappings.map((mapping) => ({ ...mapping }));
				const view = this.getActiveFilter();
				if (view) view.mappings = this.currentMappings.map((mapping) => ({ ...mapping }));
				this.imageLoader.setCustomFileTypes(this.currentMappings);
				this.scheduleFilterPersistence();
				this.renderToolbar();
				void this.loadImages();
			},
		}, this.getToolbarState());

		this.gridContainer = this.contentEl.createDiv("image-manager-grid-panel afm-manager-view");
		this.gridContainer.addEventListener("scroll", this.handleViewScroll, { passive: true });
		this.gridStateEl = this.gridContainer.createDiv("image-manager-grid-state");
		this.gridEl = this.gridContainer.createDiv("image-manager-grid afm-manager-cards-container");
		this.mediaLoader = new ViewportMediaLoader(this.gridEl);
		this.createViewportLayout();
	}

	private createViewportLayout(): void {
		this.viewportGrid?.destroy();
		this.visibleControllers = [];
		this.gridEl.empty();
		const commonOptions = {
			viewportEl: this.gridContainer,
			gridEl: this.gridEl,
			getKey: (image: ImageItem): string => image.path,
			shouldReuse: (previous: ImageItem, next: ImageItem): boolean =>
				previous.originalFile === next.originalFile &&
				previous.displayFile === next.displayFile &&
				previous.stat.ctime === next.stat.ctime &&
				previous.stat.mtime === next.stat.mtime &&
				previous.stat.size === next.stat.size &&
				previous.name === next.name &&
				(!this.cardProperties.includes("references") || previous.referenceCount === next.referenceCount),
			create: (image: ImageItem): ManagerImageController => this.createImageController(image),
			dispose: (controller: ManagerImageController): void => controller.dispose(),
			update: (controller: ManagerImageController, image: ImageItem): void => {
				controller.item = image;
				updateImageManagerSelectionState(
					controller.element,
					this.isMultiSelectMode && this.selectedImages.has(image.path),
				);
				updateImageManagerReferenceBadge(
					controller.element,
					image,
					(anchor) => this.openReferenceMenu(controller.item, anchor),
				);
			},
			onVisibleChange: (controllers: readonly ManagerImageController[]): void => {
				this.visibleControllers = controllers;
				this.mediaLoader?.sync(controllers);
			},
			minimumItemWidth: this.cardSize,
			gap: 12,
			padding: 12,
			maxDetachedItems: 20,
		};
		const detailCount = this.cardProperties.filter((property) =>
			property !== "extension" && property !== "references").length;
		const estimatedHeight = (_image: ImageItem, width: number, aspectRatio: number): number => {
			return width / aspectRatio + (detailCount > 0 ? detailCount * 24 + 16 : 0);
		};
		this.viewportGrid = this.groupBy
			? new GroupedImageViewport({
				viewportEl: this.gridContainer,
				rootEl: this.gridEl,
				layout: this.layoutMode,
				groupPropertyLabel: getGroupFieldLabel(this.groupBy.field),
				minimumItemWidth: this.cardSize,
				estimatedGridItemHeight: 174 + detailCount * 24,
				getGroups: (items) => orderImageGroups(
					collectImageGroups(items, this.groupBy!.field), this.groupBy!, this.groupOrder,
				),
				isCollapsed: (key) => this.collapsedGroups.has(key),
				onToggleGroup: (key) => this.toggleGroup(key),
				create: commonOptions.create,
				update: commonOptions.update,
				dispose: commonOptions.dispose,
				shouldReuse: commonOptions.shouldReuse,
				onVisibleChange: commonOptions.onVisibleChange,
				getEstimatedHeight: estimatedHeight,
			})
			: this.layoutMode === "masonry"
			? new ViewportMasonry({
				...commonOptions,
				getEstimatedHeight: estimatedHeight,
				overscanPixels: this.gridContainer.clientHeight,
			})
			: new ViewportGrid({
				...commonOptions,
				estimatedItemHeight: 246,
				overscanRows: 3,
			});
		this.renderedLayoutMode = this.layoutMode;
		this.renderedGroupField = this.groupBy?.field ?? null;
		this.viewportGrid.setItems(this.filteredImages);
	}

	private migrateLegacyFolderFilter(): void {
		if (!this.selectedFolder) return;
		const existing = this.filterPresets.find((filter) =>
			filterContainsRule(filter.filter, (rule) =>
				rule.field === "folder" && rule.value === this.selectedFolder),
		);
		if (existing) {
			this.activeFilterId = existing.id;
		} else {
			const id = `folder-${Date.now().toString(36)}`;
			this.filterPresets.push({
				id,
				name: this.selectedFolder.split("/").pop() || "文件夹",
				filter: createLegacyFilterGroup(`${id}-filter`, "all", [{
					id: `${id}-rule`, field: "folder", operator: "starts-with", value: this.selectedFolder,
				}]),
			});
			this.activeFilterId = id;
		}
		this.selectedFolder = "";
		this.migratedLegacyFolder = true;
	}

	private getToolbarState(): ImageManagerToolbarState {
		const groups = this.groupBy ? collectImageGroups(this.filteredImages, this.groupBy.field) : [];
		const visibleCount = this.groupBy
			? orderImageGroups(groups, this.groupBy, this.groupOrder).reduce((count, group) => count + group.items.length, 0)
			: this.filteredImages.length;
		return {
			filters: this.filterPresets,
			activeFilterId: this.activeFilterId,
			resultCount: visibleCount,
			totalCount: this.images.length,
			sortRules: this.sortRules,
			groupBy: this.groupBy,
			groupOrder: this.groupOrder,
			searchQuery: this.searchQuery,
			properties: this.cardProperties,
			unreferencedOnly: this.showUnreferencedOnly,
			isMultiSelect: this.isMultiSelectMode,
			selectedCount: this.selectedImages.size,
			mappings: this.currentMappings,
		};
	}

	private renderToolbar(): void {
		this.toolbar?.update(this.getToolbarState());
	}

	private getAllGroups(): ReturnType<typeof collectImageGroups> {
		if (!this.groupBy) return [];
		const images = filterImages(this.images, {
			query: "",
			unreferencedOnly: this.showUnreferencedOnly,
			filter: { id: this.activeFilterId, name: "", filter: this.viewFilter },
		});
		return collectImageGroups(images, this.groupBy.field);
	}

	private updateGrouping(groupBy: ImageGroupBy | undefined, groupOrder?: string[]): void {
		const previousField = this.groupBy?.field;
		this.groupBy = groupBy ? { ...groupBy } : undefined;
		this.groupOrder = groupBy && groupOrder !== undefined ? [...groupOrder] : undefined;
		if (previousField !== groupBy?.field) this.collapsedGroups.clear();
		this.persistCurrentViewState();
		if (groupBy?.field === "references" && this.images.some((image) => image.references === undefined)) {
			void this.checkReferences(false);
		}
		this.applyViewAppearance();
		this.renderToolbar();
		this.renderGrid();
	}

	private toggleGroup(key: string): void {
		if (this.collapsedGroups.has(key)) this.collapsedGroups.delete(key);
		else this.collapsedGroups.add(key);
		const view = this.getActiveFilter();
		if (view) view.collapsedGroups = Array.from(this.collapsedGroups);
		this.scheduleFilterPersistence();
		this.viewportGrid?.setItems(this.filteredImages);
	}

	refreshIcons(): void {
		this.toolbar?.refreshIcons();
	}

	private selectFilter(id: string): void {
		if (!this.filterPresets.some((filter) => filter.id === id)) return;
		const previousMappings = getMappingsSignature(this.currentMappings);
		this.activeFilterId = id;
		this.applyActiveViewState();
		this.viewportGrid?.setItems([]);
		void this.persistManagerSettings({ activeFilterId: id });
		if (filterUsesField(this.getActiveFilter()?.filter, "references") || this.groupBy?.field === "references") {
			void this.checkReferences(false);
		}
		this.refreshAfterViewChange(previousMappings);
	}

	private createFilter(): string {
		const previousMappings = getMappingsSignature(this.currentMappings);
		const filter: ImageFilterPreset = {
			id: createViewId(),
			name: createUniqueViewName(this.filterPresets, "视图"),
			icon: "layout-grid",
			cardSize: 200,
			invertSvgInDarkMode: true,
			mappings: [],
			layout: "grid",
			filter: createLegacyFilterGroup(createRuleId(), "all", []),
			properties: [...this.cardProperties],
			sort: this.sortRules.map((rule) => ({ ...rule })),
			unreferencedOnly: false,
		};
		this.filterPresets.push(filter);
		this.activeFilterId = filter.id;
		this.applyActiveViewState();
		this.viewportGrid?.setItems([]);
		this.scheduleFilterPersistence();
		this.refreshAfterViewChange(previousMappings);
		return filter.id;
	}

	private saveFilter(filter: ImageFilterPreset): void {
		const index = this.filterPresets.findIndex((candidate) => candidate.id === filter.id);
		const previous = this.filterPresets[index];
		const filterChanged = !previous || !filterGroupsEqual(previous.filter, filter.filter);
		const cardSizeChanged = (previous?.cardSize ?? 200) !== (filter.cardSize ?? 200);
		const invertChanged = (previous?.invertSvgInDarkMode !== false) !== (filter.invertSvgInDarkMode !== false);
		const layoutChanged = (previous?.layout ?? "grid") !== (filter.layout ?? "grid");
		const savedFilter = cloneFilter(filter);
		if (index >= 0) this.filterPresets[index] = savedFilter;
		else this.filterPresets.push(savedFilter);
		this.scheduleFilterPersistence();
		if (filter.id !== this.activeFilterId) {
			this.renderToolbar();
			return;
		}
		if (cardSizeChanged) this.cardSize = filter.cardSize ?? 200;
		if (invertChanged) this.invertSvgInDarkMode = filter.invertSvgInDarkMode !== false;
		if (layoutChanged) this.layoutMode = filter.layout === "masonry" ? "masonry" : "grid";
		if (cardSizeChanged || invertChanged || layoutChanged) this.applyViewAppearance();
		if (!filterChanged) {
			this.renderToolbar();
			return;
		}
		this.viewFilter = cloneFilterGroup(filter.filter ?? createLegacyFilterGroup(createRuleId(), "all", []));
		if (filterUsesField(this.viewFilter, "references")) void this.checkReferences(false);
		this.updateQueryResult();
	}

	private duplicateFilter(id: string): string | null {
		const index = this.filterPresets.findIndex((filter) => filter.id === id);
		const source = this.filterPresets[index];
		if (!source) return null;
		const previousMappings = getMappingsSignature(this.currentMappings);
		const duplicate: ImageFilterPreset = {
			...cloneFilter(source),
			id: createViewId(),
			name: createUniqueViewName(this.filterPresets, source.name),
			filter: source.filter ? cloneFilterGroupWithNewIds(source.filter) : createLegacyFilterGroup(createRuleId(), "all", []),
		};
		this.filterPresets.splice(index + 1, 0, duplicate);
		this.activeFilterId = duplicate.id;
		this.applyActiveViewState();
		this.viewportGrid?.setItems([]);
		this.scheduleFilterPersistence();
		this.refreshAfterViewChange(previousMappings);
		return duplicate.id;
	}

	private deleteFilter(id: string): void {
		const index = this.filterPresets.findIndex((filter) => filter.id === id);
		if (index < 0) return;
		const previousMappings = getMappingsSignature(this.currentMappings);
		this.filterPresets.splice(index, 1);
		if (this.filterPresets.length === 0) this.filterPresets.push(createInitialView(this.settings));
		const nextIndex = Math.min(Math.max(index - 1, 0), this.filterPresets.length - 1);
		this.activeFilterId = this.filterPresets[nextIndex].id;
		this.applyActiveViewState();
		this.viewportGrid?.setItems([]);
		this.scheduleFilterPersistence();
		this.refreshAfterViewChange(previousMappings);
	}

	private reorderFilters(ids: readonly string[]): void {
		if (ids.length !== this.filterPresets.length) return;
		const filtersById = new Map(this.filterPresets.map((filter) => [filter.id, filter]));
		const reordered = ids.map((id) => filtersById.get(id)).filter((filter): filter is ImageFilterPreset => Boolean(filter));
		if (reordered.length !== this.filterPresets.length) return;
		this.filterPresets = reordered;
		this.scheduleFilterPersistence();
		this.renderToolbar();
	}

	private refreshAfterViewChange(previousMappings: string): void {
		if (previousMappings !== getMappingsSignature(this.currentMappings)) {
			this.renderToolbar();
			void this.loadImages();
			return;
		}
		this.updateQueryResult();
	}

	private getActiveFilter(): ImageFilterPreset | null {
		return this.filterPresets.find((filter) => filter.id === this.activeFilterId) ?? null;
	}

	private applyActiveViewState(): void {
		const view = this.getActiveFilter();
		this.cardProperties = orderCardProperties(
			view?.properties ?? this.settings.allViewProperties ?? ["name", "size", "mtime"],
		);
		this.sortRules = (view?.sort ?? this.settings.allViewSort ?? [{ field: "mtime", order: "desc" }])
			.map((rule) => ({ ...rule }));
		this.groupBy = view?.groupBy ? { ...view.groupBy } : undefined;
		this.groupOrder = view?.groupOrder !== undefined ? [...view.groupOrder] : undefined;
		this.collapsedGroups.clear();
		for (const key of view?.collapsedGroups ?? []) this.collapsedGroups.add(key);
		this.cardSize = view?.cardSize ?? 200;
		this.invertSvgInDarkMode = view?.invertSvgInDarkMode ?? (this.settings.invertSvgInDarkMode !== false);
		this.currentMappings = (view?.mappings ?? []).map((mapping) => ({ ...mapping }));
		this.imageLoader.setCustomFileTypes(this.currentMappings);
		this.layoutMode = view?.layout === "masonry" ? "masonry" : "grid";
		this.viewFilter = cloneFilterGroup(view?.filter ?? createLegacyFilterGroup(
			"active-filter",
			this.settings.allViewFilterMatch ?? "all",
			this.settings.allViewFilterRules ?? [],
		));
		this.showUnreferencedOnly = view?.unreferencedOnly ?? this.settings.allViewUnreferencedOnly === true;
		this.applyViewAppearance();
	}

	private applyViewAppearance(): void {
		this.contentEl.toggleClass("afm-manager-no-svg-invert", !this.invertSvgInDarkMode);
		if (this.viewportGrid && (
			this.renderedLayoutMode !== this.layoutMode || this.renderedGroupField !== (this.groupBy?.field ?? null)
		)) {
			this.createViewportLayout();
			return;
		}
		this.viewportGrid?.setMinimumItemWidth(this.cardSize);
	}

	private persistCurrentViewState(): void {
		const view = this.getActiveFilter();
		if (!view) return;
		view.properties = [...this.cardProperties];
		view.sort = this.sortRules.map((rule) => ({ ...rule }));
		view.groupBy = this.groupBy ? { ...this.groupBy } : undefined;
		view.groupOrder = this.groupOrder ? [...this.groupOrder] : undefined;
		view.collapsedGroups = Array.from(this.collapsedGroups);
		view.filter = cloneFilterGroup(this.viewFilter);
		view.unreferencedOnly = this.showUnreferencedOnly;
		this.scheduleFilterPersistence();
	}

	private scheduleFilterPersistence(): void {
		if (this.filterPersistTimer !== null) {
			this.contentEl.ownerDocument.defaultView?.clearTimeout(this.filterPersistTimer);
		}
		const ownerWindow = this.contentEl.ownerDocument.defaultView ?? window;
		this.filterPersistTimer = ownerWindow.setTimeout(() => {
			this.filterPersistTimer = null;
			void this.persistFilters();
		}, 250);
	}

	private async persistFilters(): Promise<void> {
		await this.persistManagerSettings({
			filterPresets: cloneFilters(this.filterPresets),
			activeFilterId: this.activeFilterId,
		});
	}

	private toggleMultiSelect(): void {
		this.setMultiSelectMode(!this.isMultiSelectMode);
	}

	private setMultiSelectMode(enabled: boolean): void {
		this.isMultiSelectMode = enabled;
		if (!enabled) this.selectedImages.clear();
		this.contentEl.toggleClass("is-multi-select", enabled);
		this.renderToolbar();
		this.viewportGrid?.refreshVisible();
	}

	private updateQueryResult(): void {
		this.applyFilters();
		this.renderToolbar();
		this.renderGrid();
	}

	private renderGrid(): void {
		if (!this.viewportGrid) return;
		this.gridStateEl.empty();
		if (this.isLoading) {
			this.gridEl.hide();
			this.viewportGrid.setItems([]);
			const loading = this.gridStateEl.createDiv("image-manager-loading-state");
			loading.createDiv("image-manager-loading-spinner");
			loading.createSpan({ text: "正在加载附件..." });
			return;
		}
		if (this.groupBy && this.groupOrder?.length === 0) {
			this.gridEl.hide();
			this.viewportGrid.setItems([]);
			this.gridStateEl.createDiv({ cls: "image-manager-empty-state", text: "当前没有显示的分组" });
			return;
		}
		if (this.filteredImages.length === 0) {
			this.gridEl.hide();
			this.viewportGrid.setItems([]);
			const empty = this.gridStateEl.createDiv("image-manager-empty-state");
			empty.createSpan({ text: this.images.length === 0 ? "没有找到附件" : "没有符合条件的附件" });
			return;
		}
		this.gridEl.show();
		this.viewportGrid.setItems(this.filteredImages);
		this.restorePendingScroll();
	}

	private restorePendingScroll(): void {
		if (this.pendingScrollRatio === null || !this.gridContainer) return;
		const ratio = this.pendingScrollRatio;
		this.pendingScrollRatio = null;
		this.gridContainer.ownerDocument.defaultView?.requestAnimationFrame(() => {
			if (!this.gridContainer?.isConnected) return;
			this.gridContainer.scrollTop = this.gridContainer.scrollHeight * ratio;
		});
	}

	private createImageController(image: ImageItem): ManagerImageController {
		let controller: ManagerImageController;
		const { element, imageEl, closeMenus, dispose } = createImageManagerCard(
			this.app,
			this.contentEl.ownerDocument,
			image,
			this.cardProperties,
			{
				isSelected: (path) => this.selectedImages.has(path),
				isMultiSelect: () => this.isMultiSelectMode,
				onToggleSelection: (_item, card) => this.toggleSelection(controller.item, card),
				onPreview: (_item, sourceImage) => this.openImageViewer(sourceImage),
				onOpenReferences: (_item, anchor) => this.openReferenceMenu(controller.item, anchor),
				onOpen: () => this.fileOperations.openFile(controller.item),
				onRename: () => this.handleRename(controller.item),
				onCopyLink: () => void this.clipboardService.copyLink(controller.item, this.contentEl.ownerDocument),
				onCopyImage: () => void this.clipboardService.copyImage(controller.item, this.contentEl.ownerDocument),
				onMove: () => this.handleMove(controller.item),
				onDelete: () => void this.handleDelete(controller.item),
			},
		);
		controller = {
			element,
			item: image,
			closeMenus,
			dispose,
			hasPendingMedia: () => Boolean(imageEl?.dataset.src),
			loadMedia: () => {
				const source = imageEl?.dataset.src;
				if (!imageEl || !source) return;
				imageEl.onload = () => {
					imageEl.addClass("is-loaded");
					if ((this.viewportGrid instanceof ViewportMasonry || this.viewportGrid instanceof GroupedImageViewport) && imageEl.naturalHeight > 0) {
						this.viewportGrid.setItemAspectRatio(
							controller.item.path,
							imageEl.naturalWidth / imageEl.naturalHeight,
						);
					}
				};
				this.thumbnailService.load(imageEl, source, controller.item.displayFile.extension.toLowerCase());
				delete imageEl.dataset.src;
			},
		};
		return controller;
	}

	private readonly handleViewScroll = (): void => {
		this.referenceMenu?.close();
		for (const controller of this.visibleControllers) controller.closeMenus();
	};

	private toggleSelection(image: ImageItem, element: HTMLElement): void {
		if (this.selectedImages.has(image.path)) this.selectedImages.delete(image.path);
		else this.selectedImages.add(image.path);
		updateImageManagerSelectionState(element, this.selectedImages.has(image.path));
		this.renderToolbar();
	}

	private async loadImages(): Promise<void> {
		if (this.isClosed) return;
		if (this.isLoading) {
			this.refreshPending = true;
			return;
		}
		this.referenceGeneration += 1;
		const isInitialLoad = this.images.length === 0;
		this.isLoading = isInitialLoad;
		if (isInitialLoad) this.renderGrid();
		try {
			const previous = new Map(this.images.map((image) => [image.path, image]));
			const loadedImages = await this.imageLoader.loadImagesTimeSliced("");
			if (this.isClosed) return;
			this.images = loadedImages.map((image) => {
				const old = previous.get(image.path);
				if (
					!old ||
					old.originalFile !== image.originalFile ||
					old.displayFile !== image.displayFile
				) return image;
				return {
					...image,
					references: old.references,
					referenceCount: old.referenceCount,
				};
			});
			this.applyFilters();
			this.renderToolbar();
		} catch (error) {
			new Notice(`加载附件失败: ${error instanceof Error ? error.message : String(error)}`);
			console.error("Failed to load attachments", error);
		} finally {
			this.isLoading = false;
			if (!this.isClosed) {
				this.renderGrid();
				if (this.refreshPending) {
					this.refreshPending = false;
					queueMicrotask(() => { void this.loadImages(); });
				} else {
					void this.checkReferences(false);
				}
			}
		}
	}

	private async checkReferences(showProgress = true, force = false): Promise<void> {
		if (this.isClosed || this.images.length === 0) return;
		if (this.isCheckingReferences) {
			this.referenceCheckPending = true;
			return;
		}
		this.isCheckingReferences = true;
		const generation = this.referenceGeneration;
		const notice = showProgress ? new Notice(`正在检查引用... 0/${this.images.length}`, 0) : null;
		try {
			const checked = await this.referenceChecker.checkReferences(
				this.images,
				notice ? (current, total) => notice.setMessage(`正在检查引用... ${current}/${total}`) : undefined,
				force,
			);
			if (generation !== this.referenceGeneration || this.isClosed) return;
			this.images = checked;
			this.updateQueryResult();
			if (showProgress) new Notice(`引用检查完成: 已检查 ${checked.length} 个附件`);
		} catch (error) {
			if (showProgress) new Notice(`检查引用失败: ${error instanceof Error ? error.message : String(error)}`);
			console.error("Failed to check attachment references", error);
		} finally {
			notice?.hide();
			this.isCheckingReferences = false;
			if (this.referenceCheckPending && !this.isClosed) {
				this.referenceCheckPending = false;
				void this.checkReferences(false);
			}
		}
	}

	async refreshReferencePaths(paths?: ReadonlySet<string>): Promise<void> {
		if (this.isClosed || this.images.length === 0) return;
		const generation = this.referenceGeneration;
		const candidates = paths
			? this.images.filter((image) => paths.has(image.originalFile.path) || paths.has(image.displayFile.path))
			: this.images;
		if (candidates.length === 0) return;
		const checked = await this.referenceChecker.checkReferences(candidates);
		if (generation !== this.referenceGeneration || this.isClosed) return;
		const updates = new Map(checked.map((image) => [image.path, image]));
		this.images = this.images.map((image) => updates.get(image.path) ?? image);
		this.updateQueryResult();
	}

	private applyFilters(): void {
		this.filteredImages = filterAndSortImages(this.images, {
			query: this.searchQuery,
			unreferencedOnly: this.showUnreferencedOnly,
			filter: {
				id: this.activeFilterId,
				name: "",
				filter: this.viewFilter,
			},
			sortField: this.sortRules[0]?.field ?? "name",
			sortOrder: this.sortRules[0]?.order ?? "asc",
			sortRules: this.sortRules,
		});
	}

	private openReferenceMenu(image: ImageItem, anchor: HTMLElement): void {
		if (this.referenceMenu && this.referenceMenuAnchor === anchor) {
			this.referenceMenu.close();
			return;
		}
		if (
			this.lastClosedReferenceAnchor === anchor &&
			Date.now() - this.lastReferenceMenuCloseTime < 250
		) return;
		this.referenceMenu?.close();
		const menu = new Menu().setParentElement(anchor);
		this.referenceMenu = menu;
		this.referenceMenuAnchor = anchor;
		menu.onHide(() => {
			anchor.removeClass("has-active-menu");
			if (anchor.ownerDocument.activeElement === anchor) anchor.blur();
			if (this.referenceMenu !== menu) return;
			this.referenceMenu = null;
			this.referenceMenuAnchor = null;
			this.lastClosedReferenceAnchor = anchor;
			this.lastReferenceMenuCloseTime = Date.now();
		});
		const references = image.references ?? [];
		const grouped = new Map<string, typeof references>();
		for (const reference of references) {
			const items = grouped.get(reference.file.path) ?? [];
			items.push(reference);
			grouped.set(reference.file.path, items);
		}
		if (grouped.size === 0) {
			menu.addItem((item) => item
				.setTitle("没有引用笔记")
				.setIcon("file-x")
				.setDisabled(true));
		} else {
			for (const [path, items] of Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right))) {
				const reference = items[0];
				if (!reference) continue;
				menu.addItem((item) => item
					.setTitle(items.length > 1 ? `${reference.file.basename} (${items.length})` : reference.file.basename)
					.setIcon("file-text")
					.onClick(() => {
						void this.fileOperations.openReferenceFile(path, reference.position);
					}));
			}
		}
		const rect = anchor.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
	}

	private handleRename(image: ImageItem): void {
		new RenameModal(this.app, image, async (newName) => {
			const oldPath = image.path;
			const newPath = image.path.replace(/[^/]+$/, newName);
			await this.fileOperations.renameFile(image, newName);
			this.updateImageAfterRename(oldPath, newPath, newName);
			this.updateQueryResult();
		}).open();
	}

	private handleMove(image: ImageItem): void {
		new FolderPickerModal(this.app, (folder) => {
			void (async () => {
				try {
					const oldPath = image.path;
					const newPath = await this.fileOperations.moveFile(image, folder.path);
					if (!newPath) return;
					this.updateImageAfterRename(oldPath, newPath, newPath.split("/").pop() ?? image.name);
					this.updateQueryResult();
				} catch {
					// FileOperationService already reported the failure.
				}
			})();
		}).open();
	}

	private async handleDelete(image: ImageItem): Promise<void> {
		const remove = async (): Promise<void> => {
			await this.fileOperations.deleteFile(image);
			this.removeImageFromList(image);
		};
		new DeleteConfirmModal(
			this.app,
			image,
			this.fileOperations.getDeleteExtraMessage(image),
			remove,
		).open();
	}

	private updateImageAfterRename(oldPath: string, newPath: string, newName: string): void {
		this.images = this.images.map((image) => image.path === oldPath
			? { ...image, path: newPath, name: newName }
			: image);
		if (this.selectedImages.delete(oldPath)) this.selectedImages.add(newPath);
		this.referenceChecker.updateCacheKey(oldPath, newPath);
	}

	private removeImageFromList(image: ImageItem): void {
		this.images = this.images.filter((candidate) => candidate.path !== image.path);
		this.filteredImages = this.filteredImages.filter((candidate) => candidate.path !== image.path);
		this.selectedImages.delete(image.path);
		this.referenceChecker.removeCacheKey(image.path);
		this.updateQueryResult();
	}

	private handleBatchDeleteSelected(): void {
		if (this.selectedImages.size === 0) return;
		const selected = this.images.filter((image) => this.selectedImages.has(image.path));
		new BatchDeleteConfirmModal(this.app, selected, async (onProgress) => {
			await this.deleteImageBatch(selected, onProgress);
			this.setMultiSelectMode(false);
		}).open();
	}

	private handleBatchMoveSelected(): void {
		if (this.selectedImages.size === 0) return;
		const selected = this.images.filter((image) => this.selectedImages.has(image.path));
		new FolderPickerModal(this.app, (folder) => {
			void (async () => {
				let success = 0;
				let failed = 0;
				const notice = new Notice(`正在移动... 0/${selected.length}`, 0);
				for (const image of selected) {
					try {
						const oldPath = image.path;
						const newPath = await this.fileOperations.moveFile(image, folder.path, true);
						if (newPath) this.updateImageAfterRename(oldPath, newPath, newPath.split("/").pop() ?? image.name);
						success += 1;
					} catch {
						failed += 1;
					}
					notice.setMessage(`正在移动... ${success + failed}/${selected.length}`);
				}
				notice.hide();
				new Notice(failed === 0 ? `成功移动 ${success} 个附件` : `移动完成: 成功 ${success} 个, 失败 ${failed} 个`);
				this.setMultiSelectMode(false);
				this.updateQueryResult();
			})();
		}).open();
	}

	private removeImageFromMemory(image: ImageItem): void {
		this.images = this.images.filter((candidate) => candidate.path !== image.path);
		this.filteredImages = this.filteredImages.filter((candidate) => candidate.path !== image.path);
		this.selectedImages.delete(image.path);
		this.referenceChecker.removeCacheKey(image.path);
	}

	private async deleteImageBatch(
		images: ImageItem[],
		onProgress: (current: number, total: number) => void,
	): Promise<void> {
		let success = 0;
		let failed = 0;
		for (let offset = 0; offset < images.length; offset += 10) {
			const results = await Promise.all(images.slice(offset, offset + 10).map(async (image) => {
				try {
					await this.fileOperations.deleteFile(image, true);
					return { image, success: true };
				} catch (error) {
					console.error(`Failed to delete attachment: ${image.path}`, error);
					return { image, success: false };
				}
			}));
			for (const result of results) {
				if (result.success) {
					success += 1;
					this.removeImageFromMemory(result.image);
				} else failed += 1;
			}
			onProgress(success + failed, images.length);
			await new Promise<void>((resolve) => (this.contentEl.ownerDocument.defaultView ?? window).setTimeout(resolve, 0));
		}
		new Notice(failed === 0 ? `成功删除 ${success} 个附件` : `删除完成: 成功 ${success} 个, 失败 ${failed} 个`);
		this.updateQueryResult();
	}

	async refresh(): Promise<void> {
		await this.loadImages();
	}

	applyVaultChanges(changes: readonly ImageManagerVaultChange[]): void {
		if (this.isClosed || changes.length === 0) return;
		if (changes.some((change) =>
			this.imageLoader.isCustomSource(change.file) ||
			this.imageLoader.isKnownCover(change.file.path) ||
			Boolean(change.oldPath && this.imageLoader.isKnownCover(change.oldPath)),
		)) {
			void this.loadImages();
			return;
		}
		const itemsByPath = new Map(this.images.map((image) => [image.path, image]));
		const pathsToRefresh = new Set<string>();
		for (const change of changes) {
			if (change.oldPath) itemsByPath.delete(change.oldPath);
			if (change.type === "delete") {
				itemsByPath.delete(change.file.path);
				continue;
			}
			if (!this.imageLoader.shouldInclude(change.file)) {
				itemsByPath.delete(change.file.path);
				continue;
			}
			const previous = itemsByPath.get(change.file.path);
			const next = this.imageLoader.createImageItem(change.file);
			itemsByPath.set(change.file.path, previous ? {
				...next,
				references: previous.references,
				referenceCount: previous.referenceCount,
			} : next);
			pathsToRefresh.add(change.file.path);
		}
		this.images = Array.from(itemsByPath.values());
		this.updateQueryResult();
		if (pathsToRefresh.size > 0) void this.refreshReferencePaths(pathsToRefresh);
	}
}

function cloneFilters(filters: readonly ImageFilterPreset[]): ImageFilterPreset[] {
	return filters.map((filter) => ({
		...filter,
		filter: filter.filter ? cloneFilterGroup(filter.filter) : undefined,
		rules: filter.rules?.map((rule) => ({ ...rule })),
		mappings: filter.mappings?.map((mapping) => ({ ...mapping })),
		properties: filter.properties ? [...filter.properties] : undefined,
		sort: filter.sort?.map((rule) => ({ ...rule })),
		groupBy: filter.groupBy ? { ...filter.groupBy } : undefined,
		groupOrder: filter.groupOrder ? [...filter.groupOrder] : undefined,
		collapsedGroups: filter.collapsedGroups ? [...filter.collapsedGroups] : undefined,
	}));
}

function cloneFilter(filter: ImageFilterPreset): ImageFilterPreset {
	return cloneFilters([filter])[0];
}

function createInitialView(settings: ImageManagerSettings): ImageFilterPreset {
	return {
		id: createViewId(),
		name: "视图",
		icon: "layout-grid",
		cardSize: 200,
		invertSvgInDarkMode: settings.invertSvgInDarkMode !== false,
		mappings: (settings.customFileTypes ?? []).map((mapping) => ({ ...mapping })),
		layout: "grid",
		filter: createLegacyFilterGroup(createRuleId(), "all", []),
		properties: orderCardProperties(settings.allViewProperties ?? ["name", "size", "mtime"]),
		sort: (settings.allViewSort ?? [{ field: "mtime", order: "desc" }]).map((rule) => ({ ...rule })),
		unreferencedOnly: false,
	};
}

function createUniqueViewName(views: readonly ImageFilterPreset[], baseName: string): string {
	const names = new Set(views.map((view) => view.name));
	if (!names.has(baseName)) return baseName;
	let suffix = 2;
	while (names.has(`${baseName} ${suffix}`)) suffix += 1;
	return `${baseName} ${suffix}`;
}

function createViewId(): string {
	return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRuleId(): string {
	return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLegacyFilterGroup(
	id: string,
	match: "all" | "any" | "none",
	rules: readonly ImageFilterRule[],
): ImageFilterGroup {
	return { id, match, children: rules.map((rule) => ({ ...rule })) };
}

function cloneFilterGroup(group: ImageFilterGroup): ImageFilterGroup {
	return {
		...group,
		children: group.children.map((child) => "children" in child
			? cloneFilterGroup(child)
			: { ...child }),
	};
}

function cloneFilterGroupWithNewIds(group: ImageFilterGroup): ImageFilterGroup {
	return {
		...group,
		id: createRuleId(),
		children: group.children.map((child) => "children" in child
			? cloneFilterGroupWithNewIds(child)
			: { ...child, id: createRuleId() }),
	};
}

function filterGroupsEqual(
	left: ImageFilterGroup | undefined,
	right: ImageFilterGroup | undefined,
): boolean {
	return JSON.stringify(getEffectiveFilter(left)) === JSON.stringify(getEffectiveFilter(right));
}

function getEffectiveFilter(group: ImageFilterGroup | undefined): unknown {
	if (!group) return null;
	const children = group.children.flatMap((child): unknown[] => {
		if ("children" in child) {
			const nested = getEffectiveFilter(child);
			return nested === null ? [] : [nested];
		}
		return [[child.field, child.operator, child.value]];
	});
	return children.length === 0 ? null : [group.match, children];
}

function filterContainsRule(
	group: ImageFilterGroup | undefined,
	predicate: (rule: ImageFilterRule) => boolean,
): boolean {
	if (!group) return false;
	return group.children.some((child) => "children" in child
		? filterContainsRule(child, predicate)
		: predicate(child));
}

function filterUsesField(group: ImageFilterGroup | undefined, field: ImageFilterField): boolean {
	return filterContainsRule(group, (rule) => rule.field === field);
}

function getMappingsSignature(mappings: readonly CustomFileTypeConfig[]): string {
	return JSON.stringify(mappings);
}

function orderCardProperties(properties: readonly ImageCardProperty[]): ImageCardProperty[] {
	const selected = new Set(properties);
	return IMAGE_CARD_PROPERTY_ORDER.filter((property) => selected.has(property));
}
