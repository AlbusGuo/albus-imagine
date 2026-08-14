module.exports = {
	writerOpts: {
		transform: (commit, context) => {
			// 创建一个新对象而不是修改原对象
			const transformedCommit = { ...commit };

			// 定义完整的 commit 类型映射
			const typeMap = {
				feat: "✨ Features",
				fix: "🐛 Bug Fixes",
				docs: "📝 Documentation",
				style: "🎨 Styles",
				refactor: "♻️ Refactor",
				perf: "⚡️ Performance",
				test: "✅ Tests",
				build: "👷 Build",
				ci: "🔧 CI",
				chore: "🔨 Chore",
				revert: "⏪️ Reverts",
			};

			// 应用类型映射
			if (transformedCommit.type && typeMap[transformedCommit.type]) {
				transformedCommit.type = typeMap[transformedCommit.type];
			}

			// 如果没有匹配的类型, 跳过
			if (transformedCommit.type === commit.type) {
				return false;
			}

			// 保留 URL 链接等信息
			if (commit.scope === "*") {
				transformedCommit.scope = "";
			}

			// 确保 hash 作为链接文本
			if (transformedCommit.hash) {
				transformedCommit.shortHash = transformedCommit.hash.substring(
					0,
					7
				);
			}

			// 处理 BREAKING CHANGE - 创建深层复制
			if (commit.notes && commit.notes.length > 0) {
				transformedCommit.notes = commit.notes.map((note) => {
					// 创建笔记的副本
					const noteCopy = { ...note };
					// 修改副本而不是原对象
					if (noteCopy.title === "BREAKING CHANGE") {
						noteCopy.title = "💥 BREAKING CHANGE";
					}
					return noteCopy;
				});
			}

			return transformedCommit;
		},
	},
};
