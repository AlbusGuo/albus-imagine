import { SearchComponent, setIcon } from "obsidian";
import {
	IMAGE_CARD_PROPERTY_ORDER,
	ImageCardProperty,
} from "../types/image-manager.types";

interface ImageManagerPropertiesPanelOptions {
	properties: readonly ImageCardProperty[];
	onChange: (properties: ImageCardProperty[]) => void;
}

const PROPERTY_LABELS: Record<ImageCardProperty, string> = {
	name: "文件名",
	extension: "扩展名",
	references: "引用",
	size: "大小",
	ctime: "创建时间",
	mtime: "修改时间",
	folder: "路径",
};

const PROPERTY_ICONS: Record<ImageCardProperty, string> = {
	name: "file-text",
	extension: "file-type",
	references: "links-coming-in",
	size: "file-chart-column",
	ctime: "calendar-plus",
	mtime: "calendar-clock",
	folder: "folder",
};

/** Fixed-order attachment property visibility controls. */
export class ImageManagerPropertiesPanel {
	private readonly containerEl: HTMLElement;
	private readonly itemsEl: HTMLElement;
	private readonly search: SearchComponent;
	private selected: Set<ImageCardProperty>;
	private query = "";

	constructor(
		parentEl: HTMLElement,
		private readonly options: ImageManagerPropertiesPanelOptions,
	) {
		this.selected = new Set(options.properties);
		this.containerEl = parentEl.createDiv("bases-toolbar-menu-container");
		this.search = new SearchComponent(this.containerEl)
			.setPlaceholder("搜索属性...")
			.onChange((query) => {
				this.query = query.trim().toLocaleLowerCase();
				this.renderItems();
			});
		this.search.inputEl.closest(".search-input-container")?.addClass("mod-raised");
		this.search.inputEl.addEventListener("focus", () => this.containerEl.addClass("has-input-focus"));
		this.search.inputEl.addEventListener("blur", () => this.containerEl.removeClass("has-input-focus"));
		this.itemsEl = this.containerEl.createDiv("bases-toolbar-items");
		this.renderItems();
		queueMicrotask(() => {
			this.search.inputEl.focus({ preventScroll: true });
			this.search.inputEl.select();
		});
	}

	private renderItems(focusProperty?: ImageCardProperty): void {
		this.itemsEl.empty();
		const group = this.itemsEl.createDiv("suggestion-group");
		group.dataset.group = "attachment-properties";
		for (const property of IMAGE_CARD_PROPERTY_ORDER) {
			if (this.query && !PROPERTY_LABELS[property].toLocaleLowerCase().includes(this.query)) continue;
			this.renderProperty(group, property, property === focusProperty);
		}
		if (focusProperty) {
			queueMicrotask(() => {
				group.querySelector<HTMLElement>(`[data-property="${focusProperty}"]`)
					?.focus({ preventScroll: true });
			});
		}
	}

	private renderProperty(group: HTMLElement, property: ImageCardProperty, shouldFocus: boolean): void {
		const isVisible = this.selected.has(property);
		const row = group.createDiv("suggestion-item bases-toolbar-menu-item");
		row.dataset.property = property;
		row.tabIndex = shouldFocus ? 0 : -1;
		row.setAttribute("role", "checkbox");
		row.setAttribute("aria-checked", String(isVisible));
		row.toggleClass("mod-hidden", !isVisible);

		const checkbox = row.createEl("input", { type: "checkbox" });
		checkbox.checked = isVisible;
		checkbox.tabIndex = -1;
		const info = row.createDiv("bases-toolbar-menu-item-info");
		const icon = info.createDiv("bases-toolbar-menu-item-info-icon");
		setIcon(icon, PROPERTY_ICONS[property]);
		info.createDiv({ cls: "bases-toolbar-menu-item-name", text: PROPERTY_LABELS[property] });

		const toggle = (): void => {
			if (isVisible) this.selected.delete(property);
			else this.selected.add(property);
			this.commit(property);
		};
		checkbox.addEventListener("click", (event) => {
			event.stopPropagation();
			toggle();
		});
		row.addEventListener("click", (event) => {
			if (event.target !== checkbox) toggle();
		});
		row.addEventListener("keydown", (event) => this.handleRowKeydown(event, toggle));
	}

	private handleRowKeydown(event: KeyboardEvent, toggle: () => void): void {
		if (event.isComposing || event.defaultPrevented) return;
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			toggle();
			return;
		}
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
		event.preventDefault();
		const rows = Array.from(this.itemsEl.querySelectorAll<HTMLElement>(".bases-toolbar-menu-item"));
		const index = rows.indexOf(event.currentTarget as HTMLElement);
		const nextIndex = Math.max(0, Math.min(rows.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
		rows[nextIndex]?.focus({ preventScroll: true });
	}

	private commit(focusProperty: ImageCardProperty): void {
		const properties = IMAGE_CARD_PROPERTY_ORDER.filter((property) => this.selected.has(property));
		this.options.onChange([...properties]);
		this.renderItems(focusProperty);
	}
}
