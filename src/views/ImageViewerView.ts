import { App } from 'obsidian';
import { IMAGE_VIEWER_CLASS } from './ImageViewerConstants';
import { ImageViewerSettings } from '../types/types';

const ZOOM_FACTOR = 0.8;

/**
 * 图片状态信息（参照源码 ImgCto）
 */
interface ImageStatus {
	realWidth: number;
	realHeight: number;
	curWidth: number;
	curHeight: number;
	left: number;
	top: number;
	moveX: number;
	moveY: number;
	scale: number;
}

/**
 * 图片查看器视图
 * 按照 image-toolkit 的 normal mode 实现
 */
export class ImageViewerView {
	private app: App;
	private settings: ImageViewerSettings;
	private containerEl: HTMLDivElement | null = null;
	private imgContainerEl: HTMLDivElement | null = null;
	private imgViewEl: HTMLImageElement | null = null;
	private isVisible: boolean = false;
	private imgStatus: ImageStatus | null = null;
	private isDragging: boolean = false;

	constructor(app: App, settings: ImageViewerSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * 更新设置
	 */
	updateSettings(settings: ImageViewerSettings): void {
		this.settings = settings;
	}

	/**
	 * 初始化容器 DOM（参照源码结构）
	 */
	private initContainerDom(parentEl: HTMLElement): void {
		if (this.containerEl) {
			return;
		}

		// <div class="afm-img-viewer-container">
		this.containerEl = createDiv();
		this.containerEl.addClass(IMAGE_VIEWER_CLASS.CONTAINER);
		parentEl.appendChild(this.containerEl);

		// <div class="afm-img-container">
		this.imgContainerEl = createDiv();
		this.imgContainerEl.addClass(IMAGE_VIEWER_CLASS.IMG_CONTAINER);
		this.containerEl.appendChild(this.imgContainerEl);

		// <img class="afm-img-view">
		this.imgViewEl = createEl('img');
		this.imgViewEl.addClass(IMAGE_VIEWER_CLASS.IMG_VIEW);
		this.imgContainerEl.appendChild(this.imgViewEl);

		// 添加事件监听（参照源码）
		this.addEventListeners();
	}

	/**
	 * 添加事件监听器（参照源码 addOrRemoveEvents）
	 */
	private addEventListeners(): void {
		if (!this.containerEl || !this.imgViewEl) return;

		// 点击容器背景关闭（参照源码 closeContainerView）
		this.containerEl.addEventListener('click', this.handleContainerClick);

		// 图片拖拽事件（参照源码）
		this.imgViewEl.addEventListener('mousedown', this.handleMouseDown);
		this.imgViewEl.addEventListener('mouseup', this.handleMouseUp);

		// 滚轮缩放（参照源码 mousewheelViewContainer）
		this.imgViewEl.addEventListener('wheel', this.handleWheel, { passive: false });

		// ESC 键关闭
		document.addEventListener('keydown', this.handleKeydown);
	}

	/**
	 * 容器点击事件
	 */
	private handleContainerClick = (event: MouseEvent): void => {
		const target = event.target as HTMLElement;
		if (target === this.containerEl || target === this.imgContainerEl) {
			this.close();
		}
	};

	/**
	 * 鼠标按下事件（参照源码 mousedownImgView）
	 */
	private handleMouseDown = (event: MouseEvent): void => {
		if (event.button !== 0 || !this.imgStatus || !this.imgViewEl) return; // 只处理左键

		event.stopPropagation();
		event.preventDefault();

		this.isDragging = true;

		// 鼠标相对于图片的位置（参照源码）
		this.imgStatus.moveX = this.imgStatus.left - event.clientX;
		this.imgStatus.moveY = this.imgStatus.top - event.clientY;

		// 鼠标按下时持续触发/移动事件
		document.addEventListener('mousemove', this.handleMouseMove);
	};

	/**
	 * 鼠标移动事件（参照源码 mousemoveImgView）
	 */
	private handleMouseMove = (event: MouseEvent): void => {
		if (!this.isDragging || !this.imgStatus || !this.imgViewEl) return;

		// drag via mouse cursor
		this.imgStatus.left = event.clientX + this.imgStatus.moveX;
		this.imgStatus.top = event.clientY + this.imgStatus.moveY;

		// move the image
		this.imgViewEl.style.setProperty('margin-left', this.imgStatus.left + 'px', 'important');
		this.imgViewEl.style.setProperty('margin-top', this.imgStatus.top + 'px', 'important');
	};

	/**
	 * 鼠标释放事件（参照源码 mouseupImgView）
	 */
	private handleMouseUp = (event: MouseEvent): void => {
		this.isDragging = false;
		document.removeEventListener('mousemove', this.handleMouseMove);
	};

	/**
	 * 滚轮事件（参照源码 mousewheelViewContainer）
	 */
	private handleWheel = (event: WheelEvent): void => {
		event.stopPropagation();
		event.preventDefault();

		if (!this.imgStatus || !this.imgViewEl) return;

		// 参照源码：0 < event.wheelDelta ? 0.1 : -0.1
		// @ts-ignore
		const ratio = 0 < event.wheelDelta ? 0.1 : -0.1;
		this.zoomImage(ratio, event.offsetX, event.offsetY);
	};

	/**
	 * 缩放图片（完全参照源码 ImgUtil.zoom）
	 */
	private zoomImage(ratio: number, offsetX: number, offsetY: number): void {
		if (!this.imgStatus || !this.imgViewEl) return;

		// 参照源码的缩放逻辑
		const zoomInFlag = ratio > 0;
		const zoomRatio = zoomInFlag ? 1 + ratio : 1 / (1 - ratio);
		
		// 计算新的宽高
		const newWidth = this.imgStatus.curWidth * zoomRatio;
		const newHeight = this.imgStatus.curHeight * zoomRatio;
		
		// 限制最小尺寸
		if (newWidth < 50 || newHeight < 50) return;
		
		// 使用源码的公式：以鼠标位置为锚点缩放
		// left = targetImgInfo.left + offsetSize.offsetX * (1 - ratio)
		const left = this.imgStatus.left + offsetX * (1 - zoomRatio);
		const top = this.imgStatus.top + offsetY * (1 - zoomRatio);
		
		// 更新状态
		this.imgStatus.curWidth = newWidth;
		this.imgStatus.curHeight = newHeight;
		this.imgStatus.left = left;
		this.imgStatus.top = top;
		this.imgStatus.scale = newWidth / this.imgStatus.realWidth;

		// 渲染
		this.imgViewEl.setAttribute('width', this.imgStatus.curWidth + 'px');
		this.imgViewEl.style.setProperty('margin-left', this.imgStatus.left + 'px', 'important');
		this.imgViewEl.style.setProperty('margin-top', this.imgStatus.top + 'px', 'important');
	}

	/**
	 * 处理键盘事件
	 */
	private handleKeydown = (e: KeyboardEvent): void => {
		if (!this.isVisible) return;

		if (e.key === 'Escape') {
			this.close();
		}
	};

	/**
	 * 计算图片缩放尺寸（参照源码 ImgUtil.calculateImgZoomSize）
	 */
	private calculateImgSize(realImg: HTMLImageElement, windowWidth: number, windowHeight: number): { width: number; height: number; left: number; top: number } {
		const windowZoomWidth = windowWidth * ZOOM_FACTOR;
		const windowZoomHeight = windowHeight * ZOOM_FACTOR;

		let tempWidth = realImg.width;
		let tempHeight = realImg.height;

		if (realImg.height > windowZoomHeight) {
			tempHeight = windowZoomHeight;
			if ((tempWidth = tempHeight / realImg.height * realImg.width) > windowZoomWidth) {
				tempWidth = windowZoomWidth;
			}
		} else if (realImg.width > windowZoomWidth) {
			tempWidth = windowZoomWidth;
			tempHeight = tempWidth / realImg.width * realImg.height;
		}
		tempHeight = tempWidth * realImg.height / realImg.width;

		const left = (windowWidth - tempWidth) / 2;
		const top = (windowHeight - tempHeight) / 2;

		return { width: tempWidth, height: tempHeight, left, top };
	}

	/**
	 * 打开图片查看器
	 */
	open(imgEl: HTMLImageElement): void {
		// 始终挂载到 document.body，确保不被局部容器遮挡
		const parentEl = document.body;
		if (!parentEl) return;

		// 初始化容器
		this.initContainerDom(parentEl);

		// 显示容器
		if (this.containerEl) {
			this.containerEl.addClass('is-visible');
			this.isVisible = true;
		}

		// 加载并显示图片（参照源码 refreshImg）
		const realImg = new Image();
		realImg.src = imgEl.src;

		const loadInterval = setInterval(() => {
			if (realImg.width > 0 || realImg.height > 0) {
				clearInterval(loadInterval);

				const windowWidth = document.documentElement.clientWidth || document.body.clientWidth;
				const windowHeight = (document.documentElement.clientHeight || document.body.clientHeight) - 100;

				const size = this.calculateImgSize(realImg, windowWidth, windowHeight);

				// 初始化图片状态
				this.imgStatus = {
					realWidth: realImg.width,
					realHeight: realImg.height,
					curWidth: size.width,
					curHeight: size.height,
					left: size.left,
					top: size.top,
					moveX: 0,
					moveY: 0,
					scale: size.width / realImg.width,
				};

				if (this.imgViewEl) {
					this.imgViewEl.src = imgEl.src;
					this.imgViewEl.alt = imgEl.alt;
					this.imgViewEl.setAttribute('width', size.width + 'px');
					this.imgViewEl.style.setProperty('margin-top', size.top + 'px', 'important');
					this.imgViewEl.style.setProperty('margin-left', size.left + 'px', 'important');
					// 添加默认棋盘背景（用于透明图片）
					this.imgViewEl.addClass('img-default-background');
				}
			}
		}, 40);
	}

	/**
	 * 关闭图片查看器
	 */
	close(): void {
		if (this.containerEl) {
			this.containerEl.removeClass('is-visible');
			this.isVisible = false;
		}

		// 清空图片
		if (this.imgViewEl) {
			this.imgViewEl.src = '';
			this.imgViewEl.alt = '';
			this.imgViewEl.removeClass('img-default-background');
		}

		// 重置状态
		this.imgStatus = null;
		this.isDragging = false;
		document.removeEventListener('mousemove', this.handleMouseMove);
	}

	/**
	 * 移除查看器
	 */
	remove(): void {
		document.removeEventListener('keydown', this.handleKeydown);
		document.removeEventListener('mousemove', this.handleMouseMove);

		if (this.containerEl) {
			this.containerEl.remove();
			this.containerEl = null;
		}

		this.imgContainerEl = null;
		this.imgViewEl = null;
		this.isVisible = false;
		this.imgStatus = null;
		this.isDragging = false;
	}
}
