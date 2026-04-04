/**
 * 文件夹建议组件
 * 基于 Obsidian 内置 AbstractInputSuggest 实现
 */

import { AbstractInputSuggest, App, TFolder } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(app: App, inputEl: HTMLInputElement, onSelectCb?: (path: string) => void) {
		super(app, inputEl);
		if (onSelectCb) {
			this.onSelect((folder) => {
				onSelectCb(folder.path);
			});
		}
	}

	protected getSuggestions(query: string): TFolder[] {
		const lowerQuery = (query || "").toLowerCase();
		return this.app.vault
			.getAllFolders()
			.filter((f) => f.path.toLowerCase().includes(lowerQuery))
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path || "/");
	}
}
