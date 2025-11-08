/**
 * App Context - 提供 Obsidian App 实例
 */

import { App } from "obsidian";
import { createContext, useContext } from "react";

export const AppContext = createContext<App | null>(null);

export function useApp(): App {
	const app = useContext(AppContext);
	if (!app) {
		throw new Error("useApp must be used within AppContext.Provider");
	}
	return app;
}
