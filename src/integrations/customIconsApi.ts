export type PublicIconType = "lucide" | "svg";

export interface PublicIconSelection {
	icon: string;
	type: PublicIconType;
}

export interface OpenIconPickerOptions {
	sourceEl?: HTMLElement;
	initialSelection?: PublicIconSelection;
}

export interface AlbusCustomIconsApi {
	readonly isReady: boolean;
	whenReady(): Promise<void>;
	renderIcon(element: HTMLElement, iconId: string, type?: PublicIconType): boolean;
	requireIcons(consumerId: string, iconIds: string[]): Promise<{ ready: string[]; missing: string[]; }>;
	openIconPicker(consumerId: string, options?: OpenIconPickerOptions): Promise<PublicIconSelection | null>;
	onIconsChanged(callback: () => void): () => void;
}

export interface AlbusCustomIconsPluginInstance {
	readonly api: AlbusCustomIconsApi;
}
