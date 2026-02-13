/**
 * 原生 Obsidian 设置界面
 * 使用 SettingGroup API 组织设置项
 * 参考 Note Toolbar 插件实现，保留标签页设计
 */

import CPlugin from "@src/main";
import { 
	PluginSettingTab, 
	Setting, 
	SettingGroup,
	debounce,
	Notice,
	setIcon
} from "obsidian";
import { CustomFileTypeConfig } from "@src/types/image-manager.types";

type SettingsTab = "IMAGE_MANAGER" | "IMAGE_RESIZE" | "IMAGE_VIEWER";

const TAB_LABELS: Record<SettingsTab, string> = {
	IMAGE_MANAGER: "图片管理器",
	IMAGE_RESIZE: "图片拖拽",
	IMAGE_VIEWER: "图片查看器",
};

export class NativePluginSettingTab extends PluginSettingTab {
	plugin: CPlugin;
	private lastScrollPosition: number = 0;
	private activeTab: SettingsTab = "IMAGE_MANAGER";

	constructor(plugin: CPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
		this.icon = 'image';
		// 恢复上次选择的标签页
		this.activeTab = this.plugin.settings.settingsTab || "IMAGE_MANAGER";
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('afm-settings-ui');

		// 渲染标签页导航
		this.renderTabs(containerEl);

		// 渲染当前标签页内容
		this.renderTabContent(containerEl);

		// 恢复滚动位置
		this.restoreScrollPosition();
	}

	hide() {
		// 保存滚动位置
		this.lastScrollPosition = this.containerEl.scrollTop;
	}

	private restoreScrollPosition() {
		if (this.lastScrollPosition > 0) {
			requestAnimationFrame(() => {
				this.containerEl.scrollTo({ top: this.lastScrollPosition, behavior: "auto" });
			});
		}
	}

	/**
	 * 渲染标签页导航
	 */
	private renderTabs(containerEl: HTMLElement): void {
		const tabsContainer = containerEl.createDiv('afm-settings-tabs');

		(Object.keys(TAB_LABELS) as SettingsTab[]).forEach((tab) => {
			const button = tabsContainer.createEl('button', {
				cls: `afm-settings-tab${this.activeTab === tab ? ' afm-settings-tab-selected' : ''}`,
				text: TAB_LABELS[tab]
			});

			button.addEventListener('click', () => {
				this.activeTab = tab;
				this.plugin.settings.settingsTab = tab;
				void this.plugin.saveSettings();
				this.display();
			});
		});
	}

	/**
	 * 渲染当前标签页内容
	 */
	private renderTabContent(containerEl: HTMLElement): void {
		const contentContainer = containerEl.createDiv('afm-settings-content');

		switch (this.activeTab) {
			case "IMAGE_MANAGER":
				this.displayImageManagerSettings(contentContainer);
				break;
			case "IMAGE_RESIZE":
				this.displayImageResizeSettings(contentContainer);
				break;
			case "IMAGE_VIEWER":
				this.displayImageViewerSettings(contentContainer);
				break;
		}
	}

	/**
	 * 图片管理器设置
	 */
	private displayImageManagerSettings(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl);

		// 显示文件大小
		group.addSetting((setting) => {
			setting
				.setName('显示文件大小')
				.setDesc('在图片卡片上显示文件大小信息')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.imageManager?.showFileSize !== false)
						.onChange(async (value) => {
							if (!this.plugin.settings.imageManager) {
								this.plugin.settings.imageManager = {};
							}
							this.plugin.settings.imageManager.showFileSize = value;
							await this.plugin.saveSettings();
						});
				});
		});

		// 显示修改时间
		group.addSetting((setting) => {
			setting
				.setName('显示修改时间')
				.setDesc('在图片卡片上显示最后修改时间')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.imageManager?.showModifiedTime !== false)
						.onChange(async (value) => {
							if (!this.plugin.settings.imageManager) {
								this.plugin.settings.imageManager = {};
							}
							this.plugin.settings.imageManager.showModifiedTime = value;
							await this.plugin.saveSettings();
						});
				});
		});

		// 默认排序字段
		group.addSetting((setting) => {
			setting
				.setName('默认排序字段')
				.setDesc('打开图片管理器时的默认排序方式')
				.addDropdown((dropdown) => {
					dropdown
						.addOption('mtime', '修改时间')
						.addOption('ctime', '创建时间')
						.addOption('size', '文件大小')
						.addOption('name', '文件名')
						.addOption('references', '引用数量')
						.setValue(this.plugin.settings.imageManager?.defaultSortField || 'mtime')
						.onChange(async (value) => {
							if (!this.plugin.settings.imageManager) {
								this.plugin.settings.imageManager = {};
							}
							this.plugin.settings.imageManager.defaultSortField = value as any;
							await this.plugin.saveSettings();
						});
				});
		});

		// 默认排序顺序
		group.addSetting((setting) => {
			setting
				.setName('默认排序顺序')
				.setDesc('打开图片管理器时的默认排序顺序')
				.addDropdown((dropdown) => {
					dropdown
						.addOption('desc', '降序')
						.addOption('asc', '升序')
						.setValue(this.plugin.settings.imageManager?.defaultSortOrder || 'desc')
						.onChange(async (value) => {
							if (!this.plugin.settings.imageManager) {
								this.plugin.settings.imageManager = {};
							}
							this.plugin.settings.imageManager.defaultSortOrder = value as any;
							await this.plugin.saveSettings();
						});
				});
		});

		// 排除文件夹
		group.addSetting((setting) => {
			setting
				.setName('排除文件夹')
				.setDesc('在图片管理器中排除这些文件夹')
				.addTextArea((text) => {
					const excludedFolders = this.plugin.settings.imageManager?.excludedFolders || [];
					text
						.setPlaceholder('输入要排除的文件夹路径, 每行一个')
						.setValue(excludedFolders.join('\n'))
						.onChange(debounce(async (value) => {
							if (!this.plugin.settings.imageManager) {
								this.plugin.settings.imageManager = {};
							}
							// 将文本分割成行，并过滤空行
							const folders = value.split('\n')
								.map(line => line.trim())
								.filter(line => line.length > 0);
							this.plugin.settings.imageManager.excludedFolders = folders;
							await this.plugin.saveSettings();
						}, 500));
					text.inputEl.rows = 6;
					text.inputEl.style.width = '100%';
				});
		});

		// 删除确认
		group.addSetting((setting) => {
			setting
				.setName('删除确认')
				.setDesc('删除文件前显示确认对话框')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.imageManager?.confirmDelete !== false)
						.onChange(async (value) => {
							if (!this.plugin.settings.imageManager) {
								this.plugin.settings.imageManager = {};
							}
							this.plugin.settings.imageManager.confirmDelete = value;
							await this.plugin.saveSettings();
						});
				});
		});

		// SVG图片反色处理
		group.addSetting((setting) => {
			setting
				.setName('深色模式下SVG图片反色')
				.setDesc('在深色主题下对SVG图片进行反色处理，使其更适配深色背景')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.imageManager?.invertSvgInDarkMode !== false)
						.onChange(async (value) => {
							if (!this.plugin.settings.imageManager) {
								this.plugin.settings.imageManager = {};
							}
							this.plugin.settings.imageManager.invertSvgInDarkMode = value;
							await this.plugin.saveSettings();
							// 更新CSS类
							this.updateSvgInvertClass();
						});
				});
		});

		// 自定义文件类型
		this.displayCustomFileTypes(containerEl);
	}

	/**
	 * 自定义文件类型设置
	 */
	private displayCustomFileTypes(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('自定义文件类型')
			.setHeading();

		const customTypes = this.plugin.settings.imageManager?.customFileTypes || [];

		// 使用 SettingGroup 包裹列表和添加按钮
		const group = new SettingGroup(containerEl);

		if (customTypes.length === 0) {
			group.addSetting((setting) => {
				setting.settingEl.addClass('afm-empty-message');
				setting.settingEl.createEl('p', { text: '暂无自定义文件类型' });
				setting.settingEl.createEl('p', { 
					text: '点击下方"添加文件类型"按钮开始创建',
					cls: 'afm-empty-hint'
				});
			});
		} else {
			customTypes.forEach((type, index) => {
				group.addSetting((setting) => {
					setting
						.setName('类型')
						.addText((text) => {
							text
								.setPlaceholder('文件扩展名 (如: pdf)')
								.setValue(type.fileExtension)
								.onChange(debounce(async (value) => {
									type.fileExtension = value;
									if (!this.plugin.settings.imageManager) {
										this.plugin.settings.imageManager = {};
									}
									this.plugin.settings.imageManager.customFileTypes = customTypes;
									await this.plugin.saveSettings();
								}, 500));
						})
						.addText((text) => {
							text
								.setPlaceholder('封面扩展名 (如: jpg)')
								.setValue(type.coverExtension)
								.onChange(debounce(async (value) => {
									type.coverExtension = value;
									if (!this.plugin.settings.imageManager) {
										this.plugin.settings.imageManager = {};
									}
									this.plugin.settings.imageManager.customFileTypes = customTypes;
									await this.plugin.saveSettings();
								}, 500));
						})
						.addText((text) => {
							text
								.setPlaceholder('封面文件夹 (可选)')
								.setValue(type.coverFolder || '')
								.onChange(debounce(async (value) => {
									type.coverFolder = value;
									if (!this.plugin.settings.imageManager) {
										this.plugin.settings.imageManager = {};
									}
									this.plugin.settings.imageManager.customFileTypes = customTypes;
									await this.plugin.saveSettings();
								}, 500));
						})
						.addExtraButton((btn) => {
							btn
								.setIcon('trash-2')
								.setTooltip('删除此类型')
								.onClick(async () => {
									customTypes.splice(index, 1);
									if (!this.plugin.settings.imageManager) {
										this.plugin.settings.imageManager = {};
									}
									this.plugin.settings.imageManager.customFileTypes = customTypes;
									await this.plugin.saveSettings();
									this.display();
								});
						});
				});
			});
		}

		// 添加按钮
		group.addSetting((setting) => {
			setting
				.setClass('afm-add-button')
				.addButton((btn) => {
					btn
						.setButtonText('添加文件类型')
						.setCta()
						.onClick(() => {
							customTypes.push({
								fileExtension: '',
								coverExtension: '',
								coverFolder: ''
							});
							this.display();
						});
				});
		});
	}

	/**
	 * 图片拖拽设置
	 */
	private displayImageResizeSettings(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl);

		// 启用一般图片拖拽调整
		group.addSetting((setting) => {
			setting
				.setName('启用 Callout 外图片拖拽调整大小')
				.setDesc('是否允许通过拖拽 Callout 外图片边缘来调整图片大小')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.imageResize?.dragResizeGeneral !== false)
						.onChange(async (value) => {
							if (!this.plugin.settings.imageResize) {
								this.plugin.settings.imageResize = {
									resizeInterval: 0,
									edgeSize: 20,
									dragResizeGeneral: true,
									dragResizeCallout: true
								};
							}
							this.plugin.settings.imageResize.dragResizeGeneral = value;
							await this.plugin.saveSettings();
						});
				});
		});

		// 启用 Callout 内图片拖拽调整
		group.addSetting((setting) => {
			setting
				.setName('启用 Callout 内图片拖拽调整大小')
				.setDesc('是否允许通过拖拽 Callout 内图片边缘来调整图片大小')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.imageResize?.dragResizeCallout !== false)
						.onChange(async (value) => {
							if (!this.plugin.settings.imageResize) {
								this.plugin.settings.imageResize = {
									resizeInterval: 0,
									edgeSize: 20,
									dragResizeGeneral: true,
									dragResizeCallout: true
								};
							}
							this.plugin.settings.imageResize.dragResizeCallout = value;
							await this.plugin.saveSettings();
						});
				});
		});

		// 调整间隔
		group.addSetting((setting) => {
			const currentValue = this.plugin.settings.imageResize?.resizeInterval || 0;
			setting
				.setName('调整大小的时间间隔')
				.setDesc(`拖动调整最小刻度（当前: ${currentValue} px，0 表示不对齐刻度）`)
				.addText((text) => {
					text
						.setPlaceholder('0')
						.setValue(currentValue.toString())
						.onChange(debounce(async (value) => {
							const numValue = parseInt(value);
							if (!isNaN(numValue) && numValue >= 0) {
								if (!this.plugin.settings.imageResize) {
									this.plugin.settings.imageResize = {
										resizeInterval: 0,
										edgeSize: 20,
										dragResizeGeneral: true,
										dragResizeCallout: true
									};
								}
								this.plugin.settings.imageResize.resizeInterval = numValue;
								await this.plugin.saveSettings();
								setting.setDesc(`拖动调整最小刻度（当前: ${numValue} px，0 表示不对齐刻度）`);
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
			const currentValue = this.plugin.settings.imageResize?.edgeSize || 20;
			setting
				.setName('边缘检测区域大小')
				.setDesc(`鼠标在图片边缘多少像素内可以触发调整大小（当前: ${currentValue} px）`)
				.addSlider((slider) => {
					slider
						.setLimits(5, 150, 1)
						.setValue(currentValue)
						.setDynamicTooltip()
						.onChange(debounce(async (value) => {
							if (!this.plugin.settings.imageResize) {
								this.plugin.settings.imageResize = {
									resizeInterval: 0,
									edgeSize: 20,
									dragResizeGeneral: true,
									dragResizeCallout: true
								};
							}
							this.plugin.settings.imageResize.edgeSize = value;
							await this.plugin.saveSettings();
							setting.setDesc(`鼠标在图片边缘多少像素内可以触发调整大小（当前: ${value} px）`);
						}, 100));
				});
		});
	}

	/**
	 * 图片查看器设置
	 */
	private displayImageViewerSettings(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl);

		// 启用查看器
		group.addSetting((setting) => {
			setting
				.setName('启用图片查看器')
				.setDesc('在所有位置启用 Ctrl+点击图片查看功能')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.imageViewer?.enabled !== false)
						.onChange(async (value) => {
							if (!this.plugin.settings.imageViewer) {
								this.plugin.settings.imageViewer = {
									enabled: true
								};
							}
							this.plugin.settings.imageViewer.enabled = value;
							await this.plugin.saveSettings();
						});
				});
		});
	}

	/**
	 * 更新SVG反色CSS类
	 */
	private updateSvgInvertClass(): void {
		const shouldInvert = this.plugin.settings.imageManager?.invertSvgInDarkMode !== false;
		if (shouldInvert) {
			document.body.removeClass('afm-no-svg-invert');
		} else {
			document.body.addClass('afm-no-svg-invert');
		}
	}
}
