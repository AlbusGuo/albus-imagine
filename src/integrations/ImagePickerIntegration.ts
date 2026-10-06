import { type Editor, type Events, Notice, Plugin } from "obsidian";
import { ImageCatalogService } from "../services/ImageCatalogService";
import { ReferenceCheckService } from "../services/ReferenceCheckService";
import { ViewIconService } from "../services/ViewIconService";
import { ImageManagerSettings } from "../types/image-manager.types";
import {
	IMAGINE_IMAGE_PICKER_EVENT,
	isImagineImagePickerRequestV1,
} from "../types/image-picker-integration";
import { type ImagePickerAction, ImagePickerModal } from "../views/ImagePickerModal";

/** Owns cross-plugin picker requests and every picker opened by Imagine. */
export class ImagePickerIntegration {
	private readonly openPickers = new Set<ImagePickerModal>();

	constructor(
		private readonly plugin: Plugin,
		private readonly getSettings: () => ImageManagerSettings,
		private readonly imageCatalog: ImageCatalogService,
		private readonly referenceIndex: ReferenceCheckService,
		private readonly viewIconService: ViewIconService,
	) {}

	register(): void {
		const workspaceEvents = this.plugin.app.workspace as Events;
		this.plugin.registerEvent(workspaceEvents.on(IMAGINE_IMAGE_PICKER_EVENT, (...data: unknown[]) => {
			const request = data[0];
			if (!isImagineImagePickerRequestV1(request)) return;
			const modal = this.show({
				kind: "select",
				multiple: request.multiple,
				onSelect: request.onSelect,
			});
			if (!modal) return;
			try {
				request.accept();
			} catch {
				modal.close();
				new Notice("图片选择请求未被接管");
			}
		}));
	}

	openInsert(editor: Editor, sourcePath: string): void {
		this.show({ kind: "insert", editor, sourcePath });
	}

	closeAll(): void {
		for (const modal of Array.from(this.openPickers)) modal.close();
		this.openPickers.clear();
	}

	private show(action: ImagePickerAction): ImagePickerModal | null {
		const modal = new ImagePickerModal(
			this.plugin.app,
			this.getSettings(),
			this.imageCatalog,
			this.referenceIndex,
			this.viewIconService,
			action,
		);
		modal.setCloseCallback(() => this.openPickers.delete(modal));
		this.openPickers.add(modal);
		try {
			modal.open();
			return modal;
		} catch {
			this.openPickers.delete(modal);
			modal.close();
			new Notice("打开图片选择器失败");
			return null;
		}
	}
}
