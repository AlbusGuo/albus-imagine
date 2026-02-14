import { App, Editor, MarkdownView, Notice } from 'obsidian';
import { MermaidTypePicker } from '../components/MermaidTypePicker';
import { MermaidEditorModal } from '../ui/MermaidEditorModal';
import { MermaidMode } from '../utils/mermaidUtils';

/**
 * 打开 Mermaid 可视化编辑器
 * @param app Obsidian 应用实例
 * @param initialMode 初始模式（可选）
 */
export function openMermaidEditor(app: App, initialMode?: MermaidMode) {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const editor = view?.editor || null;
	
	if (!editor) {
		new Notice('请先打开一个 Markdown 文档');
		return;
	}

	// 如果有初始模式，直接打开编辑器
	if (initialMode) {
		new MermaidEditorModal(app, editor, initialMode).open();
		return;
	}

	// 否则显示类型选择器
	const typePicker = new MermaidTypePicker(app, (item) => {
		// 只有在用户选择了类型后才创建和打开编辑器模态框
		new MermaidEditorModal(app, editor, item.id).open();
	});
	
	typePicker.open();
}