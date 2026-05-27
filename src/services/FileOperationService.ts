/**
 * 文件操作服务
 */

import { App, MarkdownView, Notice, TFile } from "obsidian";
import { CustomFileTypeConfig, ImageItem, SUPPORTED_IMAGE_EXTENSIONS } from "../types/image-manager.types";

export class FileOperationService {
	constructor(private app: App) {}

	/**
	 * 打开文件（图片用系统默认应用，其他用 Obsidian 内部打开）
	 */
	openFile(image: ImageItem): void {
		const ext = image.originalFile.extension.toLowerCase();
		if ((SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
			(this.app as any).openWithDefaultApp(image.originalFile.path);
		} else {
			const leaf = this.app.workspace.getLeaf(false);
			void leaf.openFile(image.originalFile);
		}
	}

	/**
	 * 重命名文件
	 */
	async renameFile(image: ImageItem, newName: string): Promise<void> {
		try {
			const newPath = image.path.replace(/[^/]+$/, newName);
			await this.app.fileManager.renameFile(
				image.originalFile,
				newPath
			);

			// 如果是自定义文件类型，同时重命名封面文件
			if (image.isCustomType && image.customTypeConfig) {
				const coverPath = this.getCoverPath(image.path, image.customTypeConfig);
				const coverFile = this.app.vault.getAbstractFileByPath(coverPath);
				if (coverFile instanceof TFile) {
					const newCoverPath = this.getCoverPath(newPath, image.customTypeConfig);
					await this.app.fileManager.renameFile(coverFile, newCoverPath);
				}
			}

			new Notice("文件重命名成功");
		} catch (error) {
			new Notice(`重命名失败: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 删除文件（不再使用 confirm，由调用方处理确认逻辑）
	 * @param image 要删除的图片项
	 * @param silent 静默模式，不显示成功通知（用于批量删除）
	 */
	async deleteFile(image: ImageItem, silent: boolean = false): Promise<void> {
		try {
			await this.app.fileManager.trashFile(image.originalFile);

			// 如果是自定义文件类型，同时删除封面文件
			if (image.isCustomType && image.customTypeConfig) {
				const coverPath = this.getCoverPath(image.path, image.customTypeConfig);
				const coverFile = this.app.vault.getAbstractFileByPath(coverPath);
				if (coverFile instanceof TFile) {
					await this.app.fileManager.trashFile(coverFile);
				}
			}

			if (!silent) {
				new Notice("文件删除成功");
			}
		} catch (error) {
			if (!silent) {
				new Notice(`删除失败: ${error.message}`);
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
	 * @returns 移动后的新路径；若文件已在目标文件夹中则返回 null
	 */
	async moveFile(image: ImageItem, targetFolder: string, silent: boolean = false): Promise<string | null> {
		try {
			const newPath = targetFolder ? `${targetFolder}/${image.originalFile.name}` : image.originalFile.name;
			if (newPath === image.originalFile.path) {
				if (!silent) new Notice("文件已在该文件夹中");
				return null;
			}
			await this.app.fileManager.renameFile(image.originalFile, newPath);

			// 如果是自定义文件类型，同时移动封面文件
			if (image.isCustomType && image.customTypeConfig) {
				const coverPath = this.getCoverPath(image.path, image.customTypeConfig);
				const coverFile = this.app.vault.getAbstractFileByPath(coverPath);
				if (coverFile instanceof TFile) {
					const newCoverPath = this.getCoverPath(newPath, image.customTypeConfig);
					await this.app.fileManager.renameFile(coverFile, newCoverPath);
				}
			}

			if (!silent) new Notice("文件移动成功");
			return newPath;
		} catch (error) {
			if (!silent) new Notice(`移动失败: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 打开引用文件
	 */
	async openReferenceFile(filePath: string, position?: { start: { line: number; col: number } }): Promise<void> {
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

	/**
	 * 获取封面文件路径（与 ImageLoaderService 中的方法一致）
	 */
	private getCoverPath(filePath: string, config: CustomFileTypeConfig): string {
		const directory = filePath.substring(0, filePath.lastIndexOf("/"));
		const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);
		const baseName = fileName.substring(0, fileName.lastIndexOf("."));
		
		let coverDir = directory;
		if (config.coverFolder && config.coverFolder.trim() !== "") {
			// 如果指定了封面文件夹，则使用该文件夹
			coverDir = config.coverFolder.startsWith("/")
				? config.coverFolder.substring(1)
				: directory + "/" + config.coverFolder;
		}
		
		return `${coverDir}/${baseName}.${config.coverExtension}`;
	}
}
