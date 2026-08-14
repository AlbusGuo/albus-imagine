import { ImageViewerView } from './ImageViewerView';
import { ImageViewerSettings } from '../types/types';

/**
 * 图片查看器管理器
 */
export class ImageViewerManager {
	private settings: ImageViewerSettings;
	private viewer: ImageViewerView | null = null;
	private registeredDocs: Set<Document> = new Set();

	constructor(settings: ImageViewerSettings) {
		this.settings = settings;
	}

	/**
	 * 更新设置
	 */
	updateSettings(settings: ImageViewerSettings): void {
		this.settings = settings;
		this.viewer?.updateSettings(settings);
		this.registeredDocs.forEach((doc) => this.refreshViewTrigger(doc));
	}

	/**
	 * 初始化查看器
	 */
	initialize(): void {
		if (!this.viewer) {
			this.viewer = new ImageViewerView(this.settings);
		}
		this.refreshViewTrigger();
	}

	/**
	 * 检查是否可点击 (必须按住 Ctrl 键且查看器已启用)
	 */
	private isClickable(targetEl: HTMLImageElement, event: MouseEvent): boolean {
		if (!targetEl || targetEl.tagName !== 'IMG') {
			return false;
		}

		// 必须按住 Ctrl 键
		if (!event.ctrlKey || event.altKey || event.shiftKey) {
			return false;
		}

		// 检查查看器是否启用
		return this.settings.enabled;
	}

	private isMarkdownImage(target: EventTarget | null, doc: Document): target is HTMLImageElement {
		const ownerWindow = doc.defaultView;
		return Boolean(
			ownerWindow &&
			target instanceof ownerWindow.HTMLImageElement &&
			target.closest(".image-embed, .internal-embed") &&
			target.closest(".markdown-source-view, .markdown-preview-view, .markdown-rendered"),
		);
	}

	/**
	 * 刷新视图触发器 (设置事件监听)
	 */
	refreshViewTrigger(doc?: Document): void {
		if (!doc) {
			doc = document;
		}

		// 记录此文档
		this.registeredDocs.add(doc);

		doc.removeEventListener('click', this.clickImageCapture, true);
		doc.removeEventListener('click', this.disableNativeViewerCapture, true);
		doc.removeEventListener('mousedown', this.preserveSelectedImageFocus, true);

		if (this.settings.enabled) doc.addEventListener('click', this.clickImageCapture, true);
		if (this.settings.disableNativeImageViewer) {
			doc.addEventListener('mousedown', this.preserveSelectedImageFocus, true);
			doc.addEventListener('click', this.disableNativeViewerCapture, true);
		}
	}

	/**
	 * 捕获阶段的点击事件处理 (在事件传播早期阻止)
	 */
	private clickImageCapture = (event: MouseEvent): void => {
		const targetEl = event.target as HTMLElement;
		if (targetEl && targetEl.tagName === 'IMG' && this.isClickable(targetEl as HTMLImageElement, event)) {
			// 在捕获阶段就阻止事件, 防止 Obsidian 的默认图片查看器
			event.stopPropagation();
			event.stopImmediatePropagation();
			event.preventDefault();
			// 直接在这里打开查看器
			if (this.viewer) {
				this.viewer.open(targetEl as HTMLImageElement);
			}
		}
	};

	/** Obsidian's image click handler explicitly skips default-prevented clicks. */
	private disableNativeViewerCapture = (event: MouseEvent): void => {
		const document = event.currentTarget as Document;
		const image = this.isMarkdownImage(event.target, document) ? event.target : null;
		if (
			!image ||
			event.button !== 0 ||
			event.ctrlKey ||
			event.metaKey ||
			event.altKey ||
			event.shiftKey
		) return;

		if (image.closest(".markdown-source-view")) {
			// 实时预览首次点击仍可选择图片; 仅阻止选中后的再次点击打开灯箱.
			if (!image.closest(".image-embed")?.hasClass("is-selected")) return;
			event.preventDefault();
			return;
		}

		// 阅读模式的媒体委托不检查 defaultPrevented, 必须阻断事件传播.
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
	};

	/** Prevent the browser's mousedown focus transfer before the blocked click. */
	private preserveSelectedImageFocus = (event: MouseEvent): void => {
		const document = event.currentTarget as Document;
		const image = this.isMarkdownImage(event.target, document) ? event.target : null;
		if (
			image &&
			event.button === 0 &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey &&
			!event.shiftKey &&
			image.closest(".markdown-source-view") &&
			image.closest(".image-embed")?.hasClass("is-selected")
		) {
			event.preventDefault();
		}
	};

	/**
	 * 卸载
	 */
	cleanup(): void {
		this.registeredDocs.forEach(doc => {
			doc.removeEventListener('click', this.clickImageCapture, true);
			doc.removeEventListener('click', this.disableNativeViewerCapture, true);
			doc.removeEventListener('mousedown', this.preserveSelectedImageFocus, true);
		});
		this.registeredDocs.clear();

		// 移除查看器
		if (this.viewer) {
			this.viewer.remove();
			this.viewer = null;
		}
	}
}
