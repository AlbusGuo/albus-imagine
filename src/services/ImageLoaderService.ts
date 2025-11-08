/**
 * 图片加载服务
 */

import { App, TFile } from "obsidian";
import {
	ImageItem,
	SUPPORTED_IMAGE_EXTENSIONS,
	SortOrder,
	CustomFileTypeConfig,
} from "../types/image-manager.types";

export class ImageLoaderService {
	private customFileTypes: CustomFileTypeConfig[] = [];

	constructor(private app: App) {}

	/**
	 * 设置自定义文件类型配置
	 */
	setCustomFileTypes(types: CustomFileTypeConfig[]): void {
		this.customFileTypes = types.filter(t => t.enabled && t.fileExtension && t.coverExtension);
	}

	/**
	 * 加载指定文件夹下的图片
	 */
	async loadImages(
		folderPath: string,
		sortOrder: SortOrder = "desc"
	): Promise<ImageItem[]> {
		const allFiles = this.app.vault.getFiles();

		// 找出所有AGX文件及其对应的SVG文件
		const agxFiles = allFiles.filter(
			(file) => file.extension.toLowerCase() === "agx"
		);

		const usedSvgPaths = new Set<string>();
		agxFiles.forEach((agxFile) => {
			const svgPath = agxFile.path.replace(/\.agx$/i, ".svg");
			usedSvgPaths.add(svgPath);
		});

		// 找出所有自定义文件类型及其对应的封面文件
		const usedCoverPaths = new Set<string>();
		this.customFileTypes.forEach((config) => {
			const customFiles = allFiles.filter(
				(file) => file.extension.toLowerCase() === config.fileExtension.toLowerCase()
			);
			customFiles.forEach((customFile) => {
				const coverPath = this.getCoverPath(customFile.path, config);
				usedCoverPaths.add(coverPath);
			});
		});

		// 筛选图片文件
		const imageFiles = allFiles.filter((file) => {
			// 文件夹筛选逻辑
			let inFolder = true;
			if (folderPath && folderPath.trim() !== "") {
				inFolder =
					file.path.startsWith(folderPath + "/") ||
					file.path === folderPath;
			}

			// 文件类型筛选
			const extension = file.extension.toLowerCase();
			const isImage = SUPPORTED_IMAGE_EXTENSIONS.includes(
				extension as any
			);

			// 检查是否为自定义文件类型
			const isCustomType = this.customFileTypes.some(
				(config) => config.fileExtension.toLowerCase() === extension
			);

			// 如果是SVG文件且已被AGX使用，则跳过
			if (extension === "svg" && usedSvgPaths.has(file.path)) {
				return false;
			}

			// 如果是封面文件且已被自定义类型使用，则跳过
			if (usedCoverPaths.has(file.path)) {
				return false;
			}

			return inFolder && (isImage || isCustomType);
		});

		// 处理AGX文件和自定义文件类型的封面
		const processedImages = await Promise.all(
			imageFiles.map((file) => this.processImageFile(file))
		);

		// 按创建时间排序
		const sortedImages = processedImages.sort((a, b) => {
			const timeA = a.stat.ctime;
			const timeB = b.stat.ctime;
			return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
		});

		return sortedImages;
	}

	/**
	 * 处理单个图片文件
	 */
	private async processImageFile(file: TFile): Promise<ImageItem> {
		const extension = file.extension.toLowerCase();
		const isAgx = extension === "agx";
		let displayFile = file;
		let isCustomType = false;
		let customTypeConfig: CustomFileTypeConfig | undefined = undefined;

		// 对于AGX文件，尝试找到对应的SVG文件
		if (isAgx) {
			const svgPath = file.path.replace(/\.agx$/i, ".svg");
			const svgFile = this.app.vault.getAbstractFileByPath(svgPath);
			if (svgFile instanceof TFile) {
				displayFile = svgFile;
			}
		} else {
			// 检查是否为自定义文件类型
			const matchedConfig = this.customFileTypes.find(
				(config) => config.fileExtension.toLowerCase() === extension
			);
			if (matchedConfig) {
				isCustomType = true;
				customTypeConfig = matchedConfig;
				const coverPath = this.getCoverPath(file.path, matchedConfig);
				const coverFile = this.app.vault.getAbstractFileByPath(coverPath);
				if (coverFile instanceof TFile) {
					displayFile = coverFile;
				}
			}
		}

		return {
			name: file.name,
			path: file.path,
			originalFile: file,
			displayFile: displayFile,
			isAgx: isAgx,
			isCustomType: isCustomType,
			customTypeConfig: customTypeConfig,
			stat: {
				ctime: file.stat.ctime,
				mtime: file.stat.mtime,
				size: file.stat.size,
			},
		};
	}

	/**
	 * 获取封面文件路径
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

	/**
	 * 获取图片的资源URL
	 */
	getImageResourcePath(file: TFile): string {
		return this.app.vault.getResourcePath(file);
	}
}
