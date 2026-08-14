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
						const viewerSettings = plugin.settings.imageViewer ?? {
							enabled: true,
							disableNativeImageViewer: false,
						};
						viewerSettings.enabled = value;
						plugin.settings.imageViewer = viewerSettings;
						await plugin.saveSettings();
					});
			});
	});

	group.addSetting((setting) => {
		setting
			.setName('禁用内置点击查看图片')
			.setDesc('阻止内置图片灯箱响应普通点击, 不影响右键菜单, 拖拽缩放或本插件的快捷查看')
			.addToggle((toggle) => {
				toggle
					.setValue(plugin.settings.imageViewer?.disableNativeImageViewer === true)
					.onChange(async (value) => {
						const viewerSettings = plugin.settings.imageViewer ?? {
							enabled: true,
							disableNativeImageViewer: false,
						};
						viewerSettings.disableNativeImageViewer = value;
						plugin.settings.imageViewer = viewerSettings;
						await plugin.saveSettings();
					});
			});
	});
}
