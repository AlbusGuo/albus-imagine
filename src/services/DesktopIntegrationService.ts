import { App, Notice, TFile } from "obsidian";
import { t } from "../i18n";

type DesktopApp = App & {
	openWithDefaultApp?: (path: string) => void;
};

/** Isolates Obsidian's optional desktop integration from feature modules. */
export class DesktopIntegrationService {
	constructor(private readonly app: App) {}

	openWithDefaultApp(file: TFile): boolean {
		const open = (this.app as DesktopApp).openWithDefaultApp;
		if (typeof open !== "function") {
			new Notice(t("service.notSupportedEnvironment"));
			return false;
		}
		open.call(this.app, file.path);
		return true;
	}
}
