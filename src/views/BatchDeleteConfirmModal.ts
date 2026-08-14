import { App, ButtonComponent, Modal, ProgressBarComponent, Setting } from "obsidian";
import { ImageItem } from "../types/image-manager.types";
import { setDestructiveButton } from "../utils/obsidianCompatibility";

export class BatchDeleteConfirmModal extends Modal {
	private progressBar: ProgressBarComponent | null = null;
	private progressSettingEl: HTMLElement | null = null;
	private progressTextEl: HTMLElement | null = null;
	private confirmButton: ButtonComponent | null = null;
	private cancelButton: ButtonComponent | null = null;
	private isSubmitting = false;

	constructor(
		app: App,
		private readonly images: ImageItem[],
		private readonly onConfirm: (
			onProgress: (current: number, total: number) => void
		) => Promise<void>
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("批量删除图片");
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		const customCount = this.images.filter((image) => image.isCustomType).length;
		const totalFiles = this.images.length + customCount;

		const message = this.contentEl.createEl("p");
		message.createSpan({ text: "确认要删除 " });
		message.createEl("strong", { text: `${this.images.length} 张图片` });
		message.createSpan({ text: " 吗?" });
		this.contentEl.createDiv({
			cls: "setting-item-description",
			text: customCount > 0
				? `其中 ${customCount} 张特殊图片包含封面, 共删除 ${totalFiles} 个文件.`
				: `共删除 ${totalFiles} 个文件.`,
		});

		const progressSetting = new Setting(this.contentEl).setName("删除进度");
		this.progressSettingEl = progressSetting.settingEl;
		progressSetting.settingEl.hide();
		progressSetting.addProgressBar((progress) => {
			this.progressBar = progress.setValue(0);
		});
		this.progressTextEl = progressSetting.descEl;

		new Setting(this.contentEl)
			.addButton((button) => {
				this.cancelButton = button.setButtonText("取消").onClick(() => this.close());
			})
			.addButton((button) => {
				this.confirmButton = setDestructiveButton(button.setButtonText("删除全部"))
					.onClick(() => void this.handleConfirm());
			});

		this.contentEl.ownerDocument.defaultView?.requestAnimationFrame(() => {
			this.cancelButton?.buttonEl.focus();
		});
	}

	private async handleConfirm(): Promise<void> {
		if (this.isSubmitting) return;
		this.isSubmitting = true;
		this.confirmButton?.setDisabled(true).setButtonText("正在删除...");
		this.cancelButton?.setDisabled(true);
		this.progressSettingEl?.show();
		try {
			await this.onConfirm((current, total) => this.updateProgress(current, total));
			this.close();
		} catch {
			this.isSubmitting = false;
			this.confirmButton?.setDisabled(false).setButtonText("删除全部");
			this.cancelButton?.setDisabled(false);
		}
	}

	private updateProgress(current: number, total: number): void {
		const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
		this.progressBar?.setValue(percentage);
		this.progressTextEl?.setText(`${current}/${total}(${percentage}%)`);
	}

	onClose(): void {
		this.contentEl.empty();
		this.progressBar = null;
		this.progressSettingEl = null;
		this.progressTextEl = null;
		this.confirmButton = null;
		this.cancelButton = null;
		this.isSubmitting = false;
	}
}
