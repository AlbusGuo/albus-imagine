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
	public onCloseCallback: (() => void) | null = null;

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
			{ id: 'gantt', name: '甘特图 (Gantt)' },
			{ id: 'timeline', name: '时间线图 (Timeline)' },
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
		console.log('MermaidTypePicker: onChooseItem called with', item); // 调试信息
		this.onSelect(item);
		// 选择后手动关闭模态框
		this.close();
	}

	/**
	 * 关闭模态框时的处理
	 */
	onClose(): void {
		super.onClose();
	}
}