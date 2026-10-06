import { App, Notice, setIcon, TextComponent } from "obsidian";
import { ImageGroupBy, ImageGroupField } from "../types/image-manager.types";
import { formatGroupLabel, ImageGroup, IMAGE_GROUP_FIELDS } from "../utils/imageGrouping";
import { bindBasesVerticalReorder } from "../utils/basesReorder";
import { normalizeExtension, normalizeVaultFolder } from "../utils/vaultPaths";
import { FolderSuggest } from "./FolderSuggest";

export interface ImageManagerGroupPanelState {
	groupBy?: ImageGroupBy;
	groupOrder?: readonly string[];
	groups: readonly ImageGroup[];
}

export interface ImageManagerGroupPanelActions {
	onGroupChange: (groupBy: ImageGroupBy | undefined, order?: string[]) => void;
	onGroupOrderChange: (order: string[]) => void;
}

export type GroupComboboxFactory = (
	container: HTMLElement,
	className: string,
	ariaLabel: string,
	getItems: () => Array<[string, string]>,
	getValue: () => string,
	onSelect: (value: string) => void,
	getIcon?: (value: string) => string | undefined,
	getAux?: (value: string) => string | undefined,
) => { element: HTMLElement; refresh: () => void };

const FIELD_ICONS: Record<ImageGroupField, string> = {
	extension: "text",
	folder: "text",
	references: "binary",
	size: "binary",
};

const FIELD_IDS: Record<ImageGroupField, string> = {
	extension: "file.ext",
	folder: "file.folder",
	references: "imagine.references",
	size: "file.size",
};

/** Mirrors the 1.14.4 Bases Group page with project-owned data and callbacks. */
export function renderImageManagerGroupPanel(
	panel: HTMLElement,
	app: App,
	getState: () => ImageManagerGroupPanelState,
	actions: ImageManagerGroupPanelActions,
	createCombobox: GroupComboboxFactory,
): () => void {
	let removedOrder: string[] | undefined;
	let addingGroup = false;
	const addedGroupKeys = new Set<string>();
	let folderSuggest: FolderSuggest | null = null;
	const cleanup = (): void => {
		folderSuggest?.close();
		folderSuggest = null;
	};

	const render = (): void => {
		const state = getState();
		cleanup();
		panel.empty();
		const page = panel.createDiv("bases-toolbar-menu-container bases-group-page");
		const groupBySection = page.createDiv("bases-toolbar-section bases-groupby-container");
		groupBySection.createDiv({ cls: "bases-toolbar-section-header", text: "分组依据" });
		const row = groupBySection.createDiv("bases-toolbar-section-content")
			.createDiv("bases-toolbar-items")
			.createDiv("base-toolbar-sort-item");
		const controls = row.createDiv("metadata-property bases-sort-property-container");
		createCombobox(
			controls,
			"bases-sort-property",
			"属性",
			() => IMAGE_GROUP_FIELDS.map(([field, label]) => [field, label]),
			() => getState().groupBy?.field ?? "",
			(value) => {
				const current = getState();
				if (!value || current.groupBy?.field === value) return;
				removedOrder = undefined;
				addingGroup = false;
				addedGroupKeys.clear();
				actions.onGroupChange(
					{ field: value as ImageGroupField, direction: "asc" },
					current.groupOrder !== undefined ? [] : undefined,
				);
				queueMicrotask(() => {
					render();
					panel.querySelector<HTMLElement>(".bases-sort-direction")?.focus({ preventScroll: true });
				});
			},
			(value) => FIELD_ICONS[value as ImageGroupField],
			(value) => FIELD_IDS[value as ImageGroupField],
		);
		createCombobox(
			controls,
			"bases-sort-direction",
			"分组顺序",
			() => getDirectionItems(getState().groupBy?.field),
			() => getState().groupOrder !== undefined ? "manual" : getState().groupBy?.direction ?? "asc",
			(value) => {
				const current = getState();
				if (!current.groupBy) return;
				const selected = current.groupOrder !== undefined ? "manual" : current.groupBy.direction;
				if (value === selected) return;
				addingGroup = false;
				if (value === "manual") {
					actions.onGroupChange({ ...current.groupBy }, removedOrder ?? []);
					removedOrder = undefined;
				} else {
					if (current.groupOrder !== undefined) removedOrder = [...current.groupOrder];
					actions.onGroupChange({ field: current.groupBy.field, direction: value === "desc" ? "desc" : "asc" });
				}
				queueMicrotask(() => {
					render();
					panel.querySelector<HTMLElement>(".bases-sort-direction")?.focus({ preventScroll: true });
				});
			},
		);
		const remove = row.createDiv({
			cls: "clickable-icon",
			attr: { tabindex: "0", role: "button", "aria-label": "取消分组" },
		});
		setIcon(remove, "trash-2");
		const clearGroup = (): void => {
			removedOrder = undefined;
			addingGroup = false;
			addedGroupKeys.clear();
			actions.onGroupChange(undefined);
			render();
		};
		remove.addEventListener("click", clearGroup);
		remove.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			clearGroup();
		});

		const listSection = page.createDiv("bases-toolbar-section bases-group-list-container");
		if (state.groupOrder === undefined || !state.groupBy) {
			listSection.hide();
			return;
		}
		const list = listSection.createDiv("bases-toolbar-items bases-group-list");
		const rowsGroup = list.createDiv({ cls: "suggestion-group", attr: { "data-group": "rows" } });
		const actionsGroup = list.createDiv({ cls: "suggestion-group", attr: { "data-group": "actions" } });
		const available = new Map(state.groups.map((group) => [group.key, group]));
		for (const key of addedGroupKeys) {
			if (!available.has(key)) available.set(key, { key, label: formatGroupLabel(key), items: [] });
		}
		const visible = state.groupOrder.filter((key) => available.has(key));
		const unshownOrder = state.groupOrder.filter((key) => !available.has(key));
		const hidden = [...available.keys()].filter((key) => !visible.includes(key));
		const saveVisibleOrder = (order: string[]): void => {
			actions.onGroupOrderChange([...order, ...unshownOrder.filter((key) => !order.includes(key))]);
		};

		const selectItem = (item: HTMLElement): void => {
			for (const selected of Array.from(list.querySelectorAll<HTMLElement>(".suggestion-item.is-selected"))) {
				selected.removeClass("is-selected");
			}
			item.addClass("is-selected");
		};
		const moveFocus = (item: HTMLElement, delta: number): void => {
			const items = Array.from(list.querySelectorAll<HTMLElement>(".suggestion-item:not(.is-editing)"));
			const index = items.indexOf(item);
			const next = items[Math.max(0, Math.min(items.length - 1, index + delta))];
			if (next) {
				next.focus();
				selectItem(next);
			}
		};
		const renderGroupRow = (key: string, isVisible: boolean, index: number): void => {
			const group = available.get(key);
			const item = rowsGroup.createDiv("suggestion-item bases-toolbar-menu-item bases-group-row");
			item.toggleClass("mod-hidden", !isVisible);
			item.dataset.groupKey = key;
			item.tabIndex = 0;
			item.setAttribute("role", "menuitemcheckbox");
			item.setAttribute("aria-checked", String(isVisible));
			item.addEventListener("mousedown", (event) => event.preventDefault());
			item.addEventListener("mouseenter", () => selectItem(item));
			const grip = item.createDiv("grip-handle");
			setIcon(grip, "grip-vertical");
			const checkbox = item.createEl("input", { type: "checkbox" });
			checkbox.checked = isVisible;
			checkbox.tabIndex = -1;
			const info = item.createDiv("bases-toolbar-menu-item-info");
			info.createDiv({
				cls: "bases-toolbar-menu-item-name",
				text: group?.label ?? formatGroupLabel(key),
			});
			item.createDiv({ cls: "bases-group-row-count", text: (group?.items.length ?? 0).toLocaleString() });
			const toggle = (): void => {
				saveVisibleOrder(isVisible ? visible.filter((value) => value !== key) : [...visible, key]);
				render();
				Array.from(panel.querySelectorAll<HTMLElement>(".bases-group-row[data-group-key]"))
					.find((row) => row.dataset.groupKey === key)?.focus();
			};
			item.addEventListener("click", (event) => {
				if (grip.contains(event.target as Node)) return;
				event.preventDefault();
				toggle();
			});
			item.addEventListener("keydown", (event) => {
				if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown") && isVisible) {
					const nextIndex = Math.max(0, Math.min(visible.length - 1, index + (event.key === "ArrowUp" ? -1 : 1)));
					if (nextIndex === index) return;
					event.preventDefault();
					const reordered = [...visible];
					const [moved] = reordered.splice(index, 1);
					if (moved !== undefined) reordered.splice(nextIndex, 0, moved);
					saveVisibleOrder(reordered);
					render();
					Array.from(panel.querySelectorAll<HTMLElement>(".bases-group-row[data-group-key]"))
						.find((row) => row.dataset.groupKey === key)?.focus();
				} else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
					event.preventDefault();
					moveFocus(item, event.key === "ArrowUp" ? -1 : 1);
				} else if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					toggle();
				}
			});
			if (isVisible) {
				grip.addEventListener("click", (event) => event.stopPropagation());
				bindBasesVerticalReorder(grip, item, rowsGroup, 10, (newIndex) => {
					const targetIndex = Math.max(0, Math.min(visible.length - 1, newIndex));
					if (targetIndex === index) return;
					const reordered = [...visible];
					const [moved] = reordered.splice(index, 1);
					if (moved !== undefined) reordered.splice(targetIndex, 0, moved);
					saveVisibleOrder(reordered);
					render();
				});
			}
		};
		for (const [index, key] of visible.entries()) renderGroupRow(key, true, index);
		for (const key of hidden) renderGroupRow(key, false, -1);

		if (addingGroup) {
			const edit = rowsGroup.createDiv("suggestion-item bases-toolbar-menu-item bases-group-row is-editing");
			const grip = edit.createDiv("grip-handle");
			setIcon(grip, "grip-vertical");
			const checkbox = edit.createEl("input", { type: "checkbox" });
			checkbox.checked = true;
			checkbox.tabIndex = -1;
			checkbox.addEventListener("click", (event) => event.preventDefault());
			const value = edit.createDiv("bases-toolbar-menu-item-info")
				.createDiv("metadata-property bases-group-add-line")
				.createDiv("metadata-property-value");
			const input = new TextComponent(value).setPlaceholder(getAddPlaceholder(state.groupBy.field));
			input.inputEl.setAttribute("aria-label", "分组值");
			if (state.groupBy.field === "size" || state.groupBy.field === "references") {
				input.inputEl.type = "number";
				input.inputEl.min = "0";
				input.inputEl.step = "1";
			}
			edit.createDiv("bases-group-row-count");
			const commit = (): void => {
				if (!addingGroup) return;
				const raw = input.getValue().trim();
				if (!raw) {
					addingGroup = false;
					render();
					return;
				}
				const key = parseGroupKey(state.groupBy!.field, raw);
				if (key === null) {
					new Notice("请输入有效的分组值");
					input.inputEl.focus();
					return;
				}
				addingGroup = false;
				addedGroupKeys.add(key);
				saveVisibleOrder(visible.includes(key) ? visible : [...visible, key]);
				render();
			};
			if (state.groupBy.field === "folder") {
				folderSuggest = new FolderSuggest(app, input.inputEl, (path) => {
					input.setValue(path);
					commit();
				});
			}
			input.inputEl.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					commit();
				} else if (event.key === "Escape") {
					event.stopPropagation();
					addingGroup = false;
					render();
				}
			});
			input.inputEl.addEventListener("blur", () => {
				if (state.groupBy?.field === "folder") return;
				queueMicrotask(() => {
					if (edit.isConnected) commit();
				});
			});
		}

		const action = (icon: string, label: string, callback: () => void): void => {
			const item = actionsGroup.createDiv("suggestion-item bases-toolbar-menu-item");
			item.tabIndex = 0;
			item.setAttribute("role", "menuitem");
			item.addEventListener("mousedown", (event) => event.preventDefault());
			item.addEventListener("mouseenter", () => selectItem(item));
			const info = item.createDiv("bases-toolbar-menu-item-info");
			const iconEl = info.createDiv("bases-toolbar-menu-item-info-icon");
			setIcon(iconEl, icon);
			info.createDiv({ cls: "bases-toolbar-menu-item-name", text: label });
			item.addEventListener("click", callback);
			item.addEventListener("keydown", (event) => {
				if (event.key === "ArrowUp" || event.key === "ArrowDown") {
					event.preventDefault();
					moveFocus(item, event.key === "ArrowUp" ? -1 : 1);
				} else if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					callback();
				}
			});
		};
		action("plus", "添加分组", () => {
			addingGroup = true;
			render();
			panel.querySelector<HTMLInputElement>(".bases-group-add-line input")?.focus();
		});
		action(visible.length > 0 ? "eye-off" : "eye", visible.length > 0 ? "全部隐藏" : "显示全部", () => {
			saveVisibleOrder(visible.length > 0 ? [] : hidden);
			render();
		});
		list.querySelector<HTMLElement>(".suggestion-item")?.addClass("is-selected");
	};
	render();
	return cleanup;
}

function getDirectionItems(field?: ImageGroupField): Array<[string, string]> {
	if (field === "size" || field === "references") {
		return [["asc", "0 → 1"], ["desc", "1 → 0"], ["manual", "手动"]];
	}
	return [["asc", "排序 A → Z"], ["desc", "排序 Z → A"], ["manual", "手动"]];
}

function getAddPlaceholder(field: ImageGroupField): string {
	if (field === "extension") return "输入扩展名";
	if (field === "folder") return "输入文件夹路径";
	return "输入分组值";
}

function parseGroupKey(field: ImageGroupField, raw: string): string | null {
	const value = raw.trim();
	if (!value) return null;
	if (field === "extension") return normalizeExtension(value) || null;
	if (field === "folder") return normalizeVaultFolder(value) || null;
	if (field === "size" || field === "references") {
		return /^\d+$/.test(value) ? String(Number(value)) : null;
	}
	return value;
}
