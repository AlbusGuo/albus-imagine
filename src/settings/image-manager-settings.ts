import { debounce, SettingDefinitionRender, SettingGroup } from 'obsidian';
import type { NativePluginSettingTab } from './NativePluginSettingTab';
import { SortField, SortOrder } from '../types/image-manager.types';
import type CPlugin from '@src/main';
import { createSettingDefinition, renderSettingDefinitions } from './setting-definitions';

export function getImageManagerSettingDefinitions(plugin: CPlugin): SettingDefinitionRender[] {
	return [
		createSettingDefinition('显示文件大小', '在图片卡片上显示文件大小信息', (setting) => {
			setting
			.addToggle((toggle) => {
				toggle
					.setValue(plugin.settings.imageManager?.showFileSize !== false)
					.onChange(async (value) => {
						if (!plugin.settings.imageManager) {
							plugin.settings.imageManager = {};
						}
						plugin.settings.imageManager.showFileSize = value;
						await plugin.saveSettings();
					});
			});
		}),
		createSettingDefinition('显示修改时间', '在图片卡片上显示最后修改时间', (setting) => {
			setting
			.addToggle((toggle) => {
				toggle
					.setValue(plugin.settings.imageManager?.showModifiedTime !== false)
					.onChange(async (value) => {
						if (!plugin.settings.imageManager) {
							plugin.settings.imageManager = {};
						}
						plugin.settings.imageManager.showModifiedTime = value;
						await plugin.saveSettings();
					});
			});
		}),
		createSettingDefinition('默认排序字段', '打开图片管理器时的默认排序方式', (setting) => {
			setting
			.addDropdown((dropdown) => {
				dropdown
					.addOption('mtime', '修改时间')
					.addOption('ctime', '创建时间')
					.addOption('size', '文件大小')
					.addOption('name', '文件名')
					.addOption('references', '引用数量')
					.setValue(plugin.settings.imageManager?.defaultSortField || 'mtime')
					.onChange(async (value) => {
						if (!plugin.settings.imageManager) {
							plugin.settings.imageManager = {};
						}
						plugin.settings.imageManager.defaultSortField = value as SortField;
						await plugin.saveSettings();
					});
			});
		}),
		createSettingDefinition('默认排序顺序', '打开图片管理器时的默认排序顺序', (setting) => {
			setting
			.addDropdown((dropdown) => {
				dropdown
					.addOption('desc', '降序')
					.addOption('asc', '升序')
					.setValue(plugin.settings.imageManager?.defaultSortOrder || 'desc')
					.onChange(async (value) => {
						if (!plugin.settings.imageManager) {
							plugin.settings.imageManager = {};
						}
						plugin.settings.imageManager.defaultSortOrder = value as SortOrder;
						await plugin.saveSettings();
					});
			});
		}),
		createSettingDefinition('排除文件夹', '在图片管理器中排除这些文件夹', (setting) => {
			setting
			.addTextArea((text) => {
				const excludedFolders = plugin.settings.imageManager?.excludedFolders || [];
				text
					.setPlaceholder('输入要排除的文件夹路径, 每行一个')
					.setValue(excludedFolders.join('\n'))
					.onChange(debounce(async (value) => {
						if (!plugin.settings.imageManager) {
							plugin.settings.imageManager = {};
						}
						const folders = value.split('\n')
							.map(line => line.trim())
							.filter(line => line.length > 0);
						plugin.settings.imageManager.excludedFolders = folders;
						await plugin.saveSettings();
					}, 500));
				text.inputEl.rows = 6;
				text.inputEl.addClass('afm-textarea-full-width');
			});
		}),
		createSettingDefinition('删除确认', '删除文件前显示确认对话框', (setting) => {
			setting
			.addToggle((toggle) => {
				toggle
					.setValue(plugin.settings.imageManager?.confirmDelete !== false)
					.onChange(async (value) => {
						if (!plugin.settings.imageManager) {
							plugin.settings.imageManager = {};
						}
						plugin.settings.imageManager.confirmDelete = value;
						await plugin.saveSettings();
					});
			});
		}),
		createSettingDefinition('深色模式下 SVG 图片反色', '在深色主题下对 SVG 图片进行反色处理, 使其更适配深色背景', (setting) => {
			setting
			.addToggle((toggle) => {
				toggle
					.setValue(plugin.settings.imageManager?.invertSvgInDarkMode !== false)
					.onChange(async (value) => {
						if (!plugin.settings.imageManager) {
							plugin.settings.imageManager = {};
						}
						plugin.settings.imageManager.invertSvgInDarkMode = value;
						await plugin.saveSettings();
					});
			});
		}),
	];
}

export function showImageManagerSettings(tab: NativePluginSettingTab): void {
	const group = new SettingGroup(tab.contentEl);
	renderSettingDefinitions(group, getImageManagerSettingDefinitions(tab.plugin));
}
