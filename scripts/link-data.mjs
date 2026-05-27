import { spawn } from "child_process";
import dotenv from "dotenv";
import { existsSync } from "fs";
import { lstat, readFile, symlink, unlink } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

dotenv.config({ quiet: true });
const VAULT_PATH = process.env.VAULT_PATH;
if (!VAULT_PATH) {
	throw new Error(
		"VAULT_PATH is not defined. Please create a .env file in the project root and add the line: VAULT_PATH=/path/to/your/vault"
	);
}

const manifestPath = join(projectRoot, "manifest.json");

// 检查是否以管理员身份运行
function isAdmin() {
	if (process.platform !== "win32") return true;

	try {
		const { execSync } = require("child_process");
		execSync("net session >nul 2>&1", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

// 尝试以管理员身份重新运行
async function runAsAdmin() {
	return new Promise((resolve, reject) => {
		const scriptPath = process.argv[1];
		const args = process.argv.slice(2);

		// 使用 PowerShell 以管理员身份运行
		const psCommand = `Start-Process -FilePath "node" -ArgumentList "${scriptPath}",${args
			.map((arg) => `"${arg}"`)
			.join(",")} -Verb RunAs -Wait`;

		const ps = spawn("powershell.exe", ["-Command", psCommand], {
			stdio: "inherit",
		});

		ps.on("exit", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`PowerShell 退出码: ${code}`));
			}
		});

		ps.on("error", reject);
	});
}

async function linkDataJson() {
	try {
		// 从 manifest.json 读取插件 ID
		const manifestContent = await readFile(manifestPath, "utf8");
		const manifest = JSON.parse(manifestContent);
		const pluginId = manifest.id;

		if (!pluginId) {
			throw new Error("无法从 manifest.json 中获取插件 ID");
		}

		// 构建路径
		const vaultPluginDir = join(
			VAULT_PATH,
			".obsidian",
			"plugins",
			pluginId
		);
		const sourceDataPath = join(vaultPluginDir, "data.json");
		const targetDataPath = join(rootDir, "data.json");

		// 检查源文件是否存在
		if (!existsSync(sourceDataPath)) {
			console.log(`警告: 源文件不存在: ${sourceDataPath}`);
			console.log("请确保插件已在测试库中运行过并生成了 data.json 文件");
			return;
		}

		// 检查目标位置是否已有文件或链接
		if (existsSync(targetDataPath)) {
			try {
				const stats = await lstat(targetDataPath);
				if (stats.isSymbolicLink()) {
					console.log("删除现有的软链接...");
					await unlink(targetDataPath);
				} else {
					console.log(
						"警告: 目标位置已存在普通文件，请手动处理后重试"
					);
					console.log(`文件路径: ${targetDataPath}`);
					return;
				}
			} catch (error) {
				console.error("检查目标文件时出错:", error);
				return;
			}
		}

		// 创建软链接
		try {
			await symlink(sourceDataPath, targetDataPath, "file");
			console.log(`成功创建软链接:`);
			console.log(`  源文件: ${sourceDataPath}`);
			console.log(`  目标位置: ${targetDataPath}`);
			console.log("");
			console.log(
				"现在项目根目录的 data.json 将实时反映测试库中的插件配置！"
			);
		} catch (symlinkError) {
			if (symlinkError.code === "EPERM") {
				console.log("软链接创建失败，权限不足。");

				// 检查是否以管理员身份运行
				if (!isAdmin()) {
					console.log("尝试以管理员身份重新运行...");
					try {
						await runAsAdmin();
						return;
					} catch (adminError) {
						console.log("自动提权失败:", adminError.message);
					}
				}
			} else {
				throw symlinkError;
			}
		}
	} catch (error) {
		console.error("执行过程中出错:", error);
		process.exit(1);
	}
}

linkDataJson();
