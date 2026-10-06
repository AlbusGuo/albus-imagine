import { ImageGroupBy, ImageGroupField, ImageItem } from "../types/image-manager.types";

export interface ImageGroup {
	key: string;
	label: string;
	items: ImageItem[];
}

export const IMAGE_GROUP_FIELDS: ReadonlyArray<readonly [ImageGroupField, string]> = [
	["extension", "扩展名"],
	["folder", "文件夹"],
	["references", "引用数量"],
	["size", "文件大小"],
];

export function getGroupFieldLabel(field: ImageGroupField): string {
	return IMAGE_GROUP_FIELDS.find(([candidate]) => candidate === field)?.[1] ?? field;
}

function getGroupKey(image: ImageItem, field: ImageGroupField): string {
	switch (field) {
		case "folder": return image.originalFile.parent?.path ?? (image.path.includes("/") ? image.path.slice(0, image.path.lastIndexOf("/")) : "");
		case "extension": return image.originalFile.extension.toLowerCase();
		case "references": return image.references === undefined ? "" : String(image.referenceCount ?? 0);
		case "size": return String(image.stat.size);
	}
}

export function formatGroupLabel(key: string): string {
	return key || "无";
}

export function collectImageGroups(images: readonly ImageItem[], field: ImageGroupField): ImageGroup[] {
	const byKey = new Map<string, ImageGroup>();
	for (const image of images) {
		const key = getGroupKey(image, field);
		let group = byKey.get(key);
		if (!group) {
			group = { key, label: formatGroupLabel(key), items: [] };
			byKey.set(key, group);
		}
		group.items.push(image);
	}
	return Array.from(byKey.values()).sort((left, right) => compareGroupKeys(left.key, right.key, field));
}

export function orderImageGroups(
	groups: readonly ImageGroup[],
	groupBy: ImageGroupBy,
	groupOrder?: readonly string[],
): ImageGroup[] {
	if (groupOrder !== undefined) {
		const byKey = new Map(groups.map((group) => [group.key, group]));
		return groupOrder.flatMap((key) => {
			const group = byKey.get(key);
			return group && group.items.length > 0 ? [group] : [];
		});
	}
	if (groupBy.direction === "desc") {
		return [...groups.filter((group) => group.key)].reverse().concat(groups.filter((group) => !group.key));
	}
	return [...groups];
}

function compareGroupKeys(left: string, right: string, field: ImageGroupField): number {
	if (!left || !right) return !left && !right ? 0 : !left ? 1 : -1;
	if (field === "references" || field === "size") {
		return Number(left) - Number(right);
	}
	return left.localeCompare(right, "zh-CN", { numeric: true, sensitivity: "base" });
}
