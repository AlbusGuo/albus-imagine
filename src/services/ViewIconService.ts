import { App, setIcon } from "obsidian";
import { ViewIconSuggestModal } from "../components/ViewIconSuggestModal";
import type {
	AlbusCustomIconsApi,
	AlbusCustomIconsPluginInstance,
	OpenIconPickerOptions,
} from "../integrations/customIconsApi";

const CUSTOM_ICONS_PLUGIN_ID = "albus-custom-icons";

interface AppWithPlugins extends App {
	plugins?: { getPlugin(id: string): unknown; };
}

export class ViewIconService {
	private api: AlbusCustomIconsApi | null = null;
	private unsubscribe: (() => void) | null = null;
	private lastSyncedSignature: string | null = null;
	private syncTail: Promise<void> = Promise.resolve();
	private destroyed = false;

	constructor(
		private readonly app: App,
		private readonly consumerId: string,
		private readonly onIconsChanged: () => void,
	) { }

	render(element: HTMLElement, icon: string): void {
		element.empty();
		const api = this.getCurrentApi();
		if (!api) this.releaseApi();
		if (api?.isReady) {
			this.adoptApi(api);
			try {
				if (api.renderIcon(element, icon)) return;
			} catch { /* Fall through to Obsidian. */ }
		}
		setIcon(element, icon || "layout-grid");
		if (!element.querySelector("svg")) setIcon(element, "circle-help");
	}

	async pick(sourceEl: HTMLElement, initialIcon: string): Promise<string | null> {
		try {
			const api = await this.getReadyApi();
			if (api) {
				const options: OpenIconPickerOptions = { sourceEl };
				if (initialIcon) {
					options.initialSelection = {
						icon: initialIcon,
						type: initialIcon.startsWith("CI-") ? "svg" : "lucide",
					};
				}
				return (await api.openIconPicker(this.consumerId, options))?.icon ?? null;
			}
		} catch (error) {
			console.error("Imagine failed to open the Custom Icons picker", error);
		}
		return new Promise((resolve) => {
			new ViewIconSuggestModal(this.app, resolve).open();
		});
	}

	syncRequiredIcons(iconIds: readonly string[]): Promise<void> {
		if (this.destroyed) return Promise.resolve();
		const normalized = Array.from(new Set(iconIds.map((icon) => icon.trim()).filter(Boolean))).sort();
		const operation = this.syncTail.then(async () => {
			const api = await this.getReadyApi();
			if (!api) return;
			const signature = normalized.join("\0");
			if (signature === this.lastSyncedSignature) return;
			await api.requireIcons(this.consumerId, normalized);
			this.lastSyncedSignature = signature;
			this.onIconsChanged();
		});
		this.syncTail = operation.catch(() => undefined);
		return operation;
	}

	destroy(): void {
		this.destroyed = true;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.api = null;
	}

	private async getReadyApi(): Promise<AlbusCustomIconsApi | null> {
		const api = this.getCurrentApi();
		if (!api) {
			this.releaseApi();
			return null;
		}
		this.adoptApi(api);
		await api.whenReady();
		return this.destroyed ? null : api;
	}

	private getCurrentApi(): AlbusCustomIconsApi | null {
		try {
			const plugin = (this.app as AppWithPlugins).plugins?.getPlugin(CUSTOM_ICONS_PLUGIN_ID) as AlbusCustomIconsPluginInstance | null;
			const api = plugin?.api;
			return api &&
				typeof api.whenReady === "function" &&
				typeof api.renderIcon === "function" &&
				typeof api.requireIcons === "function" &&
				typeof api.openIconPicker === "function" &&
				typeof api.onIconsChanged === "function"
				? api
				: null;
		} catch {
			return null;
		}
	}

	private adoptApi(api: AlbusCustomIconsApi): void {
		if (this.destroyed || this.api === api) return;
		this.unsubscribe?.();
		this.api = api;
		this.lastSyncedSignature = null;
		this.unsubscribe = api.onIconsChanged(this.onIconsChanged);
	}

	private releaseApi(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.api = null;
		this.lastSyncedSignature = null;
	}
}
