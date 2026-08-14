/**
 * 图片预览 Modal
 */

import { App, Modal, setIcon } from "obsidian";
import { ImagePanZoomController } from "../components/ImagePanZoomController";
import { ImageItem, ReferenceInfo } from "../types/image-manager.types";

export class ImagePreviewModal extends Modal {
	private image: ImageItem;
	private references: ReferenceInfo[];
	private getImagePath: (image: ImageItem) => string;
	private onOpenReference?: (filePath: string, position?: { start: { line: number; col: number; }; }) => void;

	private panZoom: ImagePanZoomController | null = null;
	private loadTimeout: number | null = null;

	constructor(
		app: App,
		image: ImageItem,
		references: ReferenceInfo[],
		getImagePath: (image: ImageItem) => string,
		onOpenReference?: (filePath: string, position?: { start: { line: number; col: number; }; }) => void
	) {
		super(app);
		this.image = image;
		this.references = references;
		this.getImagePath = getImagePath;
		this.onOpenReference = onOpenReference;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;

		modalEl.addClass("image-manager-preview-modal-container");
		contentEl.addClass("image-manager-preview-modal");
		contentEl.empty();
		this.setTitle(this.image.name);

		this.renderContent();
	}

	/**
	 * 渲染内容
	 */
	private renderContent(): void {
		const content = this.contentEl.createDiv({
			cls: "image-manager-preview-content",
		});

		// 左侧: 图片预览 (无限画布) + 详细信息
		this.renderImageSection(content);

		// 右侧: 引用列表
		this.renderInfoSection(content);
	}

	/**
	 * 渲染图片区域 (参照 ImageViewerView 实现)
	 */
	private renderImageSection(container: HTMLElement): void {
		const imageSection = container.createDiv({
			cls: "image-manager-preview-image-section",
		});

		// 图片画布容器
		const imageContainer = imageSection.createDiv({
			cls: "image-manager-preview-image-container image-manager-canvas",
		});
		const img = this.contentEl.ownerDocument.createElement("img");
		img.addClass("image-manager-preview-image");
		img.src = this.getImagePath(this.image);
		img.alt = this.image.name;
		imageContainer.appendChild(img);

		// SVG 特殊处理
		if (this.image.displayFile.extension.toLowerCase() === "svg") {
			img.addClass("image-manager-svg-image");
		}

		// 加载错误处理
		let loadFailed = false;
		img.onerror = () => {
			if (loadFailed) return;
			loadFailed = true;
			this.clearLoadTimeout();
			img.src = "";
			img.addClass("image-manager-cover-hidden");
			const errorDiv = imageContainer.createDiv({
				cls: "image-manager-preview-error",
			});
			const errorIcon = errorDiv.createDiv({ cls: "image-manager-preview-error-icon" });
			setIcon(errorIcon, "alert-triangle");
			errorDiv.createEl("div", {
				text: "图片加载失败",
				cls: "image-manager-preview-error-text",
			});
			errorDiv.createEl("div", {
				text: "文件可能已损坏, 过大或格式不支持",
				cls: "image-manager-preview-error-hint",
			});
		};

		this.loadTimeout = this.contentEl.ownerDocument.defaultView?.setTimeout(() => {
			if (!img.complete && !loadFailed) {
				img.onerror?.(new Event("error"));
			}
		}, 15000) ?? null;

		img.onload = () => {
			this.clearLoadTimeout();
			img.addClass("is-loaded");
			this.panZoom?.destroy();
			this.panZoom = new ImagePanZoomController(img, imageContainer, {
				draggingClass: "image-manager-canvas-dragging",
			});
			this.panZoom.reset();
		};

		// 详细信息
		this.renderDetails(imageSection);
	}

	/**
	 * 渲染信息区域 (仅引用列表)
	 */
	private renderInfoSection(container: HTMLElement): void {
		const infoSection = container.createDiv({
			cls: "image-manager-preview-info-section",
		});

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

		if (this.image.isCustomType) {
			// 自定义文件类型 - 双栏布局显示源文件和封面信息
			this.renderDualColumnDetails(detailSection);
		} else {
			// 普通图片 - 单栏布局
			this.renderSingleColumnDetails(detailSection);
		}
	}

	/**
	 * 渲染单栏详细信息 (普通图片)
	 */
	private renderSingleColumnDetails(container: HTMLElement): void {
		const detailList = container.createDiv({
			cls: "image-manager-detail-list",
		});

		this.createDetailItem(detailList, "路径", this.image.path);

		const sizeKB = (this.image.stat.size / 1024).toFixed(2);
		this.createDetailItem(detailList, "大小", `${sizeKB} KB`);

		const createTime = new Date(this.image.stat.ctime).toLocaleString("zh-CN");
		this.createDetailItem(detailList, "创建时间", createTime);

		const modifyTime = new Date(this.image.stat.mtime).toLocaleString("zh-CN");
		this.createDetailItem(detailList, "修改时间", modifyTime);
	}

	/**
	 * 渲染双栏详细信息 (自定义文件类型)
	 */
	private renderDualColumnDetails(container: HTMLElement): void {
		const dualColumns = container.createDiv({
			cls: "image-manager-detail-dual-columns",
		});

		// 左列 - 源文件信息
		const leftColumn = dualColumns.createDiv({
			cls: "image-manager-detail-column",
		});
		leftColumn.createEl("h5", { text: "源文件" });
		const leftList = leftColumn.createDiv({ cls: "image-manager-detail-list" });

		this.createDetailItem(leftList, "路径", this.image.originalFile.path);

		const origSizeKB = (this.image.stat.size / 1024).toFixed(2);
		this.createDetailItem(leftList, "大小", `${origSizeKB} KB`);

		const createTime = new Date(this.image.stat.ctime).toLocaleString("zh-CN");
		this.createDetailItem(leftList, "创建时间", createTime);

		const modifyTime = new Date(this.image.stat.mtime).toLocaleString("zh-CN");
		this.createDetailItem(leftList, "修改时间", modifyTime);

		if (this.image.customTypeConfig) {
			this.createDetailItem(leftList, "类型", this.image.customTypeConfig.fileExtension.toUpperCase());
		}

		// 右列 - 封面/显示文件信息
		const rightColumn = dualColumns.createDiv({
			cls: "image-manager-detail-column",
		});
		rightColumn.createEl("h5", { text: "封面文件" });
		const rightList = rightColumn.createDiv({ cls: "image-manager-detail-list" });

		if (this.image.coverMissing) {
			this.createDetailItem(rightList, "状态", "封面缺失");
		} else {
			const coverStat = this.image.displayFile.stat;
			this.createDetailItem(rightList, "路径", this.image.displayFile.path);

			const coverSizeKB = (coverStat.size / 1024).toFixed(2);
			this.createDetailItem(rightList, "大小", `${coverSizeKB} KB`);

			const coverCreateTime = new Date(coverStat.ctime).toLocaleString("zh-CN");
			this.createDetailItem(rightList, "创建时间", coverCreateTime);

			const coverModifyTime = new Date(coverStat.mtime).toLocaleString("zh-CN");
			this.createDetailItem(rightList, "修改时间", coverModifyTime);

			this.createDetailItem(rightList, "类型", this.image.displayFile.extension.toUpperCase());
		}
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

		backlinksSection.createEl("h4", { text: "引用笔记" });

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

		noBacklinks.createDiv({ text: "暂无引用" });
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
			this.onOpenReference?.(ref.file.path, ref.position);
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
		});
	}

	onClose(): void {
		this.clearLoadTimeout();
		this.panZoom?.destroy();
		this.panZoom = null;

		const { contentEl } = this;
		contentEl.empty();
	}

	private clearLoadTimeout(): void {
		if (this.loadTimeout === null) return;
		this.contentEl.ownerDocument.defaultView?.clearTimeout(this.loadTimeout);
		this.loadTimeout = null;
	}
}
