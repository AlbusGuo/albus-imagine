import { ImagePanZoomController } from "../components/ImagePanZoomController";
import { ImageViewerSettings } from "../types/types";
import { IMAGE_VIEWER_CLASS } from "./ImageViewerConstants";

const VIEWER_ANIMATION_DURATION = 200;
const VIEWER_ANIMATION_EASING = "cubic-bezier(0.4, 0, 0.22, 1)";
const VIEWER_BACKGROUND_OPACITY = 0.9;

/** Full-window image viewer used by Imagine's shortcut and click replacement. */
export class ImageViewerView {
	private containerEl: HTMLDivElement | null = null;
	private backgroundEl: HTMLDivElement | null = null;
	private imgContainerEl: HTMLDivElement | null = null;
	private imgViewEl: HTMLImageElement | null = null;
	private ownerDocument: Document | null = null;
	private sourceImageEl: HTMLImageElement | null = null;
	private sourceRect: DOMRect | null = null;
	private returnFocusEl: HTMLElement | null = null;
	private panZoom: ImagePanZoomController | null = null;
	private animations: Animation[] = [];
	private isVisible = false;
	private isClosing = false;
	private loadGeneration = 0;

	constructor(private settings: ImageViewerSettings) { }

	updateSettings(settings: ImageViewerSettings): void {
		this.settings = settings;
		if (!this.canOpen()) this.close();
	}

	open(sourceImage: HTMLImageElement, force = false): void {
		if (!force && !this.canOpen()) return;
		if (this.ownerDocument && this.ownerDocument !== sourceImage.ownerDocument) this.remove();
		this.ensureContainer(sourceImage.ownerDocument);
		if (!this.containerEl || !this.backgroundEl || !this.imgContainerEl || !this.imgViewEl) return;

		this.cancelAnimations();
		this.panZoom?.destroy();
		this.panZoom = null;
		const generation = ++this.loadGeneration;
		this.sourceImageEl = sourceImage;
		this.sourceRect = sourceImage.getBoundingClientRect();
		this.returnFocusEl = this.getReturnFocusElement(sourceImage);
		this.isClosing = false;
		const image = this.imgViewEl;
		const background = this.backgroundEl;
		image.setCssProps({ "--afm-viewer-opacity": "0" });
		background.setCssProps({ "--afm-viewer-opacity": "0" });
		this.containerEl.addClass("is-visible");
		this.containerEl.addClass("is-animating");
		this.isVisible = true;
		let hasLoaded = false;
		const handleLoad = () => {
			if (hasLoaded) return;
			hasLoaded = true;
			if (generation !== this.loadGeneration || !this.imgContainerEl) return;
			this.panZoom = new ImagePanZoomController(image, this.imgContainerEl, {
				fitRatio: 1,
				viewportPadding: this.getViewerPadding(),
				draggingClass: "is-dragging",
			});
			if (!this.panZoom.reset()) {
				this.finishClose(generation);
				return;
			}
			this.animateOpen(generation);
		};
		image.onload = handleLoad;
		image.onerror = () => {
			if (generation === this.loadGeneration) this.finishClose(generation);
		};
		image.alt = sourceImage.alt;
		image.addClass("img-default-background");
		image.src = sourceImage.dataset.afmThumbnailSource || sourceImage.currentSrc || sourceImage.src;
		if (image.complete && image.naturalWidth > 0) {
			image.ownerDocument.defaultView?.queueMicrotask(handleLoad);
		}
	}

	private canOpen(): boolean {
		return this.settings.enabled || this.settings.clickBehavior === "imagine";
	}

	close(): void {
		if (!this.isVisible || this.isClosing) return;
		const generation = ++this.loadGeneration;
		this.isVisible = false;
		this.isClosing = true;
		this.cancelAnimations();
		this.panZoom?.stopInteraction();
		if (!this.canAnimate()) {
			this.finishClose(generation);
			return;
		}

		const sourceRect = this.getSourceRect();
		const image = this.imgViewEl;
		const background = this.backgroundEl;
		if (!sourceRect || !image || !background) {
			this.finishClose(generation);
			return;
		}

		const targetTransform = this.getRectTransform(image.getBoundingClientRect(), sourceRect);
		this.containerEl?.addClass("is-animating");
		background.setCssProps({ "--afm-viewer-opacity": "0" });
		this.animations = [
			background.animate(
				[{ opacity: VIEWER_BACKGROUND_OPACITY }, { opacity: 0 }],
				this.getAnimationOptions(),
			),
			image.animate(
				[
					{ transform: "translate(0, 0) scale(1)" },
					{ transform: targetTransform },
				],
				this.getAnimationOptions(),
			),
		];
		void Promise.all(this.animations.map((animation) => animation.finished.catch(() => undefined)))
			.then(() => this.finishClose(generation));
	}

	private animateOpen(generation: number): void {
		const image = this.imgViewEl;
		const background = this.backgroundEl;
		if (!image || !background) return;
		image.setCssProps({ "--afm-viewer-opacity": "1" });
		background.setCssProps({
			"--afm-viewer-opacity": String(VIEWER_BACKGROUND_OPACITY),
		});

		const sourceRect = this.sourceRect;
		if (!this.canAnimate() || !sourceRect || !this.isUsableRect(sourceRect)) {
			this.containerEl?.removeClass("is-animating");
			return;
		}

		const initialTransform = this.getRectTransform(image.getBoundingClientRect(), sourceRect);
		this.animations = [
			background.animate(
				[{ opacity: 0 }, { opacity: VIEWER_BACKGROUND_OPACITY }],
				this.getAnimationOptions(),
			),
			image.animate(
				[
					{ transform: initialTransform },
					{ transform: "translate(0, 0) scale(1)" },
				],
				this.getAnimationOptions(),
			),
		];
		void Promise.all(this.animations.map((animation) => animation.finished.catch(() => undefined)))
			.then(() => {
				if (generation !== this.loadGeneration || this.isClosing) return;
				this.animations = [];
				this.containerEl?.removeClass("is-animating");
			});
	}

	remove(): void {
		this.loadGeneration++;
		this.cancelAnimations();
		this.finishClose(this.loadGeneration, false);
		this.ownerDocument?.removeEventListener("keydown", this.handleKeydown);
		this.containerEl?.removeEventListener("click", this.handleContainerClick);
		this.containerEl?.remove();
		this.containerEl = null;
		this.backgroundEl = null;
		this.imgContainerEl = null;
		this.imgViewEl = null;
		this.ownerDocument = null;
	}

	private ensureContainer(ownerDocument: Document): void {
		if (this.containerEl) return;
		this.ownerDocument = ownerDocument;
		const ownerWindow = ownerDocument.win;
		const containerEl = ownerWindow.createDiv();
		containerEl.addClass(IMAGE_VIEWER_CLASS.CONTAINER);
		ownerDocument.body.appendChild(containerEl);
		this.containerEl = containerEl;

		const backgroundEl = ownerWindow.createDiv();
		backgroundEl.addClass(IMAGE_VIEWER_CLASS.BACKGROUND);
		containerEl.appendChild(backgroundEl);
		this.backgroundEl = backgroundEl;

		const imgContainerEl = ownerWindow.createDiv();
		imgContainerEl.addClass(IMAGE_VIEWER_CLASS.IMG_CONTAINER);
		containerEl.appendChild(imgContainerEl);
		this.imgContainerEl = imgContainerEl;

		const imgViewEl = ownerWindow.createEl("img");
		imgViewEl.addClass(IMAGE_VIEWER_CLASS.IMG_VIEW);
		imgContainerEl.appendChild(imgViewEl);
		this.imgViewEl = imgViewEl;

		containerEl.addEventListener("click", this.handleContainerClick);
		ownerDocument.addEventListener("keydown", this.handleKeydown);
	}

	private handleContainerClick = (event: MouseEvent): void => {
		if (
			event.target === this.containerEl
			|| event.target === this.backgroundEl
			|| event.target === this.imgContainerEl
		) this.close();
	};

	private handleKeydown = (event: KeyboardEvent): void => {
		if (this.isVisible && event.key === "Escape") this.close();
	};

	private finishClose(generation: number, restoreFocus = true): void {
		if (generation !== this.loadGeneration) return;
		this.cancelAnimations();
		this.panZoom?.destroy();
		this.panZoom = null;
		this.containerEl?.removeClasses(["is-visible", "is-animating"]);
		this.isVisible = false;
		this.isClosing = false;
		this.sourceImageEl = null;
		this.sourceRect = null;
		const returnFocusEl = this.returnFocusEl;
		this.returnFocusEl = null;
		this.backgroundEl?.style.removeProperty("--afm-viewer-opacity");
		if (this.imgViewEl) {
			this.imgViewEl.onload = null;
			this.imgViewEl.onerror = null;
			this.imgViewEl.src = "";
			this.imgViewEl.alt = "";
			this.imgViewEl.style.removeProperty("--afm-viewer-opacity");
			this.imgViewEl.style.removeProperty("transform");
			this.imgViewEl.removeClass("img-default-background");
		}
		if (restoreFocus && returnFocusEl?.isConnected) {
			returnFocusEl.focus({ preventScroll: true });
		}
	}

	private cancelAnimations(): void {
		for (const animation of this.animations) animation.cancel();
		this.animations = [];
	}

	private getSourceRect(): DOMRect | null {
		if (!this.sourceImageEl?.isConnected) return null;
		const rect = this.sourceImageEl.getBoundingClientRect();
		return this.isUsableRect(rect) ? rect : null;
	}

	private getReturnFocusElement(sourceImage: HTMLImageElement): HTMLElement | null {
		const editorEl = sourceImage.closest<HTMLElement>(".cm-editor");
		const ownerWindow = sourceImage.ownerDocument.defaultView;
		if (!editorEl || !ownerWindow) return null;
		const activeElement = sourceImage.ownerDocument.activeElement;
		if (activeElement instanceof ownerWindow.HTMLElement && editorEl.contains(activeElement)) {
			return activeElement;
		}
		return editorEl.querySelector<HTMLElement>(".cm-content");
	}

	private getRectTransform(from: DOMRect, to: DOMRect): string {
		const scale = Math.max(to.width / from.width, to.height / from.height);
		const translateX = to.left + to.width / 2 - (from.left + from.width / 2);
		const translateY = to.top + to.height / 2 - (from.top + from.height / 2);
		return `translate(${translateX}px, ${translateY}px) scale(${scale})`;
	}

	private getViewerPadding(): number {
		if (!this.imgContainerEl || !this.ownerDocument?.defaultView) return 8;
		const value = this.ownerDocument.defaultView
			.getComputedStyle(this.imgContainerEl)
			.getPropertyValue("--size-4-2");
		const padding = Number.parseFloat(value);
		return Number.isFinite(padding) ? padding : 8;
	}

	private getAnimationOptions(): KeyframeAnimationOptions {
		return {
			duration: VIEWER_ANIMATION_DURATION,
			easing: VIEWER_ANIMATION_EASING,
		};
	}

	private canAnimate(): boolean {
		return !this.ownerDocument?.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}

	private isUsableRect(rect: DOMRect): boolean {
		return rect.width > 0 && rect.height > 0;
	}
}
