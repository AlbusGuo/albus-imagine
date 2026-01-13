/**
 * 批量删除确认模态框
 */

import { App, Modal } from "obsidian";
import { ImageItem } from "../types/image-manager.types";

export class BatchDeleteConfirmModal extends Modal {
	private images: ImageItem[];
	private onConfirm: () => Promise<void>;
	private bodyEl: HTMLElement | null = null;
	private actionsEl: HTMLElement | null = null;

	constructor(
		app: App,
		images: ImageItem[],
		onConfirm: () => Promise<void>
	) {
		super(app);
		this.images = images;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("delete-confirm-modal");

		// 统计信息
		const normalImages = this.images.filter(img => !img.isCustomType);
		const customImages = this.images.filter(img => img.isCustomType);
		const totalFiles = normalImages.length + customImages.length * 2; // 自定义类型需要删除2个文件

		// 内容
		this.bodyEl = contentEl.createDiv("delete-confirm-modal-body");
		
		const messageEl = this.bodyEl.createDiv("delete-confirm-modal-message");
		messageEl.createSpan({ text: "确认要删除 " });
		messageEl.createEl("strong", { text: `${this.images.length} 张图片` });
		messageEl.createSpan({ text: " 吗？" });

		// 详细统计
		const detailsEl = this.bodyEl.createDiv("delete-confirm-modal-extra");
		if (customImages.length > 0) {
			detailsEl.setText(
				`普通图片 ${normalImages.length} 张, 特殊图片 ${customImages.length} 张, 共删除 ${normalImages.length} + ${customImages.length}×2 = ${totalFiles} 个文件`
			);
		} else {
			detailsEl.setText(`共删除 ${totalFiles} 个文件`);
		}

		// 警告信息
		const warningEl = this.bodyEl.createDiv("delete-confirm-modal-extra");
		warningEl.style.marginTop = "12px";
		warningEl.setText("此操作不可撤销！");

		// 按钮区域
		this.actionsEl = contentEl.createDiv("delete-confirm-modal-actions");

		// 取消按钮
		const cancelBtn = this.actionsEl.createEl("button", {
			cls: "delete-confirm-modal-cancel",
			text: "取消",
		});
		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		// 确认删除按钮
		const confirmBtn = this.actionsEl.createEl("button", {
			cls: "delete-confirm-modal-delete",
			text: "删除全部",
		});
		confirmBtn.addEventListener("click", async () => {
			await this.handleConfirm();
		});

		// 默认聚焦取消按钮（更安全）
		setTimeout(() => cancelBtn.focus(), 0);

		// ESC 键关闭
		this.scope.register([], "Escape", () => {
			this.close();
			return false;
		});

		// Enter 键确认删除
		this.scope.register([], "Enter", async () => {
			await this.handleConfirm();
			return false;
		});
	}

	private async handleConfirm(): Promise<void> {
		try {
			// 显示加载状态
			this.showLoadingState();
			await this.onConfirm();
			this.close();
		} catch (error) {
			// 错误已在调用方处理，恢复界面以便用户看到错误提示
			this.hideLoadingState();
		}
	}

	/**
	 * 显示加载状态
	 */
	private showLoadingState(): void {
		if (!this.bodyEl || !this.actionsEl) return;

		// 清空原内容
		this.bodyEl.empty();
		this.actionsEl.empty();

		// 添加加载动画
		const loadingContainer = this.bodyEl.createDiv("delete-confirm-loading");
		loadingContainer.createDiv("delete-confirm-loading-spinner");
		loadingContainer.createDiv({
			text: "正在删除图片...",
			cls: "delete-confirm-loading-text"
		});
	}

	/**
	 * 隐藏加载状态（恢复原界面）
	 */
	private hideLoadingState(): void {
		if (!this.bodyEl || !this.actionsEl) return;

		// 重新打开模态框以恢复原内容
		this.contentEl.empty();
		this.onOpen();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
