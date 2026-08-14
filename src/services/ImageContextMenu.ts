import {
	App,
	Component,
	MarkdownView,
	Menu,
	MenuItem,
	Notice,
	TFile,
} from "obsidian";
import type { ImageManagerSettings } from "../types/image-manager.types";
import { SUPPORTED_IMAGE_EXTENSIONS } from "../types/image-manager.types";
import { ImagePosition, parseImageLink, updateImageLink } from "../utils/imageLink";
import { joinVaultPath, normalizeExtension, normalizeVaultFolder } from "../utils/vaultPaths";
import { DesktopIntegrationService } from "./DesktopIntegrationService";
import { EditorImageLinkService } from "./EditorImageLinkService";
import { ImageCaptionEditor } from "../components/ImageCaptionEditor";

type MenuItemWithSubmenu = MenuItem & { setSubmenu?: () => Menu; };

export class ImageContextMenu extends Component {
	private app: App;
	private settings: ImageManagerSettings;
	private contextImage: HTMLImageElement | null = null;
	private contextImageTimestamp = 0;
	private registeredDocuments = new Set<Document>();
	private isRegistered = false;
	private readonly desktop: DesktopIntegrationService;
	private readonly editorLinks: EditorImageLinkService;
	private captionEditor: ImageCaptionEditor | null = null;

	constructor(
		app: App,
		settings: ImageManagerSettings
	) {
		super();
		this.app = app;
		this.settings = settings;
		this.desktop = new DesktopIntegrationService(app);
		this.editorLinks = new EditorImageLinkService(app);
	}

	registerContextMenuListener(): void {
		if (this.isRegistered) return;
		this.isRegistered = true;
		this.registerDocument(document);
		this.app.workspace.iterateAllLeaves((leaf) => {
			this.registerDocument(leaf.view.containerEl.ownerDocument);
		});
		this.registerEvent(this.app.workspace.on("window-open", (_workspaceWindow, win) => {
			this.registerDocument(win.document);
		}));
		this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source) => {
			if (source !== "link-context-menu" || !(file instanceof TFile)) return;
			const target = this.contextImage;
			this.contextImage = null;
			if (
				!target ||
				Date.now() - this.contextImageTimestamp > 2000 ||
				!target.isConnected ||
				this.editorLinks.resolveImagePath(target) !== file.path
			) return;
			this.createContextMenuItems(menu, target);
		}));
	}

	private registerDocument(doc: Document): void {
		if (this.registeredDocuments.has(doc)) return;
		this.registeredDocuments.add(doc);
		this.registerDomEvent(doc, "contextmenu", (event) => {
			this.contextImage = null;
			const ownerWindow = doc.defaultView;
			if (!ownerWindow) return;
			const directImage = event.composedPath().find(
				(node): node is HTMLImageElement => node instanceof ownerWindow.HTMLImageElement,
			);
			const image = directImage;
			if (!image) return;
			if (!image.closest(".markdown-source-view, .markdown-preview-view, .markdown-rendered")) return;
			if (!image.closest(".internal-embed, .image-embed")) return;
			this.contextImage = image;
			this.contextImageTimestamp = Date.now();
		}, true);
	}

	onunload(): void {
		this.captionEditor?.close(false);
		this.captionEditor = null;
		this.contextImage = null;
		this.registeredDocuments.clear();
		this.isRegistered = false;
	}

	private createContextMenuItems(menu: Menu, img: HTMLImageElement): void {
		// 图片对齐
		this.addAlignmentSubmenu(menu, img);

		// 图片反色
		this.addDarkModeMenuItem(menu, img);

		// 编辑标题
		this.addEditCaptionMenuItem(menu, img);

		// 打开源文件
		this.addOpenSourceFileMenuItem(menu, img);

	}

	private addImageMenuItem(menu: Menu, configure: (item: MenuItem) => void): void {
		menu.addItem((item) => {
			item.setSection("image");
			configure(item);
		});
	}

	private addAlignmentSubmenu(menu: Menu, img: HTMLImageElement): void {
		this.addImageMenuItem(menu, (item) => {
			item.setTitle("图片位置").setIcon("layout-template");
			const submenuItem = item as MenuItemWithSubmenu;
			if (typeof submenuItem.setSubmenu !== "function") {
				item.setDisabled(true);
				return;
			}
			const submenu = submenuItem.setSubmenu();
			submenu.addItem((child) => child.setTitle("居中").setIcon("align-center")
				.onClick(() => void this.updateAlignment(img, "center")));
			submenu.addItem((child) => child.setTitle("左对齐").setIcon("align-left")
				.onClick(() => void this.updateAlignment(img, "align-left")));
			submenu.addItem((child) => child.setTitle("右对齐").setIcon("align-right")
				.onClick(() => void this.updateAlignment(img, "align-right")));
			submenu.addItem((child) => child.setTitle("左侧环绕").setIcon("panel-left")
				.onClick(() => void this.updateAlignment(img, "left")));
			submenu.addItem((child) => child.setTitle("右侧环绕").setIcon("panel-right")
				.onClick(() => void this.updateAlignment(img, "right")));
		});
	}

	private addDarkModeMenuItem(menu: Menu, img: HTMLImageElement): void {
		this.addImageMenuItem(menu, (item) => {
			item.setTitle("深色反色")
				.setIcon("moon")
				.onClick(() => void this.toggleDarkMode(img));
		});
	}

	private addEditCaptionMenuItem(menu: Menu, img: HTMLImageElement): void {
		this.addImageMenuItem(menu, (item) => {
			item.setTitle("编辑标题")
				.setIcon("captions")
				.onClick(() => void this.editCaption(img));
		});
	}

	private updateAlignment(img: HTMLImageElement, alignment: ImagePosition): void {
		const imagePath = this.editorLinks.resolveImagePath(img);
		if (!imagePath) {
			new Notice("无法获取图片路径");
			return;
		}

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice("请在编辑模式下使用");
			return;
		}

		const editor = activeView.editor;
		const match = this.editorLinks.findSingleMatch(editor, imagePath, img);
		if (!match) {
			new Notice("未找到图片链接");
			return;
		}

		const newLink = updateImageLink(match.fullMatch, { position: alignment });
		this.editorLinks.replace(editor, match, newLink);

		const labels: Record<ImagePosition, string> = {
			center: "居中",
			"align-left": "左对齐",
			"align-right": "右对齐",
			left: "左侧环绕",
			right: "右侧环绕",
			inline: "行间",
		};
		new Notice(`图片位置: ${labels[alignment]}`);
	}

	private toggleDarkMode(img: HTMLImageElement): void {
		const imagePath = this.editorLinks.resolveImagePath(img);
		if (!imagePath) {
			new Notice("无法获取图片路径");
			return;
		}

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice("请在编辑模式下使用");
			return;
		}

		const editor = activeView.editor;
		const match = this.editorLinks.findSingleMatch(editor, imagePath, img);
		if (!match) {
			new Notice("未找到图片链接");
			return;
		}

		const currentHasDark = parseImageLink(match.fullMatch)?.dark ?? false;
		const newLink = updateImageLink(match.fullMatch, { dark: !currentHasDark });
		this.editorLinks.replace(editor, match, newLink);

		new Notice(currentHasDark ? "已取消反色" : "已启用反色");
	}

	private addOpenSourceFileMenuItem(menu: Menu, img: HTMLImageElement): void {
		this.addImageMenuItem(menu, (item) => {
			item.setTitle("打开源文件").setIcon("file-text").onClick(async () => {
				const imagePath = this.editorLinks.resolveImagePath(img);
				if (!imagePath) {
					new Notice("无法获取图片路径");
					return;
				}

				const file = this.app.vault.getAbstractFileByPath(imagePath);
				if (!(file instanceof TFile)) {
					new Notice("文件不存在");
					return;
				}

				// 检查是否为自定义文件类型的封面文件
				const sourceFile = this.getSourceFileForCover(file);
				const fileToOpen = sourceFile || file;

				const ext = fileToOpen.extension.toLowerCase();
				if ((SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
					this.desktop.openWithDefaultApp(fileToOpen);
				} else {
					const leaf = this.app.workspace.getLeaf(false);
					void leaf.openFile(fileToOpen);
				}
			});
		});
	}

	/**
	 * 获取封面文件对应的源文件 (工程文件)
	 * 如果当前文件是某个自定义文件类型的封面, 返回对应的工程文件, 否则返回 null
	 */
	private getSourceFileForCover(coverFile: TFile): TFile | null {
		const customFileTypes = this.settings.customFileTypes || [];
		if (customFileTypes.length === 0) {
			return null;
		}

		const coverPath = coverFile.path;
		const coverExtension = coverFile.extension;

		// 遍历所有自定义文件类型配置
		for (const config of customFileTypes) {
			// 检查扩展名是否匹配
			if (config.coverExtension !== coverExtension) {
				continue;
			}

			// 尝试找到对应的工程文件
			const sourceFilePath = this.getSourcePathFromCover(coverPath, config);
			if (sourceFilePath) {
				const sourceFile = this.app.vault.getAbstractFileByPath(sourceFilePath);
				if (sourceFile instanceof TFile) {
					return sourceFile;
				}
			}
		}

		return null;
	}

	/**
	 * 从封面文件路径推导出源文件路径
	 */
	private getSourcePathFromCover(coverPath: string, config: { fileExtension: string; coverExtension: string; coverFolder: string; }): string | null {
		const separatorIndex = coverPath.lastIndexOf("/");
		const directory = separatorIndex >= 0 ? coverPath.substring(0, separatorIndex) : "";
		const fileName = separatorIndex >= 0 ? coverPath.substring(separatorIndex + 1) : coverPath;
		const baseName = fileName.substring(0, fileName.lastIndexOf("."));

		// 确定源文件所在的目录
		let sourceDir = directory;
		if (config.coverFolder && config.coverFolder.trim() !== "") {
			// 如果配置了封面文件夹, 需要从封面目录回到源文件目录
			const rawCoverFolder = config.coverFolder.trim();
			const coverFolder = normalizeVaultFolder(rawCoverFolder);

			if (rawCoverFolder.startsWith("/")) {
				// 绝对路径: 不支持反向推导
				return null;
			} else {
				// 相对路径: 移除封面文件夹部分
				if (directory.endsWith("/" + coverFolder)) {
					sourceDir = directory.substring(0, directory.length - coverFolder.length - 1);
				} else if (directory.endsWith(coverFolder)) {
					sourceDir = directory.substring(0, directory.length - coverFolder.length);
					if (sourceDir.endsWith("/")) {
						sourceDir = sourceDir.substring(0, sourceDir.length - 1);
					}
				} else {
					// 封面文件不在预期的文件夹中
					return null;
				}
			}
		}

		// 构建源文件路径
		return joinVaultPath(sourceDir, `${baseName}.${normalizeExtension(config.fileExtension)}`);
	}

	/**
	 * 编辑图片标题
	 */
	private editCaption(img: HTMLImageElement): void {
		const imagePath = this.editorLinks.resolveImagePath(img);
		if (!imagePath) {
			new Notice("无法获取图片路径");
			return;
		}

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice("请在编辑模式下使用");
			return;
		}

		const editor = activeView.editor;
		const match = this.editorLinks.findSingleMatch(editor, imagePath, img);
		if (!match) {
			new Notice("未找到图片链接");
			return;
		}

		const currentCaption = parseImageLink(match.fullMatch)?.caption ?? "";
		const imageEmbed = img.closest(".image-embed") as HTMLElement;
		if (!imageEmbed) {
			new Notice("无法找到图片容器");
			return;
		}

		this.captionEditor?.close(true);
		const captionEditor = new ImageCaptionEditor({
			imageEl: img,
			embedEl: imageEmbed,
			value: currentCaption,
			placeholder: "输入图片标题 (留空删除)",
			onSubmit: (caption) => {
				const currentLink = editor.getRange(
					{ line: match.lineNumber, ch: match.startCh },
					{ line: match.lineNumber, ch: match.endCh },
				);
				if (currentLink === match.fullMatch) {
					const replacement = updateImageLink(currentLink, { caption });
					if (replacement !== currentLink) {
						this.editorLinks.replace(editor, match, replacement);
					}
				} else {
					new Notice("图片链接已变化, 标题未保存");
				}
			},
			onClose: () => {
				if (this.captionEditor === captionEditor) this.captionEditor = null;
			},
		});
		this.captionEditor = captionEditor;
		captionEditor.open();
	}

}
