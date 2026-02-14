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

		// 配置选项
		this.addSectionTitle('配置');
		
		// 标题输入
		const titleRow = this.createRow();
		const titleLabel = this.createSpan('标题:');
		titleLabel.style.cssText = 'flex:0 0 80px';
		titleRow.appendChild(titleLabel);
		
		const titleInput = this.createInput('标题', config.title || '');
		titleInput.addEventListener('blur', (e) => {
			this.updateData({ config: { ...config, title: (e.target as HTMLInputElement).value } });
		});
		titleRow.appendChild(titleInput);
		
		// 时间格式选择
		const formatRow = this.createRow();
		const formatLabel = this.createSpan('时间格式:');
		formatLabel.style.cssText = 'flex:0 0 80px';
		formatRow.appendChild(formatLabel);
		
		const formatSelect = this.createSelect(
			['日期', '时间'],
			['date', 'time'],
			config.timeFormat || 'date'
		);
		formatSelect.addEventListener('change', (e) => {
			const timeFormat = (e.target as HTMLSelectElement).value;
			const newConfig = { 
				...config, 
				timeFormat,
				dateFormat: timeFormat === 'time' ? 'HH:mm' : 'YYYY-MM-DD',
				axisFormat: timeFormat === 'time' ? '%H:%M' : '%Y-%m-%d',
				tickInterval: timeFormat === 'time' ? '1hour' : '1day'
			};
			
			// 切换时间格式时，重置任务数据以避免格式不匹配
			const updatedTasks = tasks.map(task => {
				const now = new Date();
				if (timeFormat === 'time') {
					// 切换到时间格式，设置今天的时间
					const startHour = now.getHours();
					const endHour = Math.min(startHour + 1, 23); // 至少推进1小时
					return {
						...task,
						startDate: `${startHour.toString().padStart(2, '0')}:00`,
						endDate: `${endHour.toString().padStart(2, '0')}:00`
					};
				} else {
					// 切换到日期格式，设置未来7天的日期
					const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天后
					const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // 再推进1天
					return {
						...task,
						startDate: startDate.toISOString().split('T')[0],
						endDate: endDate.toISOString().split('T')[0]
					};
				}
			});
			
			this.updateData({ config: newConfig, tasks: updatedTasks });
		});
		formatRow.appendChild(formatSelect);

		// 任务
		this.addSectionTitle('任务');
		tasks.forEach((task, i) => {
			const taskContainer = this.containerEl.createDiv('ms-gantt-task');
			taskContainer.style.cssText = 'margin-bottom: 12px; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
			
			// 任务名称和分组行
			const headerRow = this.createRow();
			headerRow.style.marginBottom = '8px';
			
			// 任务名称输入
			const nameInput = this.createInput('任务名称', task.name || '', 'flex:0 0 150px');
			nameInput.addEventListener('blur', (e) => {
				const next = [...tasks];
				next[i].name = (e.target as HTMLInputElement).value;
				this.updateData({ tasks: next });
			});
			headerRow.appendChild(nameInput);
			
			// 分组输入
			const sectionInput = this.createInput('分组(可选)', task.section || '', 'flex:0 0 120px');
			sectionInput.addEventListener('blur', (e) => {
				const next = [...tasks];
				next[i].section = (e.target as HTMLInputElement).value || undefined;
				this.updateData({ tasks: next });
			});
			headerRow.appendChild(sectionInput);
			
			// 状态选择（包含里程碑）
			const statusOptions = ['默认', '进行中', '完成', '关键', '里程碑'];
			const statusValues = ['', 'active', 'done', 'crit', 'milestone'];
			const currentStatus = task.isMilestone ? 'milestone' : (task.status || '');
			const statusSelect = this.createSelect(
				statusOptions,
				statusValues,
				currentStatus,
				'flex:0 0 80px'
			);
			statusSelect.addEventListener('change', (e) => {
				const next = [...tasks];
				const value = (e.target as HTMLSelectElement).value;
				next[i].isMilestone = value === 'milestone';
				next[i].status = value === 'milestone' ? '' : value;
				// 如果是里程碑，将结束日期设为与开始日期相同
				if (value === 'milestone') {
					next[i].endDate = next[i].startDate;
				}
				this.updateData({ tasks: next });
				// 刷新编辑器以更新日期输入框的禁用状态
				this.refreshEditor();
			});
			headerRow.appendChild(statusSelect);
			
			taskContainer.appendChild(headerRow);
			
			// 日期行
			const dateRow = this.createRow();
			
			// 开始日期
			const startDateLabel = this.createSpan('开始日期:');
			startDateLabel.style.cssText = 'flex:0 0 80px';
			dateRow.appendChild(startDateLabel);
			
			const startDateInput = this.createInput('', task.startDate || '', 'flex:1', config.timeFormat === 'time' ? 'time' : 'date');
			startDateInput.addEventListener('blur', (e) => {
				const next = [...tasks];
				next[i].startDate = (e.target as HTMLInputElement).value;
				this.updateData({ tasks: next });
			});
			dateRow.appendChild(startDateInput);
			
			// 结束日期
			const endDateLabel = this.createSpan('结束日期:');
			endDateLabel.style.cssText = 'flex:0 0 80px';
			dateRow.appendChild(endDateLabel);
			
			const endDateInput = this.createInput('', task.endDate || '', 'flex:1', config.timeFormat === 'time' ? 'time' : 'date');
			// 里程碑任务的结束日期禁用且与开始日期相同
			endDateInput.disabled = task.isMilestone || false;
			endDateInput.addEventListener('blur', (e) => {
				const next = [...tasks];
				if (!next[i].isMilestone) {
					next[i].endDate = (e.target as HTMLInputElement).value;
				}
				this.updateData({ tasks: next });
			});
			dateRow.appendChild(endDateInput);
			
			taskContainer.appendChild(dateRow);
			
			// 删除按钮
			const delBtn = this.createAddBtn('× 删除任务', () => {
				this.updateData({ tasks: tasks.filter((_, idx) => idx !== i) });
			});
			delBtn.style.backgroundColor = '#ff4444';
			delBtn.style.color = 'white';
			delBtn.style.marginTop = '8px';
			taskContainer.appendChild(delBtn);
			
			this.containerEl.appendChild(taskContainer);
		});

		// 添加任务按钮
		const addBtn = this.createAddBtn('+ 添加任务', () => {
			const existingNames = tasks.map(t => t.name).filter(Boolean);
			const newName = generateUniqueName(existingNames, '任务');
			const timeFormat = config.timeFormat || 'date';
			const now = new Date();
			
			let startDate, endDate;
			if (timeFormat === 'time') {
				// 时间格式：当前时间，至少推进1小时
				const startHour = now.getHours();
				const endHour = Math.min(startHour + 1, 23); // 至少推进1小时，不超过23
				startDate = `${startHour.toString().padStart(2, '0')}:00`;
				endDate = `${endHour.toString().padStart(2, '0')}:00`;
			} else {
				// 日期格式：当前时间推进7天，至少推进1天
				startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
				endDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
			}
			
			this.updateData({ 
				tasks: [...tasks, { 
					name: newName, 
					startDate, 
					endDate,
					status: '', 
					section: '' 
				}] 
			});
		});
		this.containerEl.appendChild(addBtn);
	}
	
	/**
	 * 更新编辑器数据
	 */
	updateData(newData: Partial<MermaidData>): void {
		// 先更新数据
		this.data = { ...this.data, ...newData };
		
		// 通知父组件数据已更新
		this.notifyDataUpdate(newData);
		
		// 重建编辑器
		this.containerEl.empty();
		this.buildEditor();
	}
	
	/**
	 * 刷新编辑器
	 */
	private refreshEditor(): void {
		this.containerEl.empty();
		this.buildEditor();
	}
}