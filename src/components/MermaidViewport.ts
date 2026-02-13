/**
 * Mermaid 视口组件
 * 负责缩放和平移功能
 */
export class MermaidViewport {
	private viewportEl: HTMLElement;
	private canvasEl: HTMLElement;
	public zoom: number = 1;
	private renderCallback: () => void;
	private boundOnWheel: (e: WheelEvent) => void;

	constructor(viewportEl: HTMLElement, canvasEl: HTMLElement, renderCallback: () => void) {
		this.viewportEl = viewportEl;
		this.canvasEl = canvasEl;
		this.renderCallback = renderCallback;
		this.boundOnWheel = this.onWheel.bind(this);
		this.init();
	}

	/**
	 * 初始化视口
	 */
	private init(): void {
		// 监听滚轮事件
		this.viewportEl.addEventListener('wheel', this.boundOnWheel, { passive: false });
	}

	/**
	 * 设置缩放
	 */
	setZoom(next: number, mouseX: number | null = null, mouseY: number | null = null): void {
		const prev = this.zoom;
		this.zoom = Math.max(0.2, Math.min(5, next));
		this.updateZoomLayer();
		
		if (mouseX !== null && mouseY !== null) {
			// 以鼠标位置为中心缩放
			const layer = this.viewportEl.querySelector('.ms-zoom-layer') as HTMLElement;
			if (!layer) return;
			
			const rect = layer.getBoundingClientRect();
			const vpRect = this.viewportEl.getBoundingClientRect();
			const layerX = (mouseX - rect.left) / prev;
			const layerY = (mouseY - rect.top) / prev;
			
			requestAnimationFrame(() => {
				if (!this.viewportEl) return;
				const newRect = layer.getBoundingClientRect();
				const targetLeft = mouseX - layerX * this.zoom;
				const targetTop = mouseY - layerY * this.zoom;
				this.viewportEl.scrollLeft += targetLeft - newRect.left;
				this.viewportEl.scrollTop += targetTop - newRect.top;
			});
		} else {
			// 无鼠标位置时保持视口中心点不变
			const layer = this.viewportEl.querySelector('.ms-zoom-layer') as HTMLElement;
			if (!layer) return;
			
			const cx = (this.viewportEl.scrollLeft + this.viewportEl.clientWidth / 2) / prev;
			const cy = (this.viewportEl.scrollTop + this.viewportEl.clientHeight / 2) / prev;
			
			requestAnimationFrame(() => {
				if (!this.viewportEl) return;
				this.viewportEl.scrollLeft = cx * this.zoom - this.viewportEl.clientWidth / 2;
				this.viewportEl.scrollTop = cy * this.zoom - this.viewportEl.clientHeight / 2;
			});
		}
	}

	/**
	 * 更新缩放层
	 */
	private updateZoomLayer(): void {
		const layer = this.viewportEl.querySelector('.ms-zoom-layer') as HTMLElement;
		if (layer) {
			layer.style.transform = `translate(-50%, -50%) scale(${this.zoom})`;
		}
	}

	/**
	 * 处理滚轮事件
	 */
	private onWheel(e: WheelEvent): void {
		e.preventDefault();
		const dir = e.deltaY > 0 ? 'out' : 'in';
		const mouseX = e.clientX;
		const mouseY = e.clientY;
		this.setZoom(this.zoom * (dir === 'in' ? 1.1 : 0.9), mouseX, mouseY);
	}

	/**
	 * 重置缩放并居中
	 */
	resetZoomAndCenter(): void {
		this.setZoom(1);
		this.centerCanvas();
	}

	/**
	 * 居中画布
	 */
	private centerCanvas(): void {
		const layer = this.viewportEl.querySelector('.ms-zoom-layer') as HTMLElement;
		if (!layer) return;
		
		// 按照源码的方式居中
		this.viewportEl.scrollLeft = (layer.clientWidth - this.viewportEl.clientWidth) / 2;
		this.viewportEl.scrollTop = (layer.clientHeight - this.viewportEl.clientHeight) / 2;
	}

	/**
	 * 销毁视口
	 */
	destroy(): void {
		this.viewportEl.removeEventListener('wheel', this.boundOnWheel);
	}
}