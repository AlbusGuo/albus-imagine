import {
	App,
	Component,
	Editor,
	MarkdownView,
	Menu,
	Notice,
	Platform,
	setIcon,
	TFile,
	View,
} from "obsidian";
import type AlbusImaginePlugin from "../main";
import type { ImageManagerSettings } from "../types/image-manager.types";

interface ImageMatch {
	lineNumber: number;
	line: string;
	fullMatch: string;
}

type FileExplorerView = { revealInFolder?: (file: TFile) => void };

export class ImageContextMenu extends Component {
	private app: App;
	private plugin: AlbusImaginePlugin;
	private settings: ImageManagerSettings;
	private contextMenuRegistered = false;
	private currentMenu: Menu | null = null;

	constructor(
		app: App,
		plugin: AlbusImaginePlugin,
		settings: ImageManagerSettings
	) {
		super();
		this.app = app;
		this.plugin = plugin;
		this.settings = settings;
	}

	registerContextMenuListener(): void {
		if (this.contextMenuRegistered) return;

		this.registerDomEvent(
			document,
			"contextmenu",
			this.handleContextMenuEvent,
			true
		);
		this.contextMenuRegistered = true;
	}

	private handleContextMenuEvent = (event: MouseEvent): void => {
		try {
			const target = event.target;
			if (!target || !(target instanceof HTMLElement)) return;

			// 检查是否在 Canvas 中
			const currentView = this.app.workspace.getActiveViewOfType(View);
			if (currentView?.getViewType() === "canvas") return;

			const img = target instanceof HTMLImageElement ? target : target.closest("img");
			if (!img) return;

			// 仅在编辑模式下工作
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView || activeView.getMode() !== 'source') return;

			// 检查是否在编辑器容器中
			if (!img.closest(".markdown-source-view")) return;

			// 不阻止默认事件，让 Obsidian 的原生菜单先显示
			// 延迟显示我们的菜单项，添加到原生菜单中
			setTimeout(() => {
				this.addMenuItemsToExistingMenu(img, event);
			}, 50); // 增加延迟时间，确保原生菜单已经完全显示
		} catch (error) {
			console.error('[ImageContextMenu] Error:', error);
		}
	};

	/**
	 * 将我们的菜单项添加到已存在的原生菜单中
	 */
	private addMenuItemsToExistingMenu(img: HTMLImageElement, event: MouseEvent): void {
		// 查找当前显示的右键菜单
		const menus = document.querySelectorAll('.menu');
		if (menus.length === 0) {
			// 如果没找到菜单，创建我们自己的菜单
			const menu = new Menu();
			this.createContextMenuItems(menu, img, event);
			menu.showAtMouseEvent(event);
			return;
		}

		// 找到最可能的目标菜单（通常是最后创建的）
		const targetMenu = menus[menus.length - 1] as HTMLElement;
		if (!targetMenu) return;

		// 检查是否已经有我们的项目，避免重复添加
		if (targetMenu.querySelector('.albus-imagine-separator')) return;

		// 获取菜单的第一个子元素（如果有）
		const firstChild = targetMenu.firstChild;

		// 添加分隔符到顶部
		const separator = document.createElement('div');
		separator.addClass('menu-separator', 'albus-imagine-separator');
		
		if (firstChild) {
			// 如果有子元素，在第一个元素前插入
			targetMenu.insertBefore(separator, firstChild);
		} else {
			// 如果没有子元素，直接添加
			targetMenu.appendChild(separator);
		}

		// 直接将我们的菜单项添加到现有菜单的顶部
		this.addCustomMenuItems(targetMenu, img, true);
	}

	/**
	 * 添加自定义菜单项到指定容器
	 */
	private addCustomMenuItems(container: HTMLElement, img: HTMLImageElement, addToTop: boolean = false): void {
		// 获取第一个子元素（用于插入到顶部）
		const firstChild = container.firstChild;

		// 添加分隔符
		const separator = this.createSeparator();
		if (addToTop && firstChild) {
			container.insertBefore(separator, firstChild);
		} else {
			container.appendChild(separator);
		}

		// 反转顺序创建菜单项
		this.createMenuItem(container, "删除链接", "trash-2", async () => {
			const imagePath = this.getImagePath(img);
			if (!imagePath) {
				new Notice("无法获取图片路径");
				return;
			}

			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) return;

			const editor = activeView.editor;
			const match = await this.findSingleImageMatch(editor, imagePath, img);
			if (!match) {
				new Notice("未找到图片链接");
				return;
			}

			this.removeImageLink(editor, match);
			new Notice("链接已删除");
		});

		this.createMenuItem(container, "打开源文件", "file-text", async () => {
			const imagePath = this.getImagePath(img);
			if (!imagePath) {
				new Notice("无法获取图片路径");
				return;
			}

			const file = this.app.vault.getAbstractFileByPath(imagePath);
			if (!(file instanceof TFile)) {
				new Notice("文件不存在");
				return;
			}

			const sourceFile = this.getSourceFileForCover(file);
			const fileToOpen = sourceFile || file;

			try {
				await this.app.workspace.openLinkText(fileToOpen.path, '', true);
			} catch (error) {
				console.error("打开文件失败:", error);
				new Notice("打开文件失败");
			}
		});

		this.createMenuItem(container, "编辑标题", "type", () => this.editCaption(img));
		this.createMenuItem(container, "深色反色", "moon", () => this.toggleDarkMode(img));
		this.createMenuItemWithSubmenu(container, "图片对齐", "align-center", img, [
			{ title: "居中", icon: "align-center", callback: () => this.updateAlignment(img, "center") },
			{ title: "左侧环绕", icon: "align-left", callback: () => this.updateAlignment(img, "left") },
			{ title: "右侧环绕", icon: "align-right", callback: () => this.updateAlignment(img, "right") }
		]);
	}

	/**
	 * 创建菜单项
	 */
	private createMenuItem(container: HTMLElement, title: string, icon: string, callback: (menuItem?: HTMLElement) => void | Promise<void>): void {
		const menuItem = document.createElement('div');
		menuItem.addClass('menu-item', 'albus-imagine-menu-item');
		
		// 创建图标
		const menuItemIcon = document.createElement('div');
		menuItemIcon.addClass('menu-item-icon');
		
		// 添加 lucide 图标
		setIcon(menuItemIcon, icon);
		
		// 创建标题
		const menuItemTitle = document.createElement('div');
		menuItemTitle.addClass('menu-item-title');
		menuItemTitle.textContent = title;
		
		menuItem.appendChild(menuItemIcon);
		menuItem.appendChild(menuItemTitle);
		
		// 添加点击事件
		menuItem.addEventListener('click', async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await callback(menuItem);
			// 关闭整个菜单
			const menu = container.closest('.menu') as HTMLElement;
			if (menu) {
				menu.remove();
			}
		});
		
		// 添加悬停事件
		menuItem.addEventListener('mouseenter', () => {
			menuItem.addClass('selected');
		});
		
		menuItem.addEventListener('mouseleave', () => {
			menuItem.removeClass('selected');
		});
		
		// 根据参数决定添加到顶部还是底部
		const firstChild = container.firstChild;
		if (firstChild) {
			container.insertBefore(menuItem, firstChild);
		} else {
			container.appendChild(menuItem);
		}
	}

	/**
	 * 创建带子菜单的菜单项
	 */
	private createMenuItemWithSubmenu(container: HTMLElement, title: string, icon: string, img: HTMLImageElement, submenuItems: Array<{title: string, icon: string, callback: () => void}>): void {
		const menuItem = document.createElement('div');
		menuItem.addClass('menu-item', 'albus-imagine-menu-item', 'has-submenu');
		
		// 创建图标
		const menuItemIcon = document.createElement('div');
		menuItemIcon.addClass('menu-item-icon');
		
		// 添加 lucide 图标
		setIcon(menuItemIcon, icon);
		
		// 创建标题
		const menuItemTitle = document.createElement('div');
		menuItemTitle.addClass('menu-item-title');
		menuItemTitle.textContent = title;
		
		// 创建子菜单箭头
		const submenuArrow = document.createElement('div');
		submenuArrow.addClass('menu-item-icon', 'submenu-arrow');
		setIcon(submenuArrow, 'chevron-right');
		
		menuItem.appendChild(menuItemIcon);
		menuItem.appendChild(menuItemTitle);
		menuItem.appendChild(submenuArrow);
		
		// 创建子菜单
		const submenu = document.createElement('div');
		submenu.addClass('menu', 'albus-imagine-submenu');
		
		// 添加子菜单项
		submenuItems.forEach(item => {
			const submenuItem = document.createElement('div');
			submenuItem.addClass('menu-item');
			
			const submenuItemIcon = document.createElement('div');
			submenuItemIcon.addClass('menu-item-icon');
			setIcon(submenuItemIcon, item.icon);
			
			const submenuItemTitle = document.createElement('div');
			submenuItemTitle.addClass('menu-item-title');
			submenuItemTitle.textContent = item.title;
			
			submenuItem.appendChild(submenuItemIcon);
			submenuItem.appendChild(submenuItemTitle);
			
			// 添加点击事件
			submenuItem.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				item.callback();
				// 关闭整个菜单
				const menu = container.closest('.menu') as HTMLElement;
				if (menu) {
					menu.remove();
				}
			});
			
			// 添加悬停事件
			submenuItem.addEventListener('mouseenter', () => {
				submenuItem.addClass('selected');
			});
			
			submenuItem.addEventListener('mouseleave', () => {
				submenuItem.removeClass('selected');
			});
			
			submenu.appendChild(submenuItem);
		});
		
		// 添加悬停事件显示子菜单
		let submenuTimeout: number | null = null;
		
		menuItem.addEventListener('mouseenter', () => {
			if (submenuTimeout) {
				clearTimeout(submenuTimeout);
				submenuTimeout = null;
			}
			
			// 添加选中样式
			menuItem.addClass('selected');
			
			// 先将子菜单添加到DOM中，但设为不可见，以便获取正确的尺寸
			submenu.style.position = 'fixed';
			submenu.style.visibility = 'hidden';
			submenu.style.zIndex = '1000';
			document.body.appendChild(submenu);
			
			const rect = menuItem.getBoundingClientRect();
			const parentRect = container.getBoundingClientRect();
			const submenuWidth = submenu.offsetWidth;
			
			// 计算子菜单位置
			let left = parentRect.right;
			let top = rect.top;
			
			// 检查是否超出屏幕右侧
			if (left + submenuWidth > window.innerWidth) {
				left = parentRect.left - submenuWidth; // 显示在左侧，紧贴主菜单
			}
			
			// 检查是否超出屏幕底部
			if (top + submenu.offsetHeight > window.innerHeight) {
				top = window.innerHeight - submenu.offsetHeight;
			}
			
			// 设置最终位置并显示
			submenu.style.left = `${left}px`;
			submenu.style.top = `${top}px`;
			submenu.style.visibility = 'visible';
		});
		
		menuItem.addEventListener('mouseleave', () => {
			menuItem.removeClass('selected');
			
			submenuTimeout = window.setTimeout(() => {
				if (!submenu.matches(':hover')) {
					submenu.remove();
				}
			}, 100);
		});
		
		submenu.addEventListener('mouseenter', () => {
			if (submenuTimeout) {
				clearTimeout(submenuTimeout);
				submenuTimeout = null;
			}
		});
		
		submenu.addEventListener('mouseleave', () => {
			submenu.remove();
		});
		
		// 根据参数决定添加到顶部还是底部
		const firstChild = container.firstChild;
		if (firstChild) {
			container.insertBefore(menuItem, firstChild);
		} else {
			container.appendChild(menuItem);
		}
	}

	/**
	 * 创建分隔符元素
	 */
	private createSeparator(): HTMLDivElement {
		const separator = document.createElement('div');
		separator.addClass('menu-separator', 'albus-imagine-separator');
		return separator;
	}

	private createContextMenuItems(menu: Menu, img: HTMLImageElement, event: MouseEvent): void {
		this.currentMenu = menu;

		// 图片对齐
		this.addAlignmentSubmenu(menu, img);

		// 图片反色
		this.addDarkModeMenuItem(menu, img);

		// 编辑标题
		this.addEditCaptionMenuItem(menu, img);

		// 打开源文件
		this.addOpenSourceFileMenuItem(menu, img);

		// 文件操作
		if (!Platform.isMobile) {
			this.addShowInNavigationMenuItem(menu, img);
			this.addShowInSystemExplorerMenuItem(menu, img);
		}

		// 删除链接
		this.addDeleteLinkMenuItem(menu, img);
	}

	private addAlignmentSubmenu(menu: Menu, img: HTMLImageElement): void {
		menu.addItem((item) => {
			item.setTitle("图片对齐").setIcon("align-left");
			const submenu = (item as any).setSubmenu() as Menu;

			submenu.addItem((subItem) => {
				subItem.setTitle("居中").setIcon("align-center");
				subItem.onClick(() => this.updateAlignment(img, "center"));
			});

			submenu.addItem((subItem) => {
				subItem.setTitle("左侧环绕").setIcon("align-left");
				subItem.onClick(() => this.updateAlignment(img, "left"));
			});

			submenu.addItem((subItem) => {
				subItem.setTitle("右侧环绕").setIcon("align-right");
				subItem.onClick(() => this.updateAlignment(img, "right"));
			});
		});
	}

	private addDarkModeMenuItem(menu: Menu, img: HTMLImageElement): void {
		menu.addItem((item) => {
			item.setTitle("深色反色")
				.setIcon("moon")
				.onClick(() => this.toggleDarkMode(img));
		});
	}

	private addEditCaptionMenuItem(menu: Menu, img: HTMLImageElement): void {
		menu.addItem((item) => {
			item.setTitle("编辑标题")
				.setIcon("text")
				.onClick(() => this.editCaption(img));
		});
	}

	private getCurrentAlignment(img: HTMLImageElement): "center" | "left" | "right" {
		const src = img.getAttribute("src") || "";
		
		// 从 src 中检查 # 语法：image#center 或 image#center#dark
		if (src.includes("#")) {
			const hashParts = src.split("#");
			for (const part of hashParts) {
				if (part === "center" || part === "left" || part === "right") {
					return part as "center" | "left" | "right";
				}
			}
		}

		// 从 alt 中检查 | 语法
		const alt = img.getAttribute("alt") || "";
		if (alt.includes("|")) {
			const parts = alt.split("|");
			for (const part of parts) {
				const trimmed = part.trim();
				if (trimmed === "center" || trimmed === "left" || trimmed === "right") {
					return trimmed as "center" | "left" | "right";
				}
			}
		}

		// 默认居中
		return "center";
	}

	private isDarkMode(img: HTMLImageElement): boolean {
		const src = img.getAttribute("src") || "";
		const alt = img.getAttribute("alt") || "";
		
		// 检查 # 语法中的 dark
		if (src.includes("#dark")) return true;
		
		// 检查 | 语法中的 dark
		if (alt.includes("|dark|") || alt.includes("|dark]")) return true;
		
		return false;
	}

	private async updateAlignment(img: HTMLImageElement, alignment: "center" | "left" | "right"): Promise<void> {
		const imagePath = this.getImagePath(img);
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
		const match = await this.findSingleImageMatch(editor, imagePath, img);
		if (!match) {
			new Notice("未找到图片链接");
			return;
		}

		const newLink = this.updateLinkAlignment(match.fullMatch, alignment);
		const line = editor.getLine(match.lineNumber);
		const newLine = line.replace(match.fullMatch, newLink);
		editor.setLine(match.lineNumber, newLine);

		new Notice(`对齐: ${alignment}`);
	}

	private async toggleDarkMode(img: HTMLImageElement): Promise<void> {
		const imagePath = this.getImagePath(img);
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
		const match = await this.findSingleImageMatch(editor, imagePath, img);
		if (!match) {
			new Notice("未找到图片链接");
			return;
		}

		// 基于当前链接内容判断是否有dark参数
		const currentHasDark = match.fullMatch.includes("#dark") || match.fullMatch.includes("|dark|") || match.fullMatch.includes("|dark]");
		const newLink = this.updateLinkDarkMode(match.fullMatch, !currentHasDark);
		const line = editor.getLine(match.lineNumber);
		const newLine = line.replace(match.fullMatch, newLink);
		editor.setLine(match.lineNumber, newLine);

		new Notice(currentHasDark ? "已取消反色" : "已启用反色");
	}

	/**
	 * 更新链接的对齐参数
	 * 语法规则：
	 * - 无标题：![[image|dark|position|size]] 或 ![[image|position|size]]
	 * - 有标题：![[image#position#dark|caption|size]] 或 ![[image#position|caption|size]]
	 */
	private updateLinkAlignment(link: string, alignment: "center" | "left" | "right"): string {
		if (!link.startsWith("![[") || !link.endsWith("]]")) {
			return link;
		}

		const inner = link.slice(3, -2);
		const parts = inner.split("|");
		const imagePath = parts[0];
		const hasHashSyntax = imagePath.includes("#");

		if (hasHashSyntax) {
			// # 语法：有标题
			const hashParts = imagePath.split("#");
			const baseImage = hashParts[0];
			const hasDark = hashParts.includes("dark");
			
			// 重建图片路径，新位置
			const newImagePath = hasDark ? `${baseImage}#${alignment}#dark` : `${baseImage}#${alignment}`;
			
			// 保留标题和尺寸
			const otherParts = parts.slice(1);
			if (otherParts.length > 0) {
				return `![[${newImagePath}|${otherParts.join("|")}]]`;
			} else {
				return `![[${newImagePath}]]`;
			}
		} else {
			// | 语法：无标题
			const baseImage = parts[0];
			const hasDark = parts.some(p => p.trim() === "dark");
			const size = parts.find(p => /^\d+$/.test(p.trim())) || "";

			// 重建链接：image|[dark|]position|[size]
			if (hasDark) {
				return size ? `![[${baseImage}|dark|${alignment}|${size}]]` : `![[${baseImage}|dark|${alignment}]]`;
			} else {
				return size ? `![[${baseImage}|${alignment}|${size}]]` : `![[${baseImage}|${alignment}]]`;
			}
		}
	}

	/**
	 * 更新链接的 dark 参数
	 * 语法规则：
	 * - 无标题：![[image|dark|position|size]] 或 ![[image|position|size]]
	 * - 有标题：![[image#position#dark|caption|size]] 或 ![[image#position|caption|size]]
	 */
	private updateLinkDarkMode(link: string, enableDark: boolean): string {
		if (!link.startsWith("![[") || !link.endsWith("]]")) {
			return link;
		}

		const inner = link.slice(3, -2);
		const parts = inner.split("|");
		const imagePath = parts[0];
		const hasHashSyntax = imagePath.includes("#");

		if (hasHashSyntax) {
			// # 语法：有标题
			const hashParts = imagePath.split("#");
			const baseImage = hashParts[0];
			const position = hashParts.find(p => ["center", "left", "right"].includes(p)) || "center";
			
			const newImagePath = enableDark ? `${baseImage}#${position}#dark` : `${baseImage}#${position}`;
			const otherParts = parts.slice(1);
			
			if (otherParts.length > 0) {
				return `![[${newImagePath}|${otherParts.join("|")}]]`;
			} else {
				return `![[${newImagePath}]]`;
			}
		} else {
			// | 语法：无标题
			const baseImage = parts[0];
			const position = parts.find(p => ["center", "left", "right"].includes(p.trim())) || "center";
			const size = parts.find(p => /^\d+$/.test(p.trim())) || "";

			// 重建链接：image|[dark|]position|[size]
			if (enableDark) {
				return size ? `![[${baseImage}|dark|${position}|${size}]]` : `![[${baseImage}|dark|${position}]]`;
			} else {
				return size ? `![[${baseImage}|${position}|${size}]]` : `![[${baseImage}|${position}]]`;
			}
		}
	}

	private addOpenSourceFileMenuItem(menu: Menu, img: HTMLImageElement): void {
		menu.addItem((item) => {
			item.setTitle("打开源文件").setIcon("file-text").onClick(async () => {
				const imagePath = this.getImagePath(img);
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

				try {
					await this.app.workspace.openLinkText(
						fileToOpen.path,
						'',
						true
					);
				} catch (error) {
					console.error("打开文件失败:", error);
					new Notice("打开文件失败");
				}
			});
		});
	}

	private addDeleteLinkMenuItem(menu: Menu, img: HTMLImageElement): void {
		menu.addItem((item) => {
			item.setTitle("删除链接").setIcon("trash").onClick(async () => {
				const imagePath = this.getImagePath(img);
				if (!imagePath) {
					new Notice("无法获取图片路径");
					return;
				}

				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!activeView) return;

				const editor = activeView.editor;
				const match = await this.findSingleImageMatch(editor, imagePath, img);
				if (!match) {
					new Notice("未找到图片链接");
					return;
				}

				this.removeImageLink(editor, match);
				new Notice("链接已删除");
			});
		});
	}

	private addShowInNavigationMenuItem(menu: Menu, img: HTMLImageElement): void {
		menu.addItem((item) => {
			item.setTitle("在文件管理器中显示").setIcon("folder-open").onClick(async () => {
				const imagePath = this.getImagePath(img);
				if (!imagePath) {
					new Notice("无法获取图片路径");
					return;
				}

				const file = this.app.vault.getAbstractFileByPath(imagePath);
				if (!(file instanceof TFile)) {
					new Notice("文件不存在");
					return;
				}

				// 获取或创建文件管理器视图
				let fileExplorerLeaf = this.app.workspace.getLeavesOfType("file-explorer")[0];
				if (!fileExplorerLeaf) {
					const newLeaf = this.app.workspace.getLeftLeaf(false);
					if (newLeaf) {
						await newLeaf.setViewState({ type: "file-explorer" });
						fileExplorerLeaf = newLeaf;
					}
				}

				if (fileExplorerLeaf) {
					// 展开左侧边栏
					const leftSplit = this.app.workspace.leftSplit;
					if (leftSplit && leftSplit.collapsed) {
						// @ts-ignore
						leftSplit.toggle();
					}

					// 在文件管理器中定位文件
					const view = fileExplorerLeaf.view as FileExplorerView;
					if (view.revealInFolder) {
						view.revealInFolder(file);
						new Notice("已在文件管理器中定位");
					}
				}
			});
		});
	}

	private addShowInSystemExplorerMenuItem(menu: Menu, img: HTMLImageElement): void {
		menu.addItem((item) => {
			item.setTitle("在系统资源管理器中显示").setIcon("folder").onClick(async () => {
				const imagePath = this.getImagePath(img);
				if (!imagePath) {
					new Notice("无法获取图片路径");
					return;
				}

				const file = this.app.vault.getAbstractFileByPath(imagePath);
				if (!(file instanceof TFile)) {
					new Notice("文件不存在");
					return;
				}

				try {
					// @ts-ignore - showInFolder is an internal API
					this.app.showInFolder(file.path);
					new Notice("已打开系统资源管理器");
				} catch (error) {
					console.error("Failed to show in system explorer:", error);
					new Notice("打开系统资源管理器失败");
				}
			});
		});
	}

	private getImagePath(img: HTMLImageElement): string | null {
		const src = img.getAttribute("src");
		if (!src) return null;

		try {
			// 方法1: 直接尝试作为相对路径
			let file = this.app.vault.getAbstractFileByPath(src);
			if (file instanceof TFile) return file.path;

			// 方法2: 处理 app:// 协议
			if (src.startsWith("app://")) {
				try {
					const url = new URL(src);
					let decodedPath = decodeURIComponent(url.pathname);
					
					// 移除开头的斜杠
					if (decodedPath.startsWith('/')) {
						decodedPath = decodedPath.substring(1);
					}
					
					// 尝试从 vault 名称后开始的路径
					const pathParts = decodedPath.split('/');
					if (pathParts.length > 1) {
						// 去掉第一个部分（vault名称）
						const vaultRelativePath = pathParts.slice(1).join('/');
						file = this.app.vault.getAbstractFileByPath(vaultRelativePath);
						if (file instanceof TFile) return file.path;
					}
					
					// 直接尝试完整解码路径
					file = this.app.vault.getAbstractFileByPath(decodedPath);
					if (file instanceof TFile) return file.path;
				} catch (e) {
					console.warn("Failed to parse app:// URL:", e);
				}
			}

			// 方法3: 尝试文件名匹配
			const fileName = src.split('/').pop();
			if (fileName) {
				const decodedFileName = decodeURIComponent(fileName).toLowerCase();
				const files = this.app.vault.getFiles();
				
				// 精确匹配（不区分大小写）
				const exactMatch = files.find(f => 
					f.name.toLowerCase() === decodedFileName
				);
				if (exactMatch) return exactMatch.path;
				
				// 如果文件名包含特殊字符，尝试匹配基础名称
				const baseFileName = decodedFileName.split('?')[0].split('#')[0];
				const baseMatch = files.find(f => 
					f.name.toLowerCase() === baseFileName
				);
				if (baseMatch) return baseMatch.path;
			}

			// 方法4: 从图片的父级元素获取信息
			const parentEmbed = img.closest('.internal-embed');
			if (parentEmbed) {
				const embedSrc = parentEmbed.getAttribute('src');
				if (embedSrc) {
					file = this.app.vault.getAbstractFileByPath(embedSrc);
					if (file instanceof TFile) return file.path;
				}
			}

			console.warn("Could not resolve image path from src:", src);
			return null;
		} catch (error) {
			console.error("Error getting image path:", error);
			return null;
		}
	}

	private async findSingleImageMatch(
		editor: Editor,
		imagePath: string,
		img?: HTMLImageElement
	): Promise<ImageMatch | null> {
		const matches = await this.findImageMatches(editor, imagePath);
		if (matches.length === 0) return null;
		if (matches.length === 1) return matches[0];

		// 多个匹配时，通过 DOM 位置定位
		if (img) {
			try {
				// @ts-ignore - CodeMirror 6 API
				const editorView = editor.cm;
				if (editorView?.posAtDOM) {
					// 获取光标在文档中的位置
					const imgPos = editorView.posAtDOM(img);
					if (imgPos !== null && imgPos !== undefined) {
						// @ts-ignore
						const lineObj = editorView.state.doc.lineAt(imgPos);
						const targetLine = lineObj.number - 1; // 转换为 0-based

						// 精确匹配行号
						const exactMatch = matches.find(m => m.lineNumber === targetLine);
						if (exactMatch) return exactMatch;

						// 找最接近的行
						let closestMatch = matches[0];
						let minDistance = Math.abs(matches[0].lineNumber - targetLine);
						
						for (const match of matches) {
							const distance = Math.abs(match.lineNumber - targetLine);
							if (distance < minDistance) {
								minDistance = distance;
								closestMatch = match;
							}
						}
						
						// 只有当距离合理时才返回最接近的匹配（例如 5 行以内）
						if (minDistance <= 5) {
							return closestMatch;
						}
					}
				}
			} catch (e) {
				console.warn("Failed to get position from DOM:", e);
			}
		}

		// Fallback: 返回第一个匹配
		return matches[0];
	}

	private async findImageMatches(editor: Editor, imagePath: string): Promise<ImageMatch[]> {
		const matches: ImageMatch[] = [];
		const lineCount = editor.lineCount();
		
		// 提取文件名和基础名称用于匹配
		const fileName = imagePath.split('/').pop()?.toLowerCase() || '';
		const baseName = fileName.replace(/\.[^.]+$/, ''); // 去掉扩展名

		for (let i = 0; i < lineCount; i++) {
			const line = editor.getLine(i);
			
			// 跳过不包含图片语法的行
			if (!line.includes('![[') && !line.includes('![')) continue;

			// 匹配 Wiki 链接: ![[image.png]] 或 ![[image.png|100]] 或 ![[folder/image.png]]
			const wikiRegex = /!\[\[([^\]|]+)(?:\|[^\]]+?)?\]\]/g;
			let match;
			while ((match = wikiRegex.exec(line)) !== null) {
				const fullMatch = match[0];
				const linkPath = match[1].trim();
				const linkFileName = linkPath.split('/').pop()?.toLowerCase() || '';
				const linkBaseName = linkFileName.replace(/\.[^.]+$/, '');

				// 精确文件名匹配或路径匹配
				if (linkFileName === fileName || 
					linkBaseName === baseName ||
					linkPath.toLowerCase() === imagePath.toLowerCase()) {
					matches.push({ lineNumber: i, line, fullMatch });
				}
			}

			// 匹配 Markdown 链接: ![alt](image.png) 或 ![](image.png)
			const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
			while ((match = mdRegex.exec(line)) !== null) {
				const fullMatch = match[0];
				const linkPath = decodeURIComponent(match[2].trim());
				const linkFileName = linkPath.split('/').pop()?.toLowerCase() || '';
				const linkBaseName = linkFileName.replace(/\.[^.]+$/, '');

				// 精确文件名匹配或路径匹配
				if (linkFileName === fileName || 
					linkBaseName === baseName ||
					linkPath.toLowerCase() === imagePath.toLowerCase()) {
					matches.push({ lineNumber: i, line, fullMatch });
				}
			}
		}

		return matches;
	}

	private removeImageLink(editor: Editor, match: ImageMatch): void {
		const line = editor.getLine(match.lineNumber);
		const before = line.substring(0, line.indexOf(match.fullMatch));
		const after = line.substring(line.indexOf(match.fullMatch) + match.fullMatch.length);

		if (line.trim() === match.fullMatch.trim()) {
			// 整行只有图片，删除整行
			editor.replaceRange("", 
				{ line: match.lineNumber, ch: 0 },
				{ line: match.lineNumber + 1, ch: 0 }
			);
		} else {
			// 只删除图片链接部分
			const newLine = before + after;
			editor.setLine(match.lineNumber, newLine);
		}
	}

	/**
	 * 获取封面文件对应的源文件（工程文件）
	 * 如果当前文件是某个自定义文件类型的封面，返回对应的工程文件，否则返回 null
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
	private getSourcePathFromCover(coverPath: string, config: { fileExtension: string; coverExtension: string; coverFolder: string }): string | null {
		const directory = coverPath.substring(0, coverPath.lastIndexOf("/"));
		const fileName = coverPath.substring(coverPath.lastIndexOf("/") + 1);
		const baseName = fileName.substring(0, fileName.lastIndexOf("."));

		// 确定源文件所在的目录
		let sourceDir = directory;
		if (config.coverFolder && config.coverFolder.trim() !== "") {
			// 如果配置了封面文件夹，需要从封面目录回到源文件目录
			const coverFolder = config.coverFolder.trim();
			
			if (coverFolder.startsWith("/")) {
				// 绝对路径：不支持反向推导
				return null;
			} else {
				// 相对路径：移除封面文件夹部分
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
		return `${sourceDir}/${baseName}.${config.fileExtension}`;
	}

	/**
	 * 编辑图片标题
	 */
	private async editCaption(img: HTMLImageElement): Promise<void> {
		const imagePath = this.getImagePath(img);
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
		const match = await this.findSingleImageMatch(editor, imagePath, img);
		if (!match) {
			new Notice("未找到图片链接");
			return;
		}

		// 获取当前标题
		const currentCaption = this.extractCaptionFromLink(match.fullMatch);

		// 找到图片容器（.image-embed）
		const imageEmbed = img.closest(".image-embed") as HTMLElement;
		if (!imageEmbed) {
			new Notice("无法找到图片容器");
			return;
		}

		// 创建输入框
		const input = document.createElement("input");
		input.type = "text";
		input.value = currentCaption;
		input.placeholder = "输入图片标题（留空删除）";
		input.className = "afm-caption-input";

		// 设置样式
		input.style.cssText = `
			display: block;
			width: 100%;
			margin: 0.5rem 0;
			padding: 0;
			font-size: 0.85rem;
			text-align: center;
			background: transparent;
			border: none;
			outline: none;
			box-shadow: none !important;
			box-sizing: border-box;
		`;

		// 将输入框插入到图片容器内部的最后
		imageEmbed.appendChild(input);
		
		// 隐藏标题的 ::after 伪元素，实现无缝编辑
		imageEmbed.addClass("afm-editing-caption");
		
		input.focus();
		input.select();

		// 处理保存
		const saveCaption = () => {
			const newCaption = input.value.trim();
			const newLink = this.updateLinkCaptionOnly(match.fullMatch, newCaption);
			const line = editor.getLine(match.lineNumber);
			
			// 先淡出输入框
			input.style.opacity = '0';
			
			// 精确替换：确保只替换正确的匹配项
			const startPos = line.indexOf(match.fullMatch);
			if (startPos !== -1) {
				const before = line.substring(0, startPos);
				const after = line.substring(startPos + match.fullMatch.length);
				const newLine = before + newLink + after;
				
				// 保存当前滚动位置
				const scrollTop = activeView.containerEl.scrollTop;
				
				// 等待淡出动画完成后更新内容
				setTimeout(() => {
					// 使用 requestAnimationFrame 确保 DOM 更新完成后再编辑
					requestAnimationFrame(() => {
						// 先更新编辑器内容
						editor.setLine(match.lineNumber, newLine);
						
						// 恢复滚动位置
						activeView.containerEl.scrollTop = scrollTop;
						
						// 然后移除输入框和恢复标题显示，避免闪动
						if (input.parentElement) {
							input.remove();
						}
						imageEmbed.removeClass("afm-editing-caption");
					});
				}, 150); // 等待淡出动画完成
			} else {
				// 如果找不到匹配项，等待淡出动画完成后移除输入框
				setTimeout(() => {
					if (input.parentElement) {
						input.remove();
					}
					imageEmbed.removeClass("afm-editing-caption");
				}, 150);
			}
		};

		

		// 事件监听器 - 只保留 blur 事件
		input.addEventListener("blur", () => {
			// 延迟执行，确保 blur 事件完成
			setTimeout(() => {
				if (document.contains(input)) {
					saveCaption();
				}
			}, 10);
		});
	}

	/**
	 * 从链接中提取标题
	 */
	private extractCaptionFromLink(link: string): string {
		if (!link.startsWith("![[") || !link.endsWith("]]")) {
			return "";
		}

		const inner = link.slice(3, -2);
		const parts = inner.split("|");

		if (parts.length < 2) {
			return "";
		}

		// 检查是否使用 # 语法
		const imagePath = parts[0];
		const hasHashSyntax = imagePath.includes("#");

		if (hasHashSyntax) {
			// # 语法：image#position[#dark]|[caption]|[size]
			// 标题是第一个非数字的部分
			for (let i = 1; i < parts.length; i++) {
				const part = parts[i].trim();
				if (!/^\d+$/.test(part)) {
					return part;
				}
			}
		} else {
			// | 语法：image|[dark|]position|[caption]|[size]
			// 需要过滤掉关键词和尺寸
			for (let i = 1; i < parts.length; i++) {
				const part = parts[i].trim();
				if (
					part !== "dark" &&
					!["center", "left", "right"].includes(part) &&
					!/^\d+$/.test(part)
				) {
					return part;
				}
			}
		}

		return "";
	}

	/**
	 * 仅更新链接中的标题部分
	 * 语法规则：
	 * - 无标题：![[image|dark|position|size]] 或 ![[image|position|size]]
	 * - 有标题：![[image#position#dark|caption|size]] 或 ![[image#position|caption|size]]
	 */
	private updateLinkCaptionOnly(link: string, caption: string): string {
		if (!link.startsWith("![[") || !link.endsWith("]]")) {
			return link;
		}

		const inner = link.slice(3, -2);
		const parts = inner.split("|");
		const imagePath = parts[0];
		const hasHashSyntax = imagePath.includes("#");

		// 提取现有参数
		let position = "center";
		let hasDark = false;
		let size = "";

		if (hasHashSyntax) {
			// 当前是 # 语法（有标题或曾经有标题）
			const hashParts = imagePath.split("#");
			const baseImage = hashParts[0];
			position = hashParts.find(p => ["center", "left", "right"].includes(p)) || "center";
			hasDark = hashParts.includes("dark");
			size = parts.find(p => /^\d+$/.test(p.trim())) || "";

			if (caption) {
				// 保持 # 语法，更新标题
				const newImagePath = hasDark ? `${baseImage}#${position}#dark` : `${baseImage}#${position}`;
				return size ? `![[${newImagePath}|${caption}|${size}]]` : `![[${newImagePath}|${caption}]]`;
			} else {
				// 删除标题，转换为 | 语法
				if (hasDark) {
					return size ? `![[${baseImage}|dark|${position}|${size}]]` : `![[${baseImage}|dark|${position}]]`;
				} else {
					return size ? `![[${baseImage}|${position}|${size}]]` : `![[${baseImage}|${position}]]`;
				}
			}
		} else {
			// 当前是 | 语法（无标题）
			const baseImage = parts[0];
			hasDark = parts.some(p => p.trim() === "dark");
			position = parts.find(p => ["center", "left", "right"].includes(p.trim())) || "center";
			size = parts.find(p => /^\d+$/.test(p.trim())) || "";

			if (caption) {
				// 添加标题，转换为 # 语法
				const newImagePath = hasDark ? `${baseImage}#${position}#dark` : `${baseImage}#${position}`;
				return size ? `![[${newImagePath}|${caption}|${size}]]` : `![[${newImagePath}|${caption}]]`;
			} else {
				// 保持 | 语法，无标题
				if (hasDark) {
					return size ? `![[${baseImage}|dark|${position}|${size}]]` : `![[${baseImage}|dark|${position}]]`;
				} else {
					return size ? `![[${baseImage}|${position}|${size}]]` : `![[${baseImage}|${position}]]`;
				}
			}
		}
	}

	onunload(): void {
		super.onunload();
		if (this.currentMenu) {
			this.currentMenu.hide();
			this.currentMenu = null;
		}
		this.contextMenuRegistered = false;
	}
}
