import { App } from 'obsidian';
import { MermaidData, SequenceParticipant, SequenceMessage, generateUniqueName } from '../../utils/mermaidUtils';
import { BaseMermaidEditor } from './BaseMermaidEditor';

/**
 * 时序图编辑器
 */
export class SequenceEditor extends BaseMermaidEditor {
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
		const participants = this.data.participants || [];
		const messages = this.data.messages || [];

		// 参与者
		this.addSectionTitle('参与者');
		participants.forEach((p, i) => {
			const row = this.createRow();
			const nameInput = this.createInput('名称', p.name || '');
			nameInput.addEventListener('blur', (e) => {
				const next = [...participants];
				next[i].name = (e.target as HTMLInputElement).value;
				this.updateData({ participants: next });
			});
			
			const typeSelect = this.createSelect(
				['参与者', '角色'],
				['participant', 'actor'],
				p.type || 'participant',
				'flex:0 0 80px'
			);
			typeSelect.addEventListener('change', (e) => {
				const next = [...participants];
				next[i].type = (e.target as HTMLSelectElement).value;
				this.updateData({ participants: next });
			});
			
			const delBtn = this.createIconBtn('×', () => {
				this.updateData({ participants: participants.filter((_, idx) => idx !== i) });
			});
			
			row.appendChild(nameInput);
			row.appendChild(typeSelect);
			row.appendChild(delBtn);
		});

		// 添加参与者按钮
		const addParticipantBtn = this.createAddBtn('+ 添加参与者', () => {
			const existingNames = participants.map(p => p.name).filter(Boolean);
			const newName = generateUniqueName(existingNames, '角色');
			this.updateData({ participants: [...participants, { name: newName, type: 'participant' }] });
		});
		this.containerEl.appendChild(addParticipantBtn);

		// 消息序列
		this.addSectionTitle('消息序列');
		messages.forEach((m, i) => {
			const row = this.createRow();
			const fromSelect = this.createSelect(
				['发送方', ...participants.map(p => p.name)],
				['', ...participants.map(p => p.name)],
				m.from || ''
			);
			fromSelect.addEventListener('change', (e) => {
				const next = [...messages];
				next[i].from = (e.target as HTMLSelectElement).value;
				this.updateData({ messages: next });
			});
			
			const arrowSelect = this.createSelect(
				['实线带箭头', '实线无箭头', '虚线无箭头', '虚线带箭头', '实线叉号', '虚线叉号', '实线异步', '虚线异步'],
				['实线带箭头', '实线无箭头', '虚线无箭头', '虚线带箭头', '实线叉号', '虚线叉号', '实线异步', '虚线异步'],
				m.arrow || '实线带箭头',
				'flex:0 0 80px'
			);
			arrowSelect.addEventListener('change', (e) => {
				const next = [...messages];
				next[i].arrow = (e.target as HTMLSelectElement).value;
				this.updateData({ messages: next });
			});
			
			const toSelect = this.createSelect(
				['接收方', ...participants.map(p => p.name)],
				['', ...participants.map(p => p.name)],
				m.to || ''
			);
			toSelect.addEventListener('change', (e) => {
				const next = [...messages];
				next[i].to = (e.target as HTMLSelectElement).value;
				this.updateData({ messages: next });
			});
			
			const textInput = this.createInput('消息内容', m.text || '');
			textInput.addEventListener('blur', (e) => {
				const next = [...messages];
				next[i].text = (e.target as HTMLInputElement).value;
				this.updateData({ messages: next });
			});
			
			const delBtn = this.createIconBtn('×', () => {
				const next = [...messages];
				next.splice(i, 1);
				this.updateData({ messages: next });
			});
			
			row.appendChild(fromSelect);
			row.appendChild(arrowSelect);
			row.appendChild(toSelect);
			row.appendChild(textInput);
			row.appendChild(delBtn);
		});

		// 添加消息按钮
		const addMessageBtn = this.createAddBtn('+ 添加消息', () => {
			const defaultFrom = participants[0]?.name || '';
			const defaultTo = participants[1]?.name || participants[0]?.name || '';
			const existingTexts = messages.map(m => m.text).filter(Boolean);
			const newText = generateUniqueName(existingTexts, '消息');
			this.updateData({ 
				messages: [...messages, { 
					from: defaultFrom, 
					to: defaultTo, 
					text: newText, 
					arrow: '实线带箭头' 
				}] 
			});
		});
		this.containerEl.appendChild(addMessageBtn);
	}
}