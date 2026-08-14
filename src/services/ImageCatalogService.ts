import { App, TFile } from "obsidian";

/**
 * Shared, invalidatable view of the Vault file index. Obsidian remains the
 * source of truth; this only avoids repeating full-vault scans per window.
 */
export class ImageCatalogService {
	private filesByExtension: Map<string, TFile[]> | null = null;
	private filesByPath: Map<string, TFile> | null = null;

	constructor(private readonly app: App) { }

	getFilesByExtensions(extensions: ReadonlySet<string>): TFile[] {
		this.ensureIndex();
		const result: TFile[] = [];
		for (const extension of extensions) {
			const files = this.filesByExtension?.get(extension.toLowerCase());
			if (files) result.push(...files);
		}
		return result;
	}

	upsert(file: TFile): void {
		this.ensureIndex();
		this.remove(file.path);
		const extension = file.extension.toLowerCase();
		const bucket = this.filesByExtension?.get(extension);
		if (bucket) bucket.push(file);
		else this.filesByExtension?.set(extension, [file]);
		this.filesByPath?.set(file.path, file);
	}

	remove(path: string): void {
		this.ensureIndex();
		const file = this.filesByPath?.get(path);
		const fileName = path.substring(path.lastIndexOf("/") + 1);
		const extensionIndex = fileName.lastIndexOf(".");
		const extension = extensionIndex >= 0
			? fileName.substring(extensionIndex + 1).toLowerCase()
			: file?.extension.toLowerCase();
		if (!extension) return;
		const files = this.filesByExtension?.get(extension);
		const index = files?.findIndex(
			(candidate) => candidate === file || candidate.path === path,
		) ?? -1;
		if (files && index >= 0) files.splice(index, 1);
		if (files?.length === 0) this.filesByExtension?.delete(extension);
		this.filesByPath?.delete(path);
	}

	rename(file: TFile, oldPath: string): void {
		if (!this.filesByExtension || !this.filesByPath) return;
		this.remove(oldPath);
		this.upsert(file);
	}

	private ensureIndex(): void {
		if (this.filesByExtension) return;
		const mutableIndex = new Map<string, TFile[]>();
		const pathIndex = new Map<string, TFile>();
		for (const file of this.app.vault.getFiles()) {
			const extension = file.extension.toLowerCase();
			const bucket = mutableIndex.get(extension);
			if (bucket) bucket.push(file);
			else mutableIndex.set(extension, [file]);
			pathIndex.set(file.path, file);
		}
		this.filesByExtension = mutableIndex;
		this.filesByPath = pathIndex;
	}
}
