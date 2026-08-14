import { loadEnvFile } from "node:process";
import { join } from "node:path";

export function loadProjectEnv(projectRoot) {
	try {
		loadEnvFile(join(projectRoot, ".env"));
	} catch (error) {
		if (!(error instanceof Error) || error.code !== "ENOENT") throw error;
	}
}
