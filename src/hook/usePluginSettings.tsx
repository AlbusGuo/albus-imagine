import SettingsStore from "@src/settings/SettingsStore";
import { IPluginSettings } from "@src/types/types";
import { useSyncExternalStore } from "react";

export default function usePluginSettings(
	settingsStore: SettingsStore
): IPluginSettings {
	const settings = useSyncExternalStore(
		settingsStore.store.subscribe,
		settingsStore.store.getSnapshot
	);
	return settings;
}
