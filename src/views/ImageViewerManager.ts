import { App } from 'obsidian';
import { ImageViewerView } from './ImageViewerView';
import { VIEW_IMG_SELECTOR } from './ImageViewerConstants';
import { ImageViewerSettings } from '../types/types';

/**
 * 图片查看器管理器
 */
export class ImageViewerManager {
	private app: App;
	private settings: ImageViewerSettings;
	private viewer: ImageViewerView | null = null;
	private imgSelector: string = '';
	private registeredDocs: Set<Document> = new Set();
	private static readonly IMG_ORIGIN_CURSOR = 'data-afm-origin-cursor';

	constructor(app: App, settings: ImageViewerSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * 更新设置
	 */
	updateSettings(settings: ImageViewerSettings): void {
		this.settings = settings;
		if (this.viewer) {
			this.viewer.updateSettings(settings);
		}
		// 重新应用所有窗口的事件监听
		this.registeredDocs.forEach(doc => {
			this.refreshViewTrigger(doc);
		});
	}

	/**
	 * 初始化查看器
	 */
	initialize(): void {
		if (!this.viewer) {
			this.viewer = new ImageViewerView(this.app, this.settings);
		}
		this.refreshViewTrigger();
	}

	/**
	 * 检查是否可点击（必须按住 Ctrl 键且查看器已启用）
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

	/**
	 * 刷新视图触发器（设置事件监听）
	 */
	refreshViewTrigger(doc?: Document): void {
		if (!doc) {
			doc = document;
		}

		// 记录此文档
		this.registeredDocs.add(doc);

		// 移除旧的事件监听
		if (this.imgSelector) {
			doc.off('click', this.imgSelector, this.clickImage);
			doc.off('mouseover', this.imgSelector, this.mouseoverImg);
			doc.off('mouseout', this.imgSelector, this.mouseoutImg);
		}
		// 移除捕获阶段的监听
		doc.removeEventListener('click', this.clickImageCapture, true);

		// 如果禁用，不添加监听
		if (!this.settings.enabled) {
			this.imgSelector = '';
			return;
		}

		// 监听所有img元素
		this.imgSelector = 'img';
		// 在捕获阶段监听点击事件，优先阻止默认行为
		doc.addEventListener('click', this.clickImageCapture, true);
		doc.on('click', this.imgSelector, this.clickImage);
		doc.on('mouseover', this.imgSelector, this.mouseoverImg);
		doc.on('mouseout', this.imgSelector, this.mouseoutImg);
	}

	/**
	 * 捕获阶段的点击事件处理（在事件传播早期阻止）
	 */
	private clickImageCapture = (event: MouseEvent): void => {
		const targetEl = event.target as HTMLElement;
		if (targetEl && targetEl.tagName === 'IMG' && this.isClickable(targetEl as HTMLImageElement, event)) {
			// 在捕获阶段就阻止事件，防止 Obsidian 的默认图片查看器
			event.stopPropagation();
			event.stopImmediatePropagation();
			event.preventDefault();
			// 直接在这里打开查看器
			if (this.viewer) {
				this.viewer.open(targetEl as HTMLImageElement);
			}
		}
	};

	/**
	 * 点击图片事件（冒泡阶段的备用处理器）
	 */
	private clickImage = (event: MouseEvent): void => {
		const targetEl = event.target as HTMLImageElement;
		if (this.isClickable(targetEl, event) && this.viewer) {
			this.viewer.open(targetEl);
		}
	};

	/**
	 * 鼠标悬停图片事件
	 */
	private mouseoverImg = (event: MouseEvent): void => {
		const targetEl = event.target as HTMLImageElement;
		if (!this.isClickable(targetEl, event)) {
			return;
		}

		// 保存原始光标样式
		if (targetEl.getAttribute(ImageViewerManager.IMG_ORIGIN_CURSOR) === null) {
			const computedStyle = window.getComputedStyle(targetEl);
			targetEl.setAttribute(
				ImageViewerManager.IMG_ORIGIN_CURSOR,
				computedStyle.cursor || ''
			);
		}
		targetEl.addClass('afm-cursor-zoom-in');
	};

	/**
	 * 鼠标离开图片事件
	 */
	private mouseoutImg = (event: MouseEvent): void => {
		const targetEl = event.target as HTMLImageElement;
		if (!this.isClickable(targetEl, event)) {
			return;
		}

		// 恢复原始光标样式
		targetEl.removeClass('afm-cursor-zoom-in');
	};

	/**
	 * 卸载
	 */
	cleanup(): void {
		// 移除所有文档的事件监听
		this.registeredDocs.forEach(doc => {
			if (this.imgSelector) {
				doc.removeEventListener('click', this.clickImageCapture, true);
				doc.off('click', this.imgSelector, this.clickImage);
				doc.off('mouseover', this.imgSelector, this.mouseoverImg);
				doc.off('mouseout', this.imgSelector, this.mouseoutImg);
			}
		});
		this.registeredDocs.clear();

		// 移除查看器
		if (this.viewer) {
			this.viewer.remove();
			this.viewer = null;
		}
	}
}
