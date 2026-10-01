import { ImageManagerSettings } from "./image-manager.types";

/**
 * 图片调整大小插件的设置接口
 */
export interface ImageResizeSettings {
	/** 调整大小的时间间隔 (像素) */
	resizeInterval: number;
	/** 边缘检测区域大小 (像素) */
	edgeSize: number;
	/** 是否启用一般图片拖拽调整大小 */
	dragResizeGeneral: boolean;
	/** 是否启用 callout 内图片拖拽调整大小 */
	dragResizeCallout: boolean;
}

/**
 * 图片查看器设置接口
 */
export type ImageClickBehavior = "obsidian" | "disabled" | "imagine";

export interface ImageViewerSettings {
	/** 是否启用 Ctrl+Click 图片查看器 */
	enabled: boolean;
	/** 普通单击 Markdown 图片时的查看行为 */
	clickBehavior: ImageClickBehavior;
}

export interface IPluginSettings {
	imageManager?: ImageManagerSettings;
	imageResize?: ImageResizeSettings;
	imageViewer?: ImageViewerSettings;
	settingsTab?: "IMAGE_RESIZE" | "IMAGE_VIEWER";
}

const DEFAULT_IMAGE_RESIZE_SETTINGS: ImageResizeSettings = {
	resizeInterval: 0,
	edgeSize: 20,
	dragResizeGeneral: true,
	dragResizeCallout: true,
};

const DEFAULT_IMAGE_VIEWER_SETTINGS: ImageViewerSettings = {
	enabled: true,
	clickBehavior: "obsidian",
};

export const DEFAULT_SETTINGS: IPluginSettings = {
	imageManager: {
		folderPath: "",
		lastSelectedFolder: "",
		invertSvgInDarkMode: true,
		customFileTypes: [],
		filterPresets: [],
		activeFilterId: "view-default",
		viewsMigrated: false,
		allViewProperties: ["name", "size", "mtime"],
		allViewSort: [{ field: "mtime", order: "desc" }],
		allViewFilterMatch: "all",
		allViewFilterRules: [],
		allViewUnreferencedOnly: false,
	},
	imageResize: DEFAULT_IMAGE_RESIZE_SETTINGS,
	imageViewer: DEFAULT_IMAGE_VIEWER_SETTINGS,
	settingsTab: "IMAGE_RESIZE",
};
