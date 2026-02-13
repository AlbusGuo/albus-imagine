import { App } from 'obsidian';
import { MermaidData, MindmapNode, generateUniqueName } from '../../utils/mermaidUtils';
import { BaseMermaidEditor } from './BaseMermaidEditor';

/**
 * 思维导图编辑器
 */
export class MindmapEditor extends BaseMermaidEditor {
	private eventListeners: Array<{ element: HTMLElement; event: string; handler: EventListener }> = [];

	constructor(
		app: App,
		data: MermaidData,
		updateCallback: (newData: Partial<MermaidData>) => void
	) {
		super(app, data, updateCallback);
	}

	/**
	 * 构建编辑器界面
	 */
	protected buildEditor(): void {
		// 确保 data 和 tree 都存在
		if (!this.data) {
			this.data = { tree: [] };
		}
		const tree = this.data.tree || [];
		
		// 确保 tree 是数组
		if (!Array.isArray(tree)) {
			console.warn('MindmapEditor: tree is not an array, resetting to empty array');
			this.data.tree = [];
		}

		// 确保容器可见
		this.containerEl.style.display = 'block';
		this.containerEl.style.visibility = 'visible';
		
		this.addSectionTitle('思维导图');

		// 构建父子关系映射（用于删除时连带子节点）
		const buildParentMap = (nodes: MindmapNode[]): Map<string, string> => {
			const parentMap = new Map<string, string>();
			for (let i = 0; i < nodes.length; i++) {
				const node = nodes[i];
				if (node.level === 0) continue;
				for (let j = i - 1; j >= 0; j--) {
					if (nodes[j].level < node.level) {
						parentMap.set(node.id, nodes[j].id);
						break;
					}
				}
			}
			return parentMap;
		};
		const parentMap = buildParentMap(tree);

		// 清除所有行的拖拽指示类
		const clearDragOver = (): void => {
			document.querySelectorAll('.ms-row.drag-over-top, .ms-row.drag-over-bottom').forEach(el => {
				el.classList.remove('drag-over-top', 'drag-over-bottom');
			});
		};

		// 渲染单个节点行（带拖拽手柄）
		const renderNodeRow = (node: MindmapNode): HTMLElement => {
			const row = this.createRow();

			// 拖拽手柄
			const dragHandle = this.createDragHandle();
			
			// 拖拽开始处理函数
			const onDragStart = (e: DragEvent) => {
				e.dataTransfer?.setData('text/plain', node.id);
				row.classList.add('dragging');
			};
			
			// 拖拽结束处理函数
			const onDragEnd = () => {
				row.classList.remove('dragging');
				clearDragOver();
			};
			
			dragHandle.addEventListener('dragstart', onDragStart);
			dragHandle.addEventListener('dragend', onDragEnd);
			
			// 保存事件监听器引用以便清理
			this.eventListeners.push(
				{ element: dragHandle, event: 'dragstart', handler: onDragStart },
				{ element: dragHandle, event: 'dragend', handler: onDragEnd }
			);
			row.appendChild(dragHandle);

			// 层级显示
			const levelSpan = this.createSpan(`L${node.level}`, 'ms-level');
			levelSpan.style.cssText = 'width:30px;text-align:center;font-size:12px;color:var(--text-muted)';
			row.appendChild(levelSpan);

			// 文本输入
			const textInput = this.createInput('节点内容', node.text || '');
			textInput.addEventListener('blur', (e) => {
				const next = tree.map(n => n.id === node.id ? { ...n, text: (e.target as HTMLInputElement).value } : n);
				this.updateData({ tree: next });
			});
			row.appendChild(textInput);

			// 层级调整按钮
			if (node.level > 0) {
				if (node.level > 1) {
					const upBtn = this.createBtn('←', () => {
						const next = tree.map(n => n.id === node.id ? { ...n, level: Math.max(1, n.level - 1) } : n);
						this.updateData({ tree: next });
					});
					row.appendChild(upBtn);
				}
				const downBtn = this.createBtn('→', () => {
					const next = tree.map(n => n.id === node.id ? { ...n, level: n.level + 1 } : n);
					this.updateData({ tree: next });
				});
				row.appendChild(downBtn);
			}

			// 删除按钮
			const delBtn = this.createIconBtn('×', () => {
				// 删除节点及其所有子节点
				const idsToDelete = new Set<string>();
				const collectChildren = (id: string): void => {
					idsToDelete.add(id);
					tree.forEach(n => {
						if (parentMap.get(n.id) === id) collectChildren(n.id);
					});
				};
				collectChildren(node.id);
				const next = tree.filter(n => !idsToDelete.has(n.id));
				this.updateData({ tree: next });
			});
			row.appendChild(delBtn);

			// 拖拽放置事件
			const onDragOver = (e: DragEvent) => {
				e.preventDefault();
				if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
				clearDragOver();
				const rect = row.getBoundingClientRect();
				const mouseY = e.clientY;
				const threshold = rect.top + rect.height / 2;
				if (mouseY < threshold) {
					row.classList.add('drag-over-top');
				} else {
					row.classList.add('drag-over-bottom');
				}
			};
			
			const onDragLeave = () => {
				row.classList.remove('drag-over-top', 'drag-over-bottom');
			};
			
			const onDrop = (e: DragEvent) => {
				e.preventDefault();
				clearDragOver();
				const sourceId = e.dataTransfer?.getData('text/plain');
				if (!sourceId) return;
				
				const sourceIndex = tree.findIndex(n => n.id === sourceId);
				const targetIndex = tree.findIndex(n => n.id === node.id);
				if (sourceIndex === -1 || targetIndex === -1) return;
				
				const rect = row.getBoundingClientRect();
				const mouseY = e.clientY;
				const insertBefore = mouseY < rect.top + rect.height / 2;
				
				let newTree = [...tree];
				const [moved] = newTree.splice(sourceIndex, 1);
				
				let insertPos = targetIndex;
				if (sourceIndex < targetIndex) {
					insertPos = insertBefore ? targetIndex - 1 : targetIndex;
				} else if (sourceIndex > targetIndex) {
					insertPos = insertBefore ? targetIndex : targetIndex + 1;
				}
				
				insertPos = Math.max(0, Math.min(newTree.length, insertPos));
				newTree.splice(insertPos, 0, moved);
				
				this.updateData({ tree: newTree });
			};
			
			row.addEventListener('dragover', onDragOver);
			row.addEventListener('dragleave', onDragLeave);
			row.addEventListener('drop', onDrop);
			
			// 保存事件监听器引用以便清理
			this.eventListeners.push(
				{ element: row, event: 'dragover', handler: onDragOver },
				{ element: row, event: 'dragleave', handler: onDragLeave },
				{ element: row, event: 'drop', handler: onDrop }
			);

			return row;
		};

		// 按顺序遍历所有节点，分组渲染
		let i = 0;
		while (i < tree.length) {
			const node = tree[i];
			
			if (node.level === 0) {
				// 根节点直接渲染
				this.containerEl.appendChild(renderNodeRow(node));
				i++;
			} 
			else if (node.level === 1) {
				// L1 节点：开始一个新的分组块
				const block = this.containerEl.createDiv('ms-mindmap-block');
				
				// 将当前 L1 节点加入块
				block.appendChild(renderNodeRow(node));
				i++;
				
				// 收集后续属于该分支的节点（level > 1 且直到遇到下一个 level <= 1 的节点）
				while (i < tree.length) {
					const nextNode = tree[i];
					if (nextNode.level <= 1) break;
					block.appendChild(renderNodeRow(nextNode));
					i++;
				}
			} 
			else {
				// 理论上不会出现 level>1 且前面没有 L1 的情况，但为安全起见，直接渲染
				this.containerEl.appendChild(renderNodeRow(node));
				i++;
			}
		}

		// 添加节点按钮
		const addBtn = this.createAddBtn('+ 添加节点', () => {
			const existingTexts = tree.map(n => n.text).filter(Boolean);
			const newText = generateUniqueName(existingTexts, '节点');
			const newId = 'n' + Date.now();
			const next = [...tree, { id: newId, text: newText, level: 1 }];
			if (next.length === 1) next[0].level = 0;
			this.updateData({ tree: next });
		});
		
		// 确保按钮和容器可见
		addBtn.style.display = 'block';
		addBtn.style.visibility = 'visible';
		this.containerEl.appendChild(addBtn);
		
		// 确保整个容器可见
		this.containerEl.style.display = 'block';
		this.containerEl.style.visibility = 'visible';
		this.containerEl.style.opacity = '1';
	}

	/**
	 * 清理事件监听器
	 */
	public cleanup(): void {
		this.eventListeners.forEach(({ element, event, handler }) => {
			element.removeEventListener(event, handler);
		});
		this.eventListeners = [];
	}
}