/**
 * 图片管理器设置组件
 */

import { usePluginSettings } from "@src/hook/usePluginSettings";
import { useApp } from "@src/context/AppContext";
import { Setting, SettingDivider, SettingSwitch, SettingTitle, SettingDescription } from "./Settings";
import { CustomFileTypeConfig, SUPPORTED_IMAGE_EXTENSIONS, FileOpenMode } from "@src/types/image-manager.types";
import { FolderInput } from "@src/components/FolderInput";
import { FileOpenModeConfig } from "@src/components/FileOpenModeConfig";
import { useState, useMemo } from "react";

export function ImageManagerSettings() {
	const app = useApp();
	const { pluginSettings, updatePluginSettings } = usePluginSettings();
	const imageManager = pluginSettings.imageManager || {};
	const [customTypes, setCustomTypes] = useState<CustomFileTypeConfig[]>(
		imageManager.customFileTypes || []
	);

	const updateImageManagerSettings = (updates: Partial<typeof imageManager>) => {
		updatePluginSettings({
			...pluginSettings,
			imageManager: {
				...imageManager,
				...updates,
			},
		});
	};

	const addCustomFileType = () => {
		const newType: CustomFileTypeConfig = {
			fileExtension: "",
			coverExtension: "",
			coverFolder: "",
			enabled: true,
		};
		const updated = [...customTypes, newType];
		setCustomTypes(updated);
		updateImageManagerSettings({ customFileTypes: updated });
	};

	const updateCustomFileType = (index: number, updates: Partial<CustomFileTypeConfig>) => {
		const updated = [...customTypes];
		updated[index] = { ...updated[index], ...updates };
		setCustomTypes(updated);
		updateImageManagerSettings({ customFileTypes: updated });
	};

	const removeCustomFileType = (index: number) => {
		const updated = customTypes.filter((_, i) => i !== index);
		setCustomTypes(updated);
		updateImageManagerSettings({ customFileTypes: updated });
	};

	// 获取所有可用的文件扩展名（包括自定义类型）
	const allExtensions = useMemo(() => {
		const extensions = new Set<string>([...SUPPORTED_IMAGE_EXTENSIONS]);
		// 添加自定义文件类型的扩展名
		customTypes.forEach((type) => {
			if (type.fileExtension && type.enabled) {
				extensions.add(type.fileExtension.toLowerCase());
			}
		});
		return Array.from(extensions).sort();
	}, [customTypes]);

	return (
		<>
			<SettingTitle>图片管理器</SettingTitle>
			<SettingDescription>
				配置图片管理器的基本参数和显示选项。
				<br />
				图片引用情况会在加载时自动检查。
			</SettingDescription>

			<div style={{ marginBottom: "1rem" }}>
				<div style={{ marginBottom: "8px" }}>
					<label style={{ 
						fontSize: "14px", 
						fontWeight: 500,
						color: "var(--text-normal)",
						display: "block",
						marginBottom: "4px"
					}}>
						默认文件夹路径
					</label>
					<div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
						设置图片管理器的默认文件夹路径，留空则显示所有图片
					</div>
				</div>
				<FolderInput
					app={app}
					value={imageManager.folderPath || ""}
					onChange={(value) => updateImageManagerSettings({ folderPath: value })}
					placeholder="留空显示所有图片"
				/>
			</div>

			<SettingDivider />

			<SettingTitle>显示选项</SettingTitle>

			<SettingSwitch
				label="显示文件大小"
				description="在图片卡片上显示文件大小信息"
				checked={imageManager.showFileSize !== false}
				onChange={(checked) =>
					updateImageManagerSettings({ showFileSize: checked })
				}
			/>

			<SettingSwitch
				label="显示修改时间"
				description="在图片卡片上显示最后修改时间"
				checked={imageManager.showModifiedTime !== false}
				onChange={(checked) =>
					updateImageManagerSettings({
						showModifiedTime: checked,
					})
				}
			/>

			<SettingSwitch
				label="默认筛选未引用图片"
				description="打开图片管理器时默认只显示未被引用的图片"
				checked={imageManager.defaultFilterUnreferenced === true}
				onChange={(checked) =>
					updateImageManagerSettings({
						defaultFilterUnreferenced: checked,
					})
				}
			/>

			<SettingDivider />

			<SettingTitle>行为选项</SettingTitle>

			<SettingSwitch
				label="删除前确认"
				description="删除文件前显示确认对话框"
				checked={imageManager.confirmDelete !== false}
				onChange={(checked) =>
					updateImageManagerSettings({ confirmDelete: checked })
				}
			/>

			<SettingDescription>
				注意：支持 PNG, JPG, JPEG, GIF, BMP, WEBP, SVG, AGX 格式。
				<br />
				AGX文件将自动使用同名的SVG文件作为封面显示，引用检查也会基于SVG文件进行。
				<br />
				<strong>提示：</strong>自定义文件类型功能可以让您添加类似AGX的特殊文件格式，自动使用封面文件显示，删除和重命名时会同步处理原文件和封面。
			</SettingDescription>

			<SettingDivider />

			<SettingTitle>自定义文件类型</SettingTitle>
			<SettingDescription>
				配置需要特殊处理的文件格式。这些文件将使用指定的封面文件进行显示，删除和重命名时会同时处理原文件和封面文件。
			</SettingDescription>

			{customTypes.map((type, index) => (
				<div key={index} style={{ 
					border: "1px solid var(--background-modifier-border)", 
					borderRadius: "4px", 
					padding: "12px", 
					marginBottom: "12px" 
				}}>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
						<span style={{ fontWeight: 500 }}>配置 {index + 1}</span>
						<div style={{ display: "flex", gap: "8px" }}>
							<button
								onClick={() => updateCustomFileType(index, { enabled: !type.enabled })}
								style={{
									padding: "4px 12px",
									fontSize: "12px",
									background: type.enabled ? "var(--interactive-accent)" : "var(--background-modifier-border)",
									color: type.enabled ? "var(--text-on-accent)" : "var(--text-muted)",
									border: "none",
									borderRadius: "4px",
									cursor: "pointer",
								}}
							>
								{type.enabled ? "已启用" : "已禁用"}
							</button>
							<button
								onClick={() => removeCustomFileType(index)}
								style={{
									padding: "4px 12px",
									fontSize: "12px",
									background: "var(--background-modifier-error)",
									color: "var(--text-on-accent)",
									border: "none",
									borderRadius: "4px",
									cursor: "pointer",
								}}
							>
								删除
							</button>
						</div>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
						<div>
							<label style={{ fontSize: "13px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
								文件扩展名（如: agx）
							</label>
							<input
								type="text"
								value={type.fileExtension}
								onChange={(e) => updateCustomFileType(index, { fileExtension: e.target.value.toLowerCase() })}
								placeholder="例如: agx"
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
						</div>

						<div>
							<label style={{ fontSize: "13px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
								封面文件扩展名（如: svg, png）
							</label>
							<input
								type="text"
								value={type.coverExtension}
								onChange={(e) => updateCustomFileType(index, { coverExtension: e.target.value.toLowerCase() })}
								placeholder="例如: svg"
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
						</div>

						<div>
							<label style={{ fontSize: "13px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
								封面文件夹路径（相对路径，留空表示同级目录）
							</label>
							<input
								type="text"
								value={type.coverFolder}
								onChange={(e) => updateCustomFileType(index, { coverFolder: e.target.value })}
								placeholder="例如: covers 或留空"
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
						</div>
					</div>
				</div>
			))}

			<button
				onClick={addCustomFileType}
				style={{
					padding: "8px 16px",
					background: "var(--interactive-accent)",
					color: "var(--text-on-accent)",
					border: "none",
					borderRadius: "4px",
					cursor: "pointer",
					fontSize: "13px",
					fontWeight: 500,
				}}
			>
				+ 添加自定义文件类型
			</button>

			<SettingDivider />

			<SettingTitle>文件打开方式</SettingTitle>
			<SettingDescription>
				配置不同文件类型的打开方式。拖拽文件类型标签到相应区域来切换打开方式。
			</SettingDescription>

			<FileOpenModeConfig
				availableExtensions={allExtensions}
				fileOpenModes={imageManager.fileOpenModes || {}}
				onChange={(modes) => updateImageManagerSettings({ fileOpenModes: modes })}
			/>
		</>
	);
}
