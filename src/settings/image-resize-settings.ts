import { debounce, Notice, SettingGroup } from 'obsidian';
import { NativePluginSettingTab } from './NativePluginSettingTab';

export function showImageResizeSettings(tab: NativePluginSettingTab): void {
	const { contentEl, plugin } = tab;
	const group = new SettingGroup(contentEl);

	// 启用一般图片拖拽调整
	group.addSetting((setting) => {
		setting
			.setName('启用 callout 外图片拖拽调整大小')
			.setDesc('是否允许通过拖拽 callout 外图片边缘来调整图片大小')
			.addToggle((toggle) => {
				toggle
					.setValue(plugin.settings.imageResize?.dragResizeGeneral !== false)
					.onChange(async (value) => {
						if (!plugin.settings.imageResize) {
							plugin.settings.imageResize = {
								resizeInterval: 0,
								edgeSize: 20,
								dragResizeGeneral: true,
								dragResizeCallout: true
							};
						}
						plugin.settings.imageResize.dragResizeGeneral = value;
						await plugin.saveSettings();
					});
			});
	});

	// 启用 Callout 内图片拖拽调整
	group.addSetting((setting) => {
		setting
			.setName('启用 callout 内图片拖拽调整大小')
			.setDesc('是否允许通过拖拽 callout 内图片边缘来调整图片大小')
			.addToggle((toggle) => {
				toggle
					.setValue(plugin.settings.imageResize?.dragResizeCallout !== false)
					.onChange(async (value) => {
						if (!plugin.settings.imageResize) {
							plugin.settings.imageResize = {
								resizeInterval: 0,
								edgeSize: 20,
								dragResizeGeneral: true,
								dragResizeCallout: true
							};
						}
						plugin.settings.imageResize.dragResizeCallout = value;
						await plugin.saveSettings();
					});
			});
	});

	// 调整间隔
	group.addSetting((setting) => {
		const currentValue = plugin.settings.imageResize?.resizeInterval || 0;
		setting
			.setName('调整大小的时间间隔')
			.setDesc('拖动调整最小刻度, 0 表示不对齐刻度')
			.addText((text) => {
				text
					.setPlaceholder('0')
					.setValue(currentValue.toString())
					.onChange(debounce(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue >= 0) {
							if (!plugin.settings.imageResize) {
								plugin.settings.imageResize = {
									resizeInterval: 0,
									edgeSize: 20,
									dragResizeGeneral: true,
									dragResizeCallout: true
								};
							}
							plugin.settings.imageResize.resizeInterval = numValue;
							await plugin.saveSettings();
						} else {
							new Notice('请输入非负整数');
						}
					}, 500));
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.step = '1';
			});
	});

	// 边缘检测区域
	group.addSetting((setting) => {
		const currentValue = plugin.settings.imageResize?.edgeSize || 20;
		setting
			.setName('边缘检测区域大小')
			.setDesc('鼠标在图片边缘多少像素内可以触发调整大小')
			.addSlider((slider) => {
				slider
					.setLimits(5, 150, 1)
					.setValue(currentValue)
					.setDynamicTooltip()
					.onChange(debounce(async (value) => {
						if (!plugin.settings.imageResize) {
							plugin.settings.imageResize = {
								resizeInterval: 0,
								edgeSize: 20,
								dragResizeGeneral: true,
								dragResizeCallout: true
							};
						}
						plugin.settings.imageResize.edgeSize = value;
						await plugin.saveSettings();
					}, 100));
			});
	});
}
