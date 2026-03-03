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

			// 仅对 Wiki 链接图片（![[]]）显示菜单，跳过 Markdown 链接图片（![]()）
			// Wiki 链接使用 .internal-embed 包裹，而 Markdown 链接虽也可能在 .image-embed 中，但不会在 .internal-embed 中
			if (!img.closest(".internal-embed")) return;

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
		if (targetMenu.querySelector('[data-albus-imagine]')) return;

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

		this.createMenuItem(container, "编辑标题", "type", () => void this.editCaption(img));
		this.createMenuItem(container, "深色反色", "moon", () => void this.toggleDarkMode(img));
		this.createMenuItemWithSubmenu(container, "图片对齐", "align-center", img, [
			{ title: "居中", icon: "align-center", callback: () => void this.updateAlignment(img, "center") },
			{ title: "左侧环绕", icon: "align-left", callback: () => void this.updateAlignment(img, "left") },
			{ title: "右侧环绕", icon: "align-right", callback: () => void this.updateAlignment(img, "right") }
		]);
	}

	/**
	 * 创建菜单项
	 */
	private createMenuItem(container: HTMLElement, title: string, icon: string, callback: (menuItem?: HTMLElement) => void | Promise<void>): void {
		const menuItem = document.createElement('div');
		menuItem.addClass('menu-item', 'tappable');
		menuItem.setAttribute('data-albus-imagine', '');
		
		// 创建图标
		const menuItemIcon = document.createElement('div');
		menuItemIcon.addClass('menu-item-icon');
		setIcon(menuItemIcon, icon);
		
		// 创建标题
		const menuItemTitle = document.createElement('div');
		menuItemTitle.addClass('menu-item-title');
		menuItemTitle.textContent = title;
		
		menuItem.appendChild(menuItemIcon);
		menuItem.appendChild(menuItemTitle);
		
		// 添加点击事件
		menuItem.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			void (async () => {
				await callback(menuItem);
				this.closeAllMenus(container);
			})();
		});
		
		// 添加悬停事件
		menuItem.addEventListener('mouseenter', () => {
			container.querySelectorAll('.menu-item.selected').forEach(el => {
				el.removeClass('selected');
			});
			menuItem.addClass('selected');
			document.querySelectorAll('.albus-imagine-submenu').forEach(el => el.remove());
		});
		
		menuItem.addEventListener('mouseleave', () => {
			menuItem.removeClass('selected');
		});
		
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
		menuItem.addClass('menu-item', 'tappable');
		menuItem.setAttribute('data-albus-imagine', '');
		
		// 创建图标
		const menuItemIcon = document.createElement('div');
		menuItemIcon.addClass('menu-item-icon');
		setIcon(menuItemIcon, icon);
		
		// 创建标题
		const menuItemTitle = document.createElement('div');
		menuItemTitle.addClass('menu-item-title');
		menuItemTitle.textContent = title;
		
		// 创建子菜单箭头
		const submenuArrow = document.createElement('div');
		submenuArrow.addClass('menu-item-icon', 'afm-submenu-arrow');
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
			submenuItem.addClass('menu-item', 'tappable');
			
			const submenuItemIcon = document.createElement('div');
			submenuItemIcon.addClass('menu-item-icon');
			setIcon(submenuItemIcon, item.icon);
			
			const submenuItemTitle = document.createElement('div');
			submenuItemTitle.addClass('menu-item-title');
			submenuItemTitle.textContent = item.title;
			
			submenuItem.appendChild(submenuItemIcon);
			submenuItem.appendChild(submenuItemTitle);
			
			// 添加点击事件 — 同时关闭子菜单和主菜单
			submenuItem.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				item.callback();
				// 先移除子菜单，再关闭主菜单
				submenu.remove();
				this.closeAllMenus(container);
			});
			
			submenuItem.addEventListener('mouseenter', () => {
				submenu.querySelectorAll('.menu-item.selected').forEach(el => {
					el.removeClass('selected');
				});
				submenuItem.addClass('selected');
			});
			
			submenuItem.addEventListener('mouseleave', () => {
				submenuItem.removeClass('selected');
			});
			
			submenu.appendChild(submenuItem);
		});
		
		// 添加悬停事件显示子菜单
		let submenuTimeout: number | null = null;
		
		const showSubmenu = () => {
			if (submenuTimeout) {
				clearTimeout(submenuTimeout);
				submenuTimeout = null;
			}
			
			// 移除同级已打开的子菜单
			document.querySelectorAll('.albus-imagine-submenu').forEach(el => el.remove());
			
			// 取消同级菜单中所有项的选中状态
			container.querySelectorAll('.menu-item.selected').forEach(el => {
				el.removeClass('selected');
			});
			menuItem.addClass('selected');
			
			// 添加子菜单到 DOM 并定位
			submenu.addClass('afm-context-submenu', 'is-measuring');
			document.body.appendChild(submenu);
			
			const rect = menuItem.getBoundingClientRect();
			const parentRect = container.getBoundingClientRect();
			const submenuWidth = submenu.offsetWidth;
			
			let left = parentRect.right;
			let top = rect.top;
			
			if (left + submenuWidth > window.innerWidth) {
				left = parentRect.left - submenuWidth;
			}
			if (top + submenu.offsetHeight > window.innerHeight) {
				top = window.innerHeight - submenu.offsetHeight;
			}
			
			submenu.setCssProps({
				'--submenu-left': `${left}px`,
				'--submenu-top': `${top}px`,
			});
			submenu.removeClass('is-measuring');
		};
		
		const hideSubmenu = () => {
			submenuTimeout = window.setTimeout(() => {
				if (!submenu.matches(':hover')) {
					submenu.remove();
				}
			}, 100);
		};
		
		menuItem.addEventListener('mouseenter', showSubmenu);
		
		menuItem.addEventListener('mouseleave', () => {
			menuItem.removeClass('selected');
			hideSubmenu();
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
		
		// 添加到顶部
		const firstChild = container.firstChild;
		if (firstChild) {
			container.insertBefore(menuItem, firstChild);
		} else {
			container.appendChild(menuItem);
		}
	}

	/**
	 * 关闭所有菜单（主菜单和子菜单）
	 */
	private closeAllMenus(container: HTMLElement): void {
		// 移除所有自定义子菜单
		document.querySelectorAll('.albus-imagine-submenu').forEach(el => el.remove());
		// 移除主菜单
		const menu = container.closest('.menu') as HTMLElement;
		if (menu) {
			menu.remove();
		}
	}

	/**
	 * 创建分隔符元素
	 */
	private createSeparator(): HTMLDivElement {
		const separator = document.createElement('div');
		separator.addClass('menu-separator');
		separator.setAttribute('data-albus-imagine', '');
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
			const submenu = (item as unknown as { setSubmenu: () => Menu }).setSubmenu();

			submenu.addItem((subItem) => {
				subItem.setTitle("居中").setIcon("align-center");
				subItem.onClick(() => void this.updateAlignment(img, "center"));
			});

			submenu.addItem((subItem) => {
				subItem.setTitle("左侧环绕").setIcon("align-left");
				subItem.onClick(() => void this.updateAlignment(img, "left"));
			});

			submenu.addItem((subItem) => {
				subItem.setTitle("右侧环绕").setIcon("align-right");
				subItem.onClick(() => void this.updateAlignment(img, "right"));
			});
		});
	}

	private addDarkModeMenuItem(menu: Menu, img: HTMLImageElement): void {
		menu.addItem((item) => {
			item.setTitle("深色反色")
				.setIcon("moon")
				.onClick(() => void this.toggleDarkMode(img));
		});
	}

	private addEditCaptionMenuItem(menu: Menu, img: HTMLImageElement): void {
		menu.addItem((item) => {
			item.setTitle("编辑标题")
				.setIcon("text")
				.onClick(() => void this.editCaption(img));
		});
	}

	private getCurrentAlignment(img: HTMLImageElement): "center" | "left" | "right" {
		const src = img.getAttribute("src") || "";
		
		// 从 src 中检查 # 语法：image#center 或 image#center#dark
		if (src.includes("#")) {
			const hashParts = src.split("#");
			for (const part of hashParts) {
				if (part === "center" || part === "left" || part === "right") {
					return part;
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
					return trimmed;
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
			item.setTitle("在系统资源管理器中显示").setIcon("folder").onClick(() => {
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
		const matches = this.findImageMatches(editor, imagePath);
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

	private findImageMatches(editor: Editor, imagePath: string): ImageMatch[] {
		const matches: ImageMatch[] = [];
		const lineCount = editor.lineCount();
		
		// 提取文件名和基础名称用于匹配
		const fileName = imagePath.split('/').pop()?.toLowerCase() || '';
		const baseName = fileName.replace(/\.[^.]+$/, ''); // 去掉扩展名

		for (let i = 0; i < lineCount; i++) {
			const line = editor.getLine(i);
			
			// 跳过不包含 Wiki 链接语法的行
			if (!line.includes('![[')) continue;

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

		// 创建多行文本输入框（自动调节高度）
		const textarea = document.createElement("textarea");
		textarea.value = currentCaption;
		textarea.placeholder = "输入图片标题（留空删除）";
		textarea.className = "afm-caption-input";
		textarea.rows = 1;

		// 自动调节高度
		const autoResize = () => {
			textarea.setCssProps({ '--caption-height': 'auto' });
			textarea.setCssProps({ '--caption-height': textarea.scrollHeight + 'px' });
		};
		textarea.addEventListener('input', autoResize);

		// 阻止 Enter 换行，Enter 保存
		textarea.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				textarea.blur();
			}
		});

		// 将输入框插入到图片容器内部的最后
		imageEmbed.appendChild(textarea);
		
		// 隐藏标题的 ::after 伪元素，实现无缝编辑
		imageEmbed.addClass("afm-editing-caption");
		
		// 初始化高度并聚焦
		setTimeout(autoResize, 0);
		textarea.focus();
		textarea.select();

		// 处理保存
		const saveCaption = () => {
			const newCaption = textarea.value.replace(/\n/g, ' ').trim();
			const newLink = this.updateLinkCaptionOnly(match.fullMatch, newCaption);
			const line = editor.getLine(match.lineNumber);
			
			textarea.addClass('afm-fade-out');
			
			const startPos = line.indexOf(match.fullMatch);
			if (startPos !== -1) {
				const before = line.substring(0, startPos);
				const after = line.substring(startPos + match.fullMatch.length);
				const newLine = before + newLink + after;
				
				const scrollTop = activeView.containerEl.scrollTop;
				
				setTimeout(() => {
					requestAnimationFrame(() => {
						editor.setLine(match.lineNumber, newLine);
						activeView.containerEl.scrollTop = scrollTop;
						
						if (textarea.parentElement) {
							textarea.remove();
						}
						imageEmbed.removeClass("afm-editing-caption");
					});
				}, 150);
			} else {
				setTimeout(() => {
					if (textarea.parentElement) {
						textarea.remove();
					}
					imageEmbed.removeClass("afm-editing-caption");
				}, 150);
			}
		};

		textarea.addEventListener("blur", () => {
			setTimeout(() => {
				if (document.contains(textarea)) {
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
