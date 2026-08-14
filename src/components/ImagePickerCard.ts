import { App } from "obsidian";
import { ImageItem, ImageManagerSettings } from "../types/image-manager.types";

interface ImagePickerCardController {
	element: HTMLElement;
	imageEl: HTMLImageElement | null;
}

export function createImagePickerCard(
	app: App,
	document: Document,
	image: ImageItem,
	settings: ImageManagerSettings,
	isSelected: boolean,
	onActivate: (element: HTMLElement) => void,
): ImagePickerCardController {
	const itemEl = document.createElement("div");
	itemEl.addClass("image-manager-grid-item");
	itemEl.toggleClass("image-manager-item-selected", isSelected);
	const thumbnailEl = itemEl.createDiv("image-manager-thumbnail");
	thumbnailEl.onclick = () => onActivate(itemEl);

	let imageEl: HTMLImageElement | null = null;
	if (!image.coverMissing) {
		imageEl = thumbnailEl.createEl("img", {
			cls: image.displayFile.extension.toLowerCase() === "svg"
				? "image-manager-svg-image"
				: "image-manager-thumbnail-image",
		});
		imageEl.dataset.src = app.vault.getResourcePath(image.displayFile);
		imageEl.alt = image.name;
		imageEl.loading = "lazy";
		imageEl.decoding = "async";
	}

	const formatBadge = thumbnailEl.createDiv({
		text: image.originalFile.extension.toUpperCase(),
		cls: "image-manager-format-badge",
	});
	formatBadge.addClass(image.isCustomType ? "image-manager-agx-format" : "image-manager-other-format");

	const infoEl = itemEl.createDiv("image-manager-image-info");
	infoEl.createDiv({ text: image.name, cls: "image-manager-image-name", attr: { title: image.path } });
	const metaEl = infoEl.createDiv("image-manager-image-meta");
	if (settings.showFileSize) {
		metaEl.createSpan({ text: formatFileSize(image.stat.size), cls: "image-manager-meta-item image-manager-meta-size" });
	}
	if (settings.showModifiedTime) {
		metaEl.createSpan({
			text: new Date(image.stat.mtime).toLocaleDateString(),
			cls: "image-manager-meta-item image-manager-meta-date",
		});
	}
	return { element: itemEl, imageEl };
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
