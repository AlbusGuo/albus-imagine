/**
 * 执行发版和打标签操作的专用脚本
 */

import { execSync } from "child_process";

// 从 package.json 获取当前版本号
const version = process.env.npm_package_version;
console.log(`📦 Preparing to release version: ${version}`);

/**
 * 安全执行命令，带有重试机制
 * @param {string} command 要执行的命令
 * @param {string} description 命令描述
 * @param {boolean} canSkip 是否可以跳过（用于处理重复执行的情况）
 */
function safeExec(command, description, canSkip = false) {
	try {
		console.log(description);
		execSync(command, { stdio: "inherit" });
		return true;
	} catch (error) {
		if (canSkip) {
			console.log(`⚠️ ${description} - 已跳过 (可能已执行过)`);
			return true;
		} else {
			console.error(`❌ ${description} - 失败: ${error.message}`);
			throw error;
		}
	}
}

/**
 * 检查是否有未提交的更改
 */
function hasUncommittedChanges() {
	try {
		const status = execSync("git status --porcelain", { encoding: "utf8" });
		return status.trim().length > 0;
	} catch (error) {
		console.error("❌ 检查 git 状态失败");
		return false;
	}
}

/**
 * 检查标签是否已存在
 */
function tagExists(tagName) {
	try {
		execSync(`git tag -l "${tagName}"`, { stdio: "pipe" });
		const output = execSync(`git tag -l "${tagName}"`, {
			encoding: "utf8",
		});
		return output.trim() === tagName;
	} catch (error) {
		return false;
	}
}

/**
 * 检查远程标签是否已存在
 */
function remoteTagExists(tagName) {
	try {
		const output = execSync(`git ls-remote --tags origin ${tagName}`, {
			encoding: "utf8",
		});
		return output.trim().length > 0;
	} catch (error) {
		return false;
	}
}

try {
	// 执行 git add 操作
	safeExec("git add .", "📝 添加文件到 git...");

	// 检查是否有需要提交的更改
	if (hasUncommittedChanges()) {
		// 执行 git commit 操作
		safeExec(`git commit -m "build: ${version}"`, "💾 创建提交...");
	} else {
		console.log("ℹ️ 没有需要提交的更改，跳过提交步骤");
	}

	// 执行 git push 操作
	safeExec("git push", "🚀 推送到远程...", true);

	// 检查标签是否已存在
	if (!tagExists(version)) {
		// 创建版本标签
		safeExec(`git tag ${version}`, `🏷️ 创建标签: ${version}`);
	} else {
		console.log(`ℹ️ 标签 ${version} 已存在，跳过创建标签步骤`);
	}

	// 检查远程标签是否已存在
	if (!remoteTagExists(version)) {
		// 推送标签到远程
		safeExec("git push --tags", "📤 推送标签到远程...");
	} else {
		console.log(`ℹ️ 远程标签 ${version} 已存在，跳过推送标签步骤`);
	}

	console.log(`✅ 成功发布版本 ${version}!`);
} catch (error) {
	console.error(`❌ 发布失败: ${error.message}`);
	console.log("\n💡 提示: 修复问题后可以重新运行此脚本");
	process.exit(1);
}
