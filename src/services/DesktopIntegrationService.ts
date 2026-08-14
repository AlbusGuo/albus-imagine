import { App, Notice, TFile } from "obsidian";

type DesktopApp = App & {
	openWithDefaultApp?: (path: string) => void;
};

/** Isolates Obsidian's optional desktop integration from feature modules. */
export class DesktopIntegrationService {
	constructor(private readonly app: App) { }

	openWithDefaultApp(file: TFile): boolean {
		const open = (this.app as DesktopApp).openWithDefaultApp;
		if (typeof open !== "function") {
			new Notice("当前环境不支持使用系统默认应用打开");
			return false;
		}
		open.call(this.app, file.path);
		return true;
	}
}
