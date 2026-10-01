import { debounce, SettingDefinitionRender, SettingGroup } from "obsidian";
import type { NativePluginSettingTab } from "./NativePluginSettingTab";
import { SortField, SortOrder } from "../types/image-manager.types";
import type CPlugin from "@src/main";
import {
	createSettingDefinition,
	renderSettingDefinitions,
} from "./setting-definitions";
import { t } from "../i18n";

export function getImageManagerSettingDefinitions(
	plugin: CPlugin,
): SettingDefinitionRender[] {
	return [
		createSettingDefinition(
			t("settings.imageManager.showFileSize"),
			t("settings.imageManager.showFileSize.desc"),
			(setting) => {
				setting.addToggle((toggle) => {
					toggle
						.setValue(
							plugin.settings.imageManager?.showFileSize !==
								false,
						)
						.onChange(async (value) => {
							if (!plugin.settings.imageManager) {
								plugin.settings.imageManager = {};
							}
							plugin.settings.imageManager.showFileSize = value;
							await plugin.saveSettings();
						});
				});
			},
		),
		createSettingDefinition(
			t("settings.imageManager.showModifiedTime"),
			t("settings.imageManager.showModifiedTime.desc"),
			(setting) => {
				setting.addToggle((toggle) => {
					toggle
						.setValue(
							plugin.settings.imageManager?.showModifiedTime !==
								false,
						)
						.onChange(async (value) => {
							if (!plugin.settings.imageManager) {
								plugin.settings.imageManager = {};
							}
							plugin.settings.imageManager.showModifiedTime =
								value;
							await plugin.saveSettings();
						});
				});
			},
		),
		createSettingDefinition(
			t("settings.imageManager.defaultSortField"),
			t("settings.imageManager.defaultSortField.desc"),
			(setting) => {
				setting.addDropdown((dropdown) => {
					dropdown
						.addOption("mtime", t("sort.field.mtime"))
						.addOption("ctime", t("sort.field.ctime"))
						.addOption("size", t("sort.field.size"))
						.addOption("name", t("sort.field.name"))
						.addOption("references", t("sort.field.references"))
						.setValue(
							plugin.settings.imageManager?.defaultSortField ||
								"mtime",
						)
						.onChange(async (value) => {
							if (!plugin.settings.imageManager) {
								plugin.settings.imageManager = {};
							}
							plugin.settings.imageManager.defaultSortField =
								value as SortField;
							await plugin.saveSettings();
						});
				});
			},
		),
		createSettingDefinition(
			t("settings.imageManager.defaultSortOrder"),
			t("settings.imageManager.defaultSortOrder.desc"),
			(setting) => {
				setting.addDropdown((dropdown) => {
					dropdown
						.addOption("desc", t("sort.order.desc"))
						.addOption("asc", t("sort.order.asc"))
						.setValue(
							plugin.settings.imageManager?.defaultSortOrder ||
								"desc",
						)
						.onChange(async (value) => {
							if (!plugin.settings.imageManager) {
								plugin.settings.imageManager = {};
							}
							plugin.settings.imageManager.defaultSortOrder =
								value as SortOrder;
							await plugin.saveSettings();
						});
				});
			},
		),
		createSettingDefinition(
			t("settings.imageManager.excludedFolders"),
			t("settings.imageManager.excludedFolders.desc"),
			(setting) => {
				setting.addTextArea((text) => {
					const excludedFolders =
						plugin.settings.imageManager?.excludedFolders || [];
					text.setPlaceholder(
						t("settings.imageManager.excludedFolders.placeholder"),
					)
						.setValue(excludedFolders.join("\n"))
						.onChange(
							debounce(async (value) => {
								if (!plugin.settings.imageManager) {
									plugin.settings.imageManager = {};
								}
								const folders = value
									.split("\n")
									.map((line) => line.trim())
									.filter((line) => line.length > 0);
								plugin.settings.imageManager.excludedFolders =
									folders;
								await plugin.saveSettings();
							}, 500),
						);
					text.inputEl.rows = 6;
					text.inputEl.addClass("afm-textarea-full-width");
				});
			},
		),
		createSettingDefinition(
			t("settings.imageManager.confirmDelete"),
			t("settings.imageManager.confirmDelete.desc"),
			(setting) => {
				setting.addToggle((toggle) => {
					toggle
						.setValue(
							plugin.settings.imageManager?.confirmDelete !==
								false,
						)
						.onChange(async (value) => {
							if (!plugin.settings.imageManager) {
								plugin.settings.imageManager = {};
							}
							plugin.settings.imageManager.confirmDelete = value;
							await plugin.saveSettings();
						});
				});
			},
		),
		createSettingDefinition(
			t("settings.imageManager.invertSvgInDarkMode"),
			t("settings.imageManager.invertSvgInDarkMode.desc"),
			(setting) => {
				setting.addToggle((toggle) => {
					toggle
						.setValue(
							plugin.settings.imageManager
								?.invertSvgInDarkMode !== false,
						)
						.onChange(async (value) => {
							if (!plugin.settings.imageManager) {
								plugin.settings.imageManager = {};
							}
							plugin.settings.imageManager.invertSvgInDarkMode =
								value;
							await plugin.saveSettings();
						});
				});
			},
		),
	];
}

export function showImageManagerSettings(tab: NativePluginSettingTab): void {
	const group = new SettingGroup(tab.contentEl);
	renderSettingDefinitions(
		group,
		getImageManagerSettingDefinitions(tab.plugin),
	);
}
