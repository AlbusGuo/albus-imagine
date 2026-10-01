import { App, TFile } from "obsidian";
import { ImageItem, ReferenceInfo } from "../types/image-manager.types";

type ReferencesBySource = Map<string, ReferenceInfo[]>;

/**
 * Incremental reverse-link index backed by Obsidian's resolved link graph.
 * Bases reads `resolvedLinks` lazily for every entry. An attachment manager
 * displays reference state on every card, so reversing the graph once is both
 * faster and easier to invalidate precisely.
 */
export class ReferenceCheckService {
	private readonly referencesByTarget = new Map<string, ReferencesBySource>();
	private readonly targetsBySource = new Map<string, Set<string>>();
	private rebuildPromise: Promise<void> | null = null;
	private rebuildGeneration = 0;
	private ready = false;

	constructor(private readonly app: App) { }

	async checkReferences(
		images: ImageItem[],
		onProgress?: (current: number, total: number) => void,
		force = false,
	): Promise<ImageItem[]> {
		if (images.length === 0) return images;
		await this.ensureIndex(force);
		const updated: ImageItem[] = [];
		for (let index = 0; index < images.length; index += 1) {
			const image = images[index];
			const references = this.collectReferences([
				image.originalFile.path,
				image.displayFile.path,
			]);
			updated.push({ ...image, references, referenceCount: references.length });
			if (onProgress && ((index + 1) % 50 === 0 || index === images.length - 1)) {
				onProgress(index + 1, images.length);
			}
		}
		return updated;
	}

	async rebuild(): Promise<Set<string>> {
		const affected = new Set(this.referencesByTarget.keys());
		await this.ensureIndex(true);
		for (const target of this.referencesByTarget.keys()) affected.add(target);
		return affected;
	}

	/** Update only the outgoing edges of a source whose metadata was resolved. */
	refreshSource(file: TFile): Set<string> {
		if (!this.ready) return new Set();
		const affected = this.removeSource(file.path);
		const destinations = this.app.metadataCache.resolvedLinks[file.path];
		if (!destinations) return affected;
		const references = this.buildSourceReferences(file, destinations);
		const targets = new Set<string>();
		for (const [targetPath, targetReferences] of references) {
			let bySource = this.referencesByTarget.get(targetPath);
			if (!bySource) {
				bySource = new Map();
				this.referencesByTarget.set(targetPath, bySource);
			}
			bySource.set(file.path, targetReferences);
			targets.add(targetPath);
			affected.add(targetPath);
		}
		this.targetsBySource.set(file.path, targets);
		return affected;
	}

	removeSource(sourcePath: string): Set<string> {
		const targets = this.targetsBySource.get(sourcePath) ?? new Set<string>();
		const affected = new Set(targets);
		for (const targetPath of targets) {
			const bySource = this.referencesByTarget.get(targetPath);
			bySource?.delete(sourcePath);
			if (bySource?.size === 0) this.referencesByTarget.delete(targetPath);
		}
		this.targetsBySource.delete(sourcePath);
		return affected;
	}

	renamePath(oldPath: string, newPath: string): Set<string> {
		const affected = this.removeSource(oldPath);
		const targetReferences = this.referencesByTarget.get(oldPath);
		if (targetReferences) {
			this.referencesByTarget.delete(oldPath);
			const existing = this.referencesByTarget.get(newPath);
			if (existing) {
				for (const [source, references] of targetReferences) existing.set(source, references);
			} else {
				this.referencesByTarget.set(newPath, targetReferences);
			}
			for (const targets of this.targetsBySource.values()) {
				if (targets.delete(oldPath)) targets.add(newPath);
			}
			affected.add(oldPath);
			affected.add(newPath);
		}
		return affected;
	}

	updateCacheKey(oldKey: string, newKey: string): void {
		this.renamePath(oldKey, newKey);
	}

	removeCacheKey(key: string): void {
		const sources = this.referencesByTarget.get(key);
		if (sources) {
			for (const sourcePath of sources.keys()) this.targetsBySource.get(sourcePath)?.delete(key);
		}
		this.referencesByTarget.delete(key);
	}

	private async ensureIndex(force: boolean): Promise<void> {
		if (!force && this.ready) return;
		if (!force && this.rebuildPromise) {
			await this.rebuildPromise;
			if (this.ready) return;
			return this.ensureIndex(false);
		}
		const generation = ++this.rebuildGeneration;
		const promise = this.buildIndex(generation);
		this.rebuildPromise = promise;
		try {
			await promise;
		} finally {
			if (this.rebuildPromise === promise) this.rebuildPromise = null;
		}
		if (!force && !this.ready) await this.ensureIndex(false);
	}

	private async buildIndex(generation: number): Promise<void> {
		const nextReferences = new Map<string, ReferencesBySource>();
		const nextTargets = new Map<string, Set<string>>();
		const sources = Object.entries(this.app.metadataCache.resolvedLinks);
		let sliceStarted = performance.now();
		for (let index = 0; index < sources.length; index += 1) {
			if (generation !== this.rebuildGeneration) return;
			const [sourcePath, destinations] = sources[index];
			const sourceFile = this.app.vault.getFileByPath(sourcePath);
			if (sourceFile) {
				const sourceReferences = this.buildSourceReferences(sourceFile, destinations);
				const targets = new Set<string>();
				for (const [targetPath, references] of sourceReferences) {
					let bySource = nextReferences.get(targetPath);
					if (!bySource) {
						bySource = new Map();
						nextReferences.set(targetPath, bySource);
					}
					bySource.set(sourcePath, references);
					targets.add(targetPath);
				}
				nextTargets.set(sourcePath, targets);
			}
			if ((index + 1) % 50 === 0 && performance.now() - sliceStarted > 8) {
				await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
				sliceStarted = performance.now();
			}
		}
		if (generation !== this.rebuildGeneration) return;
		this.referencesByTarget.clear();
		this.targetsBySource.clear();
		for (const [target, sourcesForTarget] of nextReferences) {
			this.referencesByTarget.set(target, sourcesForTarget);
		}
		for (const [source, targets] of nextTargets) this.targetsBySource.set(source, targets);
		this.ready = true;
	}

	private buildSourceReferences(
		sourceFile: TFile,
		destinations: Record<string, number>,
	): Map<string, ReferenceInfo[]> {
		const result = new Map<string, ReferenceInfo[]>();
		const occurrenceKeys = new Map<string, Set<string>>();
		const add = (targetPath: string | undefined, reference: ReferenceInfo, key: string): void => {
			if (!targetPath || !(destinations[targetPath] > 0)) return;
			let keys = occurrenceKeys.get(targetPath);
			if (!keys) {
				keys = new Set();
				occurrenceKeys.set(targetPath, keys);
			}
			if (keys.has(key)) return;
			keys.add(key);
			const references = result.get(targetPath);
			if (references) references.push(reference);
			else result.set(targetPath, [reference]);
		};
		const cache = this.app.metadataCache.getFileCache(sourceFile);
		for (const embed of cache?.embeds ?? []) {
			add(
				this.app.metadataCache.getFirstLinkpathDest(embed.link, sourceFile.path)?.path,
				{ file: sourceFile, type: "embed", position: embed.position },
				`embed:${embed.position.start.line}:${embed.position.start.col}`,
			);
		}
		for (const link of cache?.links ?? []) {
			add(
				this.app.metadataCache.getFirstLinkpathDest(link.link, sourceFile.path)?.path,
				{ file: sourceFile, type: "link", position: link.position },
				`link:${link.position.start.line}:${link.position.start.col}`,
			);
		}
		for (const link of cache?.referenceLinks ?? []) {
			add(
				this.app.metadataCache.getFirstLinkpathDest(link.link, sourceFile.path)?.path,
				{ file: sourceFile, type: "link", position: link.position },
				`reference:${link.position.start.line}:${link.position.start.col}`,
			);
		}
		for (const link of cache?.frontmatterLinks ?? []) {
			add(
				this.app.metadataCache.getFirstLinkpathDest(link.link, sourceFile.path)?.path,
				{ file: sourceFile, type: "link" },
				`frontmatter:${link.key}:${link.link}`,
			);
		}
		for (const [targetPath, count] of Object.entries(destinations)) {
			if (count <= 0) continue;
			const references = result.get(targetPath) ?? [];
			while (references.length < count) references.push({ file: sourceFile, type: "link" });
			if (references.length > count) references.length = count;
			result.set(targetPath, references);
		}
		return result;
	}

	private collectReferences(paths: string[]): ReferenceInfo[] {
		const references: ReferenceInfo[] = [];
		const seen = new Set<string>();
		for (const path of new Set(paths)) {
			const bySource = this.referencesByTarget.get(path);
			if (!bySource) continue;
			for (const [sourcePath, sourceReferences] of bySource) {
				for (let index = 0; index < sourceReferences.length; index += 1) {
					const reference = sourceReferences[index];
					const position = reference.position?.start;
					const key = position
						? `${sourcePath}:${reference.type}:${position.line}:${position.col}`
						: `${path}:${sourcePath}:${reference.type}:unknown:${index}`;
					if (seen.has(key)) continue;
					seen.add(key);
					references.push(reference);
				}
			}
		}
		return references;
	}
}
