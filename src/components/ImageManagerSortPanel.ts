import { setIcon } from "obsidian";
import { ImageSortRule, SortField } from "../types/image-manager.types";
import { bindBasesVerticalReorder } from "../utils/basesReorder";

type SortComboboxFactory = (
	container: HTMLElement,
	className: string,
	ariaLabel: string,
	getItems: () => Array<[string, string]>,
	getValue: () => string,
	onSelect: (value: string) => void,
	getIcon?: (value: string) => string | undefined,
	getAux?: (value: string) => string | undefined,
) => { element: HTMLElement; refresh: () => void };

interface SortRow {
	field: SortField | null;
	order: "asc" | "desc";
	element: HTMLElement;
	focusProperty: () => void;
}

const SORT_LABELS: Record<SortField, string> = {
	mtime: "修改时间",
	ctime: "创建时间",
	size: "文件大小",
	name: "文件名",
	extension: "扩展名",
	references: "引用数量",
};

const SORT_ICONS: Record<SortField, string> = {
	name: "text",
	ctime: "clock",
	mtime: "clock",
	size: "binary",
	extension: "text",
	references: "binary",
};

const SORT_PROPERTY_IDS: Record<SortField, string> = {
	name: "file.name",
	ctime: "file.ctime",
	mtime: "file.mtime",
	size: "file.size",
	extension: "file.ext",
	references: "imagine.references",
};

function getSortDirections(field: SortField | null): Array<[string, string]> {
	if (field === "ctime" || field === "mtime") {
		return [["asc", "从旧到新"], ["desc", "从新到旧"]];
	}
	if (field === "size" || field === "references") {
		return [["asc", "0 → 1"], ["desc", "1 → 0"]];
	}
	return [["asc", "排序 A → Z"], ["desc", "排序 Z → A"]];
}

/** The Bases 1.14.4 Sort page keeps unsaved blank rows while reconciling saved rows. */
export function renderImageManagerSortPanel(
	panel: HTMLElement,
	initialRules: readonly ImageSortRule[],
	onChange: (rules: ImageSortRule[]) => void,
	createCombobox: SortComboboxFactory,
): { update: (rules: readonly ImageSortRule[]) => void } {
	const page = panel.createDiv("bases-toolbar-menu-container bases-sort-page");
	const section = page.createDiv("bases-toolbar-section bases-sort-container");
	section.createDiv({ cls: "bases-toolbar-section-header", text: "排序依据" });
	const rowContainer = section.createDiv("bases-toolbar-section-content").createDiv("bases-toolbar-items");
	const actions = page.createDiv("bases-toolbar-section bases-toolbar-menu-actions");
	const addAction = actions.createDiv({
		cls: "bases-toolbar-menu-item bases-toolbar-menu-action tappable",
		attr: { tabindex: "0", role: "button", "aria-label": "添加排序" },
	});
	const actionInfo = addAction.createDiv("bases-toolbar-menu-item-info");
	setIcon(actionInfo.createDiv("bases-toolbar-menu-item-info-icon"), "lucide-plus");
	actionInfo.createDiv({ cls: "bases-toolbar-menu-item-name", text: "添加排序" });
	let rows: SortRow[] = [];

	const save = (): void => {
		onChange(rows.flatMap((row) => row.field
			? [{ field: row.field, order: row.order }]
			: []));
	};

	const createRow = (field: SortField | null, order: "asc" | "desc"): SortRow => {
		const element = rowContainer.createDiv("base-toolbar-sort-item");
		const grip = element.createDiv("grip-handle");
		setIcon(grip, "lucide-grip-vertical");
		const property = element.createDiv("metadata-property bases-sort-property-container");
		let propertyControl: { element: HTMLElement; refresh: () => void };
		const row: SortRow = {
			field, order, element,
			focusProperty: () => propertyControl.element.focus({ preventScroll: true }),
		};
		let directionControl: { element: HTMLElement; refresh: () => void };
		propertyControl = createCombobox(
			property, "bases-sort-property", "属性",
			() => Object.entries(SORT_LABELS),
			() => row.field ?? "",
			(value) => {
				if (!Object.prototype.hasOwnProperty.call(SORT_LABELS, value) || row.field === value) return;
				row.field = value as SortField;
				directionControl.refresh();
				save();
				queueMicrotask(() => directionControl.element.focus({ preventScroll: true }));
			},
			(value) => SORT_ICONS[value as SortField],
			(value) => SORT_PROPERTY_IDS[value as SortField],
		);
		directionControl = createCombobox(
			property, "bases-sort-direction", "排序方式",
			() => getSortDirections(row.field),
			() => row.order,
			(value) => {
				const next = value === "desc" ? "desc" : "asc";
				if (next === row.order) return;
				row.order = next;
				save();
			},
		);
		const remove = element.createDiv({
			cls: "clickable-icon",
			attr: { tabindex: "0", role: "button", "aria-label": "删除排序" },
		});
		setIcon(remove, "lucide-trash-2");
		const removeRow = (): void => {
			const index = rows.indexOf(row);
			if (index < 0) return;
			rows.splice(index, 1);
			element.remove();
			if (rows.length === 0) appendRow(null, "asc");
			save();
		};
		remove.addEventListener("click", removeRow);
		remove.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			removeRow();
		});
		bindBasesVerticalReorder(grip, element, rowContainer, 10, (newIndex) => {
			const oldIndex = rows.indexOf(row);
			if (oldIndex < 0 || oldIndex === newIndex) return;
			rows.splice(oldIndex, 1);
			rows.splice(Math.min(newIndex, rows.length), 0, row);
			save();
		});
		return row;
	};

	const appendRow = (field: SortField | null, order: "asc" | "desc"): SortRow => {
		const row = createRow(field, order);
		rows.push(row);
		return row;
	};

	const update = (rules: readonly ImageSortRule[]): void => {
		const available = [...rows];
		const saved = rules.map((rule) => {
			const index = available.findIndex((row) => row.field === rule.field && row.order === rule.order);
			if (index >= 0) return available.splice(index, 1)[0];
			return createRow(rule.field, rule.order);
		});
		rows = [...saved, ...available.filter((row) => row.field === null)];
		if (rows.length === 0) appendRow(null, "asc");
		rowContainer.setChildrenInPlace(rows.map((row) => row.element));
	};

	const addSort = (): void => {
		const row = appendRow(null, "asc");
		row.focusProperty();
	};
	addAction.addEventListener("click", addSort);
	addAction.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		addSort();
	});
	update(initialRules);
	return { update };
}
