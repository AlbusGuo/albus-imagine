import { ImageCardProperty, ImageItem } from "../types/image-manager.types";

type ImageCardDetailProperty = Exclude<ImageCardProperty, "extension" | "references">;

const DETAIL_PROPERTY_ORDER: readonly ImageCardDetailProperty[] = [
	"name",
	"size",
	"ctime",
	"mtime",
	"folder",
];

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
	dateStyle: "short",
	timeStyle: "short",
});

export function getImageCardDetailProperties(
	properties: readonly ImageCardProperty[],
): ImageCardDetailProperty[] {
	const selected = new Set(properties);
	return DETAIL_PROPERTY_ORDER.filter((property) => selected.has(property));
}

export function renderImageCardInfo(
	itemEl: HTMLElement,
	image: ImageItem,
	properties: readonly ImageCardProperty[],
): HTMLElement | null {
	const details = getImageCardDetailProperties(properties);
	if (details.length === 0) return null;
	const infoEl = itemEl.createDiv("image-manager-image-info");
	for (const property of details) {
		if (property === "name") {
			infoEl.createDiv({
				text: image.originalFile.basename,
				cls: "image-manager-image-name",
			});
			continue;
		}
		const metadata = getMetadata(image, property);
		const row = infoEl.createDiv("image-manager-image-meta");
		row.createSpan({ cls: "image-manager-image-meta-label", text: metadata.label });
		row.createSpan({
			cls: "image-manager-image-meta-value",
			text: metadata.value,
		});
	}
	return infoEl;
}

export function renderImageFormatBadge(container: HTMLElement, image: ImageItem): void {
	const badge = container.createDiv({
		text: image.originalFile.extension.toUpperCase(),
		cls: "image-manager-format-badge",
	});
	badge.addClass(image.isCustomType ? "image-manager-agx-format" : "image-manager-other-format");
}

function getMetadata(
	image: ImageItem,
	property: Exclude<ImageCardDetailProperty, "name">,
): { label: string; value: string } {
	if (property === "size") return { label: "大小", value: formatFileSize(image.stat.size) };
	if (property === "ctime") {
		return { label: "创建时间", value: DATE_TIME_FORMATTER.format(image.stat.ctime) };
	}
	if (property === "mtime") {
		return { label: "修改时间", value: DATE_TIME_FORMATTER.format(image.stat.mtime) };
	}
	return { label: "路径", value: image.originalFile.path };
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
