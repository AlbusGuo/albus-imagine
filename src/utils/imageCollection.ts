import { ImageItem, SortField, SortOrder } from "../types/image-manager.types";

interface ImageCollectionOptions {
	query: string;
	unreferencedOnly: boolean;
	sortField: SortField;
	sortOrder: SortOrder;
}

export function filterAndSortImages(images: readonly ImageItem[], options: ImageCollectionOptions): ImageItem[] {
	const query = options.query.trim().toLowerCase();
	const filtered = images.filter((image) =>
		(!query || image.name.toLowerCase().includes(query)) &&
		(!options.unreferencedOnly || (image.references !== undefined && image.referenceCount === 0)),
	);
	return filtered.sort((a, b) => {
		let comparison = 0;
		switch (options.sortField) {
			case "mtime": comparison = a.stat.mtime - b.stat.mtime; break;
			case "ctime": comparison = a.stat.ctime - b.stat.ctime; break;
			case "size": comparison = a.stat.size - b.stat.size; break;
			case "name": comparison = a.name.localeCompare(b.name); break;
			case "references": comparison = (a.referenceCount ?? 0) - (b.referenceCount ?? 0); break;
		}
		if (comparison === 0) comparison = a.path.localeCompare(b.path);
		return options.sortOrder === "asc" ? comparison : -comparison;
	});
}
