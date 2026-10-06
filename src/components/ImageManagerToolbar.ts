import { App, DropdownComponent, Menu, Notice, Platform, setIcon, SliderComponent, ToggleComponent } from "obsidian";
import {
	CustomFileTypeConfig,
	ImageCardProperty,
	ImageFilterField,
	ImageFilterGroup,
	ImageFilterOperator,
	ImageFilterPreset,
	ImageFilterRule,
	ImageGroupBy,
	ImageSortRule,
} from "../types/image-manager.types";
import { FolderSuggest } from "./FolderSuggest";
import { ImageManagerPropertiesPanel } from "./ImageManagerPropertiesPanel";
import { normalizeExtension } from "../utils/vaultPaths";
import { ViewTabsReorderController } from "./ViewTabsReorderController";
import { ViewIconService } from "../services/ViewIconService";
import { ImageGroup } from "../utils/imageGrouping";
import { renderImageManagerGroupPanel } from "./ImageManagerGroupPanel";
import { renderImageManagerSortPanel } from "./ImageManagerSortPanel";

export interface ImageManagerToolbarState {
	filters: readonly ImageFilterPreset[];
	activeFilterId: string;
	resultCount: number;
	totalCount: number;
	sortRules: readonly ImageSortRule[];
	groupBy?: ImageGroupBy;
	groupOrder?: readonly string[];
	searchQuery: string;
	properties: readonly ImageCardProperty[];
	unreferencedOnly: boolean;
	isMultiSelect: boolean;
	selectedCount: number;
	mappings: readonly CustomFileTypeConfig[];
}

interface ImageManagerToolbarActions {
	onCreateFilter: () => string;
	onSelectFilter: (id: string) => void;
	onSaveFilter: (filter: ImageFilterPreset) => void;
	onDuplicateFilter: (id: string) => string | null;
	onDeleteFilter: (id: string) => void;
	onReorderFilters: (ids: string[]) => void;
	onSortChange: (rules: ImageSortRule[]) => void;
	onGroupChange: (groupBy: ImageGroupBy | undefined, groupOrder?: string[]) => void;
	onGroupOrderChange: (order: string[]) => void;
	getAllGroups: () => ImageGroup[];
	onSearchChange: (query: string) => void;
	onPropertiesChange: (properties: ImageCardProperty[]) => void;
	onToggleUnreferenced: () => void;
	onToggleMultiSelect: () => void;
	onMoveSelected: () => void;
	onDeleteSelected: () => void;
	onMappingsChange: (mappings: CustomFileTypeConfig[]) => void;
}

interface ComboboxControl {
	element: HTMLElement;
	refresh: () => void;
}

const OPEN_WITH_OBSIDIAN_LABEL = "用 Obsidian 打开";

const FIELD_LABELS: Record<ImageFilterField, string> = {
	name: "文件名",
	folder: "文件夹",
	extension: "扩展名",
	references: "引用状态",
	size: "文件大小",
	ctime: "创建时间",
	mtime: "修改时间",
};

const FIELD_ICONS: Record<ImageCardProperty, string> = {
	name: "file-text",
	folder: "folder",
	extension: "file-type",
	references: "links-coming-in",
	size: "file-chart-column",
	ctime: "calendar-plus",
	mtime: "calendar-clock",
};

const TEXT_OPERATORS: Array<[ImageFilterOperator, string]> = [
	["contains", "包含"],
	["not-contains", "不包含"],
	["is", "等于"],
	["is-not", "不等于"],
	["starts-with", "开头为"],
	["ends-with", "结尾为"],
];

export class ImageManagerToolbar {
	private readonly headerEl: HTMLElement;
	private readonly toolbarEl: HTMLElement;
	private readonly tabsEl: HTMLElement;
	private readonly resultCountEl: HTMLElement;
	private readonly actionsEl: HTMLElement;
	private readonly searchRowEl: HTMLElement;
	private readonly searchInputEl: HTMLInputElement;
	private readonly selectionRowEl: HTMLElement;
	private readonly tabsReorder: ViewTabsReorderController;
	private popoverEl: HTMLElement | null = null;
	private popoverBgEl: HTMLElement | null = null;
	private popoverAnchor: HTMLElement | null = null;
	private popoverObserver: ResizeObserver | null = null;
	private popoverOnClose: (() => void) | null = null;
	private outsideAbort: AbortController | null = null;
	private state: ImageManagerToolbarState;
	private tabsSignature = "";
	private sortButtonEl: HTMLElement | null = null;
	private sortBadgeEl: HTMLElement | null = null;
	private groupButtonEl: HTMLElement | null = null;
	private filterButtonEl: HTMLElement | null = null;
	private searchButtonEl: HTMLElement | null = null;
	private multiSelectButtonEl: HTMLElement | null = null;
	private searchTimer: number | null = null;
	private readonly folderSuggests = new Map<string, FolderSuggest>();
	private suggestionEl: HTMLElement | null = null;
	private sortPanel: { update: (rules: readonly ImageSortRule[]) => void } | null = null;
	private groupPanelCleanup: (() => void) | null = null;
	private suggestionAnchor: HTMLElement | null = null;
	private suggestionAbort: AbortController | null = null;
	private viewIconPreviewEl: HTMLElement | null = null;

	constructor(
		private readonly app: App,
		hostEl: HTMLElement,
		private readonly viewIconService: ViewIconService,
		private readonly actions: ImageManagerToolbarActions,
		initialState: ImageManagerToolbarState,
	) {
		this.state = initialState;
		this.headerEl = hostEl.createDiv("afm-manager-header");
		const toolbarHeader = this.headerEl.createDiv("bases-header");
		this.toolbarEl = toolbarHeader.createDiv("bases-toolbar afm-manager-toolbar");
		const tabsContainer = this.toolbarEl.createDiv("afm-manager-filter-tabs");
		this.tabsEl = tabsContainer.createDiv("afm-manager-filter-tab-list");
		this.tabsReorder = new ViewTabsReorderController(this.tabsEl, this.actions.onReorderFilters);
		const addButton = tabsContainer.createEl("button", {
			cls: "clickable-icon afm-manager-filter-add",
			attr: { type: "button", "aria-label": "添加视图" },
		});
		setIcon(addButton, "plus");
		addButton.addEventListener("click", () => {
			const id = this.actions.onCreateFilter();
			queueMicrotask(() => {
				const tab = this.tabsEl.querySelector<HTMLElement>(`[data-filter-id="${id}"]`);
				const view = this.state.filters.find((candidate) => candidate.id === id);
				if (tab && view) this.openViewNamePanel(tab, view);
			});
		});
		const resultItem = this.toolbarEl.createDiv("bases-toolbar-item bases-toolbar-result-count afm-manager-result-count");
		const resultButton = resultItem.createDiv("text-icon-button");
		const resultIcon = resultButton.createSpan("text-button-icon");
		setIcon(resultIcon, "list-filter");
		this.resultCountEl = resultButton.createSpan("text-button-label");
		this.actionsEl = this.toolbarEl.createDiv("afm-manager-toolbar-actions");
		this.searchRowEl = this.headerEl.createDiv("bases-search-row afm-manager-search-row");
		const searchWrap = this.searchRowEl.createDiv("search-input-container");
		this.searchInputEl = searchWrap.createEl("input", {
			type: "search",
			placeholder: "搜索附件...",
			value: initialState.searchQuery,
		});
		const closeSearch = searchWrap.createDiv({
			cls: "search-input-clear-button",
			attr: { "aria-label": "清除搜索" },
		});
		this.searchInputEl.addEventListener("input", () => this.scheduleSearch());
		this.searchInputEl.addEventListener("keydown", (event) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			this.hideSearch(true);
		});
		closeSearch.addEventListener("mousedown", (event) => event.preventDefault());
		closeSearch.addEventListener("click", () => {
			this.searchInputEl.value = "";
			this.actions.onSearchChange("");
			this.searchInputEl.focus();
		});
		this.searchRowEl.hide();
		this.selectionRowEl = this.headerEl.createDiv("bases-search-row afm-manager-selection-row");
		this.selectionRowEl.hide();
		this.renderActions();
		this.update(initialState);
	}

	update(state: ImageManagerToolbarState): void {
		this.state = state;
		const signature = JSON.stringify([
			state.activeFilterId,
			...state.filters.map((filter) => filter.id),
		]);
		if (signature !== this.tabsSignature) {
			this.tabsSignature = signature;
			this.renderTabs();
		}
		this.updateTabLabels();
		this.resultCountEl.setText(`${state.resultCount.toLocaleString()} 个结果`);
		this.resultCountEl.setAttribute(
			"aria-label",
			`显示 ${state.resultCount.toLocaleString()} 个, 共 ${state.totalCount.toLocaleString()} 个附件`,
		);
		if (this.searchInputEl !== this.searchInputEl.ownerDocument.activeElement) {
			this.searchInputEl.value = state.searchQuery;
		}
		this.renderSelectionRow();
		this.updateActionButtonStates();
		this.sortPanel?.update(state.sortRules);
	}

		destroy(): void {
		if (this.searchTimer !== null) {
			this.searchInputEl.ownerDocument.defaultView?.clearTimeout(this.searchTimer);
			this.searchTimer = null;
		}
		this.closePopover(false);
		this.closeSuggestions();
		this.tabsReorder.destroy();
		this.headerEl.remove();
	}

	private renderTabs(): void {
		this.tabsReorder.cancel();
		this.tabsEl.empty();
		for (const filter of this.state.filters) {
			this.createTab(filter.id, filter.name, filter.icon ?? "layout-grid");
		}
	}

	private createTab(id: string, name: string, icon: string): void {
		const button = this.tabsEl.createEl("button", {
			cls: "clickable-icon afm-manager-filter-tab",
			attr: { type: "button", "aria-pressed": String(id === this.state.activeFilterId) },
		});
		const iconEl = button.createSpan("afm-manager-filter-tab-icon");
		this.viewIconService.render(iconEl, icon);
		button.createSpan({ cls: "afm-manager-filter-tab-name", text: name });
		button.toggleClass("is-active", id === this.state.activeFilterId);
		button.dataset.filterId = id;
		button.dataset.icon = icon;
		button.addEventListener("click", () => {
			if (this.tabsReorder.consumeSuppressedClick(id)) return;
			if (id === this.state.activeFilterId) {
				const view = this.state.filters.find((candidate) => candidate.id === id);
				if (view) this.openViewNamePanel(button, view);
				return;
			}
			this.actions.onSelectFilter(id);
		});
		this.tabsReorder.bind(button, id);
	}

	private updateTabLabels(): void {
		for (const tab of Array.from(
			this.tabsEl.querySelectorAll<HTMLElement>(".afm-manager-filter-tab"),
		)) {
			const id = tab.dataset.filterId;
			const label = this.state.filters.find((filter) => filter.id === id)?.name;
			const icon = this.state.filters.find((filter) => filter.id === id)?.icon ?? "layout-grid";
			if (label) tab.querySelector<HTMLElement>(".afm-manager-filter-tab-name")?.setText(label);
			if (tab.dataset.icon !== icon) {
				const iconEl = tab.querySelector<HTMLElement>(".afm-manager-filter-tab-icon");
				if (iconEl) this.viewIconService.render(iconEl, icon);
				tab.dataset.icon = icon;
			}
			tab.toggleClass("is-active", id === this.state.activeFilterId);
			tab.setAttribute("aria-pressed", String(id === this.state.activeFilterId));
		}
	}

	refreshIcons(): void {
		for (const tab of Array.from(this.tabsEl.querySelectorAll<HTMLElement>(".afm-manager-filter-tab"))) {
			const id = tab.dataset.filterId;
			const icon = this.state.filters.find((filter) => filter.id === id)?.icon ?? "layout-grid";
			const iconEl = tab.querySelector<HTMLElement>(".afm-manager-filter-tab-icon");
			if (iconEl) this.viewIconService.render(iconEl, icon);
		}
		if (this.viewIconPreviewEl?.isConnected) {
			const view = this.state.filters.find((filter) => filter.id === this.state.activeFilterId);
			this.viewIconService.render(this.viewIconPreviewEl, view?.icon ?? "layout-grid");
		}
	}

	private renderActions(): void {
		this.actionsEl.empty();
		this.sortButtonEl = null;
		this.sortBadgeEl = null;
		this.groupButtonEl = null;
		this.filterButtonEl = null;
		this.searchButtonEl = null;
		this.multiSelectButtonEl = null;
		const sortButton = this.sortButtonEl = this.createTextButton(
			"lucide-arrow-up-down",
			"排序",
			() => this.openSortPanel(sortButton),
		);
		sortButton.parentElement?.addClass("bases-toolbar-sort-menu");
		this.sortBadgeEl = sortButton.createSpan("flair toolbar-badge");
		this.sortBadgeEl.hide();
		const groupButton = this.groupButtonEl = this.createTextButton(
			"lucide-stretch-horizontal",
			"分组",
			() => this.openGroupPanel(groupButton),
		);
		groupButton.parentElement?.addClass("bases-toolbar-group-menu");
		const filterButton = this.filterButtonEl = this.createTextButton(
			"list-filter",
			"过滤",
			this.actions.onToggleUnreferenced,
		);
		filterButton.parentElement?.addClass("bases-toolbar-filter-menu");
		const propertiesButton = this.createTextButton(
			"list",
			"属性",
			() => this.openPropertiesPanel(propertiesButton),
		);
		propertiesButton.parentElement?.addClass("bases-toolbar-properties-menu");
		const searchButton = this.searchButtonEl = this.createTextButton("search", "搜索", () => {
			if (this.searchRowEl.isShown()) this.hideSearch(true);
			else this.showSearch();
		});
		searchButton.parentElement?.addClass("bases-toolbar-search");
		this.multiSelectButtonEl = this.createTextButton("copy-check", "多选", this.actions.onToggleMultiSelect);
		const mappingButton = this.createTextButton("waypoints", "映射", () => this.openMappingPanel(mappingButton));
	}

	private updateActionButtonStates(): void {
		if (this.sortButtonEl) {
			this.sortButtonEl.toggleClass("is-active", this.state.sortRules.length > 0);
			this.sortBadgeEl?.setText(String(this.state.sortRules.length));
			this.sortBadgeEl?.toggle(this.state.sortRules.length > 0);
		}
		this.groupButtonEl?.toggleClass("is-active", Boolean(this.state.groupBy));
		this.filterButtonEl?.toggleClass("is-active", this.state.unreferencedOnly);
		this.multiSelectButtonEl?.toggleClass("is-active", this.state.isMultiSelect);
	}

	private renderSelectionRow(): void {
		this.selectionRowEl.empty();
		if (!this.state.isMultiSelect) {
			this.selectionRowEl.hide();
			return;
		}
		this.selectionRowEl.show();
		const summary = this.selectionRowEl.createDiv("afm-manager-selection-summary");
		const summaryIcon = summary.createSpan("afm-manager-selection-summary-icon");
		setIcon(summaryIcon, "copy-check");
		summary.createSpan({
			cls: "afm-manager-selection-count",
			text: `已选择 ${this.state.selectedCount} 个附件`,
		});
		const actions = this.selectionRowEl.createDiv("bases-toolbar afm-manager-selection-actions");
		actions.toggleClass("is-empty", this.state.selectedCount === 0);
		this.createSelectionAction(actions, "folder-tree", "移动", this.actions.onMoveSelected);
		this.createSelectionAction(actions, "trash-2", "删除", this.actions.onDeleteSelected, false, true);
	}

	private createSelectionAction(
		container: HTMLElement,
		icon: string,
		label: string,
		callback: () => void,
		disabled = false,
		destructive = false,
	): void {
		const item = container.createDiv("bases-toolbar-item afm-manager-toolbar-item");
		const button = item.createDiv({
			cls: `text-icon-button afm-manager-selection-action${destructive ? " mod-destructive" : ""}`,
			attr: { tabindex: disabled ? "-1" : "0", role: "button", "aria-label": label },
		});
		button.setAttribute("aria-disabled", String(disabled));
		setIcon(button.createSpan("text-button-icon"), icon);
		button.createSpan({ cls: "text-button-label", text: label });
		if (!disabled) bindActivation(button, callback);
	}

	private createTextButton(icon: string, text: string, callback: () => void): HTMLElement {
		const item = this.actionsEl.createDiv("bases-toolbar-item afm-manager-toolbar-item");
		const button = item.createDiv({
			cls: "text-icon-button tappable",
			attr: { tabindex: "0", role: "button", "aria-label": text },
		});
		const iconEl = button.createSpan("text-button-icon");
		setIcon(iconEl, icon);
		button.createSpan({ cls: "text-button-label", text });
		bindActivation(button, callback);
		return button;
	}

	private createIconButton(
		container: HTMLElement,
		icon: string,
		label: string,
		callback: ((event: MouseEvent) => void) | (() => void),
		destructive = false,
	): HTMLElement {
		const button = container.createDiv({
			cls: `clickable-icon${destructive ? " mod-warning" : ""}`,
			attr: { tabindex: "0", role: "button", "aria-label": label },
		});
		setIcon(button, icon);
		bindActivation(button, callback);
		return button;
	}

	private showSearch(): void {
		this.searchButtonEl?.addClass("is-active");
		this.searchRowEl.show();
		this.searchInputEl.focus();
		this.searchInputEl.select();
	}

	private hideSearch(clear: boolean): void {
		this.searchButtonEl?.removeClass("is-active");
		if (this.searchTimer !== null) {
			this.searchInputEl.ownerDocument.defaultView?.clearTimeout(this.searchTimer);
			this.searchTimer = null;
		}
		if (clear && this.searchInputEl.value) {
			this.searchInputEl.value = "";
			this.actions.onSearchChange("");
		}
		this.searchRowEl.hide();
	}

	private scheduleSearch(): void {
		const ownerWindow = this.searchInputEl.ownerDocument.defaultView ?? window;
		if (this.searchTimer !== null) ownerWindow.clearTimeout(this.searchTimer);
		this.searchTimer = ownerWindow.setTimeout(() => {
			this.searchTimer = null;
			this.actions.onSearchChange(this.searchInputEl.value);
		}, 50);
	}

	private openViewNamePanel(anchor: HTMLElement, source: ImageFilterPreset): void {
		const draft = cloneFilter(source);
		let savedName = source.name;
		const save = (): boolean => {
			const name = draft.name.trim();
			if (!name || this.state.filters.some((view) => view.id !== draft.id && view.name === name)) {
				return false;
			}
			this.actions.onSaveFilter({ ...draft, name });
			savedName = name;
			return true;
		};
		this.openPopover(anchor, "view", (panel) => {
			const container = panel.createDiv("bases-toolbar-menu-container afm-manager-view-name-container");
			const form = container.createDiv("bases-toolbar-menu-form view-config-menu");
			const row = form.createDiv("input-row");
			const content = row.createDiv("input-row-content");
			const iconButton = content.createEl("button", {
				cls: "clickable-icon afm-manager-view-icon-picker",
				attr: { type: "button", "aria-label": "修改视图图标" },
			});
			const iconPreview = iconButton.createSpan("afm-manager-view-icon-preview");
			this.viewIconPreviewEl = iconPreview;
			this.viewIconService.render(iconPreview, draft.icon ?? "layout-grid");
			const input = content.createEl("input", {
				type: "text",
				placeholder: "视图名称",
				value: draft.name,
			});
			const moreButton = content.createDiv({
				cls: "clickable-icon afm-manager-view-actions",
				attr: { tabindex: "0", role: "button", "aria-label": "视图操作" },
			});
			setIcon(moreButton, "more-vertical");
			iconButton.addEventListener("click", () => {
				void this.viewIconService.pick(iconButton, draft.icon ?? "layout-grid").then((icon) => {
					if (!icon) return;
					draft.icon = icon;
					this.viewIconService.render(iconPreview, icon);
					save();
				});
			});
			input.addEventListener("input", () => { draft.name = input.value; });
			input.addEventListener("blur", () => {
				if (save()) return;
				draft.name = savedName;
				input.value = savedName;
			});
			input.addEventListener("keydown", (event) => {
				if (event.isComposing) return;
				if (event.key === "Enter") {
					event.preventDefault();
					if (save()) this.closePopover(false);
				} else if (event.key === "Escape") {
					event.preventDefault();
					this.closePopover(false);
				}
			});
			bindActivation(moreButton, (event) => {
				event.preventDefault();
				if (!save()) {
					draft.name = savedName;
					input.value = savedName;
				}
				const menu = new Menu();
				menu.setParentElement(moreButton);
				menu.addItem((item) => item
					.setTitle("复制视图")
					.setIcon("files")
					.setSection("action")
					.onClick(() => {
						this.closePopover(false);
						const duplicateId = this.actions.onDuplicateFilter(source.id);
						if (!duplicateId) return;
						queueMicrotask(() => {
							const tab = this.tabsEl.querySelector<HTMLElement>(`[data-filter-id="${duplicateId}"]`);
							const view = this.state.filters.find((candidate) => candidate.id === duplicateId);
							if (tab && view) this.openViewNamePanel(tab, view);
						});
					}));
				menu.addItem((item) => item
					.setTitle("删除视图")
					.setIcon("trash-2")
					.setSection("action")
					.onClick(() => {
						this.closePopover(false);
						this.actions.onDeleteFilter(source.id);
					}));
				const rect = moreButton.getBoundingClientRect();
				menu.showAtPosition({ x: rect.right, y: rect.bottom });
			});
			const filterHost = form.createDiv("afm-manager-view-filter");
			this.renderFilterBuilder(filterHost, draft, () => { save(); });
			form.createDiv("input-group-divider");
			const cardSizeRow = form.createDiv("input-row");
			cardSizeRow.createDiv({ cls: "input-row-label", text: "卡片大小" });
			const cardSizeContent = cardSizeRow.createDiv("input-row-content afm-manager-card-size-control");
			new SliderComponent(cardSizeContent)
				.setLimits(50, 800, 10)
				.setInstant(true)
				.setValue(draft.cardSize ?? 200)
				.onChange((value) => {
					draft.cardSize = value;
					save();
				});
			form.createDiv("input-group-divider");
			const invertRow = form.createDiv("input-row");
			invertRow.createDiv({ cls: "input-row-label", text: "深色模式 SVG 反色" });
			const invertContent = invertRow.createDiv("input-row-content");
			new ToggleComponent(invertContent)
				.setValue(draft.invertSvgInDarkMode !== false)
				.onChange((value) => {
					draft.invertSvgInDarkMode = value;
					save();
				});
			form.createDiv("input-group-divider");
			const layoutRow = form.createDiv("input-row");
			layoutRow.createDiv({ cls: "input-row-label", text: "布局" });
			const layoutContent = layoutRow.createDiv("input-row-content afm-manager-layout-control");
			new DropdownComponent(layoutContent)
				.addOption("grid", "网格")
				.addOption("masonry", "瀑布流")
				.setValue(draft.layout === "masonry" ? "masonry" : "grid")
				.onChange((value) => {
					draft.layout = value === "masonry" ? "masonry" : "grid";
					save();
				});
			queueMicrotask(() => {
				input.focus();
				input.select();
			});
		}, () => { save(); });
	}

	private openPropertiesPanel(anchor: HTMLElement): void {
		this.openPopover(anchor, "properties", (panel) => {
			new ImageManagerPropertiesPanel(panel, {
				properties: this.state.properties,
				onChange: this.actions.onPropertiesChange,
			});
		});
	}

	private openMappingPanel(anchor: HTMLElement): void {
		let validateOnClose = (): void => { };
		this.openPopover(anchor, "mapping", (panel) => {
			const draft = this.state.mappings.map((mapping) => ({ ...mapping }));
			let savedState = JSON.stringify(draft);
			let saveTimer: number | null = null;
			const ownerWindow = panel.ownerDocument.defaultView ?? window;
			const container = panel.createDiv("bases-toolbar-menu-container");
			const items = container.createDiv("bases-toolbar-items");
			const mappings = items.createDiv("suggestion-group");
			mappings.dataset.group = "mappings";
			let sourceInputs: HTMLInputElement[] = [];
			let coverInputs: HTMLInputElement[] = [];
			const validateAndSave = (notifyInvalid = false): boolean => {
				const seen = new Set<string>();
				const normalized: CustomFileTypeConfig[] = [];
				let valid = true;
				for (const [index, mapping] of draft.entries()) {
					const fileExtension = normalizeExtension(mapping.fileExtension);
					const coverExtension = normalizeExtension(mapping.coverExtension);
					const invalidSource = !fileExtension || /[.\\/\s]/.test(fileExtension) || seen.has(fileExtension);
					const invalidCover = !coverExtension || /[.\\/\s]/.test(coverExtension);
					sourceInputs[index]?.toggleClass("mod-error", invalidSource);
					coverInputs[index]?.toggleClass("mod-error", invalidCover);
					if (invalidSource || invalidCover) {
						valid = false;
						continue;
					}
					seen.add(fileExtension);
					normalized.push({
						fileExtension,
						coverExtension,
						openMode: mapping.openMode === "obsidian" ? "obsidian" : "system",
					});
				}
				if (!valid) {
					if (notifyInvalid) new Notice("映射字段不完整、格式无效或存在重复, 本次修改未保存");
					return false;
				}
				const state = JSON.stringify(normalized);
				if (state !== savedState) {
					savedState = state;
					this.actions.onMappingsChange(normalized);
				}
				return true;
			};
			const scheduleSave = (): void => {
				if (saveTimer !== null) ownerWindow.clearTimeout(saveTimer);
				saveTimer = ownerWindow.setTimeout(() => {
					saveTimer = null;
					validateAndSave();
				}, 300);
			};
			const renderRows = (): void => {
				mappings.empty();
				mappings.toggleClass("mod-hidden", draft.length === 0);
				sourceInputs = [];
				coverInputs = [];
				for (const [index, mapping] of draft.entries()) {
					const row = mappings.createDiv("base-toolbar-sort-item afm-manager-mapping-row");
					const fields = row.createDiv("afm-manager-mapping-fields");
					const extensionFields = fields.createDiv("afm-manager-mapping-extension-fields");
					const sourceInput = extensionFields.createEl("input", {
						cls: "metadata-input metadata-input-text",
						type: "text",
						value: mapping.fileExtension,
						placeholder: "源扩展名",
						attr: { "aria-label": "源文件扩展名" },
					});
					const arrow = extensionFields.createSpan("afm-manager-mapping-arrow");
					setIcon(arrow, "arrow-right");
					const coverInput = extensionFields.createEl("input", {
						cls: "metadata-input metadata-input-text",
						type: "text",
						value: mapping.coverExtension,
						placeholder: "图片扩展名",
						attr: { "aria-label": "图片扩展名" },
					});
					sourceInputs.push(sourceInput);
					coverInputs.push(coverInput);
					sourceInput.addEventListener("input", () => {
						mapping.fileExtension = sourceInput.value;
						scheduleSave();
					});
					coverInput.addEventListener("input", () => {
						mapping.coverExtension = coverInput.value;
						scheduleSave();
					});
					const openModeRow = fields.createDiv("afm-manager-mapping-open-mode");
					new DropdownComponent(openModeRow)
						.addOption("obsidian", OPEN_WITH_OBSIDIAN_LABEL)
						.addOption("system", "用系统默认应用打开")
						.setValue(mapping.openMode === "obsidian" ? "obsidian" : "system")
						.onChange((value) => {
							mapping.openMode = value === "obsidian" ? "obsidian" : "system";
							validateAndSave();
						});
					this.createIconButton(row, "trash-2", "删除映射", () => {
						draft.splice(index, 1);
						renderRows();
						validateAndSave();
					});
				}
			};
			const actions = items.createDiv("suggestion-group");
			actions.dataset.group = "actions";
			const add = actions.createDiv("bases-toolbar-menu-item");
			const addInfo = add.createDiv("bases-toolbar-menu-item-info");
			const addIcon = addInfo.createDiv("bases-toolbar-menu-item-info-icon");
			setIcon(addIcon, "plus");
			addInfo.createDiv({ cls: "bases-toolbar-menu-item-name", text: "添加映射" });
			bindActivation(add, () => {
				draft.push({ fileExtension: "", coverExtension: "", openMode: "system" });
				renderRows();
				queueMicrotask(() => sourceInputs.last()?.focus({ preventScroll: true }));
			});
			renderRows();
			validateOnClose = () => {
				if (saveTimer !== null) ownerWindow.clearTimeout(saveTimer);
				saveTimer = null;
				validateAndSave(true);
			};
		}, () => validateOnClose());
	}

	private renderFilterBuilder(
		container: HTMLElement,
		draft: ImageFilterPreset,
		onChange: () => void,
	): void {
		const queryContainer = container.createDiv("bases-query-container");
		draft.filter ??= {
			id: createId("filter"),
			match: draft.match ?? "all",
			children: draft.rules?.map((rule) => ({ ...rule })) ?? [],
		};
		this.renderFilterGroup(queryContainer, draft.filter, false, onChange);
	}

	private renderFilterGroup(
		container: HTMLElement,
		filter: ImageFilterGroup,
		nested: boolean,
		onChange: () => void,
		onDelete?: () => void,
	): void {
		const group = container.createDiv("filter-group");
		const groupHeader = group.createDiv("filter-group-header");
		const matchSelect = groupHeader.createEl("select", {
			cls: "conjunction dropdown",
			attr: { "aria-label": "条件组合方式" },
		});
		matchSelect.createEl("option", { value: "all", text: "所有条件" });
		matchSelect.createEl("option", { value: "any", text: "任一条件" });
		matchSelect.createEl("option", { value: "none", text: "以下条件均不满足" });
		matchSelect.value = filter.match;
		if (nested && onDelete) {
			const headerActions = groupHeader.createDiv("filter-group-header-actions");
			this.createIconButton(headerActions, "trash-2", "删除筛选器组", onDelete);
		}
		const rows = group.createDiv("filter-group-statements");
		const renderRows = (): void => {
			rows.empty();
			for (const [index, child] of filter.children.entries()) {
				const row = rows.createDiv("filter-row");
				row.createSpan({
					cls: "conjunction",
					text: index === 0 ? "当" : filter.match === "all" ? "且" : "或",
				});
				const removeChild = (): void => {
					filter.children = filter.children.filter((candidate) => candidate !== child);
					renderRows();
					onChange();
				};
				if ("children" in child) {
					row.addClass("mod-group");
					this.renderFilterGroup(row, child, true, onChange, removeChild);
				} else {
					this.renderFilterRule(row, child, onChange, removeChild);
				}
			}
		};
		matchSelect.addEventListener("change", () => {
			filter.match = matchSelect.value === "any" || matchSelect.value === "none"
				? matchSelect.value
				: "all";
			renderRows();
			onChange();
		});
		const actions = group.createDiv("filter-group-actions");
		const addFilter = actions.createDiv({ cls: "text-icon-button", attr: { tabindex: "0", role: "button" } });
		setIcon(addFilter.createSpan("text-button-icon"), "plus");
		addFilter.createSpan({ cls: "text-button-label", text: "添加筛选器" });
		bindActivation(addFilter, () => {
			filter.children.push({
				id: createId("rule"),
				field: "references",
				operator: "is",
				value: "unreferenced",
			});
			renderRows();
			onChange();
		});
		const addGroup = actions.createDiv({ cls: "text-icon-button", attr: { tabindex: "0", role: "button" } });
		setIcon(addGroup.createSpan("text-button-icon"), "plus");
		addGroup.createSpan({ cls: "text-button-label", text: "添加筛选器组" });
		bindActivation(addGroup, () => {
			filter.children.push({ id: createId("group"), match: "all", children: [] });
			renderRows();
			onChange();
		});
		renderRows();
	}
	private renderFilterRule(
		container: HTMLElement,
		rule: ImageFilterRule,
		onChange: () => void,
		onDelete: () => void,
	): void {
		const statement = container.createDiv("filter-statement");
		const expression = statement.createDiv("filter-expression metadata-property");
		const left = expression.createDiv("filter-lhs-container");
		let operatorControl: ComboboxControl;
		const fieldControl = this.createCombobox(
			left,
			"filter-property-select",
			"过滤字段",
			() => Object.entries(FIELD_LABELS),
			() => rule.field,
			(value) => {
				rule.field = value as ImageFilterField;
				rule.operator = getOperators(rule.field)[0]?.[0] ?? "is";
				rule.value = rule.field === "references" ? "unreferenced" : "";
				fieldControl.refresh();
				operatorControl.refresh();
				renderValue();
				onChange();
			},
			(value) => FIELD_ICONS[value as ImageFilterField],
		);
		operatorControl = this.createCombobox(
			expression,
			"filter-operator",
			"过滤运算符",
			() => getOperators(rule.field),
			() => rule.operator,
			(value) => {
				rule.operator = value as ImageFilterOperator;
				operatorControl.refresh();
				onChange();
			},
		);
		const valueHost = expression.createDiv("filter-rhs-container metadata-property-value");
		const renderValue = (): void => {
			this.folderSuggests.get(rule.id)?.close();
			this.folderSuggests.delete(rule.id);
			valueHost.empty();
			if (rule.field === "references") {
				if (rule.value !== "referenced" && rule.value !== "unreferenced") rule.value = "unreferenced";
				this.createCombobox(
					valueHost,
					"metadata-input",
					"引用状态",
					() => [["unreferenced", "未引用"], ["referenced", "已引用"]],
					() => rule.value,
					(value) => { rule.value = value; onChange(); },
				);
				return;
			}
			const input = valueHost.createEl("input", {
				cls: `metadata-input metadata-input-text${rule.field === "ctime" || rule.field === "mtime" ? " mod-date" : ""}`,
				type: rule.field === "ctime" || rule.field === "mtime" ? "date" : "text",
				value: rule.value,
				placeholder: rule.field === "size" ? "例如 2 MB" : "值",
			});
			input.addEventListener("input", () => { rule.value = input.value; onChange(); });
			if (rule.field === "folder") {
				this.folderSuggests.set(rule.id, new FolderSuggest(this.app, input, (value) => {
					input.value = value;
					rule.value = value;
					onChange();
				}));
			}
		};
		const rowActions = expression.createDiv("filter-row-actions");
		this.createIconButton(rowActions, "trash-2", "删除条件", onDelete);
		renderValue();
	}

	private openSortPanel(anchor: HTMLElement): void {
		this.openPopover(anchor, "sort", (panel) => {
			this.sortPanel = renderImageManagerSortPanel(
				panel, this.state.sortRules, this.actions.onSortChange,
				(container, className, ariaLabel, getItems, getValue, onSelect, getIcon, getAux) =>
					this.createCombobox(container, className, ariaLabel, getItems, getValue, onSelect, getIcon, getAux),
			);
		});
	}

	private openGroupPanel(anchor: HTMLElement): void {
		this.openPopover(anchor, "group", (panel) => {
			this.groupPanelCleanup = renderImageManagerGroupPanel(panel, this.app, () => ({
				groupBy: this.state.groupBy,
				groupOrder: this.state.groupOrder,
				groups: this.actions.getAllGroups(),
			}), {
				onGroupChange: this.actions.onGroupChange,
				onGroupOrderChange: this.actions.onGroupOrderChange,
			}, (container, className, ariaLabel, getItems, getValue, onSelect, getIcon, getAux) =>
				this.createCombobox(container, className, ariaLabel, getItems, getValue, onSelect, getIcon, getAux));
		});
	}

	private createCombobox(
		container: HTMLElement,
		className: string,
		ariaLabel: string,
		getItems: () => Array<[string, string]>,
		getValue: () => string,
		onSelect: (value: string) => void,
		getIcon?: (value: string) => string | undefined,
		getAux?: (value: string) => string | undefined,
	): ComboboxControl {
		const element = container.createDiv({
			cls: `combobox-button ${className}`,
			attr: { tabindex: "0", role: "button", "aria-label": ariaLabel },
		});
		const iconEl = element.createDiv("combobox-button-icon");
		const labelEl = element.createDiv({
			cls: "combobox-button-label",
			attr: { placeholder: ariaLabel },
		});
		const clearEl = element.createDiv("combobox-clear-button");
		setIcon(clearEl, "x");
		clearEl.addEventListener("mousedown", (event) => event.preventDefault());
		const chevronEl = element.createDiv("combobox-button-chevron");
		setIcon(chevronEl, "chevrons-up-down");
		const refresh = (): void => {
			const current = getValue();
			const label = getItems().find(([value]) => value === current)?.[1] ?? current;
			labelEl.setText(label);
			const icon = getIcon?.(current);
			iconEl.toggle(Boolean(icon));
			if (icon) setIcon(iconEl, icon);
		};
		const toggleSuggestions = (event: Event): void => {
			event.preventDefault();
			if (this.suggestionAnchor === element) {
				this.closeSuggestions();
				return;
			}
			this.openSuggestions(element, getItems(), getValue(), (value) => {
				onSelect(value);
				refresh();
			}, getIcon, getAux);
		};
		bindActivation(element, toggleSuggestions);
		element.addEventListener("keydown", (event) => {
			if (event.isComposing || event.defaultPrevented) return;
			if (event.key !== "ArrowUp" && event.key !== "ArrowDown" &&
				!(event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)) return;
			event.preventDefault();
			if (this.suggestionAnchor !== element) toggleSuggestions(event);
			if (event.key.length === 1) {
				const input = this.suggestionEl?.querySelector<HTMLInputElement>(".search-input-container input");
				if (input) {
					input.value = event.key;
					input.dispatchEvent(new (input.ownerDocument.defaultView?.Event ?? Event)("input", { bubbles: true }));
				}
			}
		});
		refresh();
		return { element, refresh };
	}

	private openSuggestions(
		anchor: HTMLElement,
		items: Array<[string, string]>,
		current: string,
		onSelect: (value: string) => void,
		getIcon?: (value: string) => string | undefined,
		getAux?: (value: string) => string | undefined,
	): void {
		this.closeSuggestions();
		const ownerDocument = anchor.ownerDocument;
		const ownerWindow = ownerDocument.defaultView ?? window;
		const container = ownerDocument.body.createDiv("suggestion-container combobox mod-down");
		if (Platform.isPhone) {
			container.addClass("menu");
			container.createDiv({ cls: "menu-grabber", prepend: true });
		}
		const searchContainer = container.createDiv("search-input-container");
		const searchInput = searchContainer.createEl("input", {
			type: "search",
			attr: { enterkeyhint: "search", placeholder: "开始输入..." },
		});
		const clearSearch = searchContainer.createDiv("search-input-clear-button");
		clearSearch.addEventListener("mousedown", (event) => event.preventDefault());
		clearSearch.addEventListener("click", () => {
			searchInput.value = "";
			renderItems();
			searchInput.focus();
		});
		const list = container.createDiv(`suggestion${Platform.isPhone ? " menu-scroll" : ""}`);
		let itemElements: HTMLElement[] = [];
		let visibleItems = items;
		let selectedIndex = 0;
		const updateSelection = (): void => {
			for (const [index, item] of itemElements.entries()) {
				item.toggleClass("is-selected", index === selectedIndex);
			}
			itemElements[selectedIndex]?.scrollIntoView({ block: "nearest" });
		};
		const renderItems = (): void => {
			const query = searchInput.value.trim().toLowerCase();
			visibleItems = query
				? items.filter(([value, label]) => value.toLowerCase().includes(query) || label.toLowerCase().includes(query))
				: items;
			list.empty();
			itemElements = [];
			selectedIndex = Math.max(0, visibleItems.findIndex(([value]) => value === current));
			if (visibleItems.length === 0) {
				list.createDiv({ cls: "suggestion-empty", text: "没有匹配结果" });
				return;
			}
			for (const [index, [value, label]] of visibleItems.entries()) {
				const item = list.createDiv("suggestion-item mod-complex mod-toggle");
				if (value === current) {
					const checked = item.createDiv("suggestion-icon mod-checked");
					setIcon(checked, "check");
				}
				const icon = getIcon?.(value);
				if (icon) {
					const suggestionIcon = item.createDiv("suggestion-icon");
					suggestionIcon.createDiv("suggestion-flair", (element) => setIcon(element, icon));
				}
				item.createDiv("suggestion-content").createDiv({ cls: "suggestion-title", text: label });
				const aux = getAux?.(value);
				if (aux) item.createDiv("suggestion-aux").createSpan({ cls: "suggestion-flair u-small", text: aux });
				item.addEventListener("mouseenter", () => {
					selectedIndex = index;
					updateSelection();
				});
				item.addEventListener("click", (event) => {
					event.preventDefault();
					onSelect(value);
					this.closeSuggestions();
				});
				itemElements.push(item);
			}
			updateSelection();
		};
		searchInput.addEventListener("input", renderItems);
		searchInput.addEventListener("focus", () => container.addClass("has-input-focus"));
		searchInput.addEventListener("blur", () => container.removeClass("has-input-focus"));
		const rect = anchor.getBoundingClientRect();
		container.setCssStyles({
			position: "fixed",
			left: `${Math.max(8, rect.left)}px`,
			top: `${rect.bottom + 4}px`,
		});
		const suggestionRect = container.getBoundingClientRect();
		if (suggestionRect.bottom > ownerWindow.innerHeight - 8) {
			const above = rect.top - suggestionRect.height - 4;
			container.setCssStyles({ top: `${Math.max(8, above)}px` });
		}
		if (suggestionRect.right > ownerWindow.innerWidth - 8) {
			container.setCssStyles({ left: `${Math.max(8, ownerWindow.innerWidth - suggestionRect.width - 8)}px` });
		}
		anchor.addClass("has-focus");
		this.suggestionEl = container;
		this.suggestionAnchor = anchor;
		const abort = new AbortController();
		this.suggestionAbort = abort;
		ownerDocument.addEventListener("pointerdown", (event) => {
			const target = event.target as Node | null;
			if (target && (container.contains(target) || anchor.contains(target))) return;
			this.closeSuggestions();
		}, { capture: true, signal: abort.signal });
		ownerDocument.addEventListener("keydown", (event) => {
			if (event.key === "Tab") {
				this.closeSuggestions();
				anchor.focus({ preventScroll: true });
			} else if (event.key === "Escape") {
				event.preventDefault();
				this.closeSuggestions();
			} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				const delta = event.key === "ArrowDown" ? 1 : -1;
				if (visibleItems.length === 0) return;
				selectedIndex = (selectedIndex + delta + visibleItems.length) % visibleItems.length;
				updateSelection();
			} else if (event.key === "Enter") {
				event.preventDefault();
				const selected = visibleItems[selectedIndex];
				if (selected) onSelect(selected[0]);
				this.closeSuggestions();
			}
		}, { signal: abort.signal });
		renderItems();
		searchInput.focus({ preventScroll: true });
		searchInput.select();
	}

	private closeSuggestions(): void {
		this.suggestionAbort?.abort();
		this.suggestionAbort = null;
		this.suggestionAnchor?.removeClass("has-focus");
		this.suggestionAnchor = null;
		this.suggestionEl?.remove();
		this.suggestionEl = null;
	}

	private openPopover(
		anchor: HTMLElement,
		type: "sort" | "group" | "filter" | "view" | "properties" | "mapping",
		render: (panel: HTMLElement) => void,
		onClose?: () => void,
	): void {
		if (this.popoverEl && this.popoverAnchor === anchor) {
			this.closePopover(true);
			return;
		}
		this.closePopover(true);
		const ownerDocument = anchor.ownerDocument;
		const ownerWindow = ownerDocument.defaultView ?? window;
		const background = ownerDocument.body.createDiv("suggestion-bg afm-manager-popover-bg");
		background.setCssStyles({ opacity: Platform.isPhone ? "0.85" : "0" });
		background.addEventListener("mousedown", (event) => event.preventDefault());
		background.addEventListener("click", () => this.closePopover(true));
		const panel = ownerDocument.body.createDiv(
			`menu bases-toolbar-menu afm-manager-popover ${type === "sort" ? "bases-toolbar-sort-menu afm-manager-sort-menu" : type === "group" ? "bases-toolbar-group-menu afm-manager-group-menu" : type === "filter" ? "bases-toolbar-filter-menu" : type === "mapping" ? "bases-toolbar-filter-menu afm-manager-mapping-menu" : type === "properties" ? "bases-toolbar-properties-menu" : "bases-toolbar-filter-menu afm-manager-view-editor-menu"}`,
		);
		panel.createDiv("menu-grabber");
		const scrollEl = panel.createDiv("menu-scroll");
		this.popoverEl = panel;
		this.popoverBgEl = background;
		this.popoverAnchor = anchor;
		this.popoverOnClose = onClose ?? null;
		render(scrollEl);
		if (!Platform.isPhone) {
			const anchorRect = anchor.getBoundingClientRect();
			const positionPanel = (): void => {
				const panelRect = panel.getBoundingClientRect();
				const left = Math.min(
					Math.max(8, anchorRect.left),
					Math.max(8, ownerWindow.innerWidth - panelRect.width - 8),
				);
				const below = anchorRect.bottom + 4;
				const top = below + panelRect.height <= ownerWindow.innerHeight - 8
					? below
					: Math.max(8, anchorRect.top - panelRect.height - 4);
				panel.setCssStyles({ position: "fixed", left: `${left}px`, top: `${top}px` });
			};
			positionPanel();
			const ResizeObserverConstructor = ownerWindow.ResizeObserver ?? ResizeObserver;
			this.popoverObserver = new ResizeObserverConstructor(positionPanel);
			this.popoverObserver.observe(panel);
		}
		anchor.addClass("has-active-menu");
		const abort = new AbortController();
		this.outsideAbort = abort;
		const close = (event: Event): void => {
			const target = event.target;
			const NodeConstructor = panel.ownerDocument.defaultView?.Node;
			const ElementConstructor = panel.ownerDocument.defaultView?.Element;
			if (ElementConstructor && target instanceof ElementConstructor && target.closest(".suggestion-container")) {
				return;
			}
			if (
				NodeConstructor && target instanceof NodeConstructor &&
				(panel.contains(target) || anchor.contains(target))
			) return;
			this.closePopover(true);
		};
		queueMicrotask(() => {
			panel.ownerDocument.addEventListener("pointerdown", close, { capture: true, signal: abort.signal });
			panel.ownerDocument.addEventListener("keydown", (event) => {
				if (event.key === "Escape") this.closePopover(true);
			}, { signal: abort.signal });
		});
	}

	private closePopover(commit: boolean): void {
		this.sortPanel = null;
		this.groupPanelCleanup?.();
		this.groupPanelCleanup = null;
		const onClose = this.popoverOnClose;
		this.popoverOnClose = null;
		for (const suggest of this.folderSuggests.values()) suggest.close();
		this.folderSuggests.clear();
		this.closeSuggestions();
		this.outsideAbort?.abort();
		this.outsideAbort = null;
		this.popoverEl?.remove();
		this.popoverEl = null;
		this.popoverBgEl?.remove();
		this.popoverBgEl = null;
		this.popoverAnchor?.removeClass("has-active-menu");
		this.popoverAnchor = null;
		this.popoverObserver?.disconnect();
		this.popoverObserver = null;
		if (commit) onClose?.();
	}
}

function getOperators(field: ImageFilterField): Array<[ImageFilterOperator, string]> {
	if (field === "references" || field === "extension") {
		return [["is", "等于"], ["is-not", "不等于"]];
	}
	if (field === "size") {
		return [["greater-than", "大于"], ["less-than", "小于"], ["is", "等于"]];
	}
	if (field === "ctime" || field === "mtime") {
		return [["after", "晚于"], ["before", "早于"]];
	}
	return TEXT_OPERATORS;
}

function cloneFilter(filter: ImageFilterPreset): ImageFilterPreset {
	return {
		...filter,
		filter: filter.filter ? cloneFilterGroup(filter.filter) : undefined,
		rules: filter.rules?.map((rule) => ({ ...rule })),
		properties: filter.properties ? [...filter.properties] : undefined,
		sort: filter.sort?.map((rule) => ({ ...rule })),
		groupBy: filter.groupBy ? { ...filter.groupBy } : undefined,
		groupOrder: filter.groupOrder ? [...filter.groupOrder] : undefined,
		collapsedGroups: filter.collapsedGroups ? [...filter.collapsedGroups] : undefined,
	};
}

function cloneFilterGroup(group: ImageFilterGroup): ImageFilterGroup {
	return {
		...group,
		children: group.children.map((child) => "children" in child
			? cloneFilterGroup(child)
			: { ...child }),
	};
}

function createId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function bindActivation(
	element: HTMLElement,
	callback: ((event: MouseEvent) => void) | (() => void),
): void {
	element.addEventListener("click", (event) => callback(event));
	element.addEventListener("keydown", (event) => {
		if (event.isComposing || event.defaultPrevented) return;
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
	element.click();
	});
}
