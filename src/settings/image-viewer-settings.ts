import { SettingGroup } from 'obsidian';
import { NativePluginSettingTab } from './NativePluginSettingTab';

export function showImageViewerSettings(tab: NativePluginSettingTab): void {
	const { contentEl, plugin } = tab;
	const group = new SettingGroup(contentEl);

	// 启用查看器
	group.addSetting((setting) => {
		setting
			.setName('启用图片查看器')
			.setDesc('在所有位置启用 Ctrl+Click 查看图片功能')
			.addToggle((toggle) => {
				toggle
					.setValue(plugin.settings.imageViewer?.enabled !== false)
					.onChange(async (value) => {
						if (!plugin.settings.imageViewer) {
							plugin.settings.imageViewer = {
								enabled: true
							};
						}
						plugin.settings.imageViewer.enabled = value;
						await plugin.saveSettings();
					});
			});
	});
}
