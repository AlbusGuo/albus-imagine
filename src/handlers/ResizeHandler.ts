import { MarkdownView, Plugin } from 'obsidian';
import { LinkUpdateService } from '../utils';
import { ImageResizeSettings } from '../types/types';

/**
 * 图片调整大小处理器
 * 负责处理鼠标事件和图片调整逻辑
 */
export class ResizeHandler {
	private plugin: Plugin;
	private settings: ImageResizeSettings;
	private linkUpdateService: LinkUpdateService;
	private isDragging = false;
	private dragTarget: HTMLImageElement | null = null;
	private startX = 0;
	private startY = 0;
	private startWidth = 0;
	private startHeight = 0;
	private lastUpdateX = 0;
	private lastUpdate = 1;
	private updatedWidth = 0;
	private lastMoveTime = 0;
	private rafId: number | null = null;

	constructor(plugin: Plugin, settings: ImageResizeSettings) {
		this.plugin = plugin;
		this.settings = settings;
		this.linkUpdateService = new LinkUpdateService(plugin.app, settings);
	}

	/**
	 * 更新设置
	 */
	updateSettings(settings: ImageResizeSettings): void {
		this.settings = settings;
		this.linkUpdateService.updateSettings(settings);
	}

	/**
	 * 注册文档事件监听器
	 */
	registerDocument(document: Document): void {
		// 鼠标按下事件
		const mouseDownHandler = (event: MouseEvent) => {
			const img = this.getImageFromEvent(event);
			if (img) {
				this.handleMouseDown(event, img);
			}
		};
		document.addEventListener('mousedown', mouseDownHandler);
		this.plugin.register(() => document.removeEventListener('mousedown', mouseDownHandler));

		// 鼠标移动事件
		const mouseMoveHandler = (event: MouseEvent) => {
			const img = this.getImageFromEvent(event);
			if (img) {
				this.handleMouseMove(event, img);
			}
		};
		document.addEventListener('mousemove', mouseMoveHandler);
		this.plugin.register(() => document.removeEventListener('mousemove', mouseMoveHandler));

		// 鼠标离开事件
		const mouseLeaveHandler = (event: MouseEvent) => {
			const img = this.getImageFromEvent(event);
			if (img) {
				this.handleMouseLeave(event, img);
			}
		};
		document.addEventListener('mouseleave', mouseLeaveHandler);
		this.plugin.register(() => document.removeEventListener('mouseleave', mouseLeaveHandler));
	}

	/**
	 * 从事件中获取图片元素
	 * 处理直接图片和 .image-embed 容器内的图片（包括带标题的图片）
	 */
	private getImageFromEvent(event: MouseEvent): HTMLImageElement | null {
		const target = event.target as HTMLElement;
		
		// 直接是图片元素
		if (target.tagName === 'IMG') {
			return target as HTMLImageElement;
		}
		
		// 可能是 .image-embed 容器（带标题的图片）
		if (target.classList && (target.classList.contains('image-embed') || target.classList.contains('internal-embed'))) {
			const img = target.querySelector('img');
			if (img) {
				return img;
			}
		}
		
		return null;
	}

	/**
	 * 检查图片是否在 callout 内
	 */
	private isImageInCallout(img: HTMLImageElement): boolean {
		let element: HTMLElement | null = img;
		while (element) {
			if (element.classList.contains('callout')) {
				return true;
			}
			element = element.parentElement;
		}
		return false;
	}

	/**
	 * 检查是否应该为此图片启用拖拽功能
	 */
	private shouldEnableDragResize(img: HTMLImageElement): boolean {
		const isInCallout = this.isImageInCallout(img);
		
		if (isInCallout) {
			return this.settings.dragResizeCallout;
		} else {
			return this.settings.dragResizeGeneral;
		}
	}

	/**
	 * 处理鼠标按下事件
	 */
	private handleMouseDown(event: MouseEvent, img: HTMLImageElement): void {
		// 只响应鼠标左键
		if (event.button !== 0) {
			return;
		}

		const currentMd = this.plugin.app.workspace.getActiveFile();
		if (!currentMd || currentMd.name.endsWith('.canvas')) {
			return;
		}

		const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || activeView.getMode() === 'preview') {
			return;
		}

		// 检查是否应该为此图片启用拖拽功能
		if (!this.shouldEnableDragResize(img)) {
			return;
		}

		// 检查图片是否在模态框或其他非编辑器容器中
		// 避免在图片选择器等 Modal 中触发调整大小功能
		let element: HTMLElement | null = img;
		while (element) {
			if (element.classList.contains('modal') || 
			    element.classList.contains('modal-container') ||
			    element.classList.contains('image-picker-container')) {
				return;
			}
			element = element.parentElement;
		}

		event.preventDefault();

		const editor = activeView.editor;
		if (!editor) {
			return;
		}

		const rect = img.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const edgeSize = this.settings.edgeSize;

		// 检查是否在右下角可拖拽区域
		const isInResizeArea = x > rect.width - edgeSize && y > rect.height - edgeSize;

		if (isInResizeArea) {
			this.startDrag(event, img, editor as unknown as { cm: { state: { doc: { lineAt: (pos: number) => { from: number; to: number; number: number; text: string } } }; posAtDOM: (node: Node) => number; dispatch: (changes: unknown) => void } });
		}
	}

	/**
	 * 处理鼠标移动事件
	 */
	private handleMouseMove(event: MouseEvent, img: HTMLImageElement): void {
		const currentMd = this.plugin.app.workspace.getActiveFile();
		if (!currentMd || currentMd.name.endsWith('.canvas')) {
			return;
		}

		const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || activeView.getMode() === 'preview') {
			return;
		}

		// 检查是否应该为此图片启用拖拽功能
		if (!this.shouldEnableDragResize(img)) {
			return;
		}

		// 检查图片是否在模态框或其他非编辑器容器中
		let element: HTMLElement | null = img;
		while (element) {
			if (element.classList.contains('modal') || 
			    element.classList.contains('modal-container') ||
			    element.classList.contains('image-picker-container')) {
				return;
			}
			element = element.parentElement;
		}

		const rect = img.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const edgeSize = this.settings.edgeSize;

		// 检查是否在右下角可拖拽区域
		const isInResizeArea = x > rect.width - edgeSize && y > rect.height - edgeSize;

		if (isInResizeArea) {
			img.addClass('image-cursor-nwse-resize');
			img.removeClass('image-cursor-default');
		} else {
			img.removeClass('image-cursor-nwse-resize');
			img.addClass('image-cursor-default');
		}
	}

	/**
	 * 处理鼠标离开事件
	 */
	private handleMouseLeave(event: MouseEvent, img: HTMLImageElement): void {
		img.removeClass('image-cursor-nwse-resize');
		img.addClass('image-cursor-default');
	}

	/**
	 * 开始拖拽调整大小
	 */
	private startDrag(event: MouseEvent, img: HTMLImageElement, editor: { cm: { state: { doc: { lineAt: (pos: number) => { from: number; to: number; number: number; text: string } } }; posAtDOM: (node: Node) => number; dispatch: (changes: unknown) => void } }): void {
		this.isDragging = true;
		this.dragTarget = img;
		this.startX = event.clientX;
		this.startY = event.clientY;
		this.startWidth = img.clientWidth;
		this.startHeight = img.clientHeight;
		this.lastUpdateX = this.startX;
		this.lastUpdate = 1;
		this.updatedWidth = this.startWidth;
		this.lastMoveTime = Date.now();

		const editorView = editor.cm;
		const target_pos = editorView.posAtDOM(img);

		const preventEvent = (e: Event) => {
			e.preventDefault();
			e.stopPropagation();
		};

		const onMouseMove = (e: MouseEvent) => {
			img.addEventListener('click', preventEvent);
			this.performDrag(e, img, target_pos);
		};

		const allowOtherEvent = () => {
			img.removeEventListener('click', preventEvent);
		};

		const onMouseUp = (e: MouseEvent) => {
			setTimeout(allowOtherEvent, 100);
			e.preventDefault();
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
			this.endDrag(img, target_pos);
		};

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	/**
	 * 执行拖拽调整
	 */
	private performDrag(event: MouseEvent, img: HTMLImageElement, target_pos: number): void {
		const currentX = event.clientX;
		this.lastUpdate = currentX - this.lastUpdateX === 0 ? this.lastUpdate : currentX - this.lastUpdateX;
		
		let newWidth = this.startWidth + (currentX - this.startX);
		const aspectRatio = this.startWidth / this.startHeight;
		
		newWidth = Math.max(newWidth, 50);
		let newHeight = newWidth / aspectRatio;
		
		newWidth = Math.round(newWidth);
		newHeight = Math.round(newHeight);
		this.updatedWidth = newWidth;
		
		// 使用 requestAnimationFrame 优化 DOM 更新，减少抖动
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
		}
		this.rafId = requestAnimationFrame(() => {
			img.style.width = `${newWidth}px`;
			this.rafId = null;
		});
		
		// 降低 markdown 更新频率到 250ms，减少编辑器抖动
		const now = Date.now();
		if (now - this.lastMoveTime < 250) {
			return;
		}
		
		this.lastMoveTime = now;
		this.linkUpdateService.updateImageLinkWithNewSize(img, target_pos, newWidth, newHeight);
		this.lastUpdateX = event.clientX;
	}

	/**
	 * 结束拖拽调整
	 */
	private endDrag(img: HTMLImageElement, target_pos: number): void {
		// 清理待处理的 requestAnimationFrame
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		
		// 计算最终宽度
		let finalWidth = this.updatedWidth;
		if (this.settings.resizeInterval > 1) {
			const resize_interval = this.settings.resizeInterval;
			const width_offset = this.lastUpdate > 0 ? resize_interval : 0;
			
			if (finalWidth % resize_interval !== 0) {
				finalWidth = Math.floor(finalWidth / resize_interval) * resize_interval + width_offset;
			}
		}

		// 先设置最终宽度到样式，防止闪烁
		img.style.width = `${finalWidth}px`;
		
		// 更新 markdown 链接
		this.linkUpdateService.updateImageLinkWithNewSize(img, target_pos, finalWidth, 0);
		
		// 延迟移除内联样式，等待 markdown 渲染完成
		// 使用 requestAnimationFrame 确保在下一帧移除，让 markdown 的尺寸先生效
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				img.style.removeProperty('width');
				img.style.removeProperty('height');
				img.style.removeProperty('max-width');
				img.style.removeProperty('max-height');
			});
		});

		this.isDragging = false;
		this.dragTarget = null;
	}
}
