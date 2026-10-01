import {
	App,
	ButtonComponent,
	Modal,
	Notice,
	Setting,
	TextComponent,
} from "obsidian";
import { ImageItem } from "../types/image-manager.types";
import { t } from "../i18n";

export class RenameModal extends Modal {
	private input: TextComponent | null = null;
	private confirmButton: ButtonComponent | null = null;
	private isSubmitting = false;

	constructor(
		app: App,
		private readonly image: ImageItem,
		private readonly onConfirm: (newName: string) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(t("rename.title"));
		const extension = this.image.originalFile.extension;
		const suffix = `.${extension}`;
		const initialName = this.image.name.endsWith(suffix)
			? this.image.name.slice(0, -suffix.length)
			: this.image.name;

		const nameSetting = new Setting(this.contentEl).setName(
			t("rename.fileName"),
		);
		nameSetting.addText((input) => {
			this.input = input
				.setValue(initialName)
				.setPlaceholder(t("rename.fileName.placeholder"))
				.onChange((value) =>
					this.confirmButton?.setDisabled(value.trim().length === 0),
				);
			input.inputEl.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					void this.handleConfirm();
				}
			});
		});
		nameSetting.controlEl.createSpan({
			cls: "setting-item-description",
			text: suffix,
		});

		new Setting(this.contentEl)
			.addButton((button) =>
				button
					.setButtonText(t("rename.cancel"))
					.onClick(() => this.close()),
			)
			.addButton((button) => {
				this.confirmButton = button
					.setButtonText(t("rename.confirm"))
					.setCta()
					.onClick(() => void this.handleConfirm());
			});

		this.contentEl.ownerDocument.defaultView?.requestAnimationFrame(() => {
			this.input?.inputEl.focus();
			this.input?.inputEl.select();
		});
	}

	private async handleConfirm(): Promise<void> {
		if (this.isSubmitting) return;
		const baseName = this.input?.getValue().trim() ?? "";
		if (!baseName) {
			new Notice(t("rename.error.empty"));
			return;
		}

		this.isSubmitting = true;
		this.input?.setDisabled(true);
		this.confirmButton
			?.setDisabled(true)
			.setButtonText(t("rename.renaming"));
		try {
			await this.onConfirm(
				`${baseName}.${this.image.originalFile.extension}`,
			);
			this.close();
		} catch {
			this.isSubmitting = false;
			this.input?.setDisabled(false);
			this.confirmButton
				?.setDisabled(false)
				.setButtonText(t("rename.confirm"));
		}
	}

	onClose(): void {
		this.contentEl.empty();
		this.input = null;
		this.confirmButton = null;
		this.isSubmitting = false;
	}
}
