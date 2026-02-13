import { App } from 'obsidian';
import { MermaidData, GanttTask, generateUniqueName } from '../../utils/mermaidUtils';
import { BaseMermaidEditor } from './BaseMermaidEditor';

/**
 * 甘特图编辑器
 */
export class GanttEditor extends BaseMermaidEditor {
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
		const tasks = this.data.tasks || [];
		const config = this.data.config || {};

		// 项目配置
		this.addSectionTitle('项目配置');
		let row = this.createRow();
		const titleInput = this.createInput('标题', config.title || '');
		titleInput.addEventListener('blur', (e) => {
			this.updateData({ config: { ...config, title: (e.target as HTMLInputElement).value } });
		});
		row.appendChild(titleInput);
		
		const startInput = this.createInput('开始日期', config.start || '', 'flex:0 0 130px', 'date');
		startInput.addEventListener('change', (e) => {
			this.updateData({ config: { ...config, start: (e.target as HTMLInputElement).value } });
		});
		row.appendChild(startInput);

		// 任务
		this.addSectionTitle('任务');
		tasks.forEach((t, i) => {
			row = this.createRow();
			const nameInput = this.createInput('任务名', t.name || '');
			nameInput.addEventListener('blur', (e) => {
				const next = [...tasks];
				next[i].name = (e.target as HTMLInputElement).value;
				this.updateData({ tasks: next });
			});
			
			const statusSelect = this.createSelect(
				['默认', '进行中', '完成', '关键'],
				['', 'active', 'done', 'crit'],
				t.status || '',
				'flex:0 0 80px'
			);
			statusSelect.addEventListener('change', (e) => {
				const next = [...tasks];
				next[i].status = (e.target as HTMLSelectElement).value;
				this.updateData({ tasks: next });
			});

			const depInput = this.createInput('依赖任务名（可选）', t.dep || '', 'flex:0 0 120px');
			depInput.addEventListener('blur', (e) => {
				const next = [...tasks];
				next[i].dep = (e.target as HTMLInputElement).value;
				this.updateData({ tasks: next });
			});

			const durInput = this.createInput('时长', t.duration || '1d', 'flex:0 0 60px');
			durInput.addEventListener('blur', (e) => {
				const next = [...tasks];
				next[i].duration = (e.target as HTMLInputElement).value;
				this.updateData({ tasks: next });
			});
			
			const delBtn = this.createIconBtn('×', () => {
				this.updateData({ tasks: tasks.filter((_, idx) => idx !== i) });
			});
			
			row.appendChild(nameInput);
			row.appendChild(statusSelect);
			row.appendChild(depInput);
			row.appendChild(durInput);
			row.appendChild(delBtn);
		});

		// 添加任务按钮
		const addBtn = this.createAddBtn('+ 添加任务', () => {
			const existingNames = tasks.map(t => t.name).filter(Boolean);
			const newName = generateUniqueName(existingNames, '任务');
			this.updateData({ tasks: [...tasks, { name: newName, duration: '1d', status: '', dep: '' }] });
		});
		this.containerEl.appendChild(addBtn);
	}
}