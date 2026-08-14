import { debounce, SettingDefinitionRender, SettingGroup } from 'obsidian';
import type { NativePluginSettingTab } from './NativePluginSettingTab';
import type CPlugin from '@src/main';
import { createSettingDefinition, renderSettingDefinitions } from './setting-definitions';

export function getCustomFileTypesSettingDefinitions(
	plugin: CPlugin,
	refresh: () => void,
): SettingDefinitionRender[] {
	const customTypes = plugin.settings.imageManager?.customFileTypes || [];
	const definitions: SettingDefinitionRender[] = [];

	if (customTypes.length === 0) {
		definitions.push(createSettingDefinition(
			'暂无自定义文件类型',
			'添加后可为非图片文件指定预览封面.',
			() => undefined,
		));
	} else {
		customTypes.forEach((type, index) => {
			definitions.push(createSettingDefinition('类型', '', (setting) => {
				setting
					.addText((text) => {
						text
							.setPlaceholder('文件扩展名 (如 PDF)')
							.setValue(type.fileExtension)
							.onChange(debounce(async (value) => {
								type.fileExtension = value;
								if (!plugin.settings.imageManager) {
									plugin.settings.imageManager = {};
								}
								plugin.settings.imageManager.customFileTypes = customTypes;
								await plugin.saveSettings();
							}, 500));
					})
					.addText((text) => {
						text
							.setPlaceholder('封面扩展名 (如 JPG)')
							.setValue(type.coverExtension)
							.onChange(debounce(async (value) => {
								type.coverExtension = value;
								if (!plugin.settings.imageManager) {
									plugin.settings.imageManager = {};
								}
								plugin.settings.imageManager.customFileTypes = customTypes;
								await plugin.saveSettings();
							}, 500));
					})
					.addText((text) => {
						text
							.setPlaceholder('封面文件夹 (可选)')
							.setValue(type.coverFolder || '')
							.onChange(debounce(async (value) => {
								type.coverFolder = value;
								if (!plugin.settings.imageManager) {
									plugin.settings.imageManager = {};
								}
								plugin.settings.imageManager.customFileTypes = customTypes;
								await plugin.saveSettings();
							}, 500));
					})
					.addExtraButton((btn) => {
						btn
							.setIcon('trash-2')
							.setTooltip('删除此类型')
							.onClick(async () => {
								customTypes.splice(index, 1);
								if (!plugin.settings.imageManager) {
									plugin.settings.imageManager = {};
								}
								plugin.settings.imageManager.customFileTypes = customTypes;
								await plugin.saveSettings();
								refresh();
							});
					});
			}));
		});
	}

	definitions.push(createSettingDefinition(
		'添加文件类型',
		'设置源文件扩展名, 封面扩展名和可选封面文件夹.',
		(setting) => {
		setting
			.addButton((button) => {
				button
					.setButtonText('添加')
					.setCta()
					.onClick(() => {
						customTypes.push({
							fileExtension: '',
							coverExtension: '',
							coverFolder: ''
						});
						refresh();
					});
			});
		},
	));

	return definitions;
}

export function showCustomFileTypesSettings(tab: NativePluginSettingTab): void {
	const group = new SettingGroup(tab.contentEl);
	renderSettingDefinitions(
		group,
		getCustomFileTypesSettingDefinitions(tab.plugin, () => tab.refresh()),
	);
}
