import { ViewportGridController } from "./ViewportGrid";

interface ViewportMasonryOptions<Item, Controller extends ViewportGridController<Item>> {
	viewportEl: HTMLElement;
	gridEl: HTMLElement;
	getLocalViewportTop?: () => number;
	getKey: (item: Item) => string;
	create: (item: Item) => Controller;
	update: (controller: Controller, item: Item) => void;
	dispose?: (controller: Controller) => void;
	shouldReuse?: (previous: Item, next: Item) => boolean;
	onVisibleChange?: (controllers: readonly Controller[]) => void;
	getEstimatedHeight: (item: Item, width: number, aspectRatio: number) => number;
	minimumItemWidth: number;
	minimumColumns?: number;
	gap?: number;
	padding?: number;
	overscanPixels?: number;
	maxDetachedItems?: number;
}

interface MasonrySlot<Item, Controller> {
	key: string;
	item: Item;
	controller: Controller;
}

interface MasonryEntry<Item> {
	key: string;
	item: Item;
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Virtualized shortest-column masonry layout for attachment cards. */
export class ViewportMasonry<
	Item,
	Controller extends ViewportGridController<Item>,
> {
	private readonly slots = new Map<string, MasonrySlot<Item, Controller>>();
	private readonly aspectRatios = new Map<string, number>();
	private readonly resizeObserver: ResizeObserver;
	private items: readonly Item[] = [];
	private entries: MasonryEntry<Item>[] = [];
	private frame: number | null = null;
	private layoutDirty = true;
	private disposed = false;

	constructor(private readonly options: ViewportMasonryOptions<Item, Controller>) {
		const ResizeObserverConstructor = options.gridEl.ownerDocument.defaultView?.ResizeObserver ?? ResizeObserver;
		this.resizeObserver = new ResizeObserverConstructor(() => {
			this.layoutDirty = true;
			this.scheduleRender();
		});
		this.resizeObserver.observe(options.viewportEl);
		this.resizeObserver.observe(options.gridEl);
		options.viewportEl.addEventListener("scroll", this.handleScroll, { passive: true });
		options.gridEl.addClass("afm-masonry-grid");
	}

	setItems(items: readonly Item[]): void {
		if (this.disposed) return;
		const uniqueItems = Array.from(new Map(items.map((item) => [this.options.getKey(item), item])).values());
		const activeItems = new Map(uniqueItems.map((item) => [this.options.getKey(item), item]));
		for (const [key, slot] of this.slots) {
			const item = activeItems.get(key);
			if (!item) {
				this.disposeSlot(slot);
				this.slots.delete(key);
				this.aspectRatios.delete(key);
				continue;
			}
			if (slot.item !== item && !this.options.shouldReuse?.(slot.item, item)) {
				this.disposeSlot(slot);
				this.slots.delete(key);
				this.aspectRatios.delete(key);
				continue;
			}
			slot.item = item;
		}
		this.items = uniqueItems;
		this.layoutDirty = true;
		this.renderWindow();
	}

	setMinimumItemWidth(width: number): void {
		if (this.disposed || this.options.minimumItemWidth === width) return;
		this.options.minimumItemWidth = width;
		this.layoutDirty = true;
		this.scheduleRender();
	}

	setItemAspectRatio(key: string, aspectRatio: number): void {
		if (this.disposed || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return;
		const normalized = Math.min(4, Math.max(0.25, aspectRatio));
		if (Math.abs((this.aspectRatios.get(key) ?? 1) - normalized) < 0.01) return;
		this.aspectRatios.set(key, normalized);
		this.layoutDirty = true;
		this.scheduleRender();
	}

	refreshVisible(): void {
		for (const child of Array.from(this.options.gridEl.children)) {
			const key = (child as HTMLElement).dataset.afmViewportKey;
			const slot = key ? this.slots.get(key) : undefined;
			if (slot) this.options.update(slot.controller, slot.item);
		}
		this.notifyVisibleControllers();
	}

	destroy(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.cancelFrame();
		this.resizeObserver.disconnect();
		this.options.viewportEl.removeEventListener("scroll", this.handleScroll);
		for (const slot of this.slots.values()) this.disposeSlot(slot);
		this.slots.clear();
		this.items = [];
		this.entries = [];
		this.options.gridEl.empty();
		this.options.gridEl.removeClass("afm-masonry-grid");
		this.options.gridEl.style.removeProperty("--afm-masonry-height");
	}

	private readonly handleScroll = (): void => this.scheduleRender();

	private scheduleRender(): void {
		if (this.disposed || this.frame !== null) return;
		const ownerWindow = this.options.gridEl.ownerDocument.defaultView;
		if (!ownerWindow) return;
		this.frame = ownerWindow.requestAnimationFrame(() => {
			this.frame = null;
			this.renderWindow();
		});
	}

	private renderWindow(): void {
		if (this.disposed) return;
		if (this.layoutDirty) this.calculateLayout();
		if (this.entries.length === 0) {
			this.reconcileChildren([]);
			this.notifyVisibleControllers();
			return;
		}
		const overscan = this.options.overscanPixels ?? this.options.viewportEl.clientHeight;
		const localTop = this.options.getLocalViewportTop?.() ?? this.options.viewportEl.scrollTop;
		const top = Math.max(0, localTop - overscan);
		const bottom = localTop + this.options.viewportEl.clientHeight + overscan;
		const visibleEntries = this.entries.filter((entry) => entry.y + entry.height >= top && entry.y <= bottom);
		const desiredChildren: HTMLElement[] = [];
		for (const entry of visibleEntries) {
			const slot = this.getOrCreateSlot(entry.item);
			this.options.update(slot.controller, entry.item);
			slot.controller.element.setCssProps({
				"--afm-masonry-x": `${entry.x}px`,
				"--afm-masonry-y": `${entry.y}px`,
				"--afm-masonry-width": `${entry.width}px`,
				"--afm-masonry-height": `${entry.height}px`,
			});
			desiredChildren.push(slot.controller.element);
		}
		this.reconcileChildren(desiredChildren);
		this.pruneDetachedSlots(new Set(visibleEntries.map((entry) => entry.key)));
		this.notifyVisibleControllers();
	}

	private calculateLayout(): void {
		this.layoutDirty = false;
		const gap = this.options.gap ?? 12;
		const padding = this.options.padding ?? 12;
		const availableWidth = Math.max(1, this.options.gridEl.clientWidth - padding * 2);
		const minimumColumns = Math.max(1, Math.floor(this.options.minimumColumns ?? 1));
		const minimumItemWidth = Math.min(
			this.options.minimumItemWidth,
			Math.max(1, (availableWidth - gap * (minimumColumns - 1)) / minimumColumns),
		);
		const columns = Math.max(
			minimumColumns,
			Math.floor((availableWidth + gap) / (minimumItemWidth + gap)),
		);
		const width = (availableWidth - gap * (columns - 1)) / columns;
		const columnHeights = Array.from({ length: columns }, () => padding);
		this.entries = this.items.map((item) => {
			let column = 0;
			for (let index = 1; index < columnHeights.length; index += 1) {
				if ((columnHeights[index] ?? 0) < (columnHeights[column] ?? 0)) column = index;
			}
			const key = this.options.getKey(item);
			const height = Math.max(1, this.options.getEstimatedHeight(item, width, this.aspectRatios.get(key) ?? 1));
			const entry = {
				key,
				item,
				x: padding + column * (width + gap),
				y: columnHeights[column] ?? padding,
				width,
				height,
			};
			columnHeights[column] = entry.y + height + gap;
			return entry;
		});
		const height = Math.max(padding, ...columnHeights) - gap + padding;
		this.options.gridEl.setCssProps({ "--afm-masonry-height": `${Math.max(0, height)}px` });
	}

	private getOrCreateSlot(item: Item): MasonrySlot<Item, Controller> {
		const key = this.options.getKey(item);
		const existing = this.slots.get(key);
		if (existing) {
			this.slots.delete(key);
			this.slots.set(key, existing);
			return existing;
		}
		const controller = this.options.create(item);
		controller.element.dataset.afmViewportKey = key;
		const slot = { key, item, controller };
		this.slots.set(key, slot);
		return slot;
	}

	private pruneDetachedSlots(attachedKeys: ReadonlySet<string>): void {
		const limit = Math.max(0, Math.floor(this.options.maxDetachedItems ?? 20));
		let detachedCount = this.slots.size - attachedKeys.size;
		if (detachedCount <= limit) return;
		for (const [key, slot] of this.slots) {
			if (attachedKeys.has(key)) continue;
			this.disposeSlot(slot);
			this.slots.delete(key);
			detachedCount -= 1;
			if (detachedCount <= limit) break;
		}
	}

	private reconcileChildren(desiredChildren: readonly HTMLElement[]): void {
		const container = this.options.gridEl;
		for (let index = 0; index < desiredChildren.length; index += 1) {
			const desired = desiredChildren[index];
			if (!desired) continue;
			const current = container.children.item(index);
			if (current !== desired) container.insertBefore(desired, current);
		}
		while (container.children.length > desiredChildren.length) container.lastElementChild?.remove();
	}

	private notifyVisibleControllers(): void {
		if (!this.options.onVisibleChange) return;
		const visible: Controller[] = [];
		for (const child of Array.from(this.options.gridEl.children)) {
			const key = (child as HTMLElement).dataset.afmViewportKey;
			const controller = key ? this.slots.get(key)?.controller : undefined;
			if (controller) visible.push(controller);
		}
		this.options.onVisibleChange(visible);
	}

	private disposeSlot(slot: MasonrySlot<Item, Controller>): void {
		this.options.dispose?.(slot.controller);
		slot.controller.element.remove();
	}

	private cancelFrame(): void {
		if (this.frame === null) return;
		this.options.gridEl.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);
		this.frame = null;
	}
}
