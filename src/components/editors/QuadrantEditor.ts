import { App } from 'obsidian';
import { MermaidData, QuadrantPoint, generateUniqueName } from '../../utils/mermaidUtils';
import { BaseMermaidEditor } from './BaseMermaidEditor';

/**
 * 四象限图编辑器
 */
export class QuadrantEditor extends BaseMermaidEditor {
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
		const points = this.data.points || [];
		const config = this.data.config || {};

		// 象限配置
		this.addSectionTitle('象限配置');
		let row = this.createRow();
		const titleInput = this.createInput('标题', config.title || '');
		titleInput.addEventListener('blur', (e) => {
			this.updateData({ config: { ...config, title: (e.target as HTMLInputElement).value } });
		});
		row.appendChild(titleInput);

		row = this.createRow();
		const xLeft = this.createInput('X左', config.xLeft || '');
		xLeft.addEventListener('blur', (e) => {
			this.updateData({ config: { ...config, xLeft: (e.target as HTMLInputElement).value } });
		});
		const xRight = this.createInput('X右', config.xRight || '');
		xRight.addEventListener('blur', (e) => {
			this.updateData({ config: { ...config, xRight: (e.target as HTMLInputElement).value } });
		});
		row.appendChild(xLeft);
		row.appendChild(xRight);

		row = this.createRow();
		const yDown = this.createInput('Y下', config.yDown || '');
		yDown.addEventListener('blur', (e) => {
			this.updateData({ config: { ...config, yDown: (e.target as HTMLInputElement).value } });
		});
		const yUp = this.createInput('Y上', config.yUp || '');
		yUp.addEventListener('blur', (e) => {
			this.updateData({ config: { ...config, yUp: (e.target as HTMLInputElement).value } });
		});
		row.appendChild(yDown);
		row.appendChild(yUp);

		// 数据点
		this.addSectionTitle('数据点 (0.0-1.0)');
		points.forEach((p, i) => {
			row = this.createRow();
			const nameInput = this.createInput('名称', p.name || '');
			nameInput.addEventListener('blur', (e) => {
				const next = [...points];
				next[i].name = (e.target as HTMLInputElement).value;
				this.updateData({ points: next });
			});
			
			const xInput = this.createInput('X', String(p.x ?? 0.5), 'flex:0 0 60px', 'number', '0.1');
			xInput.addEventListener('blur', (e) => {
				const next = [...points];
				next[i].x = Number((e.target as HTMLInputElement).value);
				this.updateData({ points: next });
			});
			
			const yInput = this.createInput('Y', String(p.y ?? 0.5), 'flex:0 0 60px', 'number', '0.1');
			yInput.addEventListener('blur', (e) => {
				const next = [...points];
				next[i].y = Number((e.target as HTMLInputElement).value);
				this.updateData({ points: next });
			});
			
			const delBtn = this.createIconBtn('×', () => {
				this.updateData({ points: points.filter((_, idx) => idx !== i) });
			});
			
			row.appendChild(nameInput);
			row.appendChild(xInput);
			row.appendChild(yInput);
			row.appendChild(delBtn);
		});

		// 添加点按钮
		const addBtn = this.createAddBtn('+ 添加点', () => {
			const existingNames = points.map(p => p.name).filter(Boolean);
			const newName = generateUniqueName(existingNames, '点');
			this.updateData({ points: [...points, { name: newName, x: 0.5, y: 0.5 }] });
		});
		this.containerEl.appendChild(addBtn);
	}
}