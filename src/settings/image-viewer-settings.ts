import { SettingDefinitionRender, SettingGroup } from 'obsidian';
import type { NativePluginSettingTab } from './NativePluginSettingTab';
import type CPlugin from '@src/main';
import type { ImageClickBehavior, ImageViewerSettings } from '../types/types';
import { createSettingDefinition, renderSettingDefinitions } from './setting-definitions';

function getViewerSettings(plugin: CPlugin): ImageViewerSettings {
	const settings = plugin.settings.imageViewer ?? {
		enabled: true,
		clickBehavior: 'obsidian',
	};
	plugin.settings.imageViewer = settings;
	return settings;
}

export function getImageViewerSettingDefinitions(plugin: CPlugin): SettingDefinitionRender[] {
	return [
		createSettingDefinition('启用 Ctrl+单击查看', '在所有位置启用 Imagine 的 Ctrl+单击图片查看功能', (setting) => {
			setting
			.addToggle((toggle) => {
				toggle
					.setValue(getViewerSettings(plugin).enabled)
					.onChange(async (value) => {
						const viewerSettings = getViewerSettings(plugin);
						viewerSettings.enabled = value;
						await plugin.saveSettings();
					});
			});
		}),
		createSettingDefinition('普通单击图片', '设置普通单击 Markdown 图片时使用的查看方式', (setting) => {
			setting
				.addDropdown((dropdown) => {
					dropdown
						.addOption('obsidian', 'Obsidian 查看器')
						.addOption('disabled', '不打开查看器')
						.addOption('imagine', 'Imagine 查看器')
						.setValue(getViewerSettings(plugin).clickBehavior)
						.onChange(async (value) => {
						const viewerSettings = getViewerSettings(plugin);
						viewerSettings.clickBehavior = value as ImageClickBehavior;
						await plugin.saveSettings();
					});
				});
		}),
	];
}

export function showImageViewerSettings(tab: NativePluginSettingTab): void {
	const group = new SettingGroup(tab.contentEl);
	renderSettingDefinitions(group, getImageViewerSettingDefinitions(tab.plugin));
}
