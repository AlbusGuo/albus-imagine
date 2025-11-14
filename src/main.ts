import { Plugin, WorkspaceLeaf } from "obsidian";
import { PluginSettingTab } from "./settings/PluginSettingTab";
import SettingsStore from "./settings/SettingsStore";
import { IPluginSettings } from "./types/types";
import { ImageManagerView, IMAGE_MANAGER_VIEW_TYPE } from "./views/ImageManagerView";

export default class AlbusFigureManagerPlugin extends Plugin {
	settings: IPluginSettings;
	readonly settingsStore = new SettingsStore(this);

	async onload() {
		await this.settingsStore.loadSettings();

		// 注册视图
		this.registerView(
			IMAGE_MANAGER_VIEW_TYPE,
			(leaf) => new ImageManagerView(leaf, this.settings.imageManager || {})
		);

		// 添加功能区图标 - 打开图片管理器
		const ribbonIconEl = this.addRibbonIcon(
			"images",
			"图片管理器",
			(evt: MouseEvent) => {
				this.openImageManager();
			}
		);
		ribbonIconEl.addClass("albus-figure-manager-ribbon-icon");

		// 添加命令 - 打开图片管理器
		this.addCommand({
			id: "open-image-manager",
			name: "打开图片管理器",
			callback: () => {
				this.openImageManager();
			},
		});

		// 添加设置选项卡
		this.addSettingTab(new PluginSettingTab(this));
	}

	/**
	 * 打开图片管理器
	 */
	async openImageManager(): Promise<void> {
		const { workspace } = this.app;

		// 检查是否已有打开的视图
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(IMAGE_MANAGER_VIEW_TYPE);

		if (leaves.length > 0) {
			// 如果已存在，激活它
			leaf = leaves[0];
			workspace.revealLeaf(leaf);
		} else {
			// 在中间窗口创建新的视图（而非侧边栏）
			leaf = workspace.getLeaf('tab');
			if (leaf) {
				await leaf.setViewState({
					type: IMAGE_MANAGER_VIEW_TYPE,
					active: true,
				});
				workspace.revealLeaf(leaf);
			}
		}
	}

	onunload() {
		// 清理工作
		this.app.workspace.detachLeavesOfType(IMAGE_MANAGER_VIEW_TYPE);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// 通知所有打开的图片管理器视图更新设置
		const leaves = this.app.workspace.getLeavesOfType(IMAGE_MANAGER_VIEW_TYPE);
		leaves.forEach(leaf => {
			const view = leaf.view;
			if (view instanceof ImageManagerView) {
				view.updateSettings(this.settings.imageManager || {});
			}
		});
	}
}
