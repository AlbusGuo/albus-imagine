/**
 * 图片管理器相关类型定义
 */

import { TFile } from "obsidian";

/**
 * 图片文件项
 */
export interface ImageItem {
	/** 文件名 */
	name: string;
	/** 文件路径 */
	path: string;
	/** 原始文件对象 */
	originalFile: TFile;
	/** 显示用的文件对象 (对于自定义文件类型, 这是对应的封面文件) */
	displayFile: TFile;
	/** 是否为自定义文件类型 */
	isCustomType: boolean;
	/** 自定义文件类型的配置 (如果是自定义类型) */
	customTypeConfig?: CustomFileTypeConfig;
	/** 封面文件是否缺失 (仅对自定义类型有效) */
	coverMissing?: boolean;
	/** 文件统计信息 */
	stat: {
		ctime: number;
		mtime: number;
		size: number;
	};
	/** 引用信息 */
	references?: ReferenceInfo[];
	/** 引用计数 */
	referenceCount?: number;
}

/**
 * 引用信息
 */
export interface ReferenceInfo {
	/** 引用文件 */
	file: TFile;
	/** 引用类型 */
	type: "link" | "embed";
	/** 引用位置 (行号) */
	position?: {
		start: { line: number; col: number; };
		end: { line: number; col: number; };
	};
}

/**
 * 自定义文件类型配置
 */
export interface CustomFileTypeConfig {
	/** 自定义文件的扩展名 */
	fileExtension: string;
	/** 封面文件的扩展名 (如 "svg","png") */
	coverExtension: string;
	/** 源文件的打开方式; 旧配置默认使用系统应用 */
	openMode?: "obsidian" | "system";
}

/**
 * 图片管理器设置
 */
export interface ImageManagerSettings {
	/** 默认文件夹路径 */
	folderPath?: string;
	/** 上次选择的文件夹路径 (自动记录) */
	lastSelectedFolder?: string;
	/** 深色模式下 SVG 图片反色处理 */
	invertSvgInDarkMode?: boolean;
	/** 自定义文件类型配置 */
	customFileTypes?: CustomFileTypeConfig[];
	/** 用户保存的附件视图 */
	filterPresets?: ImageFilterPreset[];
	/** 上次启用的视图 */
	activeFilterId?: string;
	/** 旧版“全部”视图是否已迁移为普通视图 */
	viewsMigrated?: boolean;
	/** “全部”视图显示的属性 */
	allViewProperties?: ImageCardProperty[];
	/** “全部”视图排序规则 */
	allViewSort?: ImageSortRule[];
	/** “全部”视图的筛选组合方式 */
	allViewFilterMatch?: ImageFilterMatch;
	/** “全部”视图的筛选条件 */
	allViewFilterRules?: ImageFilterRule[];
	/** “全部”视图是否仅显示未引用附件 */
	allViewUnreferencedOnly?: boolean;
}

/**
 * 排序字段
 */
export type SortField = "mtime" | "ctime" | "size" | "name" | "extension" | "references";

/**
 * 排序顺序
 */
export type SortOrder = "asc" | "desc";

export interface ImageSortRule {
	field: SortField;
	order: SortOrder;
}

export type ImageGroupField = "extension" | "folder" | "references" | "size";

export interface ImageGroupBy {
	field: ImageGroupField;
	direction: SortOrder;
}

export type ImageCardProperty =
	| "name"
	| "extension"
	| "size"
	| "mtime"
	| "ctime"
	| "folder"
	| "references";

export type ImageManagerLayout = "grid" | "masonry";

export const IMAGE_CARD_PROPERTY_ORDER: readonly ImageCardProperty[] = [
	"name",
	"extension",
	"references",
	"size",
	"ctime",
	"mtime",
	"folder",
];

export type ImageFilterMatch = "all" | "any" | "none";

export type ImageFilterField =
	| "name"
	| "folder"
	| "extension"
	| "references"
	| "size"
	| "ctime"
	| "mtime";

export type ImageFilterOperator =
	| "is"
	| "is-not"
	| "contains"
	| "not-contains"
	| "starts-with"
	| "ends-with"
	| "greater-than"
	| "less-than"
	| "before"
	| "after";

export interface ImageFilterRule {
	id: string;
	field: ImageFilterField;
	operator: ImageFilterOperator;
	value: string;
}

export interface ImageFilterGroup {
	id: string;
	match: ImageFilterMatch;
	children: Array<ImageFilterGroup | ImageFilterRule>;
}

export interface ImageFilterPreset {
	id: string;
	name: string;
	/** 视图标签图标 ID */
	icon?: string;
	/** 卡片最小宽度, 与 Bases 卡片大小参数一致 */
	cardSize?: number;
	/** 当前视图是否在深色模式下反转 SVG */
	invertSvgInDarkMode?: boolean;
	/** 当前视图使用的文件扩展名映射 */
	mappings?: CustomFileTypeConfig[];
	/** 卡片布局 */
	layout?: ImageManagerLayout;
	/** 递归筛选器树 */
	filter?: ImageFilterGroup;
	/** 旧版扁平筛选组合方式, 仅用于迁移 */
	match?: ImageFilterMatch;
	/** 旧版扁平筛选条件, 仅用于迁移 */
	rules?: ImageFilterRule[];
	properties?: ImageCardProperty[];
	sort?: ImageSortRule[];
	groupBy?: ImageGroupBy;
	/** Presence selects manual mode; only listed group keys are visible. */
	groupOrder?: string[];
	/** Collapsed group keys for this view. */
	collapsedGroups?: string[];
	unreferencedOnly?: boolean;
}

/**
 * 引用检查结果
 */
export interface ReferenceCheckResult {
	references: ReferenceInfo[];
	referenceCount: number;
}

/**
 * 支持的图片格式
 */
export const SUPPORTED_IMAGE_EXTENSIONS = [
	"png",
	"jpg",
	"jpeg",
	"gif",
	"bmp",
	"webp",
	"svg",
	"ico",
	"tif",
	"tiff",
	"avif",
	"heic",
	"heif",
] as const;

export type ImageExtension = (typeof SUPPORTED_IMAGE_EXTENSIONS)[number];
