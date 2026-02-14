import { App } from 'obsidian';
import { MermaidData, FlowchartNode, FlowchartEdge, generateUniqueName } from '../../utils/mermaidUtils';
import { BaseMermaidEditor } from './BaseMermaidEditor';
import { ShapeSelector } from '../ShapeSelector';

/**
 * 流程图编辑器
 */
export class FlowchartEditor extends BaseMermaidEditor {
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
		const nodes = this.data.nodes || [];
		const edges = this.data.edges || [];
		const config = this.data.config || {};

		// 全局配置
		this.addSectionTitle('全局');
		let row = this.createRow();
		row.appendChild(this.createSpan('方向:'));
		const dirSelect = this.createSelect(
			['垂直(TD)', '水平(LR)'],
			['TD', 'LR'],
			config.direction || 'TD'
		);
		dirSelect.addEventListener('change', (e) => {
			this.updateData({ config: { ...config, direction: (e.target as HTMLSelectElement).value } });
		});
		row.appendChild(dirSelect);

		// 节点
		this.addSectionTitle('节点');
		nodes.forEach((n, i) => {
			row = this.createRow();
			const labelInput = this.createInput('内容', n.label || '');
			labelInput.addEventListener('blur', (e) => {
				const next = [...nodes];
				next[i].label = (e.target as HTMLInputElement).value;
				this.updateData({ nodes: next });
			});
			
			const groupInput = this.createInput('分组', n.group || '', 'flex:0 0 80px');
			groupInput.addEventListener('blur', (e) => {
				const next = [...nodes];
				next[i].group = (e.target as HTMLInputElement).value;
				this.updateData({ nodes: next });
			});
			
			// 创建形状选择器容器
			const shapeContainer = row.createDiv('shape-selector-container');
			shapeContainer.style.flex = '0 0 160px';
			
			// 创建形状选择器
			const shapeSelector = new ShapeSelector(
				shapeContainer,
				n.shape || 'rect',
				(value) => {
					const next = [...nodes];
					next[i].shape = value;
					this.updateData({ nodes: next });
				}
			);
			
			const colorInput = this.createColorPicker(n.color || '#ffffff');
			colorInput.addEventListener('change', (e) => {
				const next = [...nodes];
				next[i].color = (e.target as HTMLInputElement).value;
				this.updateData({ nodes: next });
			});
			
			const delBtn = this.createIconBtn('×', () => {
				this.updateData({ nodes: nodes.filter(x => x.id !== n.id) });
			});
			
			row.appendChild(labelInput);
			row.appendChild(groupInput);
			row.appendChild(shapeContainer);
			row.appendChild(colorInput);
			row.appendChild(delBtn);
		});

		// 添加节点按钮
		const addNodeBtn = this.createAddBtn('+ 添加节点', () => {
			const existingLabels = nodes.map(n => n.label).filter(Boolean);
			const newLabel = generateUniqueName(existingLabels, '节点');
			this.updateData({
				nodes: [...nodes, {
					id: 'n' + Date.now(),
					label: newLabel,
					shape: 'rect',
					color: '',
					group: ''
				}]
			});
		});
		this.containerEl.appendChild(addNodeBtn);

		// 连线
		this.addSectionTitle('连线');
		edges.forEach((e, i) => {
			row = this.createRow();
			const fromSelect = this.createSelect(
				['起点', ...nodes.map(n => n.label || n.id)],
				['', ...nodes.map(n => n.id)],
				e.from || ''
			);
			fromSelect.addEventListener('change', (ev) => {
				const next = [...edges];
				next[i].from = (ev.target as HTMLSelectElement).value;
				this.updateData({ edges: next });
			});
			
			const arrow = this.createSpan('→', 'ms-arrow');
			
			const toSelect = this.createSelect(
				['终点', ...nodes.map(n => n.label || n.id)],
				['', ...nodes.map(n => n.id)],
				e.to || ''
			);
			toSelect.addEventListener('change', (ev) => {
				const next = [...edges];
				next[i].to = (ev.target as HTMLSelectElement).value;
				this.updateData({ edges: next });
			});
			
			const labelInput = this.createInput('标签', e.label || '');
			labelInput.addEventListener('blur', (ev) => {
				const next = [...edges];
				next[i].label = (ev.target as HTMLInputElement).value;
				this.updateData({ edges: next });
			});
			
			const delBtn = this.createIconBtn('×', () => {
				const next = [...edges];
				next.splice(i, 1);
				this.updateData({ edges: next });
			});
			
			row.appendChild(fromSelect);
			row.appendChild(arrow);
			row.appendChild(toSelect);
			row.appendChild(labelInput);
			row.appendChild(delBtn);
		});

		// 添加连线按钮
		const addEdgeBtn = this.createAddBtn('+ 添加连线', () => {
			this.updateData({ edges: [...edges, { from: '', to: '', label: '' }] });
		});
		this.containerEl.appendChild(addEdgeBtn);
	}
}