import { App, Editor, MarkdownView, Modal, Notice, Component, MarkdownRenderer } from 'obsidian';
import { MermaidViewport } from '../components/MermaidViewport';
import { MermaidTypePicker } from '../components/MermaidTypePicker';
import { MermaidEditorPanel } from '../components/MermaidEditorPanel';
import { MermaidData, MermaidMode, generateMermaidCode } from '../utils/mermaidUtils';

/**
 * Mermaid 编辑器模态框
 */
export class MermaidEditorModal extends Modal {
	private editor: Editor;
	private viewport: MermaidViewport | null = null;
	private animationFrameId: number | null = null;
	private activeMode: MermaidMode = 'flowchart';
	private modeData: MermaidData;
	private previewCanvas: HTMLElement;
	private zoomPercent: HTMLButtonElement;
	private isInitialized: boolean = false;

	constructor(app: App, editor: Editor, initialMode?: MermaidMode) {
		super(app);
		this.editor = editor;
		this.activeMode = initialMode || 'flowchart';
		this.modeData = this.getDefaultData(this.activeMode);
		this.isInitialized = !!initialMode;
	}

	/**
	 * 获取各模式的默认数据
	 */
	private getDefaultData(mode: MermaidMode): MermaidData {
		const defaults: Record<MermaidMode, MermaidData> = {
			timeline: {
				items: [
					{ period: '时期1', events: ['事件1'] },
					{ period: '时期2', events: ['事件1'] }
				],
				config: { title: '' },
				theme: 'default'
			},
			quadrant: {
				points: [
					{ name: '点1', x: 0.3, y: 0.8 },
					{ name: '点2', x: 0.7, y: 0.2 }
				],
				config: { title: '四象限分析', xLeft: '低', xRight: '高', yDown: '不足', yUp: '充足' }
			},
			flowchart: {
				nodes: [
					{ id: 'start', label: '节点1', shape: 'rect', group: '' }
				],
				edges: [],
				config: { direction: 'TD' }
			},
			gantt: {
				tasks: [],
				config: { title: '', timeFormat: 'date' }
			},
			sequence: {
				participants: [
					{ name: '角色1', type: 'participant' },
					{ name: '角色2', type: 'participant' }
				],
				messages: [{ from: '角色1', to: '角色2', text: '消息1', arrow: '实线带箭头' }]
			},
			pie: {
				items: [
					{ label: '类别1', value: 30 },
					{ label: '类别2', value: 45 },
					{ label: '类别3', value: 25 }
				] as any,
				config: { title: '', showData: false }
			},
			mindmap: {
				tree: [
					{ id: 'root', text: '根节点', level: 0 },
					{ id: 'n1', text: '节点1', level: 1 },
					{ id: 'n2', text: '节点2', level: 2 }
				]
			},
			sankey: {
				map: {
					'Source1': [
						{ target: 'Target1', value: 10 },
						{ target: 'Target2', value: 20 }
					],
					'Source2': [
						{ target: 'Target1', value: 15 }
					]
				},
				config: { showValues: false }
			}
		};
		return defaults[mode] || {};
	}

	/**
	 * 生成 Mermaid 代码
	 */
	private generateCode(): string {
		return generateMermaidCode(this.activeMode, this.modeData);
	}

	/**
	 * 渲染预览
	 */
	private renderPreview(): void {
		if (!this.previewCanvas) return;
		this.previewCanvas.innerHTML = '';
		const mermaidCode = this.generateCode();
		
		// 直接使用源码的渲染方式
		this.renderWithObsidian(this.previewCanvas, mermaidCode);
	}

	/**
	 * 使用 Obsidian 渲染 Mermaid
	 */
	private renderWithObsidian(container: HTMLElement, mermaidCode: string): void {
		// 按照源码的方式渲染
		const wrapped = '```mermaid\n' + mermaidCode + '\n```';
		
		try {
			// 清理容器
			container.innerHTML = '';
			
			MarkdownRenderer.render(this.app, wrapped, container, '', new Component());
			
		} catch (error) {
			console.error('Obsidian Mermaid 渲染错误:', error);
			// 降级到代码显示
			container.innerHTML = '';
			const codeEl = container.createEl('pre');
			codeEl.textContent = wrapped;
			codeEl.style.cssText = 'padding: 10px; background: var(--background-secondary); border-radius: 4px; color: var(--text-normal); font-family: monospace; overflow: auto; max-height: 90%; white-space: pre-wrap;';
		}
	}

	/**
	 * 更新模式数据
	 */
	private updateModeData(newData: Partial<MermaidData>): void {
		this.modeData = { ...this.modeData, ...newData };
		this.renderPreview();
		// 重新构建编辑面板（按照源码的方式）
		this.rebuildEditorPanel();
	}

	/**
	 * 重新构建编辑面板
	 */
	private rebuildEditorPanel(): void {
		const editorPanelEl = this.contentEl.querySelector('.ms-editor-panel') as HTMLElement;
		if (editorPanelEl) {
			// 创建新的编辑器面板
			const newEditorPanel = new MermaidEditorPanel(
				this.app,
				this.activeMode,
				this.modeData,
				(newData) => this.updateModeData(newData)
			);
			
			// 替换旧的编辑器面板
			const oldPanel = editorPanelEl;
			const newPanel = newEditorPanel.getElement();
			oldPanel.parentNode?.replaceChild(newPanel, oldPanel);
		}
	}

	/**
	 * 打开模态框
	 */
	onOpen(): void {
		if (!this.isInitialized) {
			// 完全隐藏模态框，防止空模态框显示
			this.modalEl.style.display = 'none';
			
			// 显示类型选择器
			const typePicker = new MermaidTypePicker(this.app, (item) => {
				this.activeMode = item.id;
				this.modeData = this.getDefaultData(this.activeMode);
				this.isInitialized = true;
				
				// 延迟构建编辑器，确保类型选择器关闭后再构建
				setTimeout(() => {
					// 先构建编辑器，确保内容已准备好
					this.buildEditor();
					
					// 构建完成后再显示模态框
					this.modalEl.style.display = '';
					
					// 多次渲染确保图形正常显示
					this.renderPreview();
					setTimeout(() => {
						this.renderPreview();
					}, 100);
					setTimeout(() => {
						this.renderPreview();
					}, 300);
				}, 100);
			});
			typePicker.open();
		} else {
			this.buildEditor();
			// 多次渲染确保图形正常显示
			this.renderPreview();
			setTimeout(() => {
				this.renderPreview();
			}, 100);
			setTimeout(() => {
				this.renderPreview();
			}, 300);
		}
	}

	/**
	 * 构建编辑器界面
	 */
	private buildEditor(): void {
		// 清理之前的资源
		this.cleanup();
		
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('mermaid-super-modal');
		
		// 为模态框添加专用类名，确保样式不影响其他模态框
		this.modalEl.addClass('mermaid-editor-modal');
		
		// 强制设置模态框样式，使用更合理的大小
		this.modalEl.style.setProperty('width', '85vw', 'important');
		this.modalEl.style.setProperty('height', '85vh', 'important');
		this.modalEl.style.setProperty('max-width', '85vw', 'important');
		this.modalEl.style.setProperty('max-height', '85vh', 'important');
		
		// 确保内容容器填充整个模态框
		contentEl.style.setProperty('width', '100%', 'important');
		contentEl.style.setProperty('height', '100%', 'important');
		contentEl.style.setProperty('padding', '0', 'important');
		contentEl.style.setProperty('margin', '0', 'important');
		
		if (contentEl.parentElement) {
			(contentEl.parentElement as HTMLElement).style.setProperty('padding', '0', 'important');
			(contentEl.parentElement as HTMLElement).style.setProperty('margin', '0', 'important');
		}

		// 创建主布局
		const root = contentEl.createDiv('ms-root');
		const body = root.createDiv('ms-body');

		// 左侧编辑区
		const editorPanel = new MermaidEditorPanel(
			this.app,
			this.activeMode,
			this.modeData,
			(newData) => this.updateModeData(newData)
		);
		body.appendChild(editorPanel.getElement());

		// 右侧预览区
		const previewPanel = body.createDiv('ms-preview-panel');
		const viewportWrap = previewPanel.createDiv('ms-viewport-wrap');
		const viewport = viewportWrap.createDiv('ms-viewport');

		// 缩放控制
		const zoomControls = previewPanel.createDiv('ms-zoom-controls');
		this.zoomPercent = zoomControls.createEl('button', { text: '100%', cls: 'ms-btn' });
		
		// 按照源码使用 onclick
		this.zoomPercent.onclick = () => {
			this.viewport?.resetZoomAndCenter();
		};

		// 确认按钮
		const confirmBtn = previewPanel.createEl('button');
		confirmBtn.className = 'ms-confirm-btn';
		confirmBtn.textContent = '确认';
		// 按照源码使用 onclick
		confirmBtn.onclick = () => {
			const code = '```mermaid\n' + this.generateCode() + '\n```\n\n';
			this.editor.replaceSelection(code);
			new Notice('图表已插入');
			this.close();
		};

		// 创建画布容器
		this.previewCanvas = viewport.createDiv('ms-canvas');

		// 按照源码的方式初始化视口
		setTimeout(() => {
			if (viewport) {
				const layer = viewport.createDiv('ms-zoom-layer');
				layer.style.transform = 'translate(-50%, -50%) scale(1)';
				layer.appendChild(this.previewCanvas);
				viewport.appendChild(layer);
				
				// 设置初始滚动使画布居中
				viewport.scrollLeft = layer.clientWidth / 2 - viewport.clientWidth / 2;
				viewport.scrollTop = layer.clientHeight / 2 - viewport.clientHeight / 2;

				this.viewport = new MermaidViewport(viewport, this.previewCanvas, () => this.renderPreview());
				
				this.zoomPercent.onclick = () => {
					this.viewport?.resetZoomAndCenter();
				};

				const updateZoomText = () => {
					if (!this.viewport) return;
					this.zoomPercent.textContent = Math.round(this.viewport.zoom * 100) + '%';
					this.animationFrameId = requestAnimationFrame(updateZoomText);
				};
				this.animationFrameId = requestAnimationFrame(updateZoomText);
				
				// 多次渲染确保图形正常显示
				this.renderPreview();
				setTimeout(() => {
					this.renderPreview();
				}, 100);
				setTimeout(() => {
					this.renderPreview();
				}, 300);
			}
		}, 0);
	}

	/**
	 * 清理资源
	 */
	private cleanup(): void {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		if (this.viewport) {
			this.viewport.destroy();
			this.viewport = null;
		}
		
		// 清理编辑器面板
		const editorPanel = this.contentEl.querySelector('.ms-editor-panel') as any;
		if (editorPanel && editorPanel.cleanup) {
			editorPanel.cleanup();
		}
	}

	/**
	 * 关闭模态框
	 */
	onClose(): void {
		this.cleanup();
		this.contentEl.empty();
	}
}