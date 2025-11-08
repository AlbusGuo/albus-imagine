import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default [
	js.configs.recommended,
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				sourceType: 'module',
				project: './tsconfig.json'
			},
			globals: globals.browser
		},
		plugins: {
			'@typescript-eslint': tseslint,
			'obsidianmd': obsidianmd
		},
		rules: {
			...tseslint.configs.recommended.rules,

			// ==================== TypeScript Official Rules ====================
			// 禁止未使用的变量，但允许未使用的参数
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
			// 允许使用 @ts-ignore 等注释
			'@typescript-eslint/ban-ts-comment': 'off',
			// 允许直接使用原型方法
			'no-prototype-builtins': 'off',
			// 允许空函数
			'@typescript-eslint/no-empty-function': 'off',
			// 允许使用 any 类型
			'@typescript-eslint/no-explicit-any': 'off',

			// ==================== Custom Rules ====================
			// 允许显式声明可推断的类型
			'@typescript-eslint/no-inferrable-types': 'off',
			// 允许混合使用空格和制表符
			'no-mixed-spaces-and-tabs': 'off',
			'sort-imports': [ // 强制导入语句排序
				'error',
				{
					ignoreCase: true, // 忽略大小写
					ignoreDeclarationSort: true, // 忽略声明排序
					ignoreMemberSort: false, // 不忽略成员排序
					memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'] // 成员语法排序顺序
				}
			],

			// ==================== Obsidianmd Rules ====================
			// ====== 命令相关规则 ======
			// 禁止在命令 ID 中使用 'command' 单词
			'obsidianmd/commands/no-command-in-command-id': 'error',
			// 禁止在命令名称中使用 'command' 单词
			'obsidianmd/commands/no-command-in-command-name': 'error',
			// 不建议为命令提供默认热键
			'obsidianmd/commands/no-default-hotkeys': 'warn',
			// 禁止在命令 ID 中包含插件 ID
			'obsidianmd/commands/no-plugin-id-in-command-id': 'error',
			// 禁止在命令名称中包含插件名称
			'obsidianmd/commands/no-plugin-name-in-command-name': 'error',

			// ====== 内存泄漏防护规则 ======
			// 在 onunload 中不要分离叶子节点
			'obsidianmd/detach-leaves': 'error',
			// 禁止将插件作为组件传递给 MarkdownRenderer.render
			'obsidianmd/no-plugin-as-component': 'error',
			// 禁止在插件中直接存储自定义视图的引用
			'obsidianmd/no-view-references-in-plugin': 'error',

			// ====== 代码质量规则 ======
			// 禁止使用模板中的示例代码
			'obsidianmd/no-sample-code': 'error',
			// 禁止直接在 DOM 元素上设置样式，建议使用 CSS 类
			'obsidianmd/no-static-styles-assignment': 'error',
			// 禁止类型转换为 TFile 或 TFolder，建议使用 instanceof 检查
			'obsidianmd/no-tfile-tfolder-cast': 'error',
			// 禁止在 Obsidian 插件中向 DOM 附加禁止的元素
			'obsidianmd/no-forbidden-elements': 'error',

			// ====== API 使用最佳实践 ======
			// 优先使用 FileManager.trashFile() 而不是 Vault.trash() 或 Vault.delete()
			'obsidianmd/prefer-file-manager-trash-file': 'error',
			// 建议使用内置的 AbstractInputSuggest 而不是常见的 TextInputSuggest 实现
			'obsidianmd/prefer-abstract-input-suggest': 'warn',
			// 避免遍历所有文件来按路径查找文件
			'obsidianmd/vault/iterate': 'warn',

			// ====== 平台兼容性规则 ======
			// 禁止使用 navigator API 进行操作系统检测
			'obsidianmd/platform': 'error',
			// 禁止在正则表达式中使用后行断言（某些 iOS 版本不支持）
			'obsidianmd/regex-lookbehind': 'error',
			
			// ====== 其他规则 ======
			// 不建议使用带有两个参数的 Object.assign
			'obsidianmd/object-assign': 'warn',
			// 重命名示例插件类名
			'obsidianmd/sample-names': 'error',
			// 验证 LICENSE 文件中版权声明的结构
			'obsidianmd/validate-license': 'error',
			// 验证 manifest.json 的结构
			'obsidianmd/validate-manifest': 'error',

			// ====== 设置页面规则 ======
			// 禁止在设置页面中使用手动创建的 HTML 标题元素
			'obsidianmd/settings-tab/no-manual-html-headings': 'error',
			// 避免设置标题中的反模式
			'obsidianmd/settings-tab/no-problematic-settings-headings': 'error',

			// ====== UI 文本规范 ======
			'obsidianmd/ui/sentence-case': ['warn', { // 强制 UI 字符串使用句子大小写
				brands: [], // 品牌名称例外列表
				acronyms: ['API', 'UI', 'URL', 'HTML', 'CSS', 'JS', 'TS'], // 首字母缩写词例外列表
				enforceCamelCaseLower: true // 强制 CamelCase 转换为小写
			}]
		}
	},
	{
		files: ['test/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				sourceType: 'module',
				project: './tsconfig.json'
			},
			globals: {
				...globals.browser,
				...globals.jest
			}
		},
		plugins: {
			'@typescript-eslint': tseslint
		},
		rules: {
			...tseslint.configs.recommended.rules,
			// official rules
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
			'@typescript-eslint/ban-ts-comment': 'off',
			'no-prototype-builtins': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-explicit-any': 'off',

			// custom rules
			'@typescript-eslint/no-inferrable-types': 'off',
			'no-mixed-spaces-and-tabs': 'off',
			'sort-imports': [
				'error',
				{
					ignoreCase: true,
					ignoreDeclarationSort: true,
					ignoreMemberSort: false,
					memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single']
				}
			]
		}
	},
	{
		ignores: ['node_modules/**', 'main.js', 'scripts/**', '*.js']
	}
];