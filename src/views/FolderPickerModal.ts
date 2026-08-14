/**
 * 文件夹选择 Modal - 用于选择目标文件夹
 */

import { App, SuggestModal, TFolder } from "obsidian";

export class FolderPickerModal extends SuggestModal<TFolder> {
	private onChoose: (folder: TFolder) => void;

	constructor(app: App, onChoose: (folder: TFolder) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder("选择目标文件夹...");
	}

	getSuggestions(query: string): TFolder[] {
		const lowerQuery = query.toLowerCase();
		return this.app.vault
			.getAllFolders()
			.filter((f) => f.path.toLowerCase().includes(lowerQuery))
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.createDiv({ text: folder.path || "/" });
	}

	onChooseSuggestion(folder: TFolder): void {
		this.onChoose(folder);
	}
}
