import { App, Menu, setIcon } from "obsidian";
import { ImageCardProperty, ImageItem } from "../types/image-manager.types";
import {
	getImageCardDetailProperties,
	renderImageCardInfo,
	renderImageFormatBadge,
} from "./ImageCardProperties";

interface ImageManagerCardActions {
	isSelected: (path: string) => boolean;
	isMultiSelect: () => boolean;
	onToggleSelection: (image: ImageItem, element: HTMLElement) => void;
	onPreview: (image: ImageItem, sourceImage: HTMLImageElement) => void;
	onOpenReferences: (image: ImageItem, anchor: HTMLElement) => void;
	onOpen: (image: ImageItem) => void;
	onRename: (image: ImageItem) => void;
	onCopyLink: (image: ImageItem) => void;
	onCopyImage: (image: ImageItem) => void;
	onMove: (image: ImageItem) => void;
	onDelete: (image: ImageItem) => void;
}

interface ImageManagerCardController {
	element: HTMLElement;
	imageEl: HTMLImageElement | null;
	closeMenus: () => void;
	dispose: () => void;
}

export function createImageManagerCard(
	app: App,
	document: Document,
	image: ImageItem,
	properties: readonly ImageCardProperty[],
	actions: ImageManagerCardActions,
): ImageManagerCardController {
	const itemEl = document.win.createDiv();
	itemEl.addClass("image-manager-grid-item");
	itemEl.setCssProps({
		"--afm-manager-property-count": String(getImageCardDetailProperties(properties).length),
	});
	itemEl.toggleClass("image-manager-show-references", properties.includes("references"));
	itemEl.tabIndex = 0;
	itemEl.setAttribute("role", "button");
	itemEl.dataset.path = image.path;
	itemEl.toggleClass("image-manager-item-selected", actions.isSelected(image.path));
	let imageEl: HTMLImageElement | null = null;
	const activate = () => {
		if (actions.isMultiSelect()) actions.onToggleSelection(image, itemEl);
		else if (imageEl) actions.onPreview(image, imageEl);
	};
	itemEl.addEventListener("keydown", (event) => {
		if (event.isComposing || event.defaultPrevented) return;
		const target = event.target as Element | null;
		if (target?.closest?.("button")) return;
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		activate();
	});

	const thumbnailEl = itemEl.createDiv("image-manager-thumbnail");
	thumbnailEl.onclick = activate;
	const selectionIndicator = thumbnailEl.createSpan({
		cls: "image-manager-selection-indicator",
		attr: { "aria-hidden": "true" },
	});
	setIcon(selectionIndicator, "check");
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
	let moreMenu: Menu | null = null;
	let lastMoreMenuCloseTime = 0;
	createAction(actionBar, "file", "打开文件", "image-manager-open-button", () => actions.onOpen(image));
	createAction(actionBar, "pencil", "重命名", "image-manager-rename-button", () => actions.onRename(image));
	createAction(actionBar, "copy", "复制图片", "image-manager-copy-image-button", () => actions.onCopyImage(image));
	createAction(actionBar, "link", "复制图片链接", "image-manager-copy-link-button", () => actions.onCopyLink(image));
	const moreButton = createAction(
		actionBar,
		"ellipsis",
		"更多",
		"image-manager-more-button",
		(event) => {
			if (moreMenu) {
				moreMenu.close();
				return;
			}
			if (performance.now() - lastMoreMenuCloseTime < 250) return;
			const menu = new Menu().setParentElement(moreButton);
			moreMenu = menu;
			itemEl.addClass("has-open-action-menu");
			menu.onHide(() => {
				if (moreMenu !== menu) return;
				moreMenu = null;
				lastMoreMenuCloseTime = performance.now();
				itemEl.removeClass("has-open-action-menu");
				moreButton.removeClass("has-active-menu");
			});
			menu.addItem((item) => item
				.setTitle("移动")
				.setIcon("folder-tree")
				.setSection("action")
				.onClick(() => actions.onMove(image)));
			menu.addItem((item) => item
				.setTitle("删除")
				.setIcon("trash-2")
				.setSection("action")
				.onClick(() => actions.onDelete(image)));
			menu.showAtMouseEvent(event);
		},
	);

	if (properties.includes("extension")) renderImageFormatBadge(thumbnailEl, image);
	if (properties.includes("references") && image.references !== undefined) {
		updateImageManagerReferenceBadge(itemEl, image, (anchor) => actions.onOpenReferences(image, anchor));
	}

	const infoEl = renderImageCardInfo(itemEl, image, properties);
	if (infoEl) {
		infoEl.onclick = (event) => {
			event.stopPropagation();
			activate();
		};
	}
	const closeMenus = (): void => moreMenu?.close();
	return {
		element: itemEl,
		imageEl,
		closeMenus,
		dispose: closeMenus,
	};
}

export function updateImageManagerReferenceBadge(
	itemEl: HTMLElement,
	image: ImageItem,
	onOpen?: (anchor: HTMLElement) => void,
): void {
	const thumbnailEl = itemEl.querySelector<HTMLElement>(".image-manager-thumbnail");
	if (!thumbnailEl) return;
	const existing = thumbnailEl.querySelector<HTMLElement>(".image-manager-reference-badge");
	if (!itemEl.hasClass("image-manager-show-references") || image.references === undefined) {
		existing?.remove();
		return;
	}
	const count = image.referenceCount ?? 0;
	const badge = existing ?? thumbnailEl.createDiv("image-manager-reference-badge");
	badge.setText(count === 0 ? "未引用" : `${count} 引用`);
	badge.toggleClass("image-manager-reference-badge-has-refs", count > 0);
	badge.toggleClass("is-interactive", Boolean(onOpen));
	badge.onclick = onOpen ? (event) => {
		event.stopPropagation();
		onOpen(badge);
	} : null;
	badge.onkeydown = onOpen ? (event) => {
		if (event.isComposing || event.defaultPrevented) return;
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		event.stopPropagation();
		onOpen(badge);
	} : null;
	if (onOpen) {
		badge.tabIndex = 0;
		badge.setAttribute("role", "button");
		badge.setAttribute("aria-label", count === 0 ? "没有引用笔记" : `查看 ${count} 个引用`);
	} else {
		badge.removeAttribute("tabindex");
		badge.removeAttribute("role");
		badge.removeAttribute("aria-label");
	}
}

export function updateImageManagerSelectionState(itemEl: HTMLElement, selected: boolean): void {
	itemEl.toggleClass("image-manager-item-selected", selected);
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
	callback: (event: MouseEvent) => void,
): HTMLButtonElement {
	const button = container.createEl("button", {
		cls: `image-manager-action-button ${className} clickable-icon`,
		attr: { "aria-label": label },
	});
	setIcon(button, icon);
	button.onclick = (event) => {
		event.stopPropagation();
		callback(event);
	};
	return button;
}
