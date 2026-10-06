export interface ViewportGridController<Item> {
	element: HTMLElement;
	item: Item;
}

interface ViewportGridOptions<Item, Controller extends ViewportGridController<Item>> {
	viewportEl: HTMLElement;
	gridEl: HTMLElement;
	/** Position of the viewport top in this grid's own scroll coordinates. */
	getLocalViewportTop?: () => number;
	getKey: (item: Item) => string;
	create: (item: Item) => Controller;
	update: (controller: Controller, item: Item) => void;
	dispose?: (controller: Controller) => void;
	shouldReuse?: (previous: Item, next: Item) => boolean;
	onVisibleChange?: (controllers: readonly Controller[]) => void;
	minimumItemWidth: number;
	minimumColumns?: number;
	compactItemWidth?: number;
	compactBreakpoint?: number;
	estimatedItemHeight: number;
	gap?: number;
	padding?: number;
	overscanRows?: number;
	/** Maximum number of detached controllers retained for quick reuse. */
	maxDetachedItems?: number;
}

interface GridSlot<Item, Controller> {
	key: string;
	item: Item;
	controller: Controller;
}

/**
 * Keyed row virtualizer for fixed-size card grids. Controllers are cached while
 * detached so sorting, filtering and revisiting rows reuse existing cards.
 */
export class ViewportGrid<
	Item,
	Controller extends ViewportGridController<Item>,
> {
	private readonly slots = new Map<string, GridSlot<Item, Controller>>();
	private readonly topSpacerEl: HTMLElement;
	private readonly bottomSpacerEl: HTMLElement;
	private readonly resizeObserver: ResizeObserver;
	private items: readonly Item[] = [];
	private frame: number | null = null;
	private renderedStartRow = -1;
	private renderedEndRow = -1;
	private renderedColumns = -1;
	private measuredItemHeight: number | null = null;
	private disposed = false;

	constructor(private readonly options: ViewportGridOptions<Item, Controller>) {
		this.topSpacerEl = this.createSpacer("is-top");
		this.bottomSpacerEl = this.createSpacer("is-bottom");
		const ResizeObserverConstructor = options.gridEl.ownerDocument.defaultView?.ResizeObserver ?? ResizeObserver;
		this.resizeObserver = new ResizeObserverConstructor(() => this.scheduleRender());
		this.resizeObserver.observe(options.viewportEl);
		this.resizeObserver.observe(options.gridEl);
		options.viewportEl.addEventListener("scroll", this.handleScroll, { passive: true });
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
				continue;
			}
			if (slot.item !== item && !this.options.shouldReuse?.(slot.item, item)) {
				this.disposeSlot(slot);
				this.slots.delete(key);
				continue;
			}
			slot.item = item;
		}
		this.items = uniqueItems;
		this.renderedStartRow = -1;
		this.renderedEndRow = -1;
		this.renderWindow();
	}

	refreshVisible(): void {
		for (const child of Array.from(this.options.gridEl.children)) {
			const key = (child as HTMLElement).dataset.afmViewportKey;
			if (!key) continue;
			const slot = this.slots.get(key);
			if (slot) this.options.update(slot.controller, slot.item);
		}
		this.notifyVisibleControllers();
	}

	setMinimumItemWidth(width: number): void {
		if (this.disposed || this.options.minimumItemWidth === width) return;
		this.options.minimumItemWidth = width;
		this.renderedStartRow = -1;
		this.renderedEndRow = -1;
		this.renderedColumns = -1;
		this.scheduleRender();
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
		this.options.gridEl.empty();
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
		if (this.items.length === 0) {
			this.reconcileChildren([]);
			this.notifyVisibleControllers();
			return;
		}

		const gap = this.options.gap ?? 12;
		const padding = this.options.padding ?? 16;
		const availableWidth = Math.max(1, this.options.gridEl.clientWidth - padding * 2);
		const requestedItemWidth =
			availableWidth <= (this.options.compactBreakpoint ?? 768)
				? (this.options.compactItemWidth ?? this.options.minimumItemWidth)
				: this.options.minimumItemWidth;
		const minimumColumns = Math.max(1, Math.floor(this.options.minimumColumns ?? 1));
		const minimumItemWidth = Math.min(
			requestedItemWidth,
			Math.max(1, (availableWidth - gap * (minimumColumns - 1)) / minimumColumns),
		);
		const columns = Math.max(
			minimumColumns,
			Math.floor((availableWidth + gap) / (minimumItemWidth + gap)),
		);
		const rowStride = Math.max(1, (this.measuredItemHeight ?? this.options.estimatedItemHeight) + gap);
		const rowCount = Math.ceil(this.items.length / columns);
		const overscanRows = this.options.overscanRows ?? 5;
		const visibleRows = Math.max(1, Math.ceil(this.options.viewportEl.clientHeight / rowStride));
		const localTop = this.options.getLocalViewportTop?.() ?? this.options.viewportEl.scrollTop;
		const totalHeight = padding * 2 + rowCount * rowStride - gap;
		const overscanHeight = overscanRows * rowStride;
		if (localTop + this.options.viewportEl.clientHeight < -overscanHeight || localTop > totalHeight + overscanHeight) {
			this.renderedStartRow = -1;
			this.renderedEndRow = -1;
			this.setSpacerHeight(this.topSpacerEl, rowCount * rowStride - gap);
			this.reconcileChildren([this.topSpacerEl]);
			this.notifyVisibleControllers();
			return;
		}
		const unclampedStartRow = Math.max(
			0,
			Math.floor(Math.max(0, localTop - padding) / rowStride) - overscanRows,
		);
		const startRow = Math.min(Math.max(0, rowCount - visibleRows), unclampedStartRow);
		const endRow = Math.min(rowCount, startRow + visibleRows + overscanRows * 2);

		if (
			startRow === this.renderedStartRow &&
			endRow === this.renderedEndRow &&
			columns === this.renderedColumns
		) {
			// A restored background leaf can become visible without changing its
			// virtual row range. Re-notify consumers so deferred work can resume.
			this.notifyVisibleControllers();
			return;
		}

		this.renderedStartRow = startRow;
		this.renderedEndRow = endRow;
		this.renderedColumns = columns;
		this.options.gridEl.setCssProps({ "--afm-viewport-columns": String(columns) });

		const desiredChildren: HTMLElement[] = [];
		if (startRow > 0) {
			this.setSpacerHeight(this.topSpacerEl, startRow * rowStride - gap);
			desiredChildren.push(this.topSpacerEl);
		}
		const startIndex = startRow * columns;
		const endIndex = Math.min(this.items.length, endRow * columns);
		for (let index = startIndex; index < endIndex; index += 1) {
			const item = this.items[index];
			if (!item) continue;
			const slot = this.getOrCreateSlot(item);
			this.options.update(slot.controller, item);
			desiredChildren.push(slot.controller.element);
		}
		if (endRow < rowCount) {
			this.setSpacerHeight(this.bottomSpacerEl, (rowCount - endRow) * rowStride - gap);
			desiredChildren.push(this.bottomSpacerEl);
		}
		this.reconcileChildren(desiredChildren);
		this.pruneDetachedSlots(new Set(
			desiredChildren
				.map((element) => element.dataset.afmViewportKey)
				.filter((key): key is string => Boolean(key)),
		));
		this.measureRenderedItems();
		this.notifyVisibleControllers();
	}

	private getOrCreateSlot(item: Item): GridSlot<Item, Controller> {
		const key = this.options.getKey(item);
		const existing = this.slots.get(key);
		if (existing) {
			// Map insertion order doubles as an inexpensive LRU list.
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
		while (container.children.length > desiredChildren.length) {
			container.lastElementChild?.remove();
		}
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

	private createSpacer(position: string): HTMLElement {
		const spacer = this.options.gridEl.ownerDocument.win.createDiv();
		spacer.addClass("afm-viewport-spacer", position);
		return spacer;
	}

	private measureRenderedItems(): void {
		const OwnerHTMLElement = this.options.gridEl.ownerDocument.defaultView?.HTMLElement;
		if (!OwnerHTMLElement) return;
		const heights = Array.from(this.options.gridEl.children)
			.filter((child): child is HTMLElement =>
				child.instanceOf(OwnerHTMLElement) && Boolean(child.dataset.afmViewportKey),
			)
			.map((element) => element.offsetHeight)
			.filter((height) => height > 0);
		if (heights.length === 0) return;
		const measured = Math.max(...heights);
		if (this.measuredItemHeight !== null && Math.abs(this.measuredItemHeight - measured) < 1) return;
		this.measuredItemHeight = measured;
		this.renderedStartRow = -1;
		this.renderedEndRow = -1;
		this.scheduleRender();
	}

	private setSpacerHeight(spacer: HTMLElement, height: number): void {
		spacer.setCssProps({ "--afm-viewport-spacer-height": `${Math.max(0, height)}px` });
	}

	private disposeSlot(slot: GridSlot<Item, Controller>): void {
		this.options.dispose?.(slot.controller);
		slot.controller.element.remove();
	}

	private cancelFrame(): void {
		if (this.frame === null) return;
		this.options.gridEl.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);
		this.frame = null;
	}
}
