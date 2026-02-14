import { App } from 'obsidian';

/**
 * 形状选择器组件
 * 使用分组按钮和形状预览替代过长的下拉列表
 */
export class ShapeSelector {
	private containerEl: HTMLElement;
	private currentValue: string;
	private onChange: (value: string) => void;
	
	// 形状分组定义
	private shapeGroups = [
		{
			name: '基本形状',
			id: 'basic',
			shapes: [
				{ name: '矩形', value: 'rect' },
				{ name: '圆角矩形', value: 'rounded' },
				{ name: '椭圆矩形', value: 'stadium' },
				{ name: '重叠矩形', value: 'processes' },
				{ name: '菱形', value: 'diamond' },
				{ name: '圆形', value: 'circle' },
				{ name: '双圈圆形', value: 'double-circle' },
				{ name: '六边形', value: 'hex' },
				{ name: '右倾平行四边形', value: 'parallelogram' },
				{ name: '左倾平行四边形', value: 'inverse-parallelogram' },
				{ name: '梯形', value: 'trapezoid' },
				{ name: '反梯形', value: 'inverse-trapezoid' },
				{ name: '圆柱形', value: 'cylinder' },
				{ name: '横向圆柱', value: 'das' },
				{ name: '左大括号', value: 'comment' },
				{ name: '右大括号', value: 'brace-r' },
				{ name: '双大括号', value: 'braces' },
				{ name: '三角形', value: 'tri' },
				{ name: '倒三角形', value: 'flip-tri' },
				{ name: '纸带形', value: 'flag' },
				{ name: '文档', value: 'document' },
				{ name: '多文档', value: 'docs' },
				{ name: '标记文档', value: 'tag-doc' }
			]
		},
		{
			name: '无文本形状',
			id: 'no-text',
			shapes: [
				{ name: '实心点', value: 'f-circ' },
				{ name: '空心点', value: 'sm-circ' },
				{ name: '环形点', value: 'framed-circle' },
				{ name: '交叉圆形', value: 'cross-circ' },
				{ name: '闪电', value: 'bolt' },
				{ name: '沙漏', value: 'hourglass' }
			]
		}
	];
	
	constructor(
		containerEl: HTMLElement,
		initialValue: string,
		onChange: (value: string) => void
	) {
		this.containerEl = containerEl;
		this.currentValue = initialValue;
		this.onChange = onChange;
		this.render();
	}
	
	/**
	 * 渲染形状选择器
	 */
	private render(): void {
		this.containerEl.empty();
		this.containerEl.addClass('shape-selector');
		
		// 创建当前选择显示区域
		const currentDisplay = this.containerEl.createDiv('shape-current');
		currentDisplay.onclick = () => this.togglePanel();
		
		const currentShape = this.findShape(this.currentValue);
		
		const currentName = currentDisplay.createSpan('shape-name');
		currentName.textContent = currentShape?.name || '矩形';
		
		const dropdownIcon = currentDisplay.createSpan('dropdown-icon');
		dropdownIcon.textContent = '▼';
		
		// 创建形状面板
		const panel = this.containerEl.createDiv('shape-panel');
		panel.style.display = 'none';
		
		// 创建分组标签
		const tabs = panel.createDiv('shape-tabs');
		
		// 创建形状内容区域
		const content = panel.createDiv('shape-content');
		
		// 渲染每个分组
		this.shapeGroups.forEach((group, groupIndex) => {
			// 创建标签
			const tab = tabs.createEl('button', { cls: 'shape-tab' });
			tab.textContent = group.name;
			tab.onclick = () => this.switchGroup(groupIndex);
			
			// 创建内容
			const groupContent = content.createDiv('shape-group');
			groupContent.dataset.group = group.id;
			groupContent.style.display = groupIndex === 0 ? 'grid' : 'none';
			
			// 创建形状按钮
			group.shapes.forEach(shape => {
				const shapeBtn = groupContent.createEl('button', { cls: 'shape-btn' });
				if (shape.value === this.currentValue) {
					shapeBtn.addClass('active');
				}
				
				const name = shapeBtn.createSpan('shape-btn-name');
				name.textContent = shape.name;
				
				shapeBtn.onclick = () => this.selectShape(shape.value);
				shapeBtn.title = shape.name;
			});
		});
		
		// 默认激活第一个分组
		tabs.firstElementChild?.addClass('active');
		
		// 点击外部关闭面板
		document.addEventListener('click', (e) => {
			if (!this.containerEl.contains(e.target as Node)) {
				panel.style.display = 'none';
			}
		});
	}
	
	/**
	 * 查找形状
	 */
	private findShape(value: string): { name: string; value: string } | undefined {
		for (const group of this.shapeGroups) {
			const shape = group.shapes.find(s => s.value === value);
			if (shape) return shape;
		}
		return undefined;
	}
	
	/**
	 * 切换面板显示
	 */
	private togglePanel(): void {
		const panel = this.containerEl.querySelector('.shape-panel') as HTMLElement;
		if (panel.style.display === 'none') {
			panel.style.display = 'block';
		} else {
			panel.style.display = 'none';
		}
	}
	
	/**
	 * 切换分组
	 */
	private switchGroup(groupIndex: number): void {
		// 更新标签状态
		const tabs = this.containerEl.querySelectorAll('.shape-tab');
		tabs.forEach((tab, index) => {
			if (index === groupIndex) {
				tab.addClass('active');
			} else {
				tab.removeClass('active');
			}
		});
		
		// 更新内容显示
		const groups = this.containerEl.querySelectorAll('.shape-group');
		groups.forEach((group, index) => {
			(group as HTMLElement).style.display = index === groupIndex ? 'grid' : 'none';
		});
	}
	
	/**
	 * 选择形状
	 */
	private selectShape(value: string): void {
		this.currentValue = value;
		this.onChange(value);
		
		// 更新激活状态
		const buttons = this.containerEl.querySelectorAll('.shape-btn');
		buttons.forEach(btn => {
			btn.removeClass('active');
		});
		
		const activeBtn = this.containerEl.querySelector(`[data-value="${value}"]`) as HTMLElement;
		if (activeBtn) {
			activeBtn.addClass('active');
		}
		
		// 更新当前显示
		const currentName = this.containerEl.querySelector('.shape-name') as HTMLElement;
		const currentShape = this.findShape(value);
		
		if (currentName) currentName.textContent = currentShape?.name || '矩形';
		
		// 关闭面板
		const panel = this.containerEl.querySelector('.shape-panel') as HTMLElement;
		panel.style.display = 'none';
	}
	
	/**
	 * 获取当前值
	 */
	getValue(): string {
		return this.currentValue;
	}
	
	/**
	 * 设置值
	 */
	setValue(value: string): void {
		this.currentValue = value;
		const currentShape = this.findShape(value);
		
		// 更新当前显示
		const currentName = this.containerEl.querySelector('.shape-name') as HTMLElement;
		
		if (currentName) currentName.textContent = currentShape?.name || '矩形';
		
		// 更新激活状态
		const buttons = this.containerEl.querySelectorAll('.shape-btn');
		buttons.forEach(btn => {
			btn.removeClass('active');
		});
	}
}