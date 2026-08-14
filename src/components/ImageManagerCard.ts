import { App, setIcon } from "obsidian";
import { ImageItem, ImageManagerSettings } from "../types/image-manager.types";

interface ImageManagerCardActions {
	isSelected: (path: string) => boolean;
	isMultiSelect: () => boolean;
	onToggleSelection: (image: ImageItem, element: HTMLElement) => void;
	onPreview: (image: ImageItem) => void;
	onOpen: (image: ImageItem) => void;
	onRename: (image: ImageItem) => void;
	onMove: (image: ImageItem) => void;
	onDelete: (image: ImageItem) => void;
}

interface ImageManagerCardController {
	element: HTMLElement;
	imageEl: HTMLImageElement | null;
}

export function createImageManagerCard(
	app: App,
	document: Document,
	image: ImageItem,
	settings: ImageManagerSettings,
	actions: ImageManagerCardActions,
): ImageManagerCardController {
	const itemEl = document.createElement("div");
	itemEl.addClass("image-manager-grid-item");
	itemEl.dataset.path = image.path;
	itemEl.toggleClass("image-manager-item-selected", actions.isSelected(image.path));
	const activate = () => {
		if (actions.isMultiSelect()) actions.onToggleSelection(image, itemEl);
		else actions.onPreview(image);
	};

	const thumbnailEl = itemEl.createDiv("image-manager-thumbnail");
	thumbnailEl.onclick = activate;
	let imageEl: HTMLImageElement | null = null;
	if (image.coverMissing) {
		createUnavailableState(thumbnailEl, "file-x", "封面缺失");
	} else {
		imageEl = thumbnailEl.createEl("img", {
			cls: image.displayFile.extension.toLowerCase() === "svg"
				? "image-manager-svg-image"
				: "image-manager-thumbnail-image",
		});
		imageEl.dataset.src = app.vault.getResourcePath(image.displayFile);
		imageEl.alt = image.name;
		imageEl.loading = "lazy";
		imageEl.decoding = "async";
		let loadFailed = false;
		imageEl.onerror = () => {
			if (loadFailed) return;
			loadFailed = true;
			imageEl?.addClass("image-manager-cover-hidden");
			createUnavailableState(thumbnailEl, "circle-alert", "加载失败");
		};
	}

	const actionBar = thumbnailEl.createDiv("image-manager-image-actions");
	createAction(actionBar, "folder-open", "打开", "image-manager-open-button", () => actions.onOpen(image));
	createAction(actionBar, "pencil", "重命名", "image-manager-rename-button", () => actions.onRename(image));
	createAction(actionBar, "folder-tree", "移动", "image-manager-move-button", () => actions.onMove(image));
	createAction(actionBar, "trash-2", "删除", "image-manager-delete-button", () => actions.onDelete(image));

	const formatBadge = thumbnailEl.createDiv({
		text: image.originalFile.extension.toUpperCase(),
		cls: "image-manager-format-badge",
	});
	formatBadge.addClass(image.isCustomType ? "image-manager-agx-format" : "image-manager-other-format");
	if (image.references !== undefined) updateImageManagerReferenceBadge(itemEl, image);

	const infoEl = itemEl.createDiv("image-manager-image-info");
	infoEl.onclick = (event) => {
		event.stopPropagation();
		activate();
	};
	infoEl.createDiv({ text: image.name, cls: "image-manager-image-name", attr: { title: image.path } });
	const metaEl = infoEl.createDiv("image-manager-image-meta");
	if (settings.showFileSize) {
		metaEl.createSpan({ text: formatFileSize(image.stat.size), cls: "image-manager-meta-item image-manager-meta-size" });
	}
	if (settings.showModifiedTime) {
		metaEl.createSpan({ text: new Date(image.stat.mtime).toLocaleDateString(), cls: "image-manager-meta-item image-manager-meta-date" });
	}
	return { element: itemEl, imageEl };
}

export function updateImageManagerReferenceBadge(itemEl: HTMLElement, image: ImageItem): void {
	const thumbnailEl = itemEl.querySelector<HTMLElement>(".image-manager-thumbnail");
	if (!thumbnailEl) return;
	const existing = thumbnailEl.querySelector<HTMLElement>(".image-manager-reference-badge");
	if (image.references === undefined) {
		existing?.remove();
		return;
	}
	const count = image.referenceCount ?? 0;
	const badge = existing ?? thumbnailEl.createDiv("image-manager-reference-badge");
	badge.setText(count === 0 ? "未引用" : `${count} 引用`);
	badge.toggleClass("image-manager-reference-badge-has-refs", count > 0);
}

function createUnavailableState(container: HTMLElement, icon: string, text: string): void {
	const state = container.createDiv("image-manager-cover-missing");
	const content = state.createDiv("image-manager-cover-missing-content");
	const iconEl = content.createSpan("image-manager-cover-missing-icon");
	setIcon(iconEl, icon);
	content.createSpan({ text, cls: "image-manager-cover-missing-text" });
}

function createAction(
	container: HTMLElement,
	icon: string,
	label: string,
	className: string,
	callback: () => void,
): void {
	const button = container.createEl("button", {
		cls: `image-manager-action-button ${className} clickable-icon`,
		attr: { "aria-label": label },
	});
	setIcon(button, icon);
	button.onclick = (event) => {
		event.stopPropagation();
		callback();
	};
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
