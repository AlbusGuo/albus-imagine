/**
 * 原生 Obsidian 设置界面
 * 使用 Obsidian 设置容器, 仅补充轻量标签页导航.
 */

import type CPlugin from "@src/main";
import { PluginSettingTab, SettingDefinitionItem } from "obsidian";
import { showImageManagerSettings } from "./image-manager-settings";
import { showImageResizeSettings } from "./image-resize-settings";
import { showImageViewerSettings } from "./image-viewer-settings";

type SettingsTabKey = "IMAGE_MANAGER" | "IMAGE_RESIZE" | "IMAGE_VIEWER";

interface SettingsTab {
	key: SettingsTabKey;
	name: string;
	render: (tab: NativePluginSettingTab) => void;
}

const SETTINGS_TABS: SettingsTab[] = [
	{ key: "IMAGE_MANAGER", name: "图片管理器", render: showImageManagerSettings },
	{ key: "IMAGE_RESIZE", name: "图片拖拽", render: showImageResizeSettings },
	{ key: "IMAGE_VIEWER", name: "图片查看器", render: showImageViewerSettings },
];

const SETTING_SEARCH_ALIASES = [
	"图片管理器",
	"显示文件大小",
	"显示修改时间",
	"默认排序字段",
	"默认排序顺序",
	"排除文件夹",
	"删除确认",
	"深色模式下 SVG 图片反色",
	"图片拖拽",
	"启用 callout 外图片拖拽调整大小",
	"启用 callout 内图片拖拽调整大小",
	"调整大小的时间间隔",
	"边缘检测区域大小",
	"图片查看器",
	"启用图片查看器",
	"禁用内置点击查看图片",
	"自定义文件类型",
	"文件扩展名",
	"封面扩展名",
	"封面文件夹",
];

export class NativePluginSettingTab extends PluginSettingTab {
	plugin: CPlugin;
	contentEl!: HTMLElement;
	private customRenderQueued = false;
	private readonly scrollTopByTab = new Map<SettingsTabKey, number>();
	private renderedTab: SettingsTabKey | null = null;

	icon: string = 'image';

	constructor(plugin: CPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Imagine",
				desc: "图片管理器, 图片拖拽, 图片查看器和自定义文件类型",
				aliases: SETTING_SEARCH_ALIASES,
				render: (setting) => this.queueCustomRender(setting.settingEl.ownerDocument),
			},
		];
	}

	display(): void {
		this.renderSettings();
	}

	hide(): void {
		this.rememberScrollPosition();
		super.hide();
	}

	refresh(): void {
		this.renderSettings();
	}

	private queueCustomRender(ownerDocument: Document): void {
		if (this.customRenderQueued) return;
		this.customRenderQueued = true;
		const ownerWindow = ownerDocument.defaultView;
		const render = () => {
			this.customRenderQueued = false;
			this.renderSettings();
		};
		if (ownerWindow) ownerWindow.queueMicrotask(render);
		else queueMicrotask(render);
	}

	private renderSettings(): void {
		this.rememberScrollPosition();
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('afm-settings-root');

		// 恢复上次选择的标签页
		const activeTabKey = this.plugin.settings.settingsTab || "IMAGE_MANAGER";

		// 固定顶部标签栏
		const tabsEl = containerEl.createDiv({ cls: 'afm-settings-tabs' });

		for (const tab of SETTINGS_TABS) {
			const tabEl = tabsEl.createDiv({ cls: 'afm-settings-tab' });
			if (activeTabKey === tab.key) {
				tabEl.classList.add('is-active');
			}
			tabEl.setText(tab.name);
			tabEl.addEventListener('click', () => {
				if (this.plugin.settings.settingsTab === tab.key) return;
				this.plugin.settings.settingsTab = tab.key;
				void this.plugin.saveSettings();
				this.refresh();
			});
		}

		const scrollEl = containerEl.createDiv({ cls: 'afm-settings-scroll' });
		this.contentEl = scrollEl.createDiv({ cls: 'afm-settings-content' });

		// 渲染当前标签页内容
		const activeTab = SETTINGS_TABS.find(t => t.key === activeTabKey);
		if (activeTab) {
			activeTab.render(this);
		}
		this.renderedTab = activeTabKey;
		scrollEl.scrollTop = this.scrollTopByTab.get(activeTabKey) ?? 0;

	}

	private rememberScrollPosition(): void {
		if (!this.renderedTab) return;
		const scrollEl = this.containerEl.querySelector<HTMLElement>('.afm-settings-scroll');
		if (scrollEl) this.scrollTopByTab.set(this.renderedTab, scrollEl.scrollTop);
	}

}
