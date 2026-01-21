/**
 * 重命名Modal
 */

import { App, Modal } from "obsidian";
import { ImageItem } from "../types/image-manager.types";

export class RenameModal extends Modal {
	private image: ImageItem;
	private onConfirm: (newName: string) => Promise<void>;
	private inputEl: HTMLInputElement;

	constructor(
		app: App,
		image: ImageItem,
		onConfirm: (newName: string) => Promise<void>
	) {
		super(app);
		this.image = image;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("image-manager-rename-modal");

		contentEl.createEl("h3", { text: "重命名文件" });

		// 表单
		const form = contentEl.createDiv({
			cls: "image-manager-rename-form",
		});

		// 获取文件名（不含扩展名）
		const fileName = this.image.name;
		const extension = this.image.originalFile.extension;
		const nameWithoutExt = fileName.replace(new RegExp(`\\.${extension}$`), "");

		// 输入框
		this.inputEl = form.createEl("input", {
			cls: "image-manager-rename-input",
			attr: {
				type: "text",
				value: nameWithoutExt,
			},
		});

		// 扩展名显示
		form.createDiv({
			cls: "image-manager-file-extension",
			text: `.${extension}`,
		});

		// 按钮
		const actions = contentEl.createDiv({
			cls: "image-manager-modal-actions",
		});

		const cancelBtn = actions.createEl("button", {
			cls: "image-manager-cancel-button",
			text: "取消",
		});

		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		const confirmBtn = actions.createEl("button", {
			cls: "image-manager-confirm-button",
			text: "确定",
		});

		confirmBtn.addEventListener("click", () => {
			void this.handleConfirm();
		});

		// 回车确认
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				void this.handleConfirm();
			} else if (e.key === "Escape") {
				this.close();
			}
		});

		// 聚焦并选中
		this.inputEl.focus();
		this.inputEl.select();
	}

	/**
	 * 处理确认
	 */
	private async handleConfirm(): Promise<void> {
		const newNameWithoutExt = this.inputEl.value.trim();

		if (!newNameWithoutExt) {
			return;
		}

		const extension = this.image.originalFile.extension;
		const newName = `${newNameWithoutExt}.${extension}`;

		await this.onConfirm(newName);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
