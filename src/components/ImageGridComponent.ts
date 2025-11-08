/**
 * 图片网格组件
 */

import { setIcon } from "obsidian";
import { ImageItem } from "../types/image-manager.types";

export class ImageGridComponent {
	private containerEl: HTMLElement;
	private onImageClick?: (image: ImageItem) => void;
	private onImageDoubleClick?: (image: ImageItem) => void;
	private onOpenClick?: (image: ImageItem) => void;
	private onRenameClick?: (image: ImageItem) => void;
	private onDeleteClick?: (image: ImageItem) => void;

	constructor(containerEl: HTMLElement) {
		this.containerEl = containerEl;
	}

	/**
	 * 设置事件处理器
	 */
	setEventHandlers(handlers: {
		onImageClick?: (image: ImageItem) => void;
		onImageDoubleClick?: (image: ImageItem) => void;
		onOpenClick?: (image: ImageItem) => void;
		onRenameClick?: (image: ImageItem) => void;
		onDeleteClick?: (image: ImageItem) => void;
	}): void {
		this.onImageClick = handlers.onImageClick;
		this.onImageDoubleClick = handlers.onImageDoubleClick;
		this.onOpenClick = handlers.onOpenClick;
		this.onRenameClick = handlers.onRenameClick;
		this.onDeleteClick = handlers.onDeleteClick;
	}

	/**
	 * 渲染图片网格
	 */
	render(
		images: ImageItem[],
		getImagePath: (image: ImageItem) => string
	): void {
		this.containerEl.empty();

		if (images.length === 0) {
			this.renderEmptyState();
			return;
		}

		const gridEl = this.containerEl.createDiv("image-manager-grid");

		images.forEach((image) => {
			this.renderImageItem(gridEl, image, getImagePath);
		});
	}

	/**
	 * 渲染单个图片项
	 */
	private renderImageItem(
		gridEl: HTMLElement,
		image: ImageItem,
		getImagePath: (image: ImageItem) => string
	): void {
		const itemEl = gridEl.createDiv("image-manager-grid-item");

		// 点击事件
		itemEl.addEventListener("click", () => {
			this.onImageClick?.(image);
		});

		// 双击事件
		itemEl.addEventListener("dblclick", () => {
			this.onImageDoubleClick?.(image);
		});

		// 缩略图容器
		const thumbnailEl = itemEl.createDiv("image-manager-thumbnail");

		// 图片
		const imgEl = thumbnailEl.createEl("img");
		imgEl.addClass("image-manager-thumbnail-image");
		imgEl.src = getImagePath(image);
		imgEl.alt = image.name;

		// SVG图片特殊处理 - 只有当显示的封面是 SVG 时才应用
		if (image.displayFile.extension.toLowerCase() === "svg") {
			imgEl.addClass("image-manager-svg-image");
		}

		// 格式标签
		const extension = image.originalFile.extension.toUpperCase();
		const formatBadgeEl = thumbnailEl.createDiv("image-manager-format-badge");
		formatBadgeEl.setText(extension);
		formatBadgeEl.addClass(
			image.isAgx || image.isCustomType
				? "image-manager-agx-format"
				: "image-manager-other-format"
		);

		// 引用标签
		if (image.referenceCount !== undefined && image.referenceCount > 0) {
			const refBadge = thumbnailEl.createDiv("image-manager-reference-badge");
			refBadge.setText(`${image.referenceCount}`);
		}

		// 信息区域
		const infoEl = itemEl.createDiv("image-manager-image-info");

		// 文件名
		const nameEl = infoEl.createDiv("image-manager-image-name");
		nameEl.setText(image.name);
		nameEl.title = image.name;

		// 元数据
		const metaEl = infoEl.createDiv("image-manager-image-meta");

		// 引用计数
		if (image.referenceCount !== undefined) {
			const refCount = metaEl.createDiv("image-manager-reference-count");
			refCount.setText(`引用: ${image.referenceCount}`);
		}

		// 创建时间
		const createTime = new Date(image.stat.ctime).toLocaleDateString("zh-CN");
		const timeEl = metaEl.createDiv("image-manager-create-time");
		timeEl.setText(createTime);

		// 操作按钮
		const actionsEl = infoEl.createDiv("image-manager-image-actions");

		// 打开按钮
		const openBtn = actionsEl.createEl("button");
		openBtn.addClass("image-manager-action-button", "image-manager-open-button");
		openBtn.setText("📂");
		openBtn.title = "打开文件";
		openBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.onOpenClick?.(image);
		});

		// 重命名按钮
		const renameBtn = actionsEl.createEl("button");
		renameBtn.addClass("image-manager-action-button", "image-manager-rename-button");
		renameBtn.setText("✏️");
		renameBtn.title = "重命名";
		renameBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.onRenameClick?.(image);
		});

		// 删除按钮
		const deleteBtn = actionsEl.createEl("button");
		deleteBtn.addClass("image-manager-action-button", "image-manager-delete-button");
		deleteBtn.setText("🗑️");
		deleteBtn.title = "删除";
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.onDeleteClick?.(image);
		});
	}

	/**
	 * 渲染空状态
	 */
	private renderEmptyState(): void {
		const emptyEl = this.containerEl.createDiv("image-manager-empty-state");
		const msgEl = emptyEl.createDiv();
		msgEl.setText("📁 该文件夹中没有图片");
		const hintEl = emptyEl.createDiv("image-manager-empty-hint");
		hintEl.setText("支持 PNG, JPG, JPEG, GIF, BMP, WEBP, SVG, AGX 格式");
	}

	/**
	 * 显示加载状态
	 */
	showLoading(): void {
		this.containerEl.empty();
		const loadingEl = this.containerEl.createDiv("image-manager-loading-state");
		loadingEl.createDiv("image-manager-loading-spinner");
		const textEl = loadingEl.createDiv();
		textEl.setText("加载中...");
	}
}
