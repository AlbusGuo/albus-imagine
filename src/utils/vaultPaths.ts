import { normalizePath } from "obsidian";
import { CustomFileTypeConfig } from "../types/image-manager.types";

export function normalizeExtension(extension: string): string {
	return extension.trim().replace(/^\.+/, "").toLowerCase();
}

export function normalizeVaultFolder(folder: string): string {
	const trimmed = folder.trim();
	return trimmed ? normalizePath(trimmed) : "";
}

export function joinVaultPath(...parts: string[]): string {
	const path = parts.filter(Boolean).join("/");
	return path ? normalizePath(path) : "";
}

export function getCoverPath(filePath: string, config: CustomFileTypeConfig): string {
	const normalizedFilePath = normalizePath(filePath);
	const separatorIndex = normalizedFilePath.lastIndexOf("/");
	const directory = separatorIndex >= 0 ? normalizedFilePath.slice(0, separatorIndex) : "";
	const fileName = separatorIndex >= 0 ? normalizedFilePath.slice(separatorIndex + 1) : normalizedFilePath;
	const extensionIndex = fileName.lastIndexOf(".");
	const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
	const configuredFolder = normalizeVaultFolder(config.coverFolder || "");
	const coverDirectory = config.coverFolder.trim().startsWith("/")
		? configuredFolder
		: joinVaultPath(directory, configuredFolder);
	return joinVaultPath(coverDirectory, `${baseName}.${normalizeExtension(config.coverExtension)}`);
}
