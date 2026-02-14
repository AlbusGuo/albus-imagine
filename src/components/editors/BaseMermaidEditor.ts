import { App, ToggleComponent } from 'obsidian';
import { MermaidData } from '../../utils/mermaidUtils';

/**
 * Mermaid 编辑器基类
 */
export abstract class BaseMermaidEditor {
	protected app: App;
	protected data: MermaidData;
	protected updateCallback: (newData: Partial<MermaidData>) => void;
	protected containerEl: HTMLElement;

	constructor(
		app: App,
		data: MermaidData,
		updateCallback: (newData: Partial<MermaidData>) => void
	) {
		this.app = app;
		this.data = data;
		this.updateCallback = updateCallback;
		this.containerEl = document.createElement('div');
		// 延迟调用 buildEditor，让子类有机会初始化属性
		setTimeout(() => this.buildEditor(), 0);
	}

	/**
	 * 获取编辑器元素
	 */
	getElement(): HTMLElement {
		return this.containerEl;
	}

	/**
	 * 构建编辑器界面
	 */
	protected abstract buildEditor(): void;

	/**
	 * 更新数据（调用回调）
	 */
	protected notifyDataUpdate(newData: Partial<MermaidData>): void {
		this.updateCallback(newData);
	}

	/**
	 * 添加区段标题
	 */
	protected addSectionTitle(text: string): void {
		const el = document.createElement('div');
		el.className = 'ms-section-title';
		el.textContent = text;
		this.containerEl.appendChild(el);
	}

	/**
	 * 创建行
	 */
	protected createRow(): HTMLElement {
		const row = document.createElement('div');
		row.className = 'ms-row';
		this.containerEl.appendChild(row);
		return row;
	}

	/**
	 * 创建输入框
	 */
	protected createInput(
		placeholder: string,
		value: string = '',
		style: string = '',
		type: string = 'text',
		step: string | null = null
	): HTMLInputElement {
		const input = document.createElement('input');
		input.className = 'ms-input';
		input.type = type;
		if (step) input.step = step;
		input.placeholder = placeholder;
		input.value = value;
		if (style) input.style.cssText = style;
		return input;
	}

	/**
	 * 创建选择框
	 */
	protected createSelect(
		optionLabels: string[],
		optionValues: string[],
		selectedValue: string = '',
		style: string = ''
	): HTMLSelectElement {
		const select = document.createElement('select');
		select.className = 'ms-select';
		if (style) select.style.cssText = style;
		
		optionLabels.forEach((label, idx) => {
			const opt = document.createElement('option');
			opt.value = optionValues[idx];
			opt.textContent = label;
			if (opt.value === selectedValue) opt.selected = true;
			select.appendChild(opt);
		});
		
		return select;
	}

	/**
	 * 创建颜色选择器
	 */
	protected createColorPicker(value: string = '#ffffff'): HTMLInputElement {
		const picker = document.createElement('input');
		picker.type = 'color';
		picker.className = 'ms-color-picker';
		picker.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--background-modifier-border); cursor: pointer; padding: 0; background: none; flex-shrink: 0;';
		picker.value = value;
		return picker;
	}

	/**
	 * 创建图标按钮
	 */
	protected createIconBtn(text: string, onClick: () => void): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.className = 'ms-icon-btn';
		btn.innerHTML = text;
		btn.onclick = onClick;
		return btn;
	}

	/**
	 * 创建按钮
	 */
	protected createBtn(text: string, onClick: () => void): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.className = 'ms-btn';
		btn.textContent = text;
		// 确保事件正确绑定
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			onClick();
		});
		return btn;
	}

	/**
	 * 创建添加按钮
	 */
	protected createAddBtn(text: string, onClick: () => void): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.className = 'ms-add-btn';
		btn.textContent = text;
		// 确保事件正确绑定
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			onClick();
		});
		return btn;
	}

	/**
	 * 创建文本
	 */
	protected createSpan(text: string, className: string = ''): HTMLSpanElement {
		const span = document.createElement('span');
		span.textContent = text;
		if (className) span.className = className;
		return span;
	}

	/**
	 * 创建拖拽手柄
	 */
	protected createDragHandle(): HTMLSpanElement {
		const handle = document.createElement('span');
		handle.className = 'ms-drag-handle';
		handle.innerHTML = '☰';
		handle.setAttribute('draggable', 'true');
		return handle;
	}

	/**
	 * 创建切换开关
	 */
	protected createToggle(value: boolean = false, onChange: (value: boolean) => void): ToggleComponent {
		const container = document.createElement('div');
		container.className = 'ms-toggle-container';
		const toggle = new ToggleComponent(container);
		toggle.setValue(value);
		toggle.onChange(onChange);
		return toggle;
	}

	/**
	 * 更新编辑器数据（可被子类重写）
	 */
	updateData(newData: Partial<MermaidData>): void {
		// 先更新数据
		this.data = { ...this.data, ...newData };
		
		// 通知父组件数据已更新
		this.notifyDataUpdate(newData);
		
		// 子类可以重写此方法来实现具体的DOM更新
		// 这里不重建编辑器，避免循环调用和性能问题
	}
}