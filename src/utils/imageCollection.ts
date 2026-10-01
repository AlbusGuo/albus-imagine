import {
	ImageFilterGroup,
	ImageFilterPreset,
	ImageFilterRule,
	ImageItem,
	ImageSortRule,
	SortField,
	SortOrder,
} from "../types/image-manager.types";

interface ImageCollectionOptions {
	query: string;
	unreferencedOnly: boolean;
	filter?: ImageFilterPreset | null;
	sortField: SortField;
	sortOrder: SortOrder;
	sortRules?: readonly ImageSortRule[];
}

export function filterAndSortImages(images: readonly ImageItem[], options: ImageCollectionOptions): ImageItem[] {
	const tokens = tokenizeSearch(options.query);
	const filtered = images.filter((image) =>
		matchesSearch(image, tokens) &&
		(!options.unreferencedOnly || (image.references !== undefined && image.referenceCount === 0)) &&
		matchesPreset(image, options.filter),
	);
	const sortRules = options.sortRules?.length
		? options.sortRules
		: [{ field: options.sortField, order: options.sortOrder }];
	return filtered.sort((a, b) => {
		for (const rule of sortRules) {
			const comparison = compareField(a, b, rule.field);
			if (comparison !== 0) return rule.order === "asc" ? comparison : -comparison;
		}
		return a.path.localeCompare(b.path);
	});
}

function compareField(a: ImageItem, b: ImageItem, field: ImageSortRule["field"]): number {
	switch (field) {
		case "mtime": return a.stat.mtime - b.stat.mtime;
		case "ctime": return a.stat.ctime - b.stat.ctime;
		case "size": return a.stat.size - b.stat.size;
		case "name": return a.name.localeCompare(b.name);
		case "references": return (a.referenceCount ?? 0) - (b.referenceCount ?? 0);
	}
}

function tokenizeSearch(query: string): string[] {
	return query
		.trim()
		.toLowerCase()
		.split(/[\s,.;:!?/\\()[\]{}]+/)
		.filter(Boolean);
}

function matchesSearch(image: ImageItem, tokens: readonly string[]): boolean {
	if (tokens.length === 0) return true;
	const values = [
		image.name,
		image.path,
		image.originalFile.extension,
		image.isCustomType ? "自定义类型 custom" : "图片 image",
	].map((value) => value.toLowerCase());
	return tokens.every((token) => values.some((value) => value.includes(token)));
}

function matchesPreset(image: ImageItem, preset?: ImageFilterPreset | null): boolean {
	if (!preset) return true;
	const filter = preset.filter ?? {
		id: `${preset.id}-filter`,
		match: preset.match ?? "all",
		children: preset.rules ?? [],
	};
	return matchesGroup(image, filter);
}

function matchesGroup(image: ImageItem, group: ImageFilterGroup): boolean {
	return evaluateGroup(image, group) ?? true;
}

function evaluateGroup(image: ImageItem, group: ImageFilterGroup): boolean | null {
	const results = group.children.flatMap((child): boolean[] => {
		if (!("children" in child)) return [matchesRule(image, child)];
		const result = evaluateGroup(image, child);
		return result === null ? [] : [result];
	});
	if (results.length === 0) return null;
	if (group.match === "any") return results.some(Boolean);
	if (group.match === "none") return results.every((result) => !result);
	return results.every(Boolean);
}

function matchesRule(image: ImageItem, rule: ImageFilterRule): boolean {
	if (rule.field === "references") {
		if (image.references === undefined) return false;
		const referenced = (image.referenceCount ?? 0) > 0;
		const expected = rule.value === "referenced";
		return rule.operator === "is-not" ? referenced !== expected : referenced === expected;
	}
	if (rule.field === "size") {
		return compareNumber(image.stat.size, parseSize(rule.value), rule.operator);
	}
	if (rule.field === "ctime" || rule.field === "mtime") {
		const expected = new Date(rule.value).getTime();
		if (!Number.isFinite(expected)) return true;
		return compareNumber(image.stat[rule.field], expected, rule.operator);
	}
	const folder = image.path.includes("/") ? image.path.slice(0, image.path.lastIndexOf("/")) : "";
	const actual = rule.field === "folder"
		? folder
		: rule.field === "extension"
			? image.originalFile.extension
			: image.name;
	return compareText(actual, rule.value, rule.operator);
}

function compareText(actualValue: string, expectedValue: string, operator: ImageFilterRule["operator"]): boolean {
	const actual = actualValue.toLowerCase();
	const expected = expectedValue.trim().toLowerCase();
	if (!expected) return true;
	switch (operator) {
		case "is": return actual === expected;
		case "is-not": return actual !== expected;
		case "not-contains": return !actual.includes(expected);
		case "starts-with": return actual.startsWith(expected);
		case "ends-with": return actual.endsWith(expected);
		default: return actual.includes(expected);
	}
}

function compareNumber(actual: number, expected: number, operator: ImageFilterRule["operator"]): boolean {
	if (!Number.isFinite(expected)) return true;
	switch (operator) {
		case "greater-than":
		case "after": return actual > expected;
		case "less-than":
		case "before": return actual < expected;
		case "is-not": return actual !== expected;
		default: return actual === expected;
	}
}

function parseSize(value: string): number {
	const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
	if (!match) return Number.NaN;
	const amount = Number(match[1]);
	const unit = (match[2] ?? "b").toLowerCase();
	const multiplier = unit === "gb" ? 1024 ** 3 : unit === "mb" ? 1024 ** 2 : unit === "kb" ? 1024 : 1;
	return amount * multiplier;
}
