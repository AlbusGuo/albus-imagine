import { SettingDefinitionRender, SettingGroup } from "obsidian";
import type { NativePluginSettingTab } from "./NativePluginSettingTab";
import type CPlugin from "@src/main";
import {
	createSettingDefinition,
	renderSettingDefinitions,
} from "./setting-definitions";
import { t } from "../i18n";

export function getImageViewerSettingDefinitions(
	plugin: CPlugin,
): SettingDefinitionRender[] {
	return [
		createSettingDefinition(
			t("settings.imageViewer.enabled"),
			t("settings.imageViewer.enabled.desc"),
			(setting) => {
				setting.addToggle((toggle) => {
					toggle
						.setValue(
							plugin.settings.imageViewer?.enabled !== false,
						)
						.onChange(async (value) => {
							const viewerSettings = plugin.settings
								.imageViewer ?? {
								enabled: true,
								disableNativeImageViewer: false,
							};
							viewerSettings.enabled = value;
							plugin.settings.imageViewer = viewerSettings;
							await plugin.saveSettings();
						});
				});
			},
		),
		createSettingDefinition(
			t("settings.imageViewer.disableNative"),
			t("settings.imageViewer.disableNative.desc"),
			(setting) => {
				setting.addToggle((toggle) => {
					toggle
						.setValue(
							plugin.settings.imageViewer
								?.disableNativeImageViewer === true,
						)
						.onChange(async (value) => {
							const viewerSettings = plugin.settings
								.imageViewer ?? {
								enabled: true,
								disableNativeImageViewer: false,
							};
							viewerSettings.disableNativeImageViewer = value;
							plugin.settings.imageViewer = viewerSettings;
							await plugin.saveSettings();
						});
				});
			},
		),
	];
}

export function showImageViewerSettings(tab: NativePluginSettingTab): void {
	const group = new SettingGroup(tab.contentEl);
	renderSettingDefinitions(
		group,
		getImageViewerSettingDefinitions(tab.plugin),
	);
}
