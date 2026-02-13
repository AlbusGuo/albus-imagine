import { App, FuzzySuggestModal } from 'obsidian';
import { MermaidMode } from '../utils/mermaidUtils';

interface MermaidTypeItem {
	id: MermaidMode;
	name: string;
}

/**
 * Mermaid 图表类型选择器
 */
export class MermaidTypePicker extends FuzzySuggestModal<MermaidTypeItem> {
	private onSelect: (item: MermaidTypeItem) => void;

	constructor(app: App, onSelect: (item: MermaidTypeItem) => void) {
		super(app);
		this.onSelect = onSelect;
	}

	/**
	 * 获取可选的图表类型
	 */
	getItems(): MermaidTypeItem[] {
		return [
			{ id: 'flowchart', name: '流程图 (Flowchart)' },
			{ id: 'sequence', name: '时序图 (Sequence)' },
			{ id: 'gantt', name: '甘特图 (Gantt)' },
			{ id: 'mindmap', name: '思维导图 (Mindmap)' },
			{ id: 'timeline', name: '时间线图 (Timeline)' },
			{ id: 'quadrant', name: '四象限图 (Quadrant)' },
			{ id: 'pie', name: '饼图 (Pie)' },
			{ id: 'sankey', name: '桑基图 (Sankey)' }
		];
	}

	/**
	 * 获取项目文本
	 */
	getItemText(item: MermaidTypeItem): string {
		return item.name;
	}

	/**
	 * 选择项目时的处理
	 */
	onChooseItem(item: MermaidTypeItem): void {
		this.onSelect(item);
	}
}