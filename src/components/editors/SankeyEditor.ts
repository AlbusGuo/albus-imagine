import { App, ToggleComponent } from 'obsidian';
import { MermaidData, SankeyLink, SankeyMap, generateUniqueName } from '../../utils/mermaidUtils';
import { BaseMermaidEditor } from './BaseMermaidEditor';

/**
 * Sankey图编辑器
 */
export class SankeyEditor extends BaseMermaidEditor {
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
		const map = this.data.map || {};
		const config = this.data.config || {};

		// 配置选项
		this.addSectionTitle('配置');
		const configRow = this.createRow();
		const showValuesLabel = this.createSpan('显示数值:');
		showValuesLabel.style.cssText = 'flex:0 0 80px';
		configRow.appendChild(showValuesLabel);
		
		const toggleContainer = configRow.createDiv('ms-toggle-container');
		const showValuesToggle = new ToggleComponent(toggleContainer);
		showValuesToggle.setValue(config.showValues !== undefined ? config.showValues : false);
		showValuesToggle.onChange((value) => {
			this.updateData({
				config: {
					...config,
					showValues: value
				}
			});
		});
		configRow.appendChild(toggleContainer);

		// 映射管理
		this.addSectionTitle('映射');
		Object.entries(map).forEach(([source, targets]) => {
			targets.forEach((targetObj, targetIndex) => {
				const row = this.createRow();
				
				// 创建左侧容器（源节点和箭头）
				const leftContainer = document.createElement('div');
				leftContainer.style.display = 'flex';
				leftContainer.style.alignItems = 'center';
				leftContainer.style.flex = '1';
				leftContainer.style.minWidth = '0';
				leftContainer.style.gap = '8px';
				
				// 源节点输入
				const sourceInput = this.createInput('Source', source, 'flex:1;min-width:80px');
				sourceInput.addEventListener('blur', (e) => {
					const newSource = (e.target as HTMLInputElement).value;
					if (newSource !== source) {
						// 如果源节点名称改变，需要更新映射结构
						const newMap = { ...map };
						delete newMap[source];
						if (!newMap[newSource]) newMap[newSource] = [];
						newMap[newSource].push(...targets);
						this.updateData({ map: newMap });
					}
				});
				leftContainer.appendChild(sourceInput);
				
				// 箭头图标
				const arrow = this.createSpan('→');
				arrow.style.cssText = 'color:var(--text-muted);flex-shrink:0';
				leftContainer.appendChild(arrow);
				
				// 创建右侧容器（目标节点、值和删除按钮）
				const rightContainer = document.createElement('div');
				rightContainer.style.display = 'flex';
				rightContainer.style.alignItems = 'center';
				rightContainer.style.flex = '1';
				rightContainer.style.minWidth = '0';
				rightContainer.style.gap = '8px';
				
				// 目标节点输入
				const targetInput = this.createInput('Target', targetObj.target, 'flex:1;min-width:80px');
				targetInput.addEventListener('blur', (e) => {
					const newMap = { ...map };
					newMap[source][targetIndex].target = (e.target as HTMLInputElement).value;
					this.updateData({ map: newMap });
				});
				rightContainer.appendChild(targetInput);
				
				// 值输入
				const valueInput = this.createInput('Value', String(targetObj.value || 0), 'flex:0 0 70px', 'number', '1');
				valueInput.addEventListener('blur', (e) => {
					const newMap = { ...map };
					newMap[source][targetIndex].value = Number((e.target as HTMLInputElement).value);
					this.updateData({ map: newMap });
				});
				rightContainer.appendChild(valueInput);
				
				// 删除按钮
				const delBtn = this.createIconBtn('×', () => {
					const newMap = { ...map };
					newMap[source] = newMap[source].filter((_, idx) => idx !== targetIndex);
					if (newMap[source].length === 0) {
						delete newMap[source];
					}
					this.updateData({ map: newMap });
				});
				rightContainer.appendChild(delBtn);
				
				// 组装行
				row.appendChild(leftContainer);
				row.appendChild(rightContainer);
			});
		});

		// 添加映射按钮
		const addBtnRow = this.createRow();
		const addBtn = this.createAddBtn('添加映射', () => {
			// 获取所有已使用的节点名称
			const nodeNames = new Set<string>();
			Object.entries(map).forEach(([source, targets]) => {
				nodeNames.add(source);
				targets.forEach(targetObj => nodeNames.add(targetObj.target));
			});
			
			// 生成新的节点名称
			const newSourceName = generateUniqueName(Array.from(nodeNames), 'Source');
			const newTargetName = generateUniqueName(Array.from(nodeNames), 'Target');
			
			// 添加新映射
			const newMap = { ...map };
			if (!newMap[newSourceName]) newMap[newSourceName] = [];
			newMap[newSourceName].push({ target: newTargetName, value: 10 });
			
			this.updateData({ map: newMap });
		});
		addBtnRow.appendChild(addBtn);
	}
}