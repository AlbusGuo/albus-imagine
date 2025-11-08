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
	/** 显示用的文件对象（对于AGX文件或自定义文件类型，这是对应的封面文件） */
	displayFile: TFile;
	/** 是否为AGX文件 */
	isAgx: boolean;
	/** 是否为自定义文件类型 */
	isCustomType: boolean;
	/** 自定义文件类型的配置（如果是自定义类型） */
	customTypeConfig?: CustomFileTypeConfig;
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
	/** 引用位置（行号） */
	position?: {
		start: { line: number; col: number };
		end: { line: number; col: number };
	};
}

/**
 * 自定义文件类型配置
 */
export interface CustomFileTypeConfig {
	/** 自定义文件的扩展名（如 "agx"） */
	fileExtension: string;
	/** 封面文件的扩展名（如 "svg", "png"） */
	coverExtension: string;
	/** 封面文件所在的文件夹（相对路径，空字符串表示同级目录） */
	coverFolder: string;
	/** 是否启用 */
	enabled: boolean;
}

/**
 * 文件打开方式
 */
export type FileOpenMode = "internal" | "external";

/**
 * 图片管理器设置
 */
export interface ImageManagerSettings {
	/** 默认文件夹路径 */
	folderPath?: string;
	/** 显示文件大小 */
	showFileSize?: boolean;
	/** 显示修改时间 */
	showModifiedTime?: boolean;
	/** 默认筛选未引用图片 */
	defaultFilterUnreferenced?: boolean;
	/** 删除前确认 */
	confirmDelete?: boolean;
	/** 自定义文件类型配置 */
	customFileTypes?: CustomFileTypeConfig[];
	/** 文件打开方式配置 - key是文件扩展名，value是打开方式 */
	fileOpenModes?: Record<string, FileOpenMode>;
}

/**
 * 排序字段
 */
export type SortField = "mtime" | "ctime" | "size" | "name" | "references";

/**
 * 排序顺序
 */
export type SortOrder = "asc" | "desc";

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
	"agx",
] as const;

export type ImageExtension = (typeof SUPPORTED_IMAGE_EXTENSIONS)[number];
