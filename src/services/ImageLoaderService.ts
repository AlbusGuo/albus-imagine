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
	private excludedFolders: string[] = [];

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
	}

	/**
	 * 设置排除的文件夹列表
	 */
	setExcludedFolders(folders: string[]): void {
		this.excludedFolders = Array.from(new Set(folders.map(normalizeVaultFolder).filter(Boolean)));
	}

	/**
	 * 加载指定文件夹下的图片
	 */
	loadImages(
		folderPath: string
	): ImageItem[] {
		const normalizedFolderPath = normalizeVaultFolder(folderPath);
		const customTypeByExtension = new Map(this.customFileTypes.map((config) => [config.fileExtension, config]));
		const candidateExtensions = new Set<string>(SUPPORTED_IMAGE_EXTENSIONS);
		for (const config of this.customFileTypes) {
			candidateExtensions.add(config.fileExtension);
			candidateExtensions.add(config.coverExtension);
		}
		const allFiles = this.catalog.getFilesByExtensions(candidateExtensions);

		// 找出所有自定义文件类型及其对应的封面文件
		const usedCoverPaths = new Set<string>();
		for (const file of allFiles) {
			const config = customTypeByExtension.get(file.extension.toLowerCase());
			if (config) usedCoverPaths.add(getCoverPath(file.path, config));
		}

		// 筛选图片文件
		const imageFiles = allFiles.filter((file) => {
			// 排除文件夹逻辑
			for (const excludedFolder of this.excludedFolders) {
				if (file.path.startsWith(excludedFolder + "/") || file.path === excludedFolder) {
					return false;
				}
			}

			// 文件夹筛选逻辑
			let inFolder = true;
			if (normalizedFolderPath) {
				inFolder =
					file.path.startsWith(normalizedFolderPath + "/") ||
					file.path === normalizedFolderPath;
			}

			// 文件类型筛选
			const extension = file.extension.toLowerCase();
			const isImage = SUPPORTED_IMAGE_EXTENSIONS.includes(
				extension as ImageExtension
			);

			// 检查是否为自定义文件类型
			const isCustomType = customTypeByExtension.has(extension);

			// 如果是封面文件且已被自定义类型使用, 则跳过
			if (usedCoverPaths.has(file.path)) {
				return false;
			}

			return inFolder && (isImage || isCustomType);
		});

		// 处理 AGX 文件和自定义文件类型的封面
		return Array.from(
			new Map(imageFiles.map((file) => [file.path, this.processImageFile(file)])).values()
		);
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
		const matchedConfig = this.customFileTypes.find(
			(config) => config.fileExtension.toLowerCase() === extension
		);
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
