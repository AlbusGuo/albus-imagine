import { App, ToggleComponent } from 'obsidian';
import { MermaidData, generateUniqueName } from '../../utils/mermaidUtils';
import { BaseMermaidEditor } from './BaseMermaidEditor';

interface PieItem {
	label: string;
	value: number;
}

/**
 * 饼图编辑器
 */
export class PieEditor extends BaseMermaidEditor {
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
		const items = this.data.items as PieItem[] || [];
		const config = this.data.config || {};

		// 配置选项
		this.addSectionTitle('配置');
		
		// 标题输入
		const titleRow = this.createRow();
		const titleLabel = this.createSpan('标题:');
		titleLabel.style.cssText = 'flex:0 0 80px';
		titleRow.appendChild(titleLabel);
		
		const titleInput = this.createInput('标题', config.title || '');
		titleInput.addEventListener('blur', (e) => {
			this.updateData({ 
				config: { 
					...config, 
					title: (e.target as HTMLInputElement).value 
				} 
			});
		});
		titleRow.appendChild(titleInput);
		
		// 显示数据选项
		const showDataRow = this.createRow();
		const showDataLabel = this.createSpan('显示数据:');
		showDataLabel.style.cssText = 'flex:0 0 80px';
		showDataRow.appendChild(showDataLabel);
		
		const toggleContainer = showDataRow.createDiv('ms-toggle-container');
		const showDataToggle = new ToggleComponent(toggleContainer);
		showDataToggle.setValue(config.showData !== undefined ? config.showData : false);
		showDataToggle.onChange((value) => {
			this.updateData({ 
				config: { 
					...config, 
					showData: value 
				} 
			});
		});
		showDataRow.appendChild(toggleContainer);

		// 数据项
		this.addSectionTitle('数据项');
		items.forEach((it, i) => {
			const row = this.createRow();
			const labelInput = this.createInput('标签', it.label || '');
			labelInput.addEventListener('blur', (e) => {
				const next = [...items];
				next[i].label = (e.target as HTMLInputElement).value;
				this.updateData({ items: next as PieItem[] });
			});
			
			const valueInput = this.createInput('数值', String(it.value ?? 0), 'flex:0 0 80px', 'number', '1');
			valueInput.addEventListener('blur', (e) => {
				const next = [...items];
				next[i].value = Number((e.target as HTMLInputElement).value);
				this.updateData({ items: next as PieItem[] });
			});
			
			const delBtn = this.createIconBtn('×', () => {
				this.updateData({ items: items.filter((_, idx) => idx !== i) as PieItem[] });
			});
			
			row.appendChild(labelInput);
			row.appendChild(valueInput);
			row.appendChild(delBtn);
		});

		// 添加数据按钮
		const addBtn = this.createAddBtn('+ 添加数据', () => {
			const existingLabels = items.map(it => it.label).filter(Boolean);
			const newLabel = generateUniqueName(existingLabels, '类别');
			this.updateData({ items: [...items, { label: newLabel, value: 10 }] as PieItem[] });
		});
		this.containerEl.appendChild(addBtn);
	}
}