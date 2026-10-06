import AlbusFigureManagerPlugin from "@src/main";
import { DEFAULT_SETTINGS, IPluginSettings } from "@src/types/types";
import { normalizeExtension, normalizeVaultFolder } from "@src/utils/vaultPaths";
import {
	CustomFileTypeConfig,
	IMAGE_CARD_PROPERTY_ORDER,
	ImageCardProperty,
	ImageFilterGroup,
	ImageFilterRule,
	ImageGroupBy,
	ImageSortRule,
} from "@src/types/image-manager.types";

/** Loads persisted settings and validates them against the declared defaults. */
export default class SettingsStore {
	constructor(private readonly plugin: AlbusFigureManagerPlugin) { }

	async loadSettings(): Promise<void> {
		const savedSettings: unknown = await this.plugin.loadData();
		const settings = mergeWithDefaults(savedSettings, DEFAULT_SETTINGS);
		migrateLegacyImageViewerSettings(settings, savedSettings);
		this.plugin.settings = sanitizeSettings(settings);
	}
}

function sanitizeSettings(settings: IPluginSettings): IPluginSettings {
	const manager = settings.imageManager;
	if (manager) {
		const sortFields = new Set(["mtime", "ctime", "size", "name", "extension", "references"]);
		const groupFields = new Set(["extension", "folder", "references", "size"]);
		const propertyFields = new Set(["name", "extension", "size", "mtime", "ctime", "folder", "references"]);
		const filterFields = new Set(["name", "folder", "extension", "references", "size", "ctime", "mtime"]);
		const filterOperators = new Set([
			"is", "is-not", "contains", "not-contains", "starts-with", "ends-with",
			"greater-than", "less-than", "before", "after",
		]);
		manager.folderPath = normalizeVaultFolder(manager.folderPath ?? "");
		manager.lastSelectedFolder = normalizeVaultFolder(manager.lastSelectedFolder ?? "");
		manager.allViewProperties = sanitizeProperties(manager.allViewProperties, propertyFields);
		manager.allViewSort = sanitizeSort(manager.allViewSort, sortFields);
		manager.allViewFilterMatch = manager.allViewFilterMatch === "any" || manager.allViewFilterMatch === "none"
			? manager.allViewFilterMatch
			: "all";
		manager.allViewFilterRules = sanitizeFilterRules(manager.allViewFilterRules, filterFields, filterOperators);
		manager.allViewUnreferencedOnly = manager.allViewUnreferencedOnly === true;
		const legacyMappings = sanitizeMappings(manager.customFileTypes);
		const filterIds = new Set<string>();
		manager.filterPresets = (manager.filterPresets ?? []).flatMap((preset) => {
			const id = typeof preset.id === "string" ? preset.id.trim() : "";
			const name = typeof preset.name === "string" ? preset.name.trim() : "";
			if (!id || !name || id === "all" || filterIds.has(id)) return [];
			filterIds.add(id);
			const rules = sanitizeFilterRules(preset.rules, filterFields, filterOperators);
			return [{
				id,
				name,
				icon: typeof preset.icon === "string" && preset.icon.trim() ? preset.icon.trim() : "layout-grid",
				cardSize: sanitizeCardSize(preset.cardSize),
				invertSvgInDarkMode: preset.invertSvgInDarkMode ?? (manager.invertSvgInDarkMode !== false),
				mappings: sanitizeMappings(preset.mappings === undefined ? legacyMappings : preset.mappings),
				layout: preset.layout === "masonry" ? "masonry" as const : "grid" as const,
				filter: sanitizeFilterTree(
					preset.filter,
					`${id}-filter`,
					preset.match,
					rules,
					filterFields,
					filterOperators,
				),
				properties: sanitizeProperties(preset.properties, propertyFields),
				sort: sanitizeSort(preset.sort, sortFields),
				groupBy: sanitizeGroupBy(preset.groupBy, groupFields),
				groupOrder: Array.isArray(preset.groupOrder)
					? Array.from(new Set(preset.groupOrder.filter((key): key is string => typeof key === "string")))
					: undefined,
				collapsedGroups: Array.isArray(preset.collapsedGroups)
					? Array.from(new Set(preset.collapsedGroups.filter((key): key is string => typeof key === "string")))
					: undefined,
				unreferencedOnly: preset.unreferencedOnly === true,
			}];
		});
		const generatedViewExists = manager.filterPresets.some((view) => view.id === "view-default");
		if (manager.viewsMigrated !== true && !generatedViewExists) {
			const existingNames = new Set(manager.filterPresets.map((view) => view.name));
			const id = createUniqueId(filterIds, "view-default");
			const name = createUniqueName(existingNames, "视图");
			const migratedView = {
				id,
				name,
				icon: "layout-grid",
				cardSize: 200,
				invertSvgInDarkMode: manager.invertSvgInDarkMode !== false,
				mappings: legacyMappings.map((mapping) => ({ ...mapping })),
				layout: "grid" as const,
				filter: createFilterGroup(
					`${id}-filter`,
					manager.allViewFilterMatch ?? "all",
					manager.allViewFilterRules ?? [],
				),
				properties: manager.allViewProperties ?? ["name", "size", "mtime"],
				sort: manager.allViewSort ?? [{ field: "mtime" as const, order: "desc" as const }],
				unreferencedOnly: manager.allViewUnreferencedOnly === true,
			};
			manager.filterPresets.unshift(migratedView);
			filterIds.add(id);
			if (manager.activeFilterId === "all" || !filterIds.has(manager.activeFilterId ?? "")) {
				manager.activeFilterId = id;
			}
		}
		manager.viewsMigrated = true;
		if (manager.filterPresets.length === 0) {
			const initialView = {
				id: createUniqueId(filterIds, "view-default"),
				name: "视图",
				icon: "layout-grid",
				cardSize: 200,
				invertSvgInDarkMode: manager.invertSvgInDarkMode !== false,
				mappings: legacyMappings.map((mapping) => ({ ...mapping })),
				layout: "grid" as const,
				filter: createFilterGroup("view-default-filter", "all", []),
				properties: manager.allViewProperties ?? ["name", "size", "mtime"],
				sort: manager.allViewSort ?? [{ field: "mtime" as const, order: "desc" as const }],
				unreferencedOnly: false,
			};
			manager.filterPresets.push(initialView);
			filterIds.add(initialView.id);
		}
		if (!filterIds.has(manager.activeFilterId ?? "")) {
			manager.activeFilterId = manager.filterPresets[0]?.id;
		}
		manager.customFileTypes = [];
	}
	if (settings.imageResize) {
		settings.imageResize.resizeInterval = clampInteger(settings.imageResize.resizeInterval, 0, 1000, 0);
		settings.imageResize.edgeSize = clampInteger(settings.imageResize.edgeSize, 5, 150, 20);
	}
	if (settings.imageViewer && !new Set(["obsidian", "disabled", "imagine"]).has(
		settings.imageViewer.clickBehavior,
	)) {
		settings.imageViewer.clickBehavior = "obsidian";
	}
	if (!settings.settingsTab || !new Set([
		"IMAGE_RESIZE",
		"IMAGE_VIEWER",
	]).has(settings.settingsTab)) {
		settings.settingsTab = "IMAGE_RESIZE";
	}
	return settings;
}

function createUniqueId(existing: ReadonlySet<string>, base: string): string {
	if (!existing.has(base)) return base;
	let suffix = 2;
	while (existing.has(`${base}-${suffix}`)) suffix += 1;
	return `${base}-${suffix}`;
}

function createUniqueName(existing: ReadonlySet<string>, base: string): string {
	if (!existing.has(base)) return base;
	let suffix = 2;
	while (existing.has(`${base} ${suffix}`)) suffix += 1;
	return `${base} ${suffix}`;
}

function sanitizeFilterRules(
	rules: ImageFilterRule[] | undefined,
	fields: ReadonlySet<string>,
	operators: ReadonlySet<string>,
): ImageFilterRule[] {
	const ids = new Set<string>();
	return (rules ?? []).flatMap((rule) => {
		const id = typeof rule.id === "string" ? rule.id.trim() : "";
		if (!id || ids.has(id) || !fields.has(rule.field) || !operators.has(rule.operator)) return [];
		ids.add(id);
		return [{ ...rule, id, value: String(rule.value ?? "") }];
	});
}

function sanitizeFilterTree(
	filter: ImageFilterGroup | undefined,
	fallbackId: string,
	legacyMatch: "all" | "any" | "none" | undefined,
	legacyRules: ImageFilterRule[],
	fields: ReadonlySet<string>,
	operators: ReadonlySet<string>,
): ImageFilterGroup {
	if (!filter || !Array.isArray(filter.children)) {
		return createFilterGroup(fallbackId, legacyMatch ?? "all", legacyRules);
	}
	const ids = new Set<string>();
	const sanitizeGroup = (source: ImageFilterGroup, suggestedId: string): ImageFilterGroup => {
		const rawId = typeof source.id === "string" ? source.id.trim() : "";
		const id = rawId && !ids.has(rawId) ? rawId : createUniqueId(ids, suggestedId);
		ids.add(id);
		const match = source.match === "any" || source.match === "none" ? source.match : "all";
		const children = source.children.flatMap((child, index): Array<ImageFilterGroup | ImageFilterRule> => {
			if (child && "children" in child) {
				return [sanitizeGroup(child, `${id}-group-${index + 1}`)];
			}
			if (!child || !fields.has(child.field) || !operators.has(child.operator)) return [];
			const rawRuleId = typeof child.id === "string" ? child.id.trim() : "";
			const ruleId = rawRuleId && !ids.has(rawRuleId)
				? rawRuleId
				: createUniqueId(ids, `${id}-rule-${index + 1}`);
			ids.add(ruleId);
			return [{ ...child, id: ruleId, value: String(child.value ?? "") }];
		});
		return { id, match, children };
	};
	return sanitizeGroup(filter, fallbackId);
}

function createFilterGroup(
	id: string,
	match: "all" | "any" | "none",
	rules: ImageFilterRule[],
): ImageFilterGroup {
	return { id, match, children: rules.map((rule) => ({ ...rule })) };
}

function sanitizeCardSize(value: number | undefined): number {
	if (!Number.isFinite(value)) return 200;
	return Math.min(800, Math.max(50, Math.round((value ?? 200) / 10) * 10));
}

function sanitizeMappings(mappings: readonly CustomFileTypeConfig[] | undefined): CustomFileTypeConfig[] {
	const seen = new Set<string>();
	return (mappings ?? []).flatMap((mapping) => {
		const fileExtension = normalizeExtension(mapping.fileExtension);
		const coverExtension = normalizeExtension(mapping.coverExtension);
		if (!fileExtension || !coverExtension || seen.has(fileExtension)) return [];
		seen.add(fileExtension);
		return [{
			fileExtension,
			coverExtension,
			openMode: mapping.openMode === "obsidian" ? "obsidian" as const : "system" as const,
		}];
	});
}

function sanitizeProperties(
	properties: string[] | undefined,
	allowed: ReadonlySet<string>,
): ImageCardProperty[] {
	if (!Array.isArray(properties)) return ["name", "size", "mtime"];
	const selected = new Set(properties.filter((property) => allowed.has(property)));
	return IMAGE_CARD_PROPERTY_ORDER.filter((property) => selected.has(property));
}

function sanitizeSort(
	rules: Array<{ field: string; order: string }> | undefined,
	allowed: ReadonlySet<string>,
): ImageSortRule[] {
	const result = (rules ?? []).flatMap((rule) => allowed.has(rule.field) && (rule.order === "asc" || rule.order === "desc")
		? [{ field: rule.field, order: rule.order }]
		: []);
	return (result.length > 0 ? result : [{ field: "mtime", order: "desc" }]) as ImageSortRule[];
}

function sanitizeGroupBy(groupBy: ImageGroupBy | undefined, fields: ReadonlySet<string>): ImageGroupBy | undefined {
	if (!groupBy || !fields.has(groupBy.field)) return undefined;
	return {
		field: groupBy.field,
		direction: groupBy.direction === "desc" ? "desc" : "asc",
	};
}

function migrateLegacyImageViewerSettings(settings: IPluginSettings, saved: unknown): void {
	if (!settings.imageViewer || !isPlainObject(saved)) return;
	const savedViewer = saved.imageViewer;
	if (!isPlainObject(savedViewer) || "clickBehavior" in savedViewer) return;
	if (savedViewer.disableNativeImageViewer === true) {
		settings.imageViewer.clickBehavior = "disabled";
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
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
