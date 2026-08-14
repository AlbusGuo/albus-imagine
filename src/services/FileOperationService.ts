/**
 * 文件操作服务
 */

import { App, MarkdownView, Notice, TFile } from "obsidian";
import { ImageItem, SUPPORTED_IMAGE_EXTENSIONS } from "../types/image-manager.types";
import { getCoverPath, joinVaultPath, normalizeVaultFolder } from "../utils/vaultPaths";
import { DesktopIntegrationService } from "./DesktopIntegrationService";

export class FileOperationService {
	private readonly desktop: DesktopIntegrationService;

	constructor(private app: App, desktop?: DesktopIntegrationService) {
		this.desktop = desktop ?? new DesktopIntegrationService(app);
	}

	/**
	 * 打开文件 (图片用系统默认应用, 其他用 Obsidian 内部打开)
	 */
	openFile(image: ImageItem): void {
		const ext = image.originalFile.extension.toLowerCase();
		if ((SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
			this.desktop.openWithDefaultApp(image.originalFile);
		} else {
			const leaf = this.app.workspace.getLeaf(false);
			void leaf.openFile(image.originalFile);
		}
	}

	/**
	 * 重命名文件
	 */
	async renameFile(image: ImageItem, newName: string): Promise<void> {
		const oldPath = image.originalFile.path;
		let newPath = "";
		let sourceMoved = false;
		try {
			newPath = oldPath.replace(/[^/]+$/, newName);
			this.ensureDestinationAvailable(newPath, oldPath);
			const coverMove = this.getCoverMove(image, newPath);
			if (coverMove) this.ensureDestinationAvailable(coverMove.newPath, coverMove.file.path);
			await this.app.fileManager.renameFile(
				image.originalFile,
				newPath
			);
			sourceMoved = true;

			if (coverMove) await this.app.fileManager.renameFile(coverMove.file, coverMove.newPath);

			new Notice("文件重命名成功");
		} catch (error) {
			if (sourceMoved) await this.rollbackRename(image.originalFile, oldPath);
			new Notice(`重命名失败: ${this.getErrorMessage(error)}`);
			throw error;
		}
	}

	/**
	 * 删除文件 (不再使用 confirm, 由调用方处理确认逻辑)
	 * @param image 要删除的图片项
	 * @param silent 静默模式, 不显示成功通知 (用于批量删除)
	 */
	async deleteFile(image: ImageItem, silent: boolean = false): Promise<void> {
		try {
			let coverFile: TFile | null = null;
			if (image.isCustomType && image.customTypeConfig) {
				coverFile = this.app.vault.getFileByPath(getCoverPath(image.path, image.customTypeConfig));
			}
			// 先处理附属封面, 避免源文件已删除后才发现封面操作失败.
			if (coverFile) await this.app.fileManager.trashFile(coverFile);
			await this.app.fileManager.trashFile(image.originalFile);

			if (!silent) {
				new Notice("文件删除成功");
			}
		} catch (error) {
			if (!silent) {
				new Notice(`删除失败: ${this.getErrorMessage(error)}`);
			}
			throw error;
		}
	}

	/**
	 * 获取删除确认的额外提示信息
	 */
	getDeleteExtraMessage(image: ImageItem): string {
		if (image.isCustomType && image.customTypeConfig) {
			return `同时会删除对应的 ${image.customTypeConfig.coverExtension.toUpperCase()} 封面文件`;
		}
		return "";
	}

	/**
	 * 移动文件到目标文件夹
	 * @returns 移动后的新路径; 若文件已在目标文件夹中则返回 null
	 */
	async moveFile(image: ImageItem, targetFolder: string, silent: boolean = false): Promise<string | null> {
		const oldPath = image.originalFile.path;
		let sourceMoved = false;
		try {
			const normalizedFolder = normalizeVaultFolder(targetFolder);
			const newPath = joinVaultPath(normalizedFolder, image.originalFile.name);
			if (newPath === image.originalFile.path) {
				if (!silent) new Notice("文件已在该文件夹中");
				return null;
			}
			this.ensureDestinationAvailable(newPath, oldPath);
			const coverMove = this.getCoverMove(image, newPath);
			if (coverMove) this.ensureDestinationAvailable(coverMove.newPath, coverMove.file.path);
			await this.app.fileManager.renameFile(image.originalFile, newPath);
			sourceMoved = true;

			if (coverMove) await this.app.fileManager.renameFile(coverMove.file, coverMove.newPath);

			if (!silent) new Notice("文件移动成功");
			return newPath;
		} catch (error) {
			if (sourceMoved) await this.rollbackRename(image.originalFile, oldPath);
			if (!silent) new Notice(`移动失败: ${this.getErrorMessage(error)}`);
			throw error;
		}
	}

	/**
	 * 打开引用文件
	 */
	async openReferenceFile(filePath: string, position?: { start: { line: number; col: number; }; }): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
			if (position) {
				const line = position.start.line;
				// setEphemeralState 在阅读模式和编辑模式下都能定位到指定行
				leaf.setEphemeralState({ line });
				// 编辑模式下额外设置光标
				const view = leaf.view;
				if (view instanceof MarkdownView && view.getMode() === "source") {
					const editor = view.editor;
					editor.setCursor(line, position.start.col);
				}
			}
		}
	}

	private getCoverMove(image: ImageItem, newSourcePath: string): { file: TFile; newPath: string; } | null {
		if (!image.isCustomType || !image.customTypeConfig) return null;
		const coverFile = this.app.vault.getFileByPath(getCoverPath(image.path, image.customTypeConfig));
		if (!coverFile) return null;
		return { file: coverFile, newPath: getCoverPath(newSourcePath, image.customTypeConfig) };
	}

	private ensureDestinationAvailable(destination: string, currentPath: string): void {
		const existing = this.app.vault.getAbstractFileByPath(destination);
		if (existing && destination !== currentPath) {
			throw new Error(`目标路径已存在: ${destination}`);
		}
		const parentPath = destination.includes("/") ? destination.slice(0, destination.lastIndexOf("/")) : "";
		if (parentPath && !this.app.vault.getFolderByPath(parentPath)) {
			throw new Error(`目标文件夹不存在: ${parentPath}`);
		}
	}

	private async rollbackRename(file: TFile, oldPath: string): Promise<void> {
		try {
			await this.app.fileManager.renameFile(file, oldPath);
		} catch (rollbackError) {
			console.error("文件操作回滚失败:", rollbackError);
		}
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}
