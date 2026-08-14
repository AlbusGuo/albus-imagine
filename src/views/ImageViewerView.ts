import { ImagePanZoomController } from "../components/ImagePanZoomController";
import { ImageViewerSettings } from "../types/types";
import { IMAGE_VIEWER_CLASS } from "./ImageViewerConstants";

/** Full-window image viewer used by Ctrl+click. */
export class ImageViewerView {
	private containerEl: HTMLDivElement | null = null;
	private imgContainerEl: HTMLDivElement | null = null;
	private imgViewEl: HTMLImageElement | null = null;
	private ownerDocument: Document | null = null;
	private panZoom: ImagePanZoomController | null = null;
	private isVisible = false;
	private loadGeneration = 0;

	constructor(private settings: ImageViewerSettings) { }

	updateSettings(settings: ImageViewerSettings): void {
		this.settings = settings;
		if (!settings.enabled) this.close();
	}

	open(sourceImage: HTMLImageElement): void {
		if (!this.settings.enabled) return;
		if (this.ownerDocument && this.ownerDocument !== sourceImage.ownerDocument) this.remove();
		this.ensureContainer(sourceImage.ownerDocument);
		if (!this.containerEl || !this.imgContainerEl || !this.imgViewEl) return;

		this.panZoom?.destroy();
		this.panZoom = null;
		const generation = ++this.loadGeneration;
		const image = this.imgViewEl;
		image.onload = () => {
			if (generation !== this.loadGeneration || !this.imgContainerEl) return;
			this.panZoom = new ImagePanZoomController(image, this.imgContainerEl, {
				fitRatio: 0.8,
				draggingClass: "is-dragging",
			});
			this.panZoom.reset();
		};
		image.onerror = () => {
			if (generation === this.loadGeneration) this.close();
		};
		image.alt = sourceImage.alt;
		image.addClass("img-default-background");
		image.src = sourceImage.currentSrc || sourceImage.src;

		this.containerEl.addClass("is-visible");
		this.isVisible = true;
	}

	close(): void {
		this.loadGeneration++;
		this.panZoom?.destroy();
		this.panZoom = null;
		this.containerEl?.removeClass("is-visible");
		this.isVisible = false;
		if (this.imgViewEl) {
			this.imgViewEl.onload = null;
			this.imgViewEl.onerror = null;
			this.imgViewEl.src = "";
			this.imgViewEl.alt = "";
			this.imgViewEl.removeClass("img-default-background");
		}
	}

	remove(): void {
		this.close();
		this.ownerDocument?.removeEventListener("keydown", this.handleKeydown);
		this.containerEl?.removeEventListener("click", this.handleContainerClick);
		this.containerEl?.remove();
		this.containerEl = null;
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
		if (event.target === this.containerEl || event.target === this.imgContainerEl) this.close();
	};

	private handleKeydown = (event: KeyboardEvent): void => {
		if (this.isVisible && event.key === "Escape") this.close();
	};
}
