import { App, Notice } from "obsidian";
import { ImageItem } from "../types/image-manager.types";

export class ImageClipboardService {
	constructor(private readonly app: App) { }

	async copyLink(image: ImageItem, ownerDocument: Document): Promise<void> {
		try {
			const clipboard = ownerDocument.defaultView?.navigator.clipboard;
			if (!clipboard) throw new Error("Clipboard API is unavailable");
			await clipboard.writeText(`![[${image.originalFile.path}]]`);
			new Notice("已复制图片链接");
		} catch (error) {
			console.error("Failed to copy attachment link", error);
			new Notice("复制图片链接失败");
		}
	}

	async copyImage(image: ImageItem, ownerDocument: Document): Promise<void> {
		try {
			const ownerWindow = ownerDocument.defaultView;
			const clipboard = ownerWindow?.navigator.clipboard;
			const ClipboardItemConstructor = ownerWindow?.ClipboardItem;
			if (!clipboard?.write || !ClipboardItemConstructor) throw new Error("Clipboard image API is unavailable");
			const blob = image.displayFile.extension.toLowerCase() === "png"
				? new Blob([await this.app.vault.readBinary(image.displayFile)], { type: "image/png" })
				: await this.renderAsPng(image, ownerDocument);
			await clipboard.write([new ClipboardItemConstructor({ "image/png": blob })]);
			new Notice("已复制图片");
		} catch (error) {
			console.error("Failed to copy attachment image", error);
			new Notice("复制图片失败");
		}
	}

	private async renderAsPng(image: ImageItem, ownerDocument: Document): Promise<Blob> {
		const imageEl = ownerDocument.win.createEl("img");
		imageEl.src = this.app.vault.getResourcePath(image.displayFile);
		await new Promise<void>((resolve, reject) => {
			imageEl.onload = () => resolve();
			imageEl.onerror = () => reject(new Error("Failed to load attachment image"));
		});
		if (imageEl.naturalWidth < 1 || imageEl.naturalHeight < 1) throw new Error("Attachment image has no pixels");
		const canvas = ownerDocument.win.createEl("canvas");
		canvas.width = imageEl.naturalWidth;
		canvas.height = imageEl.naturalHeight;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Canvas API is unavailable");
		context.drawImage(imageEl, 0, 0);
		return new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (blob) resolve(blob);
				else reject(new Error("Failed to encode attachment image"));
			}, "image/png");
		});
	}
}
