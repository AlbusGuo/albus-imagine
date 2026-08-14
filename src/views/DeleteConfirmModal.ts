/**
 * 删除确认模态框
 */

import { App, ButtonComponent, Modal, Setting } from "obsidian";
import { ImageItem } from "../types/image-manager.types";

export class DeleteConfirmModal extends Modal {
	private image: ImageItem;
	private onConfirm: () => Promise<void>;
	private extraMessage: string;
	private confirmButton: ButtonComponent | null = null;
	private isSubmitting = false;

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
		this.setTitle("删除图片");
		const messageEl = contentEl.createEl("p");
		messageEl.createSpan({ text: "确定要删除文件 " });
		messageEl.createEl("strong", { text: this.image.name });
		messageEl.createSpan({ text: " 吗?" });

		if (this.extraMessage) {
			contentEl.createDiv({
				cls: "setting-item-description",
				text: this.extraMessage,
			});
		}

		let cancelButton: ButtonComponent | null = null;
		new Setting(contentEl)
			.addButton((button) => {
				cancelButton = button.setButtonText("取消").onClick(() => this.close());
			})
			.addButton((button) => {
				this.confirmButton = button
					.setButtonText("删除")
					.setWarning()
					.onClick(() => void this.handleConfirm());
			});

		this.contentEl.ownerDocument.defaultView?.requestAnimationFrame(() => {
			cancelButton?.buttonEl.focus();
		});

	}

	private async handleConfirm(): Promise<void> {
		if (this.isSubmitting) return;
		this.isSubmitting = true;
		this.confirmButton?.setDisabled(true).setButtonText("正在删除...");
		try {
			await this.onConfirm();
			this.close();
		} catch {
			// 错误已在调用方处理, 保持模态框打开以便用户看到错误提示
			this.isSubmitting = false;
			this.confirmButton?.setDisabled(false).setButtonText("删除");
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.confirmButton = null;
		this.isSubmitting = false;
	}
}
