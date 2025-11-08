/**
 * 文件夹建议组件
 * 使用 Obsidian 的 AbstractInputSuggest API
 */

import { App, TFolder, TAbstractFile } from "obsidian";
import { TextComponent } from "obsidian";

export class FolderSuggest {
	private app: App;
	private inputEl: HTMLInputElement;
	private onSelect?: (value: string) => void;
	private suggestEl: HTMLElement | null = null;
	private folders: TFolder[] = [];
	private selectedIndex = -1;

	constructor(app: App, inputEl: HTMLInputElement, onSelect?: (value: string) => void) {
		this.app = app;
		this.inputEl = inputEl;
		this.onSelect = onSelect;
		this.init();
	}

	private init(): void {
		// 监听输入事件
		this.inputEl.addEventListener("input", () => {
			this.updateSuggestions();
		});

		// 监听焦点事件
		this.inputEl.addEventListener("focus", () => {
			this.updateSuggestions();
		});

		// 监听键盘事件
		this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (!this.suggestEl || this.folders.length === 0) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				this.selectedIndex = Math.min(
					this.selectedIndex + 1,
					this.folders.length - 1
				);
				this.renderSuggestions();
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
				this.renderSuggestions();
			} else if (e.key === "Enter" && this.selectedIndex >= 0) {
				e.preventDefault();
				this.selectFolder(this.folders[this.selectedIndex]);
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.close();
			}
		});

		// 点击外部关闭
		document.addEventListener("click", (e) => {
			if (!this.inputEl.contains(e.target as Node) && 
				(!this.suggestEl || !this.suggestEl.contains(e.target as Node))) {
				this.close();
			}
		});
	}

	private updateSuggestions(): void {
		const query = this.inputEl.value.toLowerCase();
		
		// 获取所有文件夹
		const allFolders = this.app.vault.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder)
			.sort((a, b) => a.path.localeCompare(b.path));

		// 过滤匹配的文件夹
		if (query) {
			this.folders = allFolders.filter((folder) =>
				folder.path.toLowerCase().includes(query)
			);
		} else {
			this.folders = allFolders;
		}

		// 限制显示数量
		this.folders = this.folders.slice(0, 10);
		this.selectedIndex = -1;

		this.renderSuggestions();
	}

	private renderSuggestions(): void {
		// 清除旧的建议框
		if (this.suggestEl) {
			this.suggestEl.remove();
		}

		if (this.folders.length === 0) {
			return;
		}

		// 创建建议框
		this.suggestEl = document.createElement("div");
		this.suggestEl.addClass("suggestion-container");
		this.suggestEl.style.position = "fixed";  // 改为 fixed 定位
		this.suggestEl.style.zIndex = "10000";  // 提高 z-index
		this.suggestEl.style.background = "var(--background-primary)";
		this.suggestEl.style.border = "1px solid var(--background-modifier-border)";
		this.suggestEl.style.borderRadius = "4px";
		this.suggestEl.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
		this.suggestEl.style.maxHeight = "300px";
		this.suggestEl.style.overflowY = "auto";
		this.suggestEl.style.minWidth = this.inputEl.offsetWidth + "px";

		// 定位
		const rect = this.inputEl.getBoundingClientRect();
		this.suggestEl.style.top = rect.bottom + window.scrollY + "px";
		this.suggestEl.style.left = rect.left + window.scrollX + "px";

		// 添加建议项
		this.folders.forEach((folder, index) => {
			const item = this.suggestEl!.createDiv("suggestion-item");
			item.style.padding = "8px 12px";
			item.style.cursor = "pointer";
			item.style.userSelect = "none";  // 防止文本选择
			item.textContent = folder.path || "(根目录)";

			if (index === this.selectedIndex) {
				item.style.background = "var(--background-modifier-hover)";
			}

			// 使用 mousedown 而不是 click，避免焦点问题
			item.addEventListener("mousedown", (e) => {
				e.preventDefault();  // 防止输入框失去焦点
				this.selectFolder(folder);
			});

			item.addEventListener("mouseenter", () => {
				this.selectedIndex = index;
				this.renderSuggestions();
			});
		});

		document.body.appendChild(this.suggestEl);
	}

	private selectFolder(folder: TFolder): void {
		this.inputEl.value = folder.path;
		// 触发原生 input 事件
		this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
		// 如果有回调，也调用回调
		if (this.onSelect) {
			this.onSelect(folder.path);
		}
		this.close();
	}

	private close(): void {
		if (this.suggestEl) {
			this.suggestEl.remove();
			this.suggestEl = null;
		}
		this.folders = [];
		this.selectedIndex = -1;
	}

	public destroy(): void {
		this.close();
	}
}
