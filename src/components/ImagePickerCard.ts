import { App, setIcon } from "obsidian";
import { ImageCardProperty, ImageItem } from "../types/image-manager.types";
import {
	getImageCardDetailProperties,
	renderImageCardInfo,
	renderImageFormatBadge,
} from "./ImageCardProperties";
import { updateImageManagerReferenceBadge } from "./ImageManagerCard";

interface ImagePickerCardController {
	element: HTMLElement;
	imageEl: HTMLImageElement | null;
}

export function createImagePickerCard(
	app: App,
	document: Document,
	image: ImageItem,
	properties: readonly ImageCardProperty[],
	isSelected: boolean,
	onActivate: (element: HTMLElement) => void,
): ImagePickerCardController {
	const itemEl = document.win.createDiv();
	itemEl.addClass("image-manager-grid-item");
	itemEl.setCssProps({
		"--afm-manager-property-count": String(getImageCardDetailProperties(properties).length),
	});
	itemEl.toggleClass("image-manager-item-selected", isSelected);
	itemEl.toggleClass("image-manager-show-references", properties.includes("references"));
	const thumbnailEl = itemEl.createDiv("image-manager-thumbnail");
	thumbnailEl.onclick = () => onActivate(itemEl);
	const selectionIndicator = thumbnailEl.createSpan({ cls: "image-manager-selection-indicator", attr: { "aria-hidden": "true" } });
	setIcon(selectionIndicator, "check");

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

	if (properties.includes("extension")) renderImageFormatBadge(thumbnailEl, image);
	if (properties.includes("references") && image.references !== undefined) {
		updateImageManagerReferenceBadge(itemEl, image);
	}
	renderImageCardInfo(itemEl, image, properties);
	return { element: itemEl, imageEl };
}
