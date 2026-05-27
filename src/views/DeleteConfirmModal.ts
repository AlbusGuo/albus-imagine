/**
 * 删除确认模态框
 */

import { App, Modal } from "obsidian";
import { ImageItem } from "../types/image-manager.types";

export class DeleteConfirmModal extends Modal {
	private image: ImageItem;
	private onConfirm: () => Promise<void>;
	private extraMessage: string;

	constructor(
		app: App,
		image: ImageItem,
		extraMessage: string,
		onConfirm: () => Promise<void>
	) {
		super(app);
		this.image = image;
		this.extraMessage = extraMessage;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("delete-confirm-modal");

		// 内容
		const bodyEl = contentEl.createDiv("delete-confirm-modal-body");
		
		const messageEl = bodyEl.createDiv("delete-confirm-modal-message");
		messageEl.createSpan({ text: "确定要删除文件 " });
		messageEl.createEl("strong", { text: this.image.name });
		messageEl.createSpan({ text: " 吗？" });

		if (this.extraMessage) {
			const extraEl = bodyEl.createDiv("delete-confirm-modal-extra");
			extraEl.setText(this.extraMessage);
		}

		// 按钮区域
		const actionsEl = contentEl.createDiv("delete-confirm-modal-actions");

		// 取消按钮
		const cancelBtn = actionsEl.createEl("button", {
			cls: "delete-confirm-cancel-button",
			text: "取消",
		});
		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		// 确认删除按钮
		const confirmBtn = actionsEl.createEl("button", {
			cls: "delete-confirm-delete-button",
			text: "删除",
		});
		confirmBtn.addEventListener("click", () => {
			void this.handleConfirm();
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
			await this.onConfirm();
			this.close();
		} catch {
			// 错误已在调用方处理，保持模态框打开以便用户看到错误提示
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
