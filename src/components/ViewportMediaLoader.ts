export interface ViewportMediaController {
	element: HTMLElement;
	hasPendingMedia: () => boolean;
	loadMedia: () => void;
}

export class ViewportMediaLoader<Controller extends ViewportMediaController> {
	private controllers: readonly Controller[] = [];
	private frame: number | null = null;
	private disposed = false;

	constructor(private readonly containerEl: HTMLElement) { }

	sync(controllers: readonly Controller[]): void {
		if (this.disposed) return;
		this.controllers = controllers;
		if (this.frame !== null) return;
		const ownerWindow = this.containerEl.ownerDocument.defaultView;
		if (!ownerWindow) {
			this.flush();
			return;
		}
		this.frame = ownerWindow.requestAnimationFrame(() => {
			this.frame = null;
			this.flush();
		});
	}

	destroy(): void {
		this.disposed = true;
		if (this.frame !== null) {
			this.containerEl.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);
			this.frame = null;
		}
		this.controllers = [];
	}

	private flush(): void {
		if (this.disposed) return;
		for (const controller of this.controllers) {
			if (controller.element.isConnected && controller.hasPendingMedia()) {
				controller.loadMedia();
			}
		}
	}
}
