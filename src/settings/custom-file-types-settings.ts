import { Setting, SettingGroup } from "obsidian";
import type { NativePluginSettingTab } from "./NativePluginSettingTab";
import { CustomFileTypeConfig } from "../types/image-manager.types";
import { normalizeExtension } from "../utils/vaultPaths";
import { CustomFileTypeModal } from "./CustomFileTypeModal";

export function showCustomFileTypesSettings(tab: NativePluginSettingTab): void {
	const customTypes = getCustomTypes(tab);
	const heading = new Setting(tab.contentEl)
		.setName("自定义文件类型")
		.setHeading();
	heading.addExtraButton((button) => button
		.setIcon("plus")
		.setTooltip("添加文件类型")
		.onClick(() => openEditor(tab, null)));

	const group = new SettingGroup(tab.contentEl);
	if (customTypes.length === 0) {
		group.addSetting((setting) => {
			setting
				.setName("暂无自定义文件类型")
				.setDesc("点击标题右侧的加号添加文件类型");
		});
		return;
	}

	customTypes.forEach((config, index) => {
		group.addSetting((setting) => {
			setting.settingEl.addClass("afm-custom-file-type-setting");
			setting
				.setName(config.fileExtension.toUpperCase())
				.setDesc(getConfigSummary(config))
				.addExtraButton((button) => button
					.setIcon("pencil")
					.setTooltip("编辑文件类型")
					.onClick(() => openEditor(tab, index)))
				.addExtraButton((button) => button
					.setIcon("trash")
					.setTooltip("删除文件类型")
					.onClick(() => void removeConfig(tab, index)));
		});
	});
}

function getCustomTypes(tab: NativePluginSettingTab): CustomFileTypeConfig[] {
	if (!tab.plugin.settings.imageManager) tab.plugin.settings.imageManager = {};
	if (!tab.plugin.settings.imageManager.customFileTypes) {
		tab.plugin.settings.imageManager.customFileTypes = [];
	}
	return tab.plugin.settings.imageManager.customFileTypes;
}

function openEditor(tab: NativePluginSettingTab, index: number | null): void {
	const customTypes = getCustomTypes(tab);
	const config = index === null ? null : customTypes[index] ?? null;
	if (index !== null && !config) return;
	let targetIndex = index;
	const reservedExtensions = new Set(
		customTypes
			.filter((_item, itemIndex) => itemIndex !== index)
			.map((item) => normalizeExtension(item.fileExtension))
			.filter(Boolean),
	);

	new CustomFileTypeModal(tab.plugin.app, config, {
		reservedExtensions,
		onChange: async (savedConfig) => {
			const latestTypes = getCustomTypes(tab);
			if (targetIndex === null) {
				latestTypes.push(savedConfig);
				targetIndex = latestTypes.length - 1;
			} else if (latestTypes[targetIndex]) {
				latestTypes[targetIndex] = savedConfig;
			}
			await tab.plugin.saveSettings();
			tab.refresh();
		},
		onClose: () => tab.refresh(),
	}).open();
}

async function removeConfig(tab: NativePluginSettingTab, index: number): Promise<void> {
	const customTypes = getCustomTypes(tab);
	if (!customTypes[index]) return;
	customTypes.splice(index, 1);
	await tab.plugin.saveSettings();
	tab.refresh();
}

function getConfigSummary(config: CustomFileTypeConfig): string {
	const folder = config.coverFolder || "与源文件同级";
	return `封面扩展名: ${config.coverExtension.toUpperCase()}; 文件夹: ${folder}`;
}
