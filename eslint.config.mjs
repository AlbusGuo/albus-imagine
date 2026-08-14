import globals from "globals";
import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";

const typescriptOverrides = {
	"no-unused-vars": "off",
	"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
	"@typescript-eslint/ban-ts-comment": "off",
	"no-prototype-builtins": "off",
	"@typescript-eslint/no-empty-function": "off",
	"@typescript-eslint/no-explicit-any": "off",
	"@typescript-eslint/no-deprecated": "off",
	"@typescript-eslint/no-inferrable-types": "off",
	"no-mixed-spaces-and-tabs": "off",
	"sort-imports": [
		"error",
		{
			ignoreCase: true,
			ignoreDeclarationSort: true,
			ignoreMemberSort: false,
			memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
		},
	],
};

export default [
	{
		ignores: [
			"node_modules/**",
			".tmp/**",
			"main.js",
			"scripts/**",
			"*.js",
			"eslint.config.mjs",
			"package-lock.json",
		],
	},
	...obsidianmd.configs.recommended,
	{
		files: ["package.json"],
		rules: {
			"depend/ban-dependencies": "off",
		},
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				sourceType: "module",
				project: "./tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
			},
			globals: globals.browser,
		},
		rules: {
			...typescriptOverrides,
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					brands: [],
					acronyms: ["API", "UI", "URL", "HTML", "CSS", "JS", "TS", "SVG", "PDF", "JPG"],
					enforceCamelCaseLower: true,
				},
			],
		},
	},
	{
		files: ["test/**/*.ts"],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.jest,
			},
		},
		rules: typescriptOverrides,
	},
];
