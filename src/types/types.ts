import { ImageManagerSettings } from "./image-manager.types";

export interface IPluginSettings {
	imageManager?: ImageManagerSettings;
}

export const DEFAULT_SETTINGS: IPluginSettings = {
	imageManager: {
		folderPath: "",
		showFileSize: true,
		showModifiedTime: true,
		defaultFilterUnreferenced: false,
		confirmDelete: true,
		customFileTypes: [],
		fileOpenModes: {},
	},
};
