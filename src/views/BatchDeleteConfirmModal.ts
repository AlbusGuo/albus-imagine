import {
	App,
	ButtonComponent,
	Modal,
	ProgressBarComponent,
	Setting,
} from "obsidian";
import { ImageItem } from "../types/image-manager.types";
import { setDestructiveButton } from "../utils/obsidianCompatibility";
import { t } from "../i18n";

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
			onProgress: (current: number, total: number) => void,
		) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(t("batchDelete.title"));
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		const customCount = this.images.filter(
			(image) => image.isCustomType,
		).length;
		const totalFiles = this.images.length + customCount;

		const message = this.contentEl.createEl("p");
		message.createSpan({ text: t("batchDelete.confirmPrefix") });
		message.createEl("strong", {
			text: `${this.images.length}${t("batchDelete.imagesCount")}`,
		});
		message.createSpan({ text: t("batchDelete.questionMark") });
		this.contentEl.createDiv({
			cls: "setting-item-description",
			text:
				customCount > 0
					? t("batchDelete.customFilesInfo")
							.replace("{customCount}", customCount.toString())
							.replace("{totalFiles}", totalFiles.toString())
					: t("batchDelete.totalFilesInfo").replace(
							"{totalFiles}",
							totalFiles.toString(),
						),
		});

		const progressSetting = new Setting(this.contentEl).setName(
			t("batchDelete.progress"),
		);
		this.progressSettingEl = progressSetting.settingEl;
		progressSetting.settingEl.hide();
		progressSetting.addProgressBar((progress) => {
			this.progressBar = progress.setValue(0);
		});
		this.progressTextEl = progressSetting.descEl;

		new Setting(this.contentEl)
			.addButton((button) => {
				this.cancelButton = button
					.setButtonText(t("batchDelete.cancel"))
					.onClick(() => this.close());
			})
			.addButton((button) => {
				this.confirmButton = setDestructiveButton(
					button.setButtonText(t("batchDelete.confirm")),
				).onClick(() => void this.handleConfirm());
			});

		this.contentEl.ownerDocument.defaultView?.requestAnimationFrame(() => {
			this.cancelButton?.buttonEl.focus();
		});
	}

	private async handleConfirm(): Promise<void> {
		if (this.isSubmitting) return;
		this.isSubmitting = true;
		this.confirmButton
			?.setDisabled(true)
			.setButtonText(t("batchDelete.deleting"));
		this.cancelButton?.setDisabled(true);
		this.progressSettingEl?.show();
		try {
			await this.onConfirm((current, total) =>
				this.updateProgress(current, total),
			);
			this.close();
		} catch {
			this.isSubmitting = false;
			this.confirmButton
				?.setDisabled(false)
				.setButtonText(t("batchDelete.confirm"));
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
