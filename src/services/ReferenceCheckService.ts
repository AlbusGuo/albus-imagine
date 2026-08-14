/**
 * 引用检查服务
 */

import { App } from "obsidian";
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
		onProgress?: (current: number, total: number) => void,
		force = false
	): Promise<ImageItem[]> {
		if (images.length === 0) return images;

		try {
			const updatedImages = [...images];
			const uncachedImages = images.filter(
				(image) => force || !this.referenceCache.has(image.path),
			);
			const scannedReferences = this.findReferences(uncachedImages);
			let processedCount = 0;

			// 同步处理所有图片 (引用检查本身很快, 不需要分批)
			for (let i = 0; i < updatedImages.length; i++) {
				const imageItem = updatedImages[i];
				const cacheKey = imageItem.path;

				// 检查缓存
				if (!force && this.referenceCache.has(cacheKey)) {
					const cachedResult = this.referenceCache.get(cacheKey)!;
					updatedImages[i] = {
						...imageItem,
						references: cachedResult.references,
						referenceCount: cachedResult.referenceCount,
					};
				} else {
					const references = scannedReferences.get(cacheKey) ?? [];

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

				// 调用进度回调 (每 10 张更新一次)
				if (onProgress && processedCount % 10 === 0) {
					onProgress(processedCount, updatedImages.length);
					// 每处理 10 张图片, 给 UI 线程一些时间
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
	 * 使用公开 MetadataCache API 查找引用及其精确位置
	 */
	private findReferences(images: ImageItem[]): Map<string, ReferenceInfo[]> {
		const referencesByCacheKey = new Map<string, ReferenceInfo[]>();
		const cacheKeysByTargetPath = new Map<string, string[]>();
		for (const image of images) {
			referencesByCacheKey.set(image.path, []);
			const targetPaths = new Set([image.originalFile.path, image.displayFile.path]);
			for (const targetPath of targetPaths) {
				const cacheKeys = cacheKeysByTargetPath.get(targetPath);
				if (cacheKeys) cacheKeys.push(image.path);
				else cacheKeysByTargetPath.set(targetPath, [image.path]);
			}
		}
		if (cacheKeysByTargetPath.size === 0) return referencesByCacheKey;

		for (const [sourcePath, destinations] of Object.entries(this.app.metadataCache.resolvedLinks)) {
			const requestedTargets = Object.entries(destinations).filter(
				([targetPath, count]) => count > 0 && cacheKeysByTargetPath.has(targetPath),
			);
			if (requestedTargets.length === 0) continue;
			const sourceFile = this.app.vault.getFileByPath(sourcePath);
			if (!sourceFile) continue;
			const cache = this.app.metadataCache.getFileCache(sourceFile);
			const sourceReferencesByTarget = new Map<string, ReferenceInfo[]>();
			const occurrenceKeysByTarget = new Map<string, Set<string>>();
			const addReference = (targetPath: string, reference: ReferenceInfo, key: string): void => {
				if (!cacheKeysByTargetPath.has(targetPath)) return;
				let occurrenceKeys = occurrenceKeysByTarget.get(targetPath);
				if (!occurrenceKeys) {
					occurrenceKeys = new Set<string>();
					occurrenceKeysByTarget.set(targetPath, occurrenceKeys);
				}
				if (occurrenceKeys.has(key)) return;
				occurrenceKeys.add(key);
				const sourceReferences = sourceReferencesByTarget.get(targetPath);
				if (sourceReferences) sourceReferences.push(reference);
				else sourceReferencesByTarget.set(targetPath, [reference]);
			};
			for (const embed of cache?.embeds ?? []) {
				const targetPath = this.app.metadataCache.getFirstLinkpathDest(embed.link, sourcePath)?.path;
				if (targetPath) {
					addReference(
						targetPath,
						{ file: sourceFile, type: "embed", position: embed.position },
						`embed:${embed.position.start.line}:${embed.position.start.col}`,
					);
				}
			}
			for (const link of cache?.links ?? []) {
				const targetPath = this.app.metadataCache.getFirstLinkpathDest(link.link, sourcePath)?.path;
				if (targetPath) {
					addReference(
						targetPath,
						{ file: sourceFile, type: "link", position: link.position },
						`link:${link.position.start.line}:${link.position.start.col}`,
					);
				}
			}
			for (const referenceLink of cache?.referenceLinks ?? []) {
				const targetPath = this.app.metadataCache.getFirstLinkpathDest(referenceLink.link, sourcePath)?.path;
				if (targetPath) {
					addReference(
						targetPath,
						{ file: sourceFile, type: "link", position: referenceLink.position },
						`link:${referenceLink.position.start.line}:${referenceLink.position.start.col}`,
					);
				}
			}
			for (const frontmatterLink of cache?.frontmatterLinks ?? []) {
				const targetPath = this.app.metadataCache.getFirstLinkpathDest(frontmatterLink.link, sourcePath)?.path;
				if (targetPath) {
					addReference(
						targetPath,
						{ file: sourceFile, type: "link" },
						`frontmatter:${frontmatterLink.key}:${frontmatterLink.link}`,
					);
				}
			}

			for (const [targetPath] of requestedTargets) {
				const resolvedCount = destinations[targetPath] ?? 0;
				// resolvedLinks 是 Obsidian 对所有已解析链接的官方计数. Canvas 或未来新增的
				// 缓存形态可能没有可用位置, 此时仍按官方计数补齐, 避免把已引用图片误判为未引用.
				const detailed = sourceReferencesByTarget.get(targetPath) ?? [];
				const exactReferences = detailed.slice(0, resolvedCount);
				while (exactReferences.length < resolvedCount) {
					exactReferences.push({ file: sourceFile, type: "link" });
				}
				for (const cacheKey of cacheKeysByTargetPath.get(targetPath) ?? []) {
					referencesByCacheKey.get(cacheKey)?.push(...exactReferences);
				}
			}
		}

		return referencesByCacheKey;
	}

	/**
	 * 清除缓存
	 */
	clearCache(): void {
		this.referenceCache.clear();
	}

	updateCacheKey(oldKey: string, newKey: string): void {
		this.referenceCache.updateKey(oldKey, newKey);
	}

	removeCacheKey(key: string): void {
		this.referenceCache.delete(key);
	}

}
