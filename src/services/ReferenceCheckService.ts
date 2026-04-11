/**
 * 引用检查服务
 */

import { App, TFile, normalizePath } from "obsidian";
import { ImageItem, ReferenceInfo } from "../types/image-manager.types";
import { ReferenceCache } from "../models/ReferenceCache";

interface LinkOccurrence {
	linkPath: string;
	isEmbed: boolean;
	startIndex: number;
	endIndex: number;
}

interface IndexedReference {
	targetPath: string;
	reference: ReferenceInfo;
}

export class ReferenceCheckService {
	private referenceCache: ReferenceCache;
	private customSyntaxReferenceIndex: Map<string, ReferenceInfo[]> | null = null;
	private customSyntaxReferenceIndexPromise:
		| Promise<Map<string, ReferenceInfo[]>>
		| null = null;

	private readonly supportedImageExtensions = new Set([
		"png",
		"jpg",
		"jpeg",
		"gif",
		"bmp",
		"webp",
		"svg",
		"ico",
		"tif",
		"tiff",
		"avif",
		"heic",
		"heif",
	]);

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
			const customIndex = await this.ensureCustomSyntaxReferenceIndex();
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
					const references = this.findReferences(imageItem, customIndex);

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
		targetFile: TFile
	): ReferenceInfo[] {
		const references: ReferenceInfo[] = [];

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

	private findReferences(
		imageItem: ImageItem,
		customIndex: Map<string, ReferenceInfo[]>
	): ReferenceInfo[] {
		const targetFile =
			imageItem.isCustomType && imageItem.displayFile !== imageItem.originalFile
				? imageItem.displayFile
				: imageItem.originalFile;

		const backlinkReferences = this.findReferencesUsingBacklinks(targetFile);
		const customSyntaxReferences = customIndex.get(targetFile.path) ?? [];

		return this.mergeReferences(backlinkReferences, customSyntaxReferences);
	}

	private mergeReferences(
		backlinkReferences: ReferenceInfo[],
		customSyntaxReferences: ReferenceInfo[]
	): ReferenceInfo[] {
		if (customSyntaxReferences.length === 0) {
			return backlinkReferences;
		}

		const merged = [...backlinkReferences];
		const seen = new Set<string>();

		for (const ref of backlinkReferences) {
			seen.add(this.buildReferenceKey(ref));
		}

		for (const ref of customSyntaxReferences) {
			const key = this.buildReferenceKey(ref);
			if (!seen.has(key)) {
				seen.add(key);
				merged.push(ref);
			}
		}

		return merged;
	}

	private buildReferenceKey(ref: ReferenceInfo): string {
		if (ref.position) {
			return `${ref.file.path}:${ref.type}:${ref.position.start.line}:${ref.position.start.col}:${ref.position.end.line}:${ref.position.end.col}`;
		}

		return `${ref.file.path}:${ref.type}`;
	}

	private async ensureCustomSyntaxReferenceIndex(): Promise<Map<string, ReferenceInfo[]>> {
		if (this.customSyntaxReferenceIndex) {
			return this.customSyntaxReferenceIndex;
		}

		if (this.customSyntaxReferenceIndexPromise) {
			return this.customSyntaxReferenceIndexPromise;
		}

		this.customSyntaxReferenceIndexPromise = this.buildCustomSyntaxReferenceIndex();

		try {
			this.customSyntaxReferenceIndex = await this.customSyntaxReferenceIndexPromise;
			return this.customSyntaxReferenceIndex;
		} finally {
			this.customSyntaxReferenceIndexPromise = null;
		}
	}

	private async buildCustomSyntaxReferenceIndex(): Promise<Map<string, ReferenceInfo[]>> {
		const index = new Map<string, ReferenceInfo[]>();
		const markdownFiles = this.app.vault.getMarkdownFiles();

		for (let i = 0; i < markdownFiles.length; i++) {
			const sourceFile = markdownFiles[i];
			const refs = await this.extractCustomSyntaxReferencesFromFile(sourceFile);

			for (const ref of refs) {
				const current = index.get(ref.targetPath) ?? [];
				current.push(ref.reference);
				index.set(ref.targetPath, current);
			}

			if ((i + 1) % 20 === 0) {
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		}

		return index;
	}

	private async extractCustomSyntaxReferencesFromFile(
		sourceFile: TFile
	): Promise<IndexedReference[]> {
		let content = "";
		try {
			content = await this.app.vault.cachedRead(sourceFile);
		} catch {
			return [];
		}

		if (!content) {
			return [];
		}

		const lineStarts = this.getLineStartOffsets(content);
		const occurrences = this.extractPotentialImageLinks(content);
		const indexedReferences: IndexedReference[] = [];

		for (const occurrence of occurrences) {
			const targetFile = this.resolveImageTarget(occurrence.linkPath, sourceFile);
			if (!targetFile) {
				continue;
			}

			const start = this.indexToPosition(occurrence.startIndex, lineStarts);
			const end = this.indexToPosition(occurrence.endIndex, lineStarts);

			indexedReferences.push({
				targetPath: targetFile.path,
				reference: {
					file: sourceFile,
					type: occurrence.isEmbed ? "embed" : "link",
					position: {
						start,
						end,
					},
				},
			});
		}

		return indexedReferences;
	}

	private extractPotentialImageLinks(content: string): LinkOccurrence[] {
		const occurrences: LinkOccurrence[] = [];

		const wikiPattern = /(!)?\[\[([^\]\n]+)\]\]/g;
		let wikiMatch: RegExpExecArray | null;
		while ((wikiMatch = wikiPattern.exec(content)) !== null) {
			const rawTarget = wikiMatch[2] ?? "";
			const target = rawTarget.split("|")[0].split("#")[0].trim();
			if (!target) continue;

			occurrences.push({
				linkPath: target,
				isEmbed: Boolean(wikiMatch[1]),
				startIndex: wikiMatch.index,
				endIndex: wikiMatch.index + wikiMatch[0].length,
			});
		}

		const markdownPattern = /(!)?\[[^\]]*\]\(([^)\n]+)\)/g;
		let markdownMatch: RegExpExecArray | null;
		while ((markdownMatch = markdownPattern.exec(content)) !== null) {
			const destination = this.extractMarkdownDestination(markdownMatch[2] ?? "");
			if (!destination) continue;

			occurrences.push({
				linkPath: destination,
				isEmbed: Boolean(markdownMatch[1]),
				startIndex: markdownMatch.index,
				endIndex: markdownMatch.index + markdownMatch[0].length,
			});
		}

		const htmlImagePattern = /<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
		let htmlMatch: RegExpExecArray | null;
		while ((htmlMatch = htmlImagePattern.exec(content)) !== null) {
			if (!htmlMatch[1]) continue;
			occurrences.push({
				linkPath: htmlMatch[1],
				isEmbed: true,
				startIndex: htmlMatch.index,
				endIndex: htmlMatch.index + htmlMatch[0].length,
			});
		}

		const looseImagePathPattern =
			/(^|[\s"'`(=:\[])(!?[^\s"'`)\]]+\.(?:png|jpe?g|gif|bmp|webp|svg|ico|tiff?|avif|heic|heif)(?:\?[^\s"'`)\]]*)?)/gim;
		let looseMatch: RegExpExecArray | null;
		while ((looseMatch = looseImagePathPattern.exec(content)) !== null) {
			const raw = (looseMatch[2] ?? "").trim();
			if (!raw) continue;

			const isEmbed = raw.startsWith("!");
			const linkPath = isEmbed ? raw.slice(1) : raw;
			const start = looseMatch.index + looseMatch[1].length;

			occurrences.push({
				linkPath,
				isEmbed,
				startIndex: start,
				endIndex: start + raw.length,
			});
		}

		return occurrences;
	}

	private extractMarkdownDestination(rawDestination: string): string {
		const trimmed = rawDestination.trim();
		if (!trimmed) {
			return "";
		}

		if (trimmed.startsWith("<") && trimmed.includes(">")) {
			return trimmed.slice(1, trimmed.indexOf(">")).trim();
		}

		const firstSpaceIndex = trimmed.search(/\s/);
		if (firstSpaceIndex === -1) {
			return trimmed;
		}

		return trimmed.slice(0, firstSpaceIndex).trim();
	}

	private resolveImageTarget(linkPath: string, sourceFile: TFile): TFile | null {
		let normalizedLinkPath = linkPath.trim();
		if (!normalizedLinkPath) {
			return null;
		}

		if (
			normalizedLinkPath.startsWith("<") &&
			normalizedLinkPath.endsWith(">")
		) {
			normalizedLinkPath = normalizedLinkPath.slice(1, -1).trim();
		}

		normalizedLinkPath = normalizedLinkPath
			.replace(/^"|"$/g, "")
			.replace(/^'|'$/g, "");

		const withoutAnchor = normalizedLinkPath.split("#")[0];
		const withoutQuery = withoutAnchor.split("?")[0];
		if (!withoutQuery) {
			return null;
		}

		if (/^(https?:|data:|app:|obsidian:|file:)/i.test(withoutQuery)) {
			return null;
		}

		let decodedPath = withoutQuery;
		try {
			decodedPath = decodeURIComponent(withoutQuery);
		} catch {
			// 保持原始路径
		}

		const metadataResolved = this.app.metadataCache.getFirstLinkpathDest(
			decodedPath,
			sourceFile.path
		);

		if (metadataResolved instanceof TFile && this.isImageFile(metadataResolved)) {
			return metadataResolved;
		}

		const normalizedVaultPath = normalizePath(decodedPath.replace(/^\//, ""));
		const directFile = this.app.vault.getAbstractFileByPath(normalizedVaultPath);

		if (directFile instanceof TFile && this.isImageFile(directFile)) {
			return directFile;
		}

		return null;
	}

	private isImageFile(file: TFile): boolean {
		return this.supportedImageExtensions.has(file.extension.toLowerCase());
	}

	private getLineStartOffsets(content: string): number[] {
		const starts = [0];
		for (let i = 0; i < content.length; i++) {
			if (content.charCodeAt(i) === 10) {
				starts.push(i + 1);
			}
		}
		return starts;
	}

	private indexToPosition(index: number, lineStarts: number[]): { line: number; col: number } {
		let low = 0;
		let high = lineStarts.length - 1;

		while (low <= high) {
			const mid = (low + high) >> 1;
			if (lineStarts[mid] <= index) {
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}

		const line = Math.max(0, high);
		return {
			line,
			col: Math.max(0, index - lineStarts[line]),
		};
	}

	/**
	 * 清除缓存
	 */
	clearCache(): void {
		this.referenceCache.clear();
		this.customSyntaxReferenceIndex = null;
		this.customSyntaxReferenceIndexPromise = null;
	}

	/**
	 * 获取缓存
	 */
	getCache(): ReferenceCache {
		return this.referenceCache;
	}
}
