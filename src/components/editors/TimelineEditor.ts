import { App } from 'obsidian';
import { MermaidData, TimelineItem, generateUniqueName } from '../../utils/mermaidUtils';
import { BaseMermaidEditor } from './BaseMermaidEditor';

/**
 * 时间线图编辑器
 */
export class TimelineEditor extends BaseMermaidEditor {
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
		const items = this.data.items as TimelineItem[] || [];
		const config = this.data.config || {};
		const theme = this.data.theme || 'default';

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
		
		// 主题选择
		const themeRow = this.createRow();
		const themeLabel = this.createSpan('主题:');
		themeLabel.style.cssText = 'flex:0 0 80px';
		themeRow.appendChild(themeLabel);
		
		const themeSelect = this.createSelect(
			['默认', '基础', '森林', '暗色', '中性'],
			['default', 'base', 'forest', 'dark', 'neutral'],
			theme
		);
		themeSelect.addEventListener('change', (e) => {
			this.updateData({ theme: (e.target as HTMLSelectElement).value });
		});
		themeRow.appendChild(themeSelect);

		// 时间段
		this.addSectionTitle('时间段');
		items.forEach((it, i) => {
			const itemContainer = this.containerEl.createDiv('ms-timeline-item');
			itemContainer.style.cssText = 'margin-bottom: 12px; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
			
			// 时期和分组行
			const headerRow = this.createRow();
			headerRow.style.marginBottom = '8px';
			
			// 时期输入
			const periodInput = this.createInput('时期', it.period || '', 'flex:0 0 120px');
			periodInput.addEventListener('blur', (e) => {
				const next = [...items];
				next[i].period = (e.target as HTMLInputElement).value;
				this.updateData({ items: next as TimelineItem[] });
			});
			headerRow.appendChild(periodInput);
			
			// 分组输入
			const sectionInput = this.createInput('分组(可选)', it.section || '', 'flex:0 0 120px');
			sectionInput.addEventListener('blur', (e) => {
				const next = [...items];
				// 确保分组只应用于当前时间段
				next[i].section = (e.target as HTMLInputElement).value || undefined;
				this.updateData({ items: next as TimelineItem[] });
			});
			headerRow.appendChild(sectionInput);
			
			itemContainer.appendChild(headerRow);
			
			// 事件列表
			const eventsContainer = itemContainer.createDiv('ms-events-container');
			
			const events = it.events || [];
			events.forEach((event, eventIndex) => {
				const eventRow = this.createRow();
				
				const eventInput = this.createInput('事件', event, 'flex:1');
				eventInput.addEventListener('blur', (e) => {
					const next = [...items];
					const nextEvents = [...(next[i].events || [])];
					nextEvents[eventIndex] = (e.target as HTMLInputElement).value;
					next[i].events = nextEvents;
					this.updateData({ items: next as TimelineItem[] });
				});
				
				const removeEventBtn = this.createIconBtn('×', () => {
					const next = [...items];
					const nextEvents = [...(next[i].events || [])];
					nextEvents.splice(eventIndex, 1);
					next[i].events = nextEvents;
					this.updateData({ items: next as TimelineItem[] });
				});
				
				eventRow.appendChild(eventInput);
				eventRow.appendChild(removeEventBtn);
				eventsContainer.appendChild(eventRow);
			});
			
			// 添加事件和删除时间段按钮容器
			const buttonContainer = eventsContainer.createDiv('ms-button-container');
			buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 4px;';
			
			// 添加事件按钮
			const addEventBtn = this.createAddBtn('+ 添加事件', () => {
				const next = [...items];
				const nextEvents = [...(next[i].events || [])];
				// 生成预设名称，考虑当前时间段内的事件
				const existingEventNames = nextEvents.filter(e => e.trim());
				const newEventName = generateUniqueName(existingEventNames, '事件');
				nextEvents.push(newEventName);
				next[i].events = nextEvents;
				this.updateData({ items: next as TimelineItem[] });
			});
			addEventBtn.style.flex = '1';
			buttonContainer.appendChild(addEventBtn);
			
			// 删除时间段按钮
			const delBtn = this.createAddBtn('× 删除时间段', () => {
				this.updateData({ items: items.filter((_, idx) => idx !== i) as TimelineItem[] });
			});
			delBtn.style.flex = '1';
			delBtn.style.backgroundColor = '#ff4444';
			delBtn.style.color = 'white';
			buttonContainer.appendChild(delBtn);
			
			this.containerEl.appendChild(itemContainer);
		});

		// 添加时间段按钮
		const addBtn = this.createAddBtn('+ 添加时间段', () => {
			const newPeriod = generateUniqueName(items.map(it => it.period), '时期');
			// 为新时间段生成预设的事件名称
			const newEvent = generateUniqueName([], '事件');
			this.updateData({ items: [...items, { period: newPeriod, events: [newEvent] }] as TimelineItem[] });
		});
		this.containerEl.appendChild(addBtn);
	}
}