import { Setting, SettingGroup, debounce } from 'obsidian';
import { NativePluginSettingTab } from './NativePluginSettingTab';

export function showCustomFileTypesSettings(tab: NativePluginSettingTab): void {
	const { contentEl, plugin } = tab;
	const customTypes = plugin.settings.imageManager?.customFileTypes || [];

	// 外层卡片容器（与参考插件 .basic-vault-button-group 结构一致）
	const groupEl = contentEl.createDiv('afm-custom-type-group');

	// 列表区域
	const listContainer = groupEl.createDiv('afm-custom-type-list-container');

	if (customTypes.length === 0) {
		new Setting(listContainer)
			.setName('暂无自定义文件类型')
			.setDesc('点击下方按钮开始创建');
	} else {
		const group = new SettingGroup(listContainer);
		customTypes.forEach((type, index) => {
			group.addSetting((setting) => {
				setting
					.setName('类型')
					.addText((text) => {
						text
							.setPlaceholder('文件扩展名（如 PDF）')
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
							.setPlaceholder('封面扩展名（如 JPG）')
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

	// 添加按钮（与参考插件完全一致的原生 DOM 结构）
	const addContainer = groupEl.createDiv('afm-add-container');
	const addBtn = addContainer.createEl('button', {
		text: '添加文件类型',
		cls: 'afm-add-btn',
	});
	addBtn.addEventListener('click', () => {
		customTypes.push({
			fileExtension: '',
			coverExtension: '',
			coverFolder: ''
		});
		tab.display();
	});
}
