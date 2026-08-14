interface ImagePanZoomState {
	width: number;
	height: number;
	left: number;
	top: number;
}

interface ImagePanZoomOptions {
	fitRatio?: number;
	minSize?: number;
	draggingClass?: string;
}

/** Shared mouse pan/zoom behavior for image canvases. */
export class ImagePanZoomController {
	private readonly fitRatio: number;
	private readonly minSize: number;
	private readonly draggingClass: string;
	private state: ImagePanZoomState | null = null;
	private dragOffset: { x: number; y: number; } | null = null;

	constructor(
		private readonly imageEl: HTMLImageElement,
		private readonly containerEl: HTMLElement,
		options: ImagePanZoomOptions = {}
	) {
		this.fitRatio = options.fitRatio ?? 0.9;
		this.minSize = options.minSize ?? 50;
		this.draggingClass = options.draggingClass ?? "is-dragging";

		imageEl.addEventListener("wheel", this.handleWheel, { passive: false });
		imageEl.addEventListener("mousedown", this.handleMouseDown);
		containerEl.addEventListener("dblclick", this.handleDoubleClick);
	}

	reset(): boolean {
		const naturalWidth = this.imageEl.naturalWidth;
		const naturalHeight = this.imageEl.naturalHeight;
		const containerWidth = this.containerEl.clientWidth;
		const containerHeight = this.containerEl.clientHeight;
		if (!naturalWidth || !naturalHeight || !containerWidth || !containerHeight) return false;

		const scale = Math.min(
			1,
			(containerWidth * this.fitRatio) / naturalWidth,
			(containerHeight * this.fitRatio) / naturalHeight
		);
		const width = naturalWidth * scale;
		const height = naturalHeight * scale;
		this.state = {
			width,
			height,
			left: (containerWidth - width) / 2,
			top: (containerHeight - height) / 2,
		};
		this.applyTransform();
		return true;
	}

	destroy(): void {
		this.imageEl.removeEventListener("wheel", this.handleWheel);
		this.imageEl.removeEventListener("mousedown", this.handleMouseDown);
		this.containerEl.removeEventListener("dblclick", this.handleDoubleClick);
		this.stopDragging();
		this.imageEl.style.removeProperty("--afm-panzoom-width");
		this.imageEl.style.removeProperty("--afm-panzoom-left");
		this.imageEl.style.removeProperty("--afm-panzoom-top");
		this.state = null;
	}

	private handleWheel = (event: WheelEvent): void => {
		if (!this.state) return;
		event.preventDefault();
		event.stopPropagation();

		const zoomRatio = event.deltaY < 0 ? 1.1 : 1 / 1.1;
		const width = this.state.width * zoomRatio;
		const height = this.state.height * zoomRatio;
		if (width < this.minSize || height < this.minSize) return;

		const containerRect = this.containerEl.getBoundingClientRect();
		const pointerX = event.clientX - containerRect.left;
		const pointerY = event.clientY - containerRect.top;
		this.state.left = pointerX - (pointerX - this.state.left) * zoomRatio;
		this.state.top = pointerY - (pointerY - this.state.top) * zoomRatio;
		this.state.width = width;
		this.state.height = height;
		this.applyTransform();
	};

	private handleMouseDown = (event: MouseEvent): void => {
		if (event.button !== 0 || !this.state) return;
		event.preventDefault();
		event.stopPropagation();
		this.dragOffset = {
			x: this.state.left - event.clientX,
			y: this.state.top - event.clientY,
		};
		this.containerEl.addClass(this.draggingClass);
		this.imageEl.ownerDocument.addEventListener("mousemove", this.handleMouseMove);
		this.imageEl.ownerDocument.addEventListener("mouseup", this.handleMouseUp);
	};

	private handleMouseMove = (event: MouseEvent): void => {
		if (!this.state || !this.dragOffset) return;
		this.state.left = event.clientX + this.dragOffset.x;
		this.state.top = event.clientY + this.dragOffset.y;
		this.applyTransform();
	};

	private handleMouseUp = (): void => this.stopDragging();

	private handleDoubleClick = (event: MouseEvent): void => {
		event.preventDefault();
		this.reset();
	};

	private stopDragging(): void {
		this.dragOffset = null;
		this.containerEl.removeClass(this.draggingClass);
		this.imageEl.ownerDocument.removeEventListener("mousemove", this.handleMouseMove);
		this.imageEl.ownerDocument.removeEventListener("mouseup", this.handleMouseUp);
	}

	private applyTransform(): void {
		if (!this.state) return;
		this.imageEl.setCssProps({
			"--afm-panzoom-width": `${this.state.width}px`,
			"--afm-panzoom-left": `${this.state.left}px`,
			"--afm-panzoom-top": `${this.state.top}px`,
		});
	}
}
