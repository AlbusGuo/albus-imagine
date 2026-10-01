/**
 * 图片加载服务
 */

import { App, TFile } from "obsidian";
import {
	CustomFileTypeConfig,
	ImageExtension,
	ImageItem,
	SUPPORTED_IMAGE_EXTENSIONS,
} from "../types/image-manager.types";
import { getCoverPath, normalizeExtension, normalizeVaultFolder } from "../utils/vaultPaths";
import { ImageCatalogService } from "./ImageCatalogService";

export class ImageLoaderService {
	private customFileTypes: CustomFileTypeConfig[] = [];
	private customFileTypeByExtension = new Map<string, CustomFileTypeConfig>();
	private coverOwnerByPath = new Map<string, string>();

	constructor(
		private app: App,
		private readonly catalog = new ImageCatalogService(app),
	) { }

	/**
	 * 设置自定义文件类型配置
	 */
	setCustomFileTypes(types: CustomFileTypeConfig[]): void {
		const seenExtensions = new Set<string>();
		this.customFileTypes = types.flatMap((type) => {
			const fileExtension = normalizeExtension(type.fileExtension);
			const coverExtension = normalizeExtension(type.coverExtension);
			if (!fileExtension || !coverExtension || seenExtensions.has(fileExtension)) return [];
			seenExtensions.add(fileExtension);
			return [{ ...type, fileExtension, coverExtension }];
		});
		this.customFileTypeByExtension = new Map(
			this.customFileTypes.map((config) => [config.fileExtension, config]),
		);
	}

	/**
	 * 加载指定文件夹下的图片
	 */
	loadImages(
		folderPath: string
	): ImageItem[] {
		const normalizedFolderPath = normalizeVaultFolder(folderPath);
		const allFiles = this.getCandidateFiles();
		this.rebuildCoverOwners(allFiles);
		const imageFiles = allFiles.filter((file) => this.shouldIncludeInFolder(file, normalizedFolderPath));
		return Array.from(
			new Map(imageFiles.map((file) => [file.path, this.processImageFile(file)])).values()
		);
	}

	async loadImagesTimeSliced(folderPath: string): Promise<ImageItem[]> {
		const normalizedFolderPath = normalizeVaultFolder(folderPath);
		const allFiles = this.getCandidateFiles();
		const coverOwners = new Map<string, string>();
		let sliceStarted = performance.now();
		for (let index = 0; index < allFiles.length; index += 1) {
			const file = allFiles[index];
			const config = this.customFileTypeByExtension.get(file.extension.toLowerCase());
			if (config) coverOwners.set(getCoverPath(file.path, config), file.path);
			if ((index + 1) % 100 === 0 && performance.now() - sliceStarted > 8) {
				await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
				sliceStarted = performance.now();
			}
		}
		this.coverOwnerByPath = coverOwners;
		const result = new Map<string, ImageItem>();
		for (let index = 0; index < allFiles.length; index += 1) {
			const file = allFiles[index];
			if (this.shouldIncludeInFolder(file, normalizedFolderPath)) {
				result.set(file.path, this.processImageFile(file));
			}
			if ((index + 1) % 100 === 0 && performance.now() - sliceStarted > 8) {
				await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
				sliceStarted = performance.now();
			}
		}
		return Array.from(result.values());
	}

	isCustomSource(file: TFile): boolean {
		return this.customFileTypeByExtension.has(file.extension.toLowerCase());
	}

	isKnownCover(path: string): boolean {
		return this.coverOwnerByPath.has(path);
	}

	shouldInclude(file: TFile): boolean {
		if (this.isKnownCover(file.path)) return false;
		const extension = file.extension.toLowerCase();
		return SUPPORTED_IMAGE_EXTENSIONS.includes(extension as ImageExtension) ||
			this.customFileTypeByExtension.has(extension);
	}

	createImageItem(file: TFile): ImageItem {
		return this.processImageFile(file);
	}

	private getCandidateFiles(): TFile[] {
		const extensions = new Set<string>(SUPPORTED_IMAGE_EXTENSIONS);
		for (const config of this.customFileTypes) {
			extensions.add(config.fileExtension);
			extensions.add(config.coverExtension);
		}
		return this.catalog.getFilesByExtensions(extensions);
	}

	private rebuildCoverOwners(files: readonly TFile[]): void {
		const coverOwners = new Map<string, string>();
		for (const file of files) {
			const config = this.customFileTypeByExtension.get(file.extension.toLowerCase());
			if (config) coverOwners.set(getCoverPath(file.path, config), file.path);
		}
		this.coverOwnerByPath = coverOwners;
	}

	private shouldIncludeInFolder(file: TFile, folderPath: string): boolean {
		if (!this.shouldInclude(file)) return false;
		return !folderPath || file.path === folderPath || file.path.startsWith(`${folderPath}/`);
	}

	/**
	 * 处理单个图片文件
	 */
	private processImageFile(file: TFile): ImageItem {
		const extension = file.extension.toLowerCase();
		let displayFile = file;
		let isCustomType = false;
		let customTypeConfig: CustomFileTypeConfig | undefined = undefined;
		let coverMissing = false;

		// 检查是否为自定义文件类型
		const matchedConfig = this.customFileTypeByExtension.get(extension);
		if (matchedConfig) {
			isCustomType = true;
			customTypeConfig = matchedConfig;
			const coverPath = getCoverPath(file.path, matchedConfig);
			const coverFile = this.app.vault.getAbstractFileByPath(coverPath);
			if (coverFile instanceof TFile) {
				displayFile = coverFile;
			} else {
				coverMissing = true;
			}
		}

		return {
			name: file.name,
			path: file.path,
			originalFile: file,
			displayFile: displayFile,
			isCustomType: isCustomType,
			customTypeConfig: customTypeConfig,
			coverMissing: coverMissing,
			stat: {
				ctime: file.stat.ctime,
				mtime: file.stat.mtime,
				size: file.stat.size,
			},
		};
	}

}
