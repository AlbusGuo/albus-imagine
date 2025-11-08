/**
 * 文件打开方式配置组件 - 支持拖拽
 */

import React, { useState, useEffect } from "react";
import { FileOpenMode } from "../types/image-manager.types";

interface FileOpenModeConfigProps {
	/** 所有可用的文件类型（扩展名） */
	availableExtensions: string[];
	/** 当前配置 */
	fileOpenModes: Record<string, FileOpenMode>;
	/** 配置变更回调 */
	onChange: (modes: Record<string, FileOpenMode>) => void;
}

export const FileOpenModeConfig: React.FC<FileOpenModeConfigProps> = ({
	availableExtensions,
	fileOpenModes,
	onChange,
}) => {
	// 分组：内部打开 和 外部打开
	const [internalExtensions, setInternalExtensions] = useState<string[]>([]);
	const [externalExtensions, setExternalExtensions] = useState<string[]>([]);
	const [draggedExtension, setDraggedExtension] = useState<string | null>(null);

	// 初始化分组
	useEffect(() => {
		const internal: string[] = [];
		const external: string[] = [];

		availableExtensions.forEach((ext) => {
			const mode = fileOpenModes[ext] || "internal";
			if (mode === "external") {
				external.push(ext);
			} else {
				internal.push(ext);
			}
		});

		setInternalExtensions(internal);
		setExternalExtensions(external);
	}, [availableExtensions, fileOpenModes]);

	// 处理拖拽开始
	const handleDragStart = (ext: string) => {
		setDraggedExtension(ext);
	};

	// 处理拖拽结束
	const handleDragEnd = () => {
		setDraggedExtension(null);
	};

	// 处理放置到内部区域
	const handleDropInternal = (e: React.DragEvent) => {
		e.preventDefault();
		if (!draggedExtension) return;

		// 从外部列表移除，添加到内部列表
		const newExternal = externalExtensions.filter((ext) => ext !== draggedExtension);
		const newInternal = [...internalExtensions];
		if (!newInternal.includes(draggedExtension)) {
			newInternal.push(draggedExtension);
		}

		setExternalExtensions(newExternal);
		setInternalExtensions(newInternal);

		// 更新配置
		const newModes = { ...fileOpenModes };
		newModes[draggedExtension] = "internal";
		onChange(newModes);

		setDraggedExtension(null);
	};

	// 处理放置到外部区域
	const handleDropExternal = (e: React.DragEvent) => {
		e.preventDefault();
		if (!draggedExtension) return;

		// 从内部列表移除，添加到外部列表
		const newInternal = internalExtensions.filter((ext) => ext !== draggedExtension);
		const newExternal = [...externalExtensions];
		if (!newExternal.includes(draggedExtension)) {
			newExternal.push(draggedExtension);
		}

		setInternalExtensions(newInternal);
		setExternalExtensions(newExternal);

		// 更新配置
		const newModes = { ...fileOpenModes };
		newModes[draggedExtension] = "external";
		onChange(newModes);

		setDraggedExtension(null);
	};

	// 允许放置
	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	return (
		<div className="file-open-mode-config">
			<div className="file-open-mode-description">
				通过拖拽文件类型标签来设置打开方式
			</div>

			<div className="file-open-mode-groups">
				{/* 内部打开区域 */}
				<div
					className="file-open-mode-group"
					onDrop={handleDropInternal}
					onDragOver={handleDragOver}
				>
					<div className="file-open-mode-group-header">
						<span className="file-open-mode-group-icon">📄</span>
						<span className="file-open-mode-group-title">
							Obsidian 内部打开
						</span>
					</div>
					<div className="file-open-mode-badges">
						{internalExtensions.length === 0 ? (
							<div className="file-open-mode-empty">
								将文件类型拖拽到这里
							</div>
						) : (
							internalExtensions.map((ext) => (
								<div
									key={ext}
									className="file-open-mode-badge"
									draggable
									onDragStart={() => handleDragStart(ext)}
									onDragEnd={handleDragEnd}
								>
									{ext.toUpperCase()}
								</div>
							))
						)}
					</div>
				</div>

				{/* 外部打开区域 */}
				<div
					className="file-open-mode-group"
					onDrop={handleDropExternal}
					onDragOver={handleDragOver}
				>
					<div className="file-open-mode-group-header">
						<span className="file-open-mode-group-icon">🚀</span>
						<span className="file-open-mode-group-title">
							外部应用打开
						</span>
					</div>
					<div className="file-open-mode-badges">
						{externalExtensions.length === 0 ? (
							<div className="file-open-mode-empty">
								将文件类型拖拽到这里
							</div>
						) : (
							externalExtensions.map((ext) => (
								<div
									key={ext}
									className="file-open-mode-badge"
									draggable
									onDragStart={() => handleDragStart(ext)}
									onDragEnd={handleDragEnd}
								>
									{ext.toUpperCase()}
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
