/**
 * 文件操作服务
 */

import { App, Notice, TFile, FileSystemAdapter } from "obsidian";
import { ImageItem, CustomFileTypeConfig, FileOpenMode } from "../types/image-manager.types";

export class FileOperationService {
	private fileOpenModes: Record<string, FileOpenMode> = {};

	constructor(private app: App) {}

	/**
	 * 设置文件打开方式配置
	 */
	setFileOpenModes(modes: Record<string, FileOpenMode>): void {
		this.fileOpenModes = modes || {};
	}

	/**
	 * 打开文件
	 */
	async openFile(image: ImageItem): Promise<void> {
		const targetFile = (image.isAgx || image.isCustomType)
			? image.originalFile
			: image.displayFile;
		
		if (!targetFile) return;

		// 获取文件扩展名
		const extension = targetFile.extension.toLowerCase();
		
		// 检查是否配置为外部打开
		const openMode = this.fileOpenModes[extension] || "internal";
		
		if (openMode === "external") {
			// 使用系统默认应用打开
			try {
				const adapter = this.app.vault.adapter;
				if (adapter instanceof FileSystemAdapter) {
					// @ts-ignore - 使用 Electron shell API
					const { shell } = require('electron');
					const basePath = adapter.getBasePath();
					const fullPath = `${basePath}/${targetFile.path}`;
					const result = await shell.openPath(fullPath);
					if (result) {
						new Notice(`无法打开文件: ${result}`);
					}
				} else {
					new Notice("当前环境不支持外部打开文件（仅桌面版支持）");
				}
			} catch (error) {
				new Notice(`无法使用外部应用打开文件: ${error.message}`);
			}
		} else {
			// 在 Obsidian 内部打开
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.openFile(targetFile);
		}
	}

	/**
	 * 重命名文件
	 */
	async renameFile(image: ImageItem, newName: string): Promise<void> {
		try {
			const newPath = image.path.replace(/[^\/]+$/, newName);
			await this.app.fileManager.renameFile(
				image.originalFile,
				newPath
			);

			// 如果是AGX文件，同时重命名对应的SVG文件
			if (image.isAgx) {
				const svgPath = image.path.replace(/\.agx$/i, ".svg");
				const svgFile =
					this.app.vault.getAbstractFileByPath(svgPath);
				if (svgFile instanceof TFile) {
					const newSvgPath = newPath.replace(/\.agx$/i, ".svg");
					await this.app.fileManager.renameFile(svgFile, newSvgPath);
				}
			}

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
	 * 删除文件
	 */
	async deleteFile(image: ImageItem, confirmDelete = true): Promise<void> {
		// 确认删除
		if (confirmDelete) {
			let extraMessage = "";
			if (image.isAgx) {
				extraMessage = "（同时会删除对应的SVG文件）";
			} else if (image.isCustomType && image.customTypeConfig) {
				extraMessage = `（同时会删除对应的${image.customTypeConfig.coverExtension.toUpperCase()}封面文件）`;
			}
			const message = `确定要删除文件 "${image.name}" 吗？${extraMessage}`;
			const confirmed = confirm(message);
			if (!confirmed) return;
		}

		try {
			await this.app.vault.trash(image.originalFile, false);

			// 如果是AGX文件，同时删除对应的SVG文件
			if (image.isAgx) {
				const svgPath = image.path.replace(/\.agx$/i, ".svg");
				const svgFile =
					this.app.vault.getAbstractFileByPath(svgPath);
				if (svgFile instanceof TFile) {
					await this.app.vault.trash(svgFile, false);
				}
			}

			// 如果是自定义文件类型，同时删除封面文件
			if (image.isCustomType && image.customTypeConfig) {
				const coverPath = this.getCoverPath(image.path, image.customTypeConfig);
				const coverFile = this.app.vault.getAbstractFileByPath(coverPath);
				if (coverFile instanceof TFile) {
					await this.app.vault.trash(coverFile, false);
				}
			}

			new Notice("文件删除成功");
		} catch (error) {
			new Notice(`删除失败: ${error.message}`);
			throw error;
		}
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
