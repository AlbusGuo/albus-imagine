import { App } from 'obsidian';
import { MermaidMode, MermaidData } from '../utils/mermaidUtils';
import { TimelineEditor } from './editors/TimelineEditor';
import { QuadrantEditor } from './editors/QuadrantEditor';
import { FlowchartEditor } from './editors/FlowchartEditor';
import { GanttEditor } from './editors/GanttEditor';
import { SequenceEditor } from './editors/SequenceEditor';
import { PieEditor } from './editors/PieEditor';
import { MindmapEditor } from './editors/MindmapEditor';
import { SankeyEditor } from './editors/SankeyEditor';
import { BaseMermaidEditor } from './editors/BaseMermaidEditor';

/**
 * Mermaid 编辑器面板
 */
export class MermaidEditorPanel {
	private app: App;
	private activeMode: MermaidMode;
	private modeData: MermaidData;
	private updateCallback: (newData: Partial<MermaidData>) => void;
	private containerEl: HTMLElement;
	private currentEditor: BaseMermaidEditor | null = null;

	constructor(
		app: App,
		activeMode: MermaidMode,
		modeData: MermaidData,
		updateCallback: (newData: Partial<MermaidData>) => void
	) {
		this.app = app;
		this.activeMode = activeMode;
		this.modeData = modeData;
		this.updateCallback = updateCallback;
		this.containerEl = document.createElement('div');
		this.containerEl.className = 'ms-editor-panel';
		this.buildEditorPanel();
	}

	/**
	 * 获取面板元素
	 */
	getElement(): HTMLElement {
		return this.containerEl;
	}

	/**
	 * 构建编辑器面板
	 */
	private buildEditorPanel(): void {
		this.containerEl.innerHTML = '';
		
		// 根据当前模式创建对应的编辑器
		let editor;
		switch (this.activeMode) {
			case 'timeline':
				editor = new TimelineEditor(this.app, this.modeData, this.updateCallback);
				break;
			case 'quadrant':
				editor = new QuadrantEditor(this.app, this.modeData, this.updateCallback);
				break;
			case 'flowchart':
				editor = new FlowchartEditor(this.app, this.modeData, this.updateCallback);
				break;
			case 'gantt':
				editor = new GanttEditor(this.app, this.modeData, this.updateCallback);
				break;
			case 'sequence':
				editor = new SequenceEditor(this.app, this.modeData, this.updateCallback);
				break;
			case 'pie':
				editor = new PieEditor(this.app, this.modeData, this.updateCallback);
				break;
			case 'mindmap':
				editor = new MindmapEditor(this.app, this.modeData, this.updateCallback);
				break;
			case 'sankey':
				editor = new SankeyEditor(this.app, this.modeData, this.updateCallback);
				break;
			default:
				return;
		}

		this.currentEditor = editor;
		const editorElement = editor.getElement();
		
		// 确保思维导图编辑器能正确显示
		if (this.activeMode === 'mindmap') {
			// 强制显示思维导图编辑器
			editorElement.style.display = 'block';
			editorElement.style.visibility = 'visible';
		}
		
		this.containerEl.appendChild(editorElement);
		
		// 确保容器可见
		this.containerEl.style.display = 'block';
		this.containerEl.style.visibility = 'visible';
	}

	/**
	 * 清理编辑器
	 */
	public cleanup(): void {
		if (this.currentEditor && 'cleanup' in this.currentEditor) {
			(this.currentEditor as any).cleanup();
		}
		this.currentEditor = null;
	}
}