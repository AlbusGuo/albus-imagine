/**
 * 原生 Obsidian 设置界面
 * 使用 Obsidian 设置容器, 仅补充轻量标签页导航.
 */

import type CPlugin from "@src/main";
import { PluginSettingTab, SettingDefinitionItem } from "obsidian";
import {
	getImageManagerSettingDefinitions,
	showImageManagerSettings,
} from "./image-manager-settings";
import {
	getImageResizeSettingDefinitions,
	showImageResizeSettings,
} from "./image-resize-settings";
import {
	getImageViewerSettingDefinitions,
	showImageViewerSettings,
} from "./image-viewer-settings";
import {
	getCustomFileTypesSettingDefinitions,
	showCustomFileTypesSettings,
} from "./custom-file-types-settings";
import { refreshSettingTab } from "../utils/obsidianCompatibility";
import { t } from "../i18n";

type SettingsTabKey =
	| "IMAGE_MANAGER"
	| "IMAGE_RESIZE"
	| "IMAGE_VIEWER"
	| "CUSTOM_FILE_TYPES";

interface SettingsTab {
	key: SettingsTabKey;
	name: string;
	render: (tab: NativePluginSettingTab) => void;
}

const SETTINGS_TABS: SettingsTab[] = [
	{
		key: "IMAGE_MANAGER",
		name: t("settings.tab.imageManager"),
		render: showImageManagerSettings,
	},
	{
		key: "IMAGE_RESIZE",
		name: t("settings.tab.imageResize"),
		render: showImageResizeSettings,
	},
	{
		key: "IMAGE_VIEWER",
		name: t("settings.tab.imageViewer"),
		render: showImageViewerSettings,
	},
	{
		key: "CUSTOM_FILE_TYPES",
		name: t("settings.tab.customFileTypes"),
		render: showCustomFileTypesSettings,
	},
];

export class NativePluginSettingTab extends PluginSettingTab {
	plugin: CPlugin;
	contentEl!: HTMLElement;

	icon: string = "image";

	constructor(plugin: CPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: "page",
				name: t("settings.tab.imageManager"),
				desc: t("settings.page.imageManager.desc"),
				items: [
					{
						type: "group",
						items: getImageManagerSettingDefinitions(this.plugin),
					},
				],
			},
			{
				type: "page",
				name: t("settings.tab.imageResize"),
				desc: t("settings.page.imageResize.desc"),
				items: [
					{
						type: "group",
						items: getImageResizeSettingDefinitions(this.plugin),
					},
				],
			},
			{
				type: "page",
				name: t("settings.tab.imageViewer"),
				desc: t("settings.page.imageViewer.desc"),
				items: [
					{
						type: "group",
						items: getImageViewerSettingDefinitions(this.plugin),
					},
				],
			},
			{
				type: "page",
				name: t("settings.tab.customFileTypes"),
				desc: t("settings.page.customFileTypes.desc"),
				items: [
					{
						type: "group",
						items: getCustomFileTypesSettingDefinitions(
							this.plugin,
							() => this.refresh(),
						),
					},
				],
			},
		];
	}

	display(): void {
		this.renderSettings();
	}

	refresh(): void {
		refreshSettingTab(this, () => this.renderSettings());
	}

	private renderSettings(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("afm-settings-root");

		// 恢复上次选择的标签页
		const activeTabKey =
			this.plugin.settings.settingsTab || "IMAGE_MANAGER";

		// 固定顶部标签栏
		const tabsEl = containerEl.createDiv({ cls: "afm-settings-tabs" });

		for (const tab of SETTINGS_TABS) {
			const tabEl = tabsEl.createDiv({ cls: "afm-settings-tab" });
			if (activeTabKey === tab.key) {
				tabEl.classList.add("is-active");
			}
			tabEl.setText(tab.name);
			tabEl.addEventListener("click", () => {
				this.plugin.settings.settingsTab = tab.key;
				void this.plugin.saveSettings();
				this.refresh();
			});
		}

		this.contentEl = containerEl.createDiv({ cls: "afm-settings-content" });

		// 渲染当前标签页内容
		const activeTab = SETTINGS_TABS.find((t) => t.key === activeTabKey);
		if (activeTab) {
			activeTab.render(this);
		}
	}
}
