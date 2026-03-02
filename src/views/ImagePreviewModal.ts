/**
 * 图片预览Modal
 */

import { App, Modal } from "obsidian";
import { ImageItem, ReferenceInfo } from "../types/image-manager.types";

export class ImagePreviewModal extends Modal {
	private image: ImageItem;
	private references: ReferenceInfo[];
	private getImagePath: (image: ImageItem) => string;
	private onOpenReference?: (filePath: string) => void;
	private imageScale = 1;
	private imageElement: HTMLImageElement | null = null;

	constructor(
		app: App,
		image: ImageItem,
		references: ReferenceInfo[],
		getImagePath: (image: ImageItem) => string,
		onOpenReference?: (filePath: string) => void
	) {
		super(app);
		this.image = image;
		this.references = references;
		this.getImagePath = getImagePath;
		this.onOpenReference = onOpenReference;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		
		// 设置 Modal 容器样式
		modalEl.addClass("image-manager-preview-modal-container");
		
		contentEl.addClass("image-manager-preview-modal");
		contentEl.empty();

		this.renderToolbar();
		this.renderContent();
	}

	/**
	 * 渲染工具栏
	 */
	private renderToolbar(): void {
		const toolbar = this.contentEl.createDiv({
			cls: "image-manager-preview-toolbar",
		});

		// 标题
		const titleEl = toolbar.createDiv({
			cls: "image-manager-preview-title",
		});

		titleEl.createSpan({ text: this.image.name });

		// 格式标签
		const extension = this.image.originalFile.extension.toUpperCase();
		const formatTag = titleEl.createSpan({
			cls: "image-manager-format-tag",
			text: extension,
		});
		formatTag.addClass(
			this.image.isCustomType
				? "image-manager-agx-format-tag"
				: "image-manager-other-format-tag"
		);

		// 引用标签
		if (
			this.image.referenceCount !== undefined &&
			this.image.referenceCount > 0
		) {
			titleEl.createSpan({
				cls: "image-manager-reference-tag",
				text: `${this.image.referenceCount} 个引用`,
			});
		}
	}

	/**
	 * 渲染内容
	 */
	private renderContent(): void {
		const content = this.contentEl.createDiv({
			cls: "image-manager-preview-content",
		});

		// 左侧：图片和详细信息
		this.renderImageSection(content);

		// 右侧：引用列表
		this.renderInfoSection(content);
	}

	/**
	 * 渲染图片区域（包含详细信息）
	 */
	private renderImageSection(container: HTMLElement): void {
		const imageSection = container.createDiv({
			cls: "image-manager-preview-image-section",
		});

		// 图片容器
		const imageContainer = imageSection.createDiv({
			cls: "image-manager-preview-image-container",
		});

		const img = imageContainer.createEl("img", {
			cls: "image-manager-preview-image image-preview-zoom",
			attr: {
				src: this.getImagePath(this.image),
				alt: this.image.name,
			},
		});

		// 保存图片元素引用
		this.imageElement = img;

		// SVG图片特殊处理 - 只有当显示的封面是 SVG 时才应用
		if (this.image.displayFile.extension.toLowerCase() === "svg") {
			img.addClass("image-manager-svg-image");
		}

		// 添加加载错误处理，防止循环加载
		let loadFailed = false;
		img.onerror = () => {
			if (loadFailed) return; // 防止重复处理
			loadFailed = true;
			console.warn(`预览图片加载失败: ${this.image.path}`);
			// 清空 src 防止持续尝试加载
			img.src = "";
			img.addClass("image-manager-cover-hidden");
			// 显示错误提示
			const errorDiv = imageContainer.createDiv({
				cls: "image-manager-preview-error",
			});
			errorDiv.createEl("div", {
				text: "⚠️",
				cls: "image-manager-preview-error-icon",
			});
			errorDiv.createEl("div", {
				text: "图片加载失败",
				cls: "image-manager-preview-error-text",
			});
			errorDiv.createEl("div", {
				text: "文件可能已损坏、过大或格式不支持",
				cls: "image-manager-preview-error-hint",
			});
		};

		// 添加加载超时处理（15秒）
		const loadTimeout = setTimeout(() => {
			if (!img.complete && !loadFailed) {
				console.warn(`预览图片加载超时: ${this.image.path}`);
				img.onerror?.(new Event("error"));
			}
		}, 15000);

		// 加载成功时清除超时
		img.onload = () => {
			clearTimeout(loadTimeout);
		};

		// 添加滚轮缩放功能
		imageContainer.addEventListener("wheel", (e: WheelEvent) => {
			e.preventDefault();
			
			// 计算缩放增量
			const delta = e.deltaY > 0 ? -0.1 : 0.1;
			this.imageScale = Math.max(0.1, Math.min(5, this.imageScale + delta));
			
			// 应用缩放
			if (this.imageElement) {
				this.imageElement.style.setProperty('--image-scale', String(this.imageScale));
				this.imageElement.removeClass("cursor-zoom-in", "cursor-zoom-out");
				this.imageElement.addClass(this.imageScale > 1 ? "cursor-zoom-out" : "cursor-zoom-in");
			}
		});

		// 点击重置缩放
		img.addEventListener("click", () => {
			if (this.imageScale !== 1) {
				this.imageScale = 1;
				img.style.setProperty('--image-scale', '1');
				img.removeClass("cursor-zoom-in", "cursor-zoom-out");
				img.addClass("cursor-zoom-in");
			}
		});

		// 详细信息放在图片下方
		this.renderDetails(imageSection);
	}

	/**
	 * 渲染信息区域（仅引用列表）
	 */
	private renderInfoSection(container: HTMLElement): void {
		const infoSection = container.createDiv({
			cls: "image-manager-preview-info-section",
		});

		// 只渲染引用文档
		this.renderBacklinks(infoSection);
	}

	/**
	 * 渲染详细信息
	 */
	private renderDetails(container: HTMLElement): void {
		const detailSection = container.createDiv({
			cls: "image-manager-detail-section",
		});

		detailSection.createEl("h4", { text: "详细信息" });

		const detailList = detailSection.createDiv({
			cls: "image-manager-detail-list",
		});

		// 文件路径
		this.createDetailItem(detailList, "路径", this.image.path);

		// 文件大小
		const sizeKB = (this.image.stat.size / 1024).toFixed(2);
		this.createDetailItem(detailList, "大小", `${sizeKB} KB`);

		// 创建时间
		const createTime = new Date(this.image.stat.ctime).toLocaleString(
			"zh-CN"
		);
		this.createDetailItem(detailList, "创建时间", createTime);

		// 修改时间
		const modifyTime = new Date(this.image.stat.mtime).toLocaleString(
			"zh-CN"
		);
		this.createDetailItem(detailList, "修改时间", modifyTime);

		// 引用数量
		const refCount = this.image.referenceCount ?? 0;
		this.createDetailItem(detailList, "引用数量", `${refCount} 个`);
	}

	/**
	 * 创建详细信息项
	 */
	private createDetailItem(
		container: HTMLElement,
		label: string,
		value: string
	): void {
		const item = container.createDiv({
			cls: "image-manager-detail-item",
		});

		item.createDiv({
			cls: "image-manager-detail-label",
			text: label,
		});

		item.createDiv({
			cls: "image-manager-detail-value",
			text: value,
		});
	}

	/**
	 * 渲染引用文档
	 */
	private renderBacklinks(container: HTMLElement): void {
		const backlinksSection = container.createDiv({
			cls: "image-manager-backlinks-section",
		});

		backlinksSection.createEl("h4", { text: "引用文档" });

		const backlinksList = backlinksSection.createDiv({
			cls: "image-manager-backlinks-list",
		});

		if (this.references.length === 0) {
			this.renderNoBacklinks(backlinksList);
		} else {
			this.references.forEach((ref) => {
				this.renderBacklinkItem(backlinksList, ref);
			});
		}
	}

	/**
	 * 渲染无引用状态
	 */
	private renderNoBacklinks(container: HTMLElement): void {
		const noBacklinks = container.createDiv({
			cls: "image-manager-no-backlinks",
		});

		noBacklinks.createDiv({ text: "📝 暂无引用" });
	}

	/**
	 * 渲染引用项
	 */
	private renderBacklinkItem(
		container: HTMLElement,
		ref: ReferenceInfo
	): void {
		const item = container.createDiv({
			cls: "image-manager-backlink-item",
		});

		item.addEventListener("click", () => {
			this.onOpenReference?.(ref.file.path);
			this.close();
		});

		const info = item.createDiv({
			cls: "image-manager-backlink-info",
		});

		info.createDiv({
			cls: "image-manager-backlink-name",
			text: ref.file.basename,
		});

		info.createDiv({
			cls: "image-manager-backlink-path",
			text: ref.file.path,
			attr: { title: ref.file.path },
		});

		item.createDiv({
			cls: "image-manager-backlink-type",
			text: ref.type === "embed" ? "嵌入" : "链接",
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
