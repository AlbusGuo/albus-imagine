interface PointerCoordinates {
	clientX: number;
	clientY: number;
	screenX: number;
	screenY: number;
}

/** Vertical reorder interaction matching Obsidian Bases' internal helper. */
export function bindBasesVerticalReorder(
	handle: HTMLElement,
	item: HTMLElement,
	container: HTMLElement,
	threshold: number,
	onCommit: (index: number) => void,
): void {
	handle.addEventListener("mousedown", (event) => {
		if (event.button === 0) beginReorder(event, event, false);
	});
	handle.addEventListener("touchstart", (event) => {
		if (event.touches.length > 1) return;
		const touch = event.touches[0];
		if (touch) beginReorder(event, touch, true, touch.identifier);
	}, { passive: false });

	function beginReorder(
		startEvent: MouseEvent | TouchEvent,
		startPoint: PointerCoordinates,
		isTouch: boolean,
		touchIdentifier?: number,
	): void {
		if (container.firstElementChild === container.lastElementChild) return;
		startEvent.preventDefault();
		const ownerDocument = item.ownerDocument;
		const ownerWindow = ownerDocument.defaultView ?? window;
		const startX = startPoint.clientX;
		const startY = startPoint.clientY;
		const itemRect = item.getBoundingClientRect();
		const grabX = startX - itemRect.left;
		const grabY = startY - itemRect.top;
		const scrollEl = findScrollContainer(container);
		const scrollRect = scrollEl.getBoundingClientRect();
		const thresholdSquared = threshold * threshold;
		let latestY = startY;
		let movedPastThreshold = false;
		let canStart = !isTouch;
		let ghost: HTMLElement | null = null;
		let scrollVelocity = 0;
		let smoothedVelocity = 0;
		let scrollTimer: number | null = null;

		const longPressTimer = ownerWindow.setTimeout(() => {
			if (movedPastThreshold) return;
			canStart = true;
			if (isTouch) ownerWindow.navigator.vibrate?.(200);
		}, 250);

		const moveItem = (clientY: number): number => {
			const children = Array.from(container.children) as HTMLElement[];
			let index = 0;
			for (; index < children.length - 1; index += 1) {
				const rect = children[index]?.getBoundingClientRect();
				if (rect && clientY - grabY + itemRect.height / 2 < rect.bottom) break;
			}
			if (children[index] !== item) {
				const scrollTop = scrollEl.scrollTop;
				item.remove();
				container.insertBefore(item, container.children[index] ?? null);
				scrollEl.scrollTop = scrollTop;
				if (isTouch) ownerWindow.navigator.vibrate?.(0);
			}
			return index;
		};

		const updateAutoScroll = (): void => {
			if (scrollVelocity === 0) return;
			smoothedVelocity = smoothedVelocity * 0.9 + scrollVelocity * 0.1;
			scrollEl.scrollTop += smoothedVelocity;
			moveItem(latestY);
		};

		const createGhost = (): HTMLElement => {
			const wrapper = ownerDocument.win.createDiv("drag-reorder-ghost");
			const clone = item.cloneNode(true) as HTMLElement;
			clone.removeAttribute("aria-label");
			clone.addClass("mod-dragged-item");
			clone.setCssStyles({
				position: "relative",
				inset: "auto",
				width: `${item.offsetWidth}px`,
				height: `${item.offsetHeight}px`,
			});
			wrapper.appendChild(clone);
			return wrapper;
		};

		const move = (event: MouseEvent | TouchEvent, point: PointerCoordinates): void => {
			const clientX = point.clientX;
			latestY = point.clientY;
			if (!ghost) {
				const deltaX = clientX - startX;
				const deltaY = latestY - startY;
				movedPastThreshold = deltaX * deltaX + deltaY * deltaY >= thresholdSquared;
				if (!movedPastThreshold || !canStart) return;
				ghost = createGhost();
				ownerDocument.body.appendChild(ghost);
				ownerDocument.body.addClass("is-grabbing");
				item.addClass("drag-ghost-hidden");
				scrollTimer = ownerWindow.setInterval(updateAutoScroll, 1000 / 60);
			}
			event.preventDefault();
			const edge = Math.min(50, scrollRect.height / 3);
			const upperEdge = scrollRect.top + edge;
			const lowerEdge = scrollRect.bottom - edge;
			const itemTop = latestY - grabY;
			const itemBottom = itemTop + itemRect.height;
			if (itemTop < upperEdge) scrollVelocity = ((itemTop - upperEdge) / edge) * 10;
			else if (itemBottom > lowerEdge) scrollVelocity = ((itemBottom - lowerEdge) / edge) * 10;
			else {
				scrollVelocity = 0;
				smoothedVelocity = 0;
			}
			scrollVelocity = Math.max(-10, Math.min(10, scrollVelocity));
			moveItem(latestY);
			ghost.setCssStyles({ left: `${clientX - grabX}px`, top: `${latestY - grabY}px` });
		};

		const cleanup = (): void => {
			ownerWindow.clearTimeout(longPressTimer);
			if (scrollTimer !== null) ownerWindow.clearInterval(scrollTimer);
			ownerWindow.removeEventListener("mousemove", onMouseMove);
			ownerWindow.removeEventListener("mouseup", onMouseUp);
			ownerWindow.removeEventListener("touchmove", onTouchMove);
			ownerWindow.removeEventListener("touchend", onTouchEnd);
			ownerWindow.removeEventListener("touchcancel", onTouchCancel);
			ownerDocument.removeEventListener("contextmenu", blockContextMenu, true);
		};

		const finish = (event: MouseEvent | TouchEvent, point: PointerCoordinates): void => {
			cleanup();
			if (ghost) {
				event.preventDefault();
				const index = moveItem(latestY);
				ownerDocument.body.removeClass("is-grabbing");
				item.removeClass("drag-ghost-hidden");
				item.remove();
				ghost.remove();
				container.insertBefore(item, container.children[index] ?? null);
				onCommit(index);
				return;
			}
			if (!isTouch || movedPastThreshold || canStart) return;
			event.preventDefault();
			handle.dispatchEvent(new MouseEvent("click", {
				button: 0,
				buttons: 0,
				ctrlKey: event.ctrlKey,
				altKey: event.altKey,
				shiftKey: event.shiftKey,
				metaKey: event.metaKey,
				screenX: point.screenX,
				screenY: point.screenY,
				clientX: startX,
				clientY: startY,
				bubbles: true,
				cancelable: true,
			}));
		};

		const findTouch = (event: TouchEvent): Touch | null => {
			for (const touch of Array.from(event.changedTouches)) {
				if (touch.identifier === touchIdentifier) return touch;
			}
			for (const touch of Array.from(event.touches)) {
				if (touch.identifier === touchIdentifier) return touch;
			}
			return null;
		};
		const onMouseMove = (event: MouseEvent): void => move(event, event);
		const onMouseUp = (event: MouseEvent): void => finish(event, event);
		const onTouchMove = (event: TouchEvent): void => {
			const touch = findTouch(event);
			if (touch) move(event, touch);
		};
		const onTouchEnd = (event: TouchEvent): void => {
			const touch = findTouch(event);
			if (touch) finish(event, touch);
			else cleanup();
		};
		const onTouchCancel = (event: TouchEvent): void => {
			const touch = findTouch(event);
			if (touch) finish(event, touch);
			else cleanup();
		};
		const blockContextMenu = (event: Event): void => {
			if (!event.isTrusted) return;
			event.preventDefault();
			event.stopImmediatePropagation();
		};

		if (isTouch) {
			ownerDocument.addEventListener("contextmenu", blockContextMenu, true);
			ownerWindow.addEventListener("touchmove", onTouchMove, { passive: false });
			ownerWindow.addEventListener("touchend", onTouchEnd);
			ownerWindow.addEventListener("touchcancel", onTouchCancel);
		} else {
			ownerWindow.addEventListener("mousemove", onMouseMove);
			ownerWindow.addEventListener("mouseup", onMouseUp);
		}
	}
}

function findScrollContainer(element: HTMLElement): HTMLElement {
	const parent = element.parentElement;
	if (!parent) return element;
	return parent.scrollHeight > parent.clientHeight ? parent : findScrollContainer(parent);
}
