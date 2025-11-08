import SettingsStore from "@src/settings/SettingsStore";
import { createContext } from "react";

export const SettingsStoreContext = createContext<SettingsStore | undefined>(
	undefined
);
