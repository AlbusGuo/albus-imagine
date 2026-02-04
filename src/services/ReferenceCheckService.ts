/**
 * 引用检查服务
 */

import { App, TFile } from "obsidian";
import { ImageItem, ReferenceInfo } from "../types/image-manager.types";
import { ReferenceCache } from "../models/ReferenceCache";

export class ReferenceCheckService {
	private referenceCache: ReferenceCache;

	constructor(private app: App) {
		this.referenceCache = new ReferenceCache();
	}

	/**
	 * 检查图片引用
	 * @param images 要检查的图片列表
	 * @param onProgress 进度回调 (current, total)
	 */
	async checkReferences(
		images: ImageItem[],
		onProgress?: (current: number, total: number) => void
	): Promise<ImageItem[]> {
		if (images.length === 0) return images;

		try {
			const updatedImages = [...images];
			let processedCount = 0;

			// 同步处理所有图片（引用检查本身很快，不需要分批）
			for (let i = 0; i < updatedImages.length; i++) {
				const imageItem = updatedImages[i];
				const cacheKey = imageItem.path;

				// 检查缓存
				if (this.referenceCache.has(cacheKey)) {
					const cachedResult = this.referenceCache.get(cacheKey)!;
					updatedImages[i] = {
						...imageItem,
						references: cachedResult.references,
						referenceCount: cachedResult.referenceCount,
					};
				} else {
					// 使用新的反向链接API查找引用
					const references = this.findReferencesUsingBacklinks(imageItem);

					const result = {
						references: references,
						referenceCount: references.length,
					};

					// 缓存结果
					this.referenceCache.set(cacheKey, result);

					updatedImages[i] = {
						...imageItem,
						...result,
					};
				}
				
				processedCount++;
				
				// 调用进度回调（每10张更新一次）
				if (onProgress && processedCount % 10 === 0) {
					onProgress(processedCount, updatedImages.length);
					// 每处理10张图片，给UI线程一些时间
					await new Promise(resolve => setTimeout(resolve, 0));
				}
			}
			
			// 最后更新一次进度
			if (onProgress && processedCount > 0) {
				onProgress(processedCount, updatedImages.length);
			}

			return updatedImages;
		} catch (error) {
			console.error("检查引用时出错:", error);
			throw error;
		}
	}

	/**
	 * 使用 Obsidian 反向链接 API 查找引用
	 */
	private findReferencesUsingBacklinks(
		imageItem: ImageItem
	): ReferenceInfo[] {
		const references: ReferenceInfo[] = [];

		// 对于自定义文件类型，使用对应的封面文件来检查引用
		let targetFile = imageItem.originalFile;
		if (imageItem.isCustomType && imageItem.displayFile !== imageItem.originalFile) {
			// 对于自定义文件类型，使用displayFile（封面文件）来检查引用
			targetFile = imageItem.displayFile;
		}

		// 使用 Obsidian 的反向链接 API
		const metadataCache = this.app.metadataCache as {
			getBacklinksForFile?: (file: TFile) => { data?: Map<string, unknown> } | undefined;
		};
		const backlinks = metadataCache.getBacklinksForFile?.(targetFile);
		
		if (!backlinks || !backlinks.data) {
			return references;
		}

		// 遍历所有反向链接
		for (const [sourcePath, linkOccurrences] of backlinks.data) {
			const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
			
			if (!(sourceFile instanceof TFile)) {
				continue;
			}

			// 检查每个引用位置
			if (Array.isArray(linkOccurrences)) {
				for (const occurrence of linkOccurrences) {
					// 判断是嵌入还是链接
					const isEmbed = occurrence.link?.startsWith("!");
					
					references.push({
						file: sourceFile,
						type: isEmbed ? "embed" : "link",
						position: occurrence.position,
					});
				}
			}
		}

		return references;
	}

	/**
	 * 清除缓存
	 */
	clearCache(): void {
		this.referenceCache.clear();
	}

	/**
	 * 获取缓存
	 */
	getCache(): ReferenceCache {
		return this.referenceCache;
	}
}
