import { debounce, SettingGroup } from 'obsidian';
import { NativePluginSettingTab } from './NativePluginSettingTab';

export function showCustomFileTypesSettings(tab: NativePluginSettingTab): void {
	const { contentEl, plugin } = tab;
	const customTypes = plugin.settings.imageManager?.customFileTypes || [];

	const group = new SettingGroup(contentEl);

	if (customTypes.length === 0) {
		group.addSetting((setting) => {
			setting
				.setName('暂无自定义文件类型')
				.setDesc('添加后可为非图片文件指定预览封面.');
		});
	} else {
		customTypes.forEach((type, index) => {
			group.addSetting((setting) => {
				setting
					.setName('类型')
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
								tab.display();
							});
					});
			});
		});
	}

	group.addSetting((setting) => {
		setting
			.setName('添加文件类型')
			.setDesc('设置源文件扩展名, 封面扩展名和可选封面文件夹.')
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
						tab.display();
					});
			});
	});
}
