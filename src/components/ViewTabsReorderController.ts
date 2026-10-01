interface TabDragState {
	pointerId: number;
	sourceEl: HTMLButtonElement;
	sourceId: string;
	pointerType: string;
	startClientX: number;
	startClientY: number;
	lastClientX: number;
	initialIndex: number;
	currentIndex: number;
	initialScrollLeft: number;
	tabs: HTMLButtonElement[];
	rects: DOMRect[];
	touchReady: boolean;
	active: boolean;
}

/** Horizontal view-tab sorting interaction mirrored from More Bases Views. */
export class ViewTabsReorderController {
	private drag: TabDragState | null = null;
	private abort: AbortController | null = null;
	private activationTimer: number | null = null;
	private autoScrollFrame: number | null = null;
	private settleTimer: number | null = null;
	private suppressedId: string | null = null;
	private suppressClickUntil = 0;

	constructor(
		private readonly listEl: HTMLElement,
		private readonly onCommit: (ids: string[]) => void,
	) { }

	bind(tabEl: HTMLButtonElement, id: string): void {
		tabEl.addEventListener("pointerdown", (event) => {
			if (this.drag || this.settleTimer !== null || !event.isPrimary || event.button !== 0) return;
			const tabs = this.getTabs();
			const initialIndex = tabs.indexOf(tabEl);
			if (initialIndex < 0) return;
			this.drag = {
				pointerId: event.pointerId,
				sourceEl: tabEl,
				sourceId: id,
				pointerType: event.pointerType,
				startClientX: event.clientX,
				startClientY: event.clientY,
				lastClientX: event.clientX,
				initialIndex,
				currentIndex: initialIndex,
				initialScrollLeft: this.listEl.scrollLeft,
				tabs,
				rects: tabs.map((tab) => tab.getBoundingClientRect()),
				touchReady: event.pointerType !== "touch",
				active: false,
			};
			this.bindEvents(tabEl.ownerDocument);
			if (event.pointerType === "touch") {
				this.activationTimer = this.listEl.ownerDocument.defaultView?.setTimeout(() => {
					this.activationTimer = null;
					const drag = this.drag;
					if (!drag || drag.pointerId !== event.pointerId) return;
					drag.touchReady = true;
					this.activate(drag);
				}, 180) ?? null;
			}
		});
	}

	consumeSuppressedClick(id: string): boolean {
		if (this.suppressedId !== id || performance.now() > this.suppressClickUntil) return false;
		this.suppressedId = null;
		this.suppressClickUntil = 0;
		return true;
	}

	cancel(): void {
		this.cancelDrag(false);
	}

	destroy(): void {
		this.cancelDrag(false);
		if (this.settleTimer !== null) this.listEl.ownerDocument.defaultView?.clearTimeout(this.settleTimer);
		this.settleTimer = null;
	}

	private bindEvents(ownerDocument: Document): void {
		this.abort?.abort();
		const abort = new AbortController();
		this.abort = abort;
		ownerDocument.addEventListener("pointermove", (event) => this.handleMove(event), { signal: abort.signal });
		ownerDocument.addEventListener("pointerup", (event) => this.handleEnd(event, false), { capture: true, signal: abort.signal });
		ownerDocument.addEventListener("pointercancel", (event) => this.handleEnd(event, true), { signal: abort.signal });
		ownerDocument.addEventListener("keydown", (event) => {
			if (event.key !== "Escape" || !this.drag?.active) return;
			event.preventDefault();
			this.cancelDrag(true);
		}, { signal: abort.signal });
	}

	private handleMove(event: PointerEvent): void {
		const drag = this.drag;
		if (!drag || event.pointerId !== drag.pointerId) return;
		drag.lastClientX = event.clientX;
		if (!drag.active) {
			const distance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
			if (drag.pointerType === "touch") {
				if (!drag.touchReady && distance > 8) {
					this.cancelDrag(false);
					return;
				}
				if (!drag.touchReady) return;
			} else if (distance < 4) return;
			this.activate(drag);
		}
		event.preventDefault();
		this.updateSort(drag);
	}

	private activate(drag: TabDragState): void {
		if (drag.active || this.drag !== drag) return;
		drag.active = true;
		drag.sourceEl.addClass("is-dragging");
		drag.sourceEl.dataset.dragging = "true";
		drag.sourceEl.setAttribute("aria-grabbed", "true");
		this.listEl.addClass("is-sorting");
		this.startAutoScroll();
		this.updateSort(drag);
	}

	private updateSort(drag: TabDragState): void {
		const scrollDelta = this.listEl.scrollLeft - drag.initialScrollLeft;
		const pointerDelta = drag.lastClientX - drag.startClientX;
		const sourceRect = drag.rects[drag.initialIndex];
		if (!sourceRect) return;
		const sourceCenter = sourceRect.left + sourceRect.width / 2 + pointerDelta;
		let nextIndex = drag.initialIndex;
		if (pointerDelta > 0) {
			for (let index = drag.initialIndex + 1; index < drag.rects.length; index += 1) {
				const rect = drag.rects[index];
				if (!rect || sourceCenter <= rect.left - scrollDelta + rect.width / 2) break;
				nextIndex = index;
			}
		} else if (pointerDelta < 0) {
			for (let index = drag.initialIndex - 1; index >= 0; index -= 1) {
				const rect = drag.rects[index];
				if (!rect || sourceCenter >= rect.left - scrollDelta + rect.width / 2) break;
				nextIndex = index;
			}
		}
		drag.currentIndex = nextIndex;
		const virtualTabs = [...drag.tabs];
		virtualTabs.splice(drag.initialIndex, 1);
		virtualTabs.splice(nextIndex, 0, drag.sourceEl);
		for (const [originalIndex, tab] of drag.tabs.entries()) {
			if (tab === drag.sourceEl) {
				tab.style.translate = `${pointerDelta + scrollDelta}px 0`;
				continue;
			}
			const targetIndex = virtualTabs.indexOf(tab);
			const originalRect = drag.rects[originalIndex];
			const targetRect = drag.rects[targetIndex];
			if (originalRect && targetRect) tab.style.translate = `${targetRect.left - originalRect.left}px 0`;
		}
	}

	private handleEnd(event: PointerEvent, canceled: boolean): void {
		const drag = this.drag;
		if (!drag || event.pointerId !== drag.pointerId) return;
		if (!drag.active) {
			this.cancelDrag(false);
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		this.suppressedId = drag.sourceId;
		this.suppressClickUntil = performance.now() + 300;
		if (canceled) this.cancelDrag(true);
		else this.finishDrag(drag);
	}

	private finishDrag(drag: TabDragState): void {
		this.stopTracking();
		const nextOrder = [...drag.tabs];
		const [source] = nextOrder.splice(drag.initialIndex, 1);
		if (source) nextOrder.splice(drag.currentIndex, 0, source);
		const ids = nextOrder.map((tab) => tab.dataset.filterId).filter((id): id is string => Boolean(id));
		const sourceRect = drag.rects[drag.initialIndex];
		const targetRect = drag.rects[drag.currentIndex];
		drag.sourceEl.addClass("is-settling");
		if (sourceRect && targetRect) drag.sourceEl.style.translate = `${targetRect.left - sourceRect.left}px 0`;
		this.settleTimer = this.listEl.ownerDocument.defaultView?.setTimeout(() => {
			this.settleTimer = null;
			this.clearTransforms(drag.tabs);
			if (drag.currentIndex !== drag.initialIndex) this.onCommit(ids);
		}, 160) ?? null;
	}

	private cancelDrag(animateBack: boolean): void {
		const drag = this.drag;
		this.stopTracking();
		if (!drag) return;
		if (!drag.active || !animateBack) {
			this.clearTransforms(drag.tabs);
			return;
		}
		for (const tab of drag.tabs) {
			tab.addClass("is-settling");
			tab.setCssProps({ translate: "0 0" });
		}
		this.settleTimer = this.listEl.ownerDocument.defaultView?.setTimeout(() => {
			this.settleTimer = null;
			this.clearTransforms(drag.tabs);
		}, 160) ?? null;
	}

	private stopTracking(): void {
		this.abort?.abort();
		this.abort = null;
		this.drag = null;
		const ownerWindow = this.listEl.ownerDocument.defaultView;
		if (this.activationTimer !== null) ownerWindow?.clearTimeout(this.activationTimer);
		if (this.autoScrollFrame !== null) ownerWindow?.cancelAnimationFrame(this.autoScrollFrame);
		this.activationTimer = null;
		this.autoScrollFrame = null;
	}

	private clearTransforms(tabs: readonly HTMLButtonElement[]): void {
		this.listEl.removeClass("is-sorting");
		for (const tab of tabs) {
			tab.removeClass("is-dragging", "is-settling");
			tab.removeAttribute("aria-grabbed");
			delete tab.dataset.dragging;
			tab.style.removeProperty("translate");
		}
	}

	private startAutoScroll(): void {
		if (this.autoScrollFrame !== null) return;
		const ownerWindow = this.listEl.ownerDocument.defaultView;
		if (!ownerWindow) return;
		const step = (): void => {
			this.autoScrollFrame = null;
			const drag = this.drag;
			if (!drag?.active) return;
			const rect = this.listEl.getBoundingClientRect();
			const threshold = 32;
			let amount = 0;
			if (drag.lastClientX < rect.left + threshold) {
				amount = -12 * (1 - Math.max(0, drag.lastClientX - rect.left) / threshold);
			} else if (drag.lastClientX > rect.right - threshold) {
				amount = 12 * (1 - Math.max(0, rect.right - drag.lastClientX) / threshold);
			}
			if (amount !== 0) {
				const previous = this.listEl.scrollLeft;
				this.listEl.scrollLeft += amount;
				if (this.listEl.scrollLeft !== previous) this.updateSort(drag);
			}
			this.autoScrollFrame = ownerWindow.requestAnimationFrame(step);
		};
		this.autoScrollFrame = ownerWindow.requestAnimationFrame(step);
	}

	private getTabs(): HTMLButtonElement[] {
		return Array.from(this.listEl.querySelectorAll<HTMLButtonElement>(".afm-manager-filter-tab"));
	}
}
