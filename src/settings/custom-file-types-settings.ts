import { debounce, SettingDefinitionRender, SettingGroup } from "obsidian";
import type { NativePluginSettingTab } from "./NativePluginSettingTab";
import type CPlugin from "@src/main";
import {
	createSettingDefinition,
	renderSettingDefinitions,
} from "./setting-definitions";
import { t } from "../i18n";

export function getCustomFileTypesSettingDefinitions(
	plugin: CPlugin,
	refresh: () => void,
): SettingDefinitionRender[] {
	const customTypes = plugin.settings.imageManager?.customFileTypes || [];
	const definitions: SettingDefinitionRender[] = [];

	if (customTypes.length === 0) {
		definitions.push(
			createSettingDefinition(
				t("settings.customFileTypes.empty"),
				t("settings.customFileTypes.empty.desc"),
				() => undefined,
			),
		);
	} else {
		customTypes.forEach((type, index) => {
			definitions.push(
				createSettingDefinition(
					t("settings.customFileTypes.type"),
					"",
					(setting) => {
						setting
							.addText((text) => {
								text.setPlaceholder(
									t(
										"settings.customFileTypes.fileExtension.placeholder",
									),
								)
									.setValue(type.fileExtension)
									.onChange(
										debounce(async (value) => {
											type.fileExtension = value;
											if (!plugin.settings.imageManager) {
												plugin.settings.imageManager =
													{};
											}
											plugin.settings.imageManager.customFileTypes =
												customTypes;
											await plugin.saveSettings();
										}, 500),
									);
							})
							.addText((text) => {
								text.setPlaceholder(
									t(
										"settings.customFileTypes.coverExtension.placeholder",
									),
								)
									.setValue(type.coverExtension)
									.onChange(
										debounce(async (value) => {
											type.coverExtension = value;
											if (!plugin.settings.imageManager) {
												plugin.settings.imageManager =
													{};
											}
											plugin.settings.imageManager.customFileTypes =
												customTypes;
											await plugin.saveSettings();
										}, 500),
									);
							})
							.addText((text) => {
								text.setPlaceholder(
									t(
										"settings.customFileTypes.coverFolder.placeholder",
									),
								)
									.setValue(type.coverFolder || "")
									.onChange(
										debounce(async (value) => {
											type.coverFolder = value;
											if (!plugin.settings.imageManager) {
												plugin.settings.imageManager =
													{};
											}
											plugin.settings.imageManager.customFileTypes =
												customTypes;
											await plugin.saveSettings();
										}, 500),
									);
							})
							.addExtraButton((btn) => {
								btn.setIcon("trash-2")
									.setTooltip(
										t(
											"settings.customFileTypes.delete.tooltip",
										),
									)
									.onClick(async () => {
										customTypes.splice(index, 1);
										if (!plugin.settings.imageManager) {
											plugin.settings.imageManager = {};
										}
										plugin.settings.imageManager.customFileTypes =
											customTypes;
										await plugin.saveSettings();
										refresh();
									});
							});
					},
				),
			);
		});
	}

	definitions.push(
		createSettingDefinition(
			t("settings.customFileTypes.add"),
			t("settings.customFileTypes.add.desc"),
			(setting) => {
				setting.addButton((button) => {
					button
						.setButtonText(t("settings.customFileTypes.add.button"))
						.setCta()
						.onClick(() => {
							customTypes.push({
								fileExtension: "",
								coverExtension: "",
								coverFolder: "",
							});
							refresh();
						});
				});
			},
		),
	);

	return definitions;
}

export function showCustomFileTypesSettings(tab: NativePluginSettingTab): void {
	const group = new SettingGroup(tab.contentEl);
	renderSettingDefinitions(
		group,
		getCustomFileTypesSettingDefinitions(tab.plugin, () => tab.refresh()),
	);
}
