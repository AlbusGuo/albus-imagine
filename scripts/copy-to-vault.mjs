import { existsSync, readFileSync } from "fs";
import { copyFile, mkdir, readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// 手动解析 .env 文件（替代 dotenv）
function loadEnv() {
	try {
		const envPath = join(projectRoot, ".env");
		if (existsSync(envPath)) {
			const content = readFileSync(envPath, "utf-8");
			for (const line of content.split("\n")) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) continue;
				const eqIndex = trimmed.indexOf("=");
				if (eqIndex === -1) continue;
				const key = trimmed.slice(0, eqIndex).trim();
				const value = trimmed.slice(eqIndex + 1).trim();
				if (!process.env[key]) {
					process.env[key] = value;
				}
			}
		}
	} catch {
		// .env 文件不存在或无法读取，忽略
	}
}

loadEnv();
const VAULT_PATH = process.env.VAULT_PATH;
if (!VAULT_PATH) {
	throw new Error(
		"VAULT_PATH is not defined. Please create a .env file in the project root and add the line: VAULT_PATH=/path/to/your/vault"
	);
}

const fileConfig = [
	{
		name: "manifest.json",
		sourcePath: projectRoot,
	},
	{
		name: "main.js",
		sourcePath: projectRoot,
	},
	{
		name: "styles.css",
		sourcePath: projectRoot,
	},
];

async function copyToVault() {
	try {
		// 获取 manifest.json 配置，从 fileConfig 中找到对应文件
		const manifestConfig = fileConfig.find(
			(file) => file.name === "manifest.json"
		);
		if (!manifestConfig) {
			throw new Error("manifest.json not found in fileConfig");
		}

		const manifestPath = join(
			manifestConfig.sourcePath,
			manifestConfig.name
		);
		const manifestContent = await readFile(manifestPath, "utf8");
		const manifest = JSON.parse(manifestContent);
		const pluginId = manifest.id;

		if (!pluginId) {
			throw new Error("Plugin ID not found in manifest.json");
		}

		const targetPluginDir = join(
			VAULT_PATH,
			".obsidian",
			"plugins",
			pluginId
		);

		if (!existsSync(targetPluginDir)) {
			await mkdir(targetPluginDir, { recursive: true });
			console.log(`创建目录: ${targetPluginDir}`);
		}

		// 复制文件
		for (const fileInfo of fileConfig) {
			const sourcePath = join(fileInfo.sourcePath, fileInfo.name);
			const destPath = join(targetPluginDir, fileInfo.name);

			if (!existsSync(sourcePath)) {
				console.warn(`警告: 源文件不存在 ${sourcePath}`);
				continue;
			}

			await copyFile(sourcePath, destPath);
			// console.log(`复制文件: ${fileInfo.name} -> ${destPath}`);
		}

		console.log(`插件 ${pluginId} 已成功复制到 vault`);
	} catch (error) {
		console.error("复制文件时出错:", error);
		process.exit(1);
	}
}

copyToVault();
