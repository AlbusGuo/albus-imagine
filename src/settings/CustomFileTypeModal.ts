import { App, Modal, Notice, Setting, TextComponent } from "obsidian";
import { FolderSuggest } from "../components/FolderSuggest";
import { CustomFileTypeConfig } from "../types/image-manager.types";
import { normalizeCoverFolder, normalizeExtension } from "../utils/vaultPaths";

interface CustomFileTypeModalOptions {
	reservedExtensions: ReadonlySet<string>;
	onChange: (config: CustomFileTypeConfig) => Promise<void>;
	onClose?: () => void;
}

interface DraftValidation {
	config: CustomFileTypeConfig | null;
	notice: string | null;
}

const COMMIT_DELAY = 300;

export class CustomFileTypeModal extends Modal {
	private readonly draft: CustomFileTypeConfig;
	private fileExtensionInput: TextComponent | null = null;
	private folderSuggest: FolderSuggest | null = null;
	private commitTimer: number | null = null;
	private commitWindow: Window | null = null;
	private commitQueue: Promise<void> = Promise.resolve();
	private lastCommittedState: string | null;
	private lastQueuedState: string | null = null;

	constructor(
		app: App,
		config: CustomFileTypeConfig | null,
		private readonly options: CustomFileTypeModalOptions,
	) {
		super(app);
		this.draft = structuredClone(config ?? {
			fileExtension: "",
			coverExtension: "",
			coverFolder: "",
		});
		this.lastCommittedState = config
			? JSON.stringify(this.normalizeConfig(config))
			: null;
	}

	onOpen(): void {
		this.setTitle(this.draft.fileExtension ? "编辑自定义文件类型" : "添加自定义文件类型");
		this.modalEl.addClass("afm-custom-file-type-modal-shell");
		this.contentEl.addClass("afm-custom-file-type-editor");
		this.contentEl.empty();

		new Setting(this.contentEl)
			.setName("文件扩展名")
			.setDesc("只输入扩展名本身, 不需要点号")
			.addText((text) => {
				this.fileExtensionInput = text
					.setPlaceholder("例如 PDF, 不含点号")
					.setValue(this.draft.fileExtension)
					.onChange((value) => {
						this.draft.fileExtension = value;
						this.handleDraftChange();
					});
			});

		new Setting(this.contentEl)
			.setName("封面扩展名")
			.setDesc("只输入封面图片扩展名本身, 不需要点号")
			.addText((text) => text
				.setPlaceholder("例如 png, 不含点号")
				.setValue(this.draft.coverExtension)
				.onChange((value) => {
					this.draft.coverExtension = value;
					this.handleDraftChange();
				}));

		new Setting(this.contentEl)
			.setName("封面文件夹")
			.setDesc("留空时与源文件同级, 手动输入相对目录, 或从联想列表选择库内目录")
			.addText((text) => {
				text
					.setPlaceholder("可选")
					.setValue(this.draft.coverFolder)
					.onChange((value) => {
						this.draft.coverFolder = value;
						this.handleDraftChange();
					});
				this.folderSuggest = new FolderSuggest(this.app, text.inputEl, (path) => {
					const normalizedPath = path.replace(/^\/+|\/+$/g, "");
					const rootPath = normalizedPath ? `/${normalizedPath}` : "/";
					this.draft.coverFolder = rootPath;
					text.setValue(rootPath);
					this.handleDraftChange();
				});
			});

		this.contentEl.ownerDocument.defaultView?.requestAnimationFrame(() => {
			this.fileExtensionInput?.inputEl.focus();
			this.fileExtensionInput?.inputEl.select();
		});
	}

	private handleDraftChange(): void {
		if (!this.validateDraft().config) {
			this.cancelScheduledCommit();
			return;
		}
		this.scheduleCommit();
	}

	private scheduleCommit(): void {
		this.cancelScheduledCommit();
		const ownerWindow = this.contentEl.ownerDocument.defaultView;
		if (!ownerWindow) {
			void this.commitCurrentDraft();
			return;
		}
		this.commitWindow = ownerWindow;
		this.commitTimer = ownerWindow.setTimeout(() => {
			this.commitTimer = null;
			this.commitWindow = null;
			void this.commitCurrentDraft();
		}, COMMIT_DELAY);
	}

	private cancelScheduledCommit(): void {
		if (this.commitTimer !== null) this.commitWindow?.clearTimeout(this.commitTimer);
		this.commitTimer = null;
		this.commitWindow = null;
	}

	private commitCurrentDraft(): Promise<void> {
		const validConfig = this.validateDraft().config;
		if (!validConfig) return this.commitQueue;
		const config = structuredClone(validConfig);
		const state = JSON.stringify(config);
		if (state === this.lastCommittedState || state === this.lastQueuedState) {
			return this.commitQueue;
		}
		this.lastQueuedState = state;

		const operation = this.commitQueue.then(async () => {
			await this.options.onChange(config);
			this.lastCommittedState = state;
		});
		this.commitQueue = operation.catch((error) => {
			new Notice(`保存自定义文件类型失败: ${error instanceof Error ? error.message : String(error)}`);
		}).finally(() => {
			if (this.lastQueuedState === state) this.lastQueuedState = null;
		});
		return this.commitQueue;
	}

	private validateDraft(): DraftValidation {
		const fileExtension = normalizeExtension(this.draft.fileExtension);
		const coverExtension = normalizeExtension(this.draft.coverExtension);
		const hasSavedOrPendingState = this.lastCommittedState !== null || this.lastQueuedState !== null;
		if (!fileExtension || !coverExtension) {
			return {
				config: null,
				notice: hasSavedOrPendingState
					? "必填字段不完整, 本次修改未保存"
					: "必填字段不完整, 未创建自定义文件类型",
			};
		}
		if (this.isInvalidExtension(fileExtension) || this.isInvalidExtension(coverExtension)) {
			return {
				config: null,
				notice: hasSavedOrPendingState
					? "扩展名格式无效, 本次修改未保存"
					: "扩展名格式无效, 未创建自定义文件类型",
			};
		}
		if (this.options.reservedExtensions.has(fileExtension)) {
			return {
				config: null,
				notice: `文件扩展名 ${fileExtension} 已存在, 本次内容未保存`,
			};
		}
		return {
			config: this.normalizeConfig({
				fileExtension,
				coverExtension,
				coverFolder: this.draft.coverFolder,
			}),
			notice: null,
		};
	}

	private normalizeConfig(config: CustomFileTypeConfig): CustomFileTypeConfig {
		return {
			fileExtension: normalizeExtension(config.fileExtension),
			coverExtension: normalizeExtension(config.coverExtension),
			coverFolder: normalizeCoverFolder(config.coverFolder),
		};
	}

	private isInvalidExtension(extension: string): boolean {
		return /[.\\/\s]/.test(extension);
	}

	onClose(): void {
		this.cancelScheduledCommit();
		const validation = this.validateDraft();
		if (!validation.config && validation.notice) new Notice(validation.notice);
		const finalCommit = validation.config ? this.commitCurrentDraft() : this.commitQueue;
		this.folderSuggest?.close();
		this.folderSuggest = null;
		this.fileExtensionInput = null;
		this.modalEl.removeClass("afm-custom-file-type-modal-shell");
		this.contentEl.removeClass("afm-custom-file-type-editor");
		this.contentEl.empty();
		void finalCommit.finally(() => this.options.onClose?.());
	}
}
