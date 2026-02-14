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
	private currentEditorPanel: MermaidEditorPanel | null = null;
	private renderTimeout: number | null = null;

	constructor(app: App, editor: Editor, initialMode?: MermaidMode) {
		super(app);
		this.editor = editor;
		this.activeMode = initialMode || 'flowchart';
		this.modeData = this.getDefaultData(this.activeMode);
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
			
			flowchart: {
				nodes: [
					{ id: 'start', label: '节点1', shape: 'rect', group: '' }
				],
				edges: [],
				config: { direction: 'TD' }
			},
			gantt: {
				tasks: [
					{ 
						name: '示例任务', 
						startDate: '2024-01-01', 
						endDate: '2024-01-03',
						status: 'active',
						section: ''
					}
				],
				config: { title: '甘特图', timeFormat: 'date' }
			},
			pie: {
				items: [
					{ label: '类别1', value: 30 },
					{ label: '类别2', value: 45 },
					{ label: '类别3', value: 25 }
				] as any,
				config: { title: '', showData: false }
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
	 * 更新模式数据（优化版本，避免闪烁）
	 */
	private updateModeData(newData: Partial<MermaidData>): void {
		// 合并数据
		this.modeData = { ...this.modeData, ...newData };
		
		// 使用防抖渲染预览，避免频繁更新
		this.debouncedRenderPreview();
		
		// 注意：不要调用编辑器面板的updateData，会造成循环调用
		// 编辑器已经通过notifyDataUpdate通知了我们，我们只需要更新预览即可
	}

	/**
	 * 防抖渲染预览
	 */
	private debouncedRenderPreview = this.debounce(() => {
		this.renderPreview();
	}, 100);

	/**
	 * 简单的防抖函数
	 */
	private debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
		let timeout: number;
		return ((...args: Parameters<T>) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => func(...args), wait);
		}) as T;
	}

	/**
	 * 打开模态框
	 */
	onOpen(): void {
		// 直接构建编辑器，不需要选择逻辑
		this.buildEditor();
		this.renderPreview();
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
		this.currentEditorPanel = new MermaidEditorPanel(
			this.app,
			this.activeMode,
			this.modeData,
			(newData) => this.updateModeData(newData)
		);
		body.appendChild(this.currentEditorPanel.getElement());

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