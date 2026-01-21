/**
 * 文件操作服务
 */

import { App, Notice, TFile } from "obsidian";
import { ImageItem, CustomFileTypeConfig } from "../types/image-manager.types";

export class FileOperationService {
	constructor(private app: App) {}

	/**
	 * 打开文件
	 */
	async openFile(image: ImageItem): Promise<void> {
		// 使用 Obsidian 默认方式打开文件
		await this.app.workspace.openLinkText(
			image.originalFile.path,
			'',
			true
		);
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
			await this.app.vault.trash(image.originalFile, false);

			// 如果是自定义文件类型，同时删除封面文件
			if (image.isCustomType && image.customTypeConfig) {
				const coverPath = this.getCoverPath(image.path, image.customTypeConfig);
				const coverFile = this.app.vault.getAbstractFileByPath(coverPath);
				if (coverFile instanceof TFile) {
					await this.app.vault.trash(coverFile, false);
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
	 * 打开引用文件
	 */
	async openReferenceFile(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			await this.app.workspace.openLinkText(filePath, "");
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
