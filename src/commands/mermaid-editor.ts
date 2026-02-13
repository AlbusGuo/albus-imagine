import { App, Editor, MarkdownView, Notice } from 'obsidian';
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

	new MermaidEditorModal(app, editor, initialMode).open();
}