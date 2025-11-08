/**
 * 文件夹输入组件（带建议）
 */

import { useEffect, useRef } from "react";
import { App } from "obsidian";
import { FolderSuggest } from "@src/components/FolderSuggest";

interface FolderInputProps {
	app: App;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

export function FolderInput({ app, value, onChange, placeholder }: FolderInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const suggestRef = useRef<FolderSuggest | null>(null);

	useEffect(() => {
		if (inputRef.current && !suggestRef.current) {
			// 创建 FolderSuggest 并传入 onChange 回调
			suggestRef.current = new FolderSuggest(app, inputRef.current, onChange);
		}

		return () => {
			if (suggestRef.current) {
				suggestRef.current.destroy();
				suggestRef.current = null;
			}
		};
	}, [app, onChange]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.value);
	};

	return (
		<input
			ref={inputRef}
			type="text"
			value={value}
			onChange={handleChange}
			placeholder={placeholder || "选择文件夹..."}
			style={{
				width: "100%",
				padding: "6px 12px",
				background: "var(--background-primary)",
				color: "var(--text-normal)",
				border: "1px solid var(--background-modifier-border)",
				borderRadius: "4px",
				fontSize: "13px",
			}}
		/>
	);
}
