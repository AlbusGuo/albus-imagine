import { setIcon } from "obsidian";
import { ImageItem, ImageManagerLayout } from "../types/image-manager.types";
import { ImageGroup } from "../utils/imageGrouping";
import { ViewportGrid, ViewportGridController } from "./ViewportGrid";
import { ViewportMasonry } from "./ViewportMasonry";

type GroupViewport<Controller extends ViewportGridController<ImageItem>> =
	| ViewportGrid<ImageItem, Controller>
	| ViewportMasonry<ImageItem, Controller>;

interface GroupSection<Controller extends ViewportGridController<ImageItem>> {
	key: string;
	element: HTMLElement;
	header: HTMLElement;
	chevron: HTMLElement;
	label: HTMLElement;
	grid: HTMLElement;
	items: ImageItem[];
	viewport: GroupViewport<Controller> | null;
}

interface GroupedImageViewportOptions<Controller extends ViewportGridController<ImageItem>> {
	viewportEl: HTMLElement;
	rootEl: HTMLElement;
	layout: ImageManagerLayout;
	groupPropertyLabel: string;
	minimumItemWidth: number;
	estimatedGridItemHeight: number;
	getGroups: (items: readonly ImageItem[]) => ImageGroup[];
	isCollapsed: (key: string) => boolean;
	onToggleGroup: (key: string) => void;
	create: (image: ImageItem) => Controller;
	update: (controller: Controller, image: ImageItem) => void;
	dispose: (controller: Controller) => void;
	shouldReuse: (previous: ImageItem, next: ImageItem) => boolean;
	onVisibleChange: (controllers: readonly Controller[]) => void;
	getEstimatedHeight: (image: ImageItem, width: number, aspectRatio: number) => number;
}

/** One scroll surface containing independently virtualized, collapsible groups. */
export class GroupedImageViewport<Controller extends ViewportGridController<ImageItem>> {
	private readonly sections = new Map<string, GroupSection<Controller>>();
	private readonly visibleByGroup = new Map<string, readonly Controller[]>();
	private readonly groupByPath = new Map<string, string>();
	private readonly sectionObserver: IntersectionObserver;
	private disposed = false;

	constructor(private readonly options: GroupedImageViewportOptions<Controller>) {
		options.rootEl.addClass("afm-grouped-sections");
		const OwnerObserver = options.rootEl.ownerDocument.defaultView?.IntersectionObserver ?? IntersectionObserver;
		this.sectionObserver = new OwnerObserver((entries) => {
			for (const entry of entries) {
				const key = (entry.target as HTMLElement).dataset.afmGroupKey;
				const section = key === undefined ? undefined : this.sections.get(key);
				if (!section || section.element !== entry.target) continue;
				if (entry.isIntersecting && !this.options.isCollapsed(key!)) this.mount(section);
				else this.unmount(section);
			}
		}, { root: options.viewportEl, rootMargin: "600px 0px" });
	}

	setItems(items: readonly ImageItem[]): void {
		if (this.disposed) return;
		const groups = this.options.getGroups(items);
		const activeKeys = new Set(groups.map((group) => group.key));
		this.groupByPath.clear();
		for (const group of groups) {
			for (const item of group.items) this.groupByPath.set(item.path, group.key);
		}
		for (const [key, section] of this.sections) {
			if (activeKeys.has(key)) continue;
			this.sectionObserver.unobserve(section.element);
			this.unmount(section);
			section.element.remove();
			this.sections.delete(key);
			this.visibleByGroup.delete(key);
		}
		for (const [index, group] of groups.entries()) {
			let section = this.sections.get(group.key);
			if (!section) {
				section = this.createSection(group.key);
				this.sections.set(group.key, section);
			}
			const current = this.options.rootEl.children.item(index);
			if (current !== section.element) this.options.rootEl.insertBefore(section.element, current);
			section.label.setText(group.label);
			section.items = group.items;
			const collapsed = this.options.isCollapsed(group.key);
			const wasCollapsed = section.element.hasClass("is-collapsed");
			section.header.toggleClass("is-collapsed", collapsed);
			section.chevron.toggleClass("is-collapsed", collapsed);
			section.element.toggleClass("is-collapsed", collapsed);
			if (collapsed) {
				this.unmount(section);
				section.grid.hide();
				this.visibleByGroup.delete(group.key);
			} else {
				section.grid.show();
				if (section.viewport) section.viewport.setItems(group.items);
				else if (wasCollapsed && this.isNearViewport(section)) this.mount(section);
				else this.setPlaceholderHeight(section);
			}
		}
		this.notifyVisible();
	}

	setMinimumItemWidth(width: number): void {
		this.options.minimumItemWidth = width;
		for (const section of this.sections.values()) {
			if (section.viewport) section.viewport.setMinimumItemWidth(width);
			else this.setPlaceholderHeight(section);
		}
	}

	setItemAspectRatio(path: string, ratio: number): void {
		const key = this.groupByPath.get(path);
		const viewport = key === undefined ? null : this.sections.get(key)?.viewport;
		if (viewport instanceof ViewportMasonry) viewport.setItemAspectRatio(path, ratio);
	}

	refreshVisible(): void {
		for (const section of this.sections.values()) section.viewport?.refreshVisible();
		this.notifyVisible();
	}

	destroy(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.sectionObserver.disconnect();
		for (const section of this.sections.values()) this.unmount(section);
		this.sections.clear();
		this.visibleByGroup.clear();
		this.groupByPath.clear();
		this.options.rootEl.empty();
		this.options.rootEl.removeClass("afm-grouped-sections");
	}

	private createSection(key: string): GroupSection<Controller> {
		const element = this.options.rootEl.createDiv("afm-group-section");
		element.dataset.afmGroupKey = key;
		const header = element.createDiv("bases-group-heading mod-collapsible afm-group-header");
		header.createDiv({ cls: "bases-group-property", text: this.options.groupPropertyLabel });
		const label = header.createDiv("bases-group-value");
		const chevron = header.createDiv("collapse-indicator collapse-icon");
		setIcon(chevron, "lucide-chevron-right");
		header.addEventListener("click", (event) => {
			if (event.defaultPrevented || event.button !== 0) return;
			event.preventDefault();
			this.options.onToggleGroup(key);
		});
		const grid = element.createDiv("image-manager-grid afm-group-grid");
		this.sectionObserver.observe(element);
		return { key, element, header, chevron, label, grid, items: [], viewport: null };
	}

	private isNearViewport(section: GroupSection<Controller>): boolean {
		const viewport = this.options.viewportEl.getBoundingClientRect();
		const bounds = section.element.getBoundingClientRect();
		return bounds.bottom >= viewport.top - 600 && bounds.top <= viewport.bottom + 600;
	}

	private mount(section: GroupSection<Controller>): void {
		if (section.viewport || this.disposed) return;
		section.grid.removeClass("afm-group-placeholder");
		section.grid.style.removeProperty("--afm-group-placeholder-height");
		section.viewport = this.createViewport(section.key, section.grid);
		section.viewport.setItems(section.items);
	}

	private unmount(section: GroupSection<Controller>): void {
		if (!section.viewport) return;
		const measuredHeight = section.grid.offsetHeight;
		section.viewport.destroy();
		section.viewport = null;
		this.visibleByGroup.delete(section.key);
		this.setPlaceholderHeight(section, measuredHeight);
		this.notifyVisible();
	}

	private setPlaceholderHeight(section: GroupSection<Controller>, measuredHeight?: number): void {
		const height = measuredHeight && measuredHeight > 0 ? measuredHeight : this.estimateHeight(section.items);
		section.grid.addClass("afm-group-placeholder");
		section.grid.setCssProps({ "--afm-group-placeholder-height": `${height}px` });
	}

	private estimateHeight(items: readonly ImageItem[]): number {
		if (items.length === 0) return 0;
		const gap = 12;
		const padding = 0;
		const availableWidth = Math.max(1, this.options.rootEl.clientWidth - 24);
		const columns = Math.max(1, Math.floor((availableWidth + gap) / (this.options.minimumItemWidth + gap)));
		if (this.options.layout === "grid") {
			const rows = Math.ceil(items.length / columns);
			return padding * 2 + rows * this.options.estimatedGridItemHeight + (rows - 1) * gap;
		}
		const width = (availableWidth - gap * (columns - 1)) / columns;
		const heights = Array.from({ length: columns }, () => padding);
		for (const item of items) {
			let shortest = 0;
			for (let index = 1; index < columns; index += 1) {
				if (heights[index] < heights[shortest]) shortest = index;
			}
			heights[shortest] += this.options.getEstimatedHeight(item, width, 1) + gap;
		}
		return Math.max(...heights) - gap + padding;
	}

	private createViewport(key: string, gridEl: HTMLElement): GroupViewport<Controller> {
		const localTop = (): number =>
			this.options.viewportEl.getBoundingClientRect().top - gridEl.getBoundingClientRect().top;
		const common = {
			viewportEl: this.options.viewportEl,
			gridEl,
			getLocalViewportTop: localTop,
			getKey: (item: ImageItem): string => item.path,
			create: this.options.create,
			update: this.options.update,
			dispose: this.options.dispose,
			shouldReuse: this.options.shouldReuse,
			onVisibleChange: (controllers: readonly Controller[]): void => {
				this.visibleByGroup.set(key, controllers);
				this.notifyVisible();
			},
			minimumItemWidth: this.options.minimumItemWidth,
			gap: 12,
			padding: 0,
			maxDetachedItems: 20,
		};
		return this.options.layout === "masonry"
			? new ViewportMasonry({
				...common,
				getEstimatedHeight: this.options.getEstimatedHeight,
				overscanPixels: this.options.viewportEl.clientHeight,
			})
			: new ViewportGrid({ ...common, estimatedItemHeight: this.options.estimatedGridItemHeight, overscanRows: 3 });
	}

	private notifyVisible(): void {
		if (this.disposed) return;
		this.options.onVisibleChange(Array.from(this.visibleByGroup.values()).flat());
	}
}
