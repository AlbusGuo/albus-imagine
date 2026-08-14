import AlbusFigureManagerPlugin from "@src/main";
import { DEFAULT_SETTINGS, IPluginSettings } from "@src/types/types";
import { normalizeExtension, normalizeVaultFolder } from "@src/utils/vaultPaths";

/** Loads persisted settings and validates them against the declared defaults. */
export default class SettingsStore {
	constructor(private readonly plugin: AlbusFigureManagerPlugin) { }

	async loadSettings(): Promise<void> {
		this.plugin.settings = sanitizeSettings(
			mergeWithDefaults(await this.plugin.loadData(), DEFAULT_SETTINGS),
		);
	}
}

function sanitizeSettings(settings: IPluginSettings): IPluginSettings {
	const manager = settings.imageManager;
	if (manager) {
		const sortFields = new Set(["mtime", "ctime", "size", "name", "references"]);
		if (!sortFields.has(manager.defaultSortField ?? "")) manager.defaultSortField = "mtime";
		if (manager.defaultSortOrder !== "asc" && manager.defaultSortOrder !== "desc") {
			manager.defaultSortOrder = "desc";
		}
		manager.folderPath = normalizeVaultFolder(manager.folderPath ?? "");
		manager.lastSelectedFolder = normalizeVaultFolder(manager.lastSelectedFolder ?? "");
		manager.excludedFolders = Array.from(new Set(
			(manager.excludedFolders ?? []).map(normalizeVaultFolder).filter(Boolean),
		));
		const seen = new Set<string>();
		manager.customFileTypes = (manager.customFileTypes ?? []).flatMap((config) => {
			const fileExtension = normalizeExtension(config.fileExtension);
			const coverExtension = normalizeExtension(config.coverExtension);
			if (!fileExtension || !coverExtension || seen.has(fileExtension)) return [];
			seen.add(fileExtension);
			return [{
				fileExtension,
				coverExtension,
				coverFolder: normalizeVaultFolder(config.coverFolder),
			}];
		});
	}
	if (settings.imageResize) {
		settings.imageResize.resizeInterval = clampInteger(settings.imageResize.resizeInterval, 0, 1000, 0);
		settings.imageResize.edgeSize = clampInteger(settings.imageResize.edgeSize, 5, 150, 20);
	}
	if (!settings.settingsTab || !new Set([
		"IMAGE_MANAGER",
		"IMAGE_RESIZE",
		"IMAGE_VIEWER",
		"CUSTOM_FILE_TYPES",
	]).has(settings.settingsTab)) {
		settings.settingsTab = "IMAGE_MANAGER";
	}
	return settings;
}

function clampInteger(value: number, minimum: number, maximum: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function mergeWithDefaults<T>(saved: unknown, defaults: T): T {
	if (defaults !== null && typeof defaults === "object" && !Array.isArray(defaults)) {
		const result: Record<string, unknown> = {};
		const defaultRecord = defaults as Record<string, unknown>;
		const savedRecord = saved !== null && typeof saved === "object" && !Array.isArray(saved)
			? saved as Record<string, unknown>
			: {};
		for (const [key, defaultValue] of Object.entries(defaultRecord)) {
			result[key] = mergeWithDefaults(savedRecord[key], defaultValue);
		}
		return result as T;
	}
	if (Array.isArray(defaults)) return (Array.isArray(saved) ? saved : defaults) as T;
	return (saved === undefined || typeof saved !== typeof defaults ? defaults : saved) as T;
}
