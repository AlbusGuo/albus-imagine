import { setIcon } from "obsidian";
import { ImageFilterPreset } from "../types/image-manager.types";
import { ViewIconService } from "../services/ViewIconService";

interface ImagePickerToolbarState {
	views: readonly ImageFilterPreset[];
	activeViewId: string;
	resultCount: number;
	totalCount: number;
	searchQuery: string;
	isMultiSelect: boolean;
	allowMultiSelect: boolean;
	selectedCount: number;
	selectionActionLabel: string;
	selectionActionAriaLabel: string;
}

interface ImagePickerToolbarActions {
	onSelectView: (id: string) => void;
	onSearchChange: (query: string) => void;
	onToggleMultiSelect: () => void;
	onInsertSelected: () => void;
}

export class ImagePickerToolbar {
	private readonly headerEl: HTMLElement;
	private readonly tabsEl: HTMLElement;
	private readonly resultCountEl: HTMLElement;
	private readonly searchRowEl: HTMLElement;
	private readonly searchInputEl: HTMLInputElement;
	private readonly selectionRowEl: HTMLElement;
	private readonly searchButtonEl: HTMLElement;
	private readonly multiSelectButtonEl: HTMLElement;
	private tabsSignature = "";

	constructor(
		hostEl: HTMLElement,
		private readonly iconService: ViewIconService,
		private readonly actions: ImagePickerToolbarActions,
		private state: ImagePickerToolbarState,
	) {
		this.headerEl = hostEl.createDiv("afm-manager-header");
		const header = this.headerEl.createDiv("bases-header");
		const toolbar = header.createDiv("bases-toolbar afm-manager-toolbar");
		const tabs = toolbar.createDiv("afm-manager-filter-tabs");
		this.tabsEl = tabs.createDiv("afm-manager-filter-tab-list");
		const result = toolbar.createDiv("bases-toolbar-item bases-toolbar-result-count afm-manager-result-count");
		const resultButton = result.createDiv("text-icon-button");
		const resultIcon = resultButton.createSpan("text-button-icon");
		setIcon(resultIcon, "list-filter");
		this.resultCountEl = resultButton.createSpan("text-button-label");
		const actionsEl = toolbar.createDiv("afm-manager-toolbar-actions");
		this.searchButtonEl = this.createToolbarButton(actionsEl, "search", "搜索", () => this.toggleSearch());
		this.multiSelectButtonEl = this.createToolbarButton(actionsEl, "copy-check", "多选", this.actions.onToggleMultiSelect);

		this.searchRowEl = this.headerEl.createDiv("bases-search-row afm-manager-search-row");
		const search = this.searchRowEl.createDiv("search-input-container");
		this.searchInputEl = search.createEl("input", {
			type: "search",
			placeholder: "搜索附件...",
			value: state.searchQuery,
		});
		const clear = search.createDiv({ cls: "search-input-clear-button", attr: { "aria-label": "清除搜索" } });
		this.searchInputEl.addEventListener("input", () => this.actions.onSearchChange(this.searchInputEl.value));
		this.searchInputEl.addEventListener("keydown", (event) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			this.hideSearch(true);
		});
		clear.addEventListener("mousedown", (event) => event.preventDefault());
		clear.addEventListener("click", () => {
			this.searchInputEl.value = "";
			this.actions.onSearchChange("");
			this.searchInputEl.focus();
		});
		this.searchRowEl.hide();
		this.selectionRowEl = this.headerEl.createDiv("bases-search-row afm-manager-selection-row");
		this.selectionRowEl.hide();
		this.update(state);
	}

	update(state: ImagePickerToolbarState): void {
		this.state = state;
		const signature = JSON.stringify([state.activeViewId, ...state.views.map((view) => `${view.id}\0${view.name}\0${view.icon ?? ""}`)]);
		if (signature !== this.tabsSignature) {
			this.tabsSignature = signature;
			this.renderTabs();
		}
		this.resultCountEl.setText(`${state.resultCount.toLocaleString()} 个结果`);
		this.searchButtonEl.toggleClass("is-active", this.searchRowEl.isShown());
		this.multiSelectButtonEl.toggle(state.allowMultiSelect);
		this.multiSelectButtonEl.toggleClass("is-active", state.isMultiSelect);
		this.renderSelectionRow();
	}

	refreshIcons(): void {
		for (const tab of Array.from(this.tabsEl.querySelectorAll<HTMLElement>(".afm-manager-filter-tab"))) {
			const view = this.state.views.find((candidate) => candidate.id === tab.dataset.filterId);
			const icon = tab.querySelector<HTMLElement>(".afm-manager-filter-tab-icon");
			if (icon) this.iconService.render(icon, view?.icon ?? "layout-grid");
		}
	}

	destroy(): void {
		this.headerEl.remove();
	}

	private renderTabs(): void {
		this.tabsEl.empty();
		for (const view of this.state.views) {
			const button = this.tabsEl.createEl("button", {
				cls: "clickable-icon afm-manager-filter-tab",
				attr: { type: "button", "aria-pressed": String(view.id === this.state.activeViewId) },
			});
			const icon = button.createSpan("afm-manager-filter-tab-icon");
			this.iconService.render(icon, view.icon ?? "layout-grid");
			button.createSpan({ cls: "afm-manager-filter-tab-name", text: view.name });
			button.toggleClass("is-active", view.id === this.state.activeViewId);
			button.dataset.filterId = view.id;
			button.addEventListener("click", () => {
				if (view.id !== this.state.activeViewId) this.actions.onSelectView(view.id);
			});
		}
	}

	private renderSelectionRow(): void {
		this.selectionRowEl.empty();
		if (!this.state.isMultiSelect) {
			this.selectionRowEl.hide();
			return;
		}
		this.selectionRowEl.show();
		const summary = this.selectionRowEl.createDiv("afm-manager-selection-summary");
		const icon = summary.createSpan("afm-manager-selection-summary-icon");
		setIcon(icon, "copy-check");
		summary.createSpan({ cls: "afm-manager-selection-count", text: `已选择 ${this.state.selectedCount} 个附件` });
		const actions = this.selectionRowEl.createDiv("bases-toolbar afm-manager-selection-actions");
		actions.toggleClass("is-empty", this.state.selectedCount === 0);
		const item = actions.createDiv("bases-toolbar-item afm-manager-toolbar-item");
		const insert = item.createDiv({
			cls: "text-icon-button",
			attr: { tabindex: "0", role: "button", "aria-label": this.state.selectionActionAriaLabel },
		});
		setIcon(insert.createSpan("text-button-icon"), "check");
		insert.createSpan({ cls: "text-button-label", text: this.state.selectionActionLabel });
		insert.addEventListener("click", this.actions.onInsertSelected);
	}

	private createToolbarButton(container: HTMLElement, icon: string, label: string, callback: () => void): HTMLElement {
		const item = container.createDiv("bases-toolbar-item afm-manager-toolbar-item");
		const button = item.createDiv({ cls: "text-icon-button", attr: { tabindex: "0", role: "button", "aria-label": label } });
		setIcon(button.createSpan("text-button-icon"), icon);
		button.createSpan({ cls: "text-button-label", text: label });
		button.addEventListener("click", callback);
		return button;
	}

	private toggleSearch(): void {
		if (this.searchRowEl.isShown()) this.hideSearch(true);
		else {
			this.searchRowEl.show();
			this.searchButtonEl.addClass("is-active");
			this.searchInputEl.focus();
			this.searchInputEl.select();
		}
	}

	private hideSearch(clear: boolean): void {
		if (clear && this.searchInputEl.value) {
			this.searchInputEl.value = "";
			this.actions.onSearchChange("");
		}
		this.searchRowEl.hide();
		this.searchButtonEl.removeClass("is-active");
	}
}
