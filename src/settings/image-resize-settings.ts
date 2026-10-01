import {
	debounce,
	Notice,
	SettingDefinitionRender,
	SettingGroup,
} from "obsidian";
import type { NativePluginSettingTab } from "./NativePluginSettingTab";
import type CPlugin from "@src/main";
import {
	createSettingDefinition,
	renderSettingDefinitions,
} from "./setting-definitions";
import { t } from "../i18n";

export function getImageResizeSettingDefinitions(
	plugin: CPlugin,
): SettingDefinitionRender[] {
	return [
		createSettingDefinition(
			t("settings.imageResize.dragResizeGeneral"),
			t("settings.imageResize.dragResizeGeneral.desc"),
			(setting) => {
				setting.addToggle((toggle) => {
					toggle
						.setValue(
							plugin.settings.imageResize?.dragResizeGeneral !==
								false,
						)
						.onChange(async (value) => {
							if (!plugin.settings.imageResize) {
								plugin.settings.imageResize = {
									resizeInterval: 0,
									edgeSize: 20,
									dragResizeGeneral: true,
									dragResizeCallout: true,
								};
							}
							plugin.settings.imageResize.dragResizeGeneral =
								value;
							await plugin.saveSettings();
						});
				});
			},
		),
		createSettingDefinition(
			t("settings.imageResize.dragResizeCallout"),
			t("settings.imageResize.dragResizeCallout.desc"),
			(setting) => {
				setting.addToggle((toggle) => {
					toggle
						.setValue(
							plugin.settings.imageResize?.dragResizeCallout !==
								false,
						)
						.onChange(async (value) => {
							if (!plugin.settings.imageResize) {
								plugin.settings.imageResize = {
									resizeInterval: 0,
									edgeSize: 20,
									dragResizeGeneral: true,
									dragResizeCallout: true,
								};
							}
							plugin.settings.imageResize.dragResizeCallout =
								value;
							await plugin.saveSettings();
						});
				});
			},
		),
		createSettingDefinition(
			t("settings.imageResize.resizeInterval"),
			t("settings.imageResize.resizeInterval.desc"),
			(setting) => {
				const currentValue =
					plugin.settings.imageResize?.resizeInterval || 0;
				setting.addText((text) => {
					text.setPlaceholder(
						t("settings.imageResize.resizeInterval.placeholder"),
					)
						.setValue(currentValue.toString())
						.onChange(
							debounce(async (value) => {
								const numValue = parseInt(value);
								if (!isNaN(numValue) && numValue >= 0) {
									if (!plugin.settings.imageResize) {
										plugin.settings.imageResize = {
											resizeInterval: 0,
											edgeSize: 20,
											dragResizeGeneral: true,
											dragResizeCallout: true,
										};
									}
									plugin.settings.imageResize.resizeInterval =
										numValue;
									await plugin.saveSettings();
								} else {
									new Notice(
										t(
											"settings.imageResize.resizeInterval.error",
										),
									);
								}
							}, 500),
						);
					text.inputEl.type = "number";
					text.inputEl.min = "0";
					text.inputEl.step = "1";
				});
			},
		),
		createSettingDefinition(
			t("settings.imageResize.edgeSize"),
			t("settings.imageResize.edgeSize.desc"),
			(setting) => {
				const currentValue =
					plugin.settings.imageResize?.edgeSize || 20;
				setting.addSlider((slider) => {
					slider
						.setLimits(5, 150, 1)
						.setValue(currentValue)
						.onChange(
							debounce(async (value) => {
								if (!plugin.settings.imageResize) {
									plugin.settings.imageResize = {
										resizeInterval: 0,
										edgeSize: 20,
										dragResizeGeneral: true,
										dragResizeCallout: true,
									};
								}
								plugin.settings.imageResize.edgeSize = value;
								await plugin.saveSettings();
							}, 100),
						);
				});
			},
		),
	];
}

export function showImageResizeSettings(tab: NativePluginSettingTab): void {
	const group = new SettingGroup(tab.contentEl);
	renderSettingDefinitions(
		group,
		getImageResizeSettingDefinitions(tab.plugin),
	);
}
