import { App, MarkdownView, Notice } from 'obsidian';
import { ImageResizeSettings } from '../types/types';

/**
 * 链接匹配结果接口
 */
interface LinkMatch {
	old_link: string;
	new_link: string;
	from_ch: number;
	to_ch: number;
}

/**
 * 链接更新服务
 * 负责处理内部和外部图片链接的更新
 */
export class LinkUpdateService {
	private app: App;
	private settings: ImageResizeSettings;

	constructor(app: App, settings: ImageResizeSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * 更新设置
	 */
	updateSettings(settings: ImageResizeSettings): void {
		this.settings = settings;
	}

	/**
	 * 更新图片链接为新尺寸
	 */
	updateImageLinkWithNewSize(
		img: HTMLImageElement,
		target_pos: number,
		newWidth: number,
		newHeight: number
	): void {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			return;
		}

		const inTable = img.closest('table') != null;
		const inCallout = img.closest('.callout') != null;
		const isExcalidraw = img.classList.contains('excalidraw-embedded-img');

		let imageName: string | null = img.getAttribute('src');

		if (imageName?.startsWith('http')) {
			this.updateExternalLink(activeView, img, target_pos, newWidth, newHeight, inTable, inCallout);
		} else if (isExcalidraw) {
			const draw_base_name = this.getExcalidrawBaseName(img);
			img.addClass('image-excalidraw-no-max-width');
			this.updateInternalLink(activeView, img, target_pos, draw_base_name, newWidth, newHeight, inTable, inCallout);
		} else {
			imageName = img.closest('.internal-embed')?.getAttribute('src') || null;
			this.updateInternalLink(activeView, img, target_pos, imageName, newWidth, newHeight, inTable, inCallout);
		}
	}

	/**
	 * 更新内部链接
	 */
	private updateInternalLink(
		activeView: MarkdownView,
		target: HTMLImageElement,
		target_pos: number,
		imageName: string | null,
		newWidth: number,
		newHeight: number,
		inTable: boolean,
		inCallout: boolean
	): void {
		if (!imageName) return;

		const editor = activeView.editor;
		const editorView = (editor as unknown as { 
			cm: { 
				state: { 
					doc: { 
						lineAt: (pos: number) => { from: number; to: number; number: number; text: string };
						line: (lineNumber: number) => { from: number; to: number; number: number; text: string };
					} 
				};
				dispatch: (changes: unknown) => void;
			} 
		}).cm;
		const target_line = editorView.state.doc.lineAt(target_pos);

		if (!inCallout && !inTable) {
			const matched = this.matchLineWithInternalLink(target_line.text, imageName, newWidth, inTable);
			if (matched.length === 1) {
				editorView.dispatch({
					changes: {
						from: target_line.from + matched[0].from_ch,
						to: target_line.from + matched[0].to_ch,
						insert: matched[0].new_link
					}
				});
			} else if (matched.length === 0) {
				// 未找到匹配项
			} else {
				new Notice('在当前行中找到多个相同的图像链接,请手动缩放!');
			}
			return;
		}

		const startReg = {
			table: /^\s*\|/,
			callout: /^>/
		};
		const mode = inTable ? 'table' : 'callout';
		const start_reg = startReg[mode];
		const start_line_number = target_line.number;
		const matched_results: LinkMatch[] = [];
		const matched_lines: number[] = [];

		// 向下搜索
		for (let i = start_line_number; i <= editor.lineCount(); i++) {
			const line = editorView.state.doc.line(i);
			if (!start_reg.test(line.text)) break;
			
			const matched = this.matchLineWithInternalLink(line.text, imageName, newWidth, inTable);
			matched_results.push(...matched);
			matched_lines.push(...new Array(matched.length).fill(i));
		}

		// 向上搜索
		for (let i = start_line_number - 1; i >= 1; i--) {
			const line = editorView.state.doc.line(i);
			if (!start_reg.test(line.text)) break;
			
			const matched = this.matchLineWithInternalLink(line.text, imageName, newWidth, inTable);
			matched_results.push(...matched);
			matched_lines.push(...new Array(matched.length).fill(i));
		}

		if (matched_results.length === 1) {
			const target_line2 = editorView.state.doc.line(matched_lines[0]);
			if (mode === 'table') {
				const old_text = target_line2.text;
				const new_line_text = old_text.substring(0, matched_results[0].from_ch) +
					matched_results[0].new_link +
					old_text.substring(matched_results[0].to_ch);
				editorView.dispatch({
					changes: {
						from: target_line2.from,
						to: target_line2.from + old_text.length,
						insert: new_line_text
					}
				});
			} else {
				editorView.dispatch({
					changes: {
						from: target_line2.from + matched_results[0].from_ch,
						to: target_line2.from + matched_results[0].to_ch,
						insert: matched_results[0].new_link
					}
				});
			}
		} else if (matched_results.length === 0) {
			new Notice(`在 ${mode === 'table' ? '表格' : 'callout'} 中未能找到当前图像链接,请手动缩放!`);
		} else {
			new Notice(`在 ${mode === 'table' ? '表格' : 'callout'} 中找到多个相同的图像链接,请手动缩放!`);
		}
	}

	/**
	 * 更新外部链接
	 */
	private updateExternalLink(
		activeView: MarkdownView,
		target: HTMLImageElement,
		target_pos: number,
		newWidth: number,
		newHeight: number,
		inTable: boolean,
		inCallout: boolean
	): void {
		const editor = activeView.editor;
		const editorView = (editor as unknown as { 
			cm: { 
				state: { 
					doc: { 
						lineAt: (pos: number) => { from: number; to: number; number: number; text: string };
						line: (lineNumber: number) => { from: number; to: number; number: number; text: string };
					} 
				};
				dispatch: (changes: unknown) => void;
			} 
		}).cm;
		const target_line = editorView.state.doc.lineAt(target_pos);
		const link = target.getAttribute('src');
		const altText = target.getAttribute('alt');

		if (!link) return;

		if (!inCallout && !inTable) {
			const matched = this.matchLineWithExternalLink(target_line.text, link, altText || '', newWidth, inTable);
			if (matched.length === 1) {
				editorView.dispatch({
					changes: {
						from: target_line.from + matched[0].from_ch,
						to: target_line.from + matched[0].to_ch,
						insert: matched[0].new_link
					}
				});
			} else if (matched.length === 0) {
				// 未找到匹配项
			} else {
				new Notice('在当前行中找到多个相同的图像链接,请手动缩放!');
			}
			return;
		}

		const startReg = {
			table: /^\s*\|/,
			callout: /^>/
		};
		const mode = inTable ? 'table' : 'callout';
		const start_reg = startReg[mode];
		const start_line_number = target_line.number;
		const matched_results: LinkMatch[] = [];
		const matched_lines: number[] = [];

		// 向下搜索
		for (let i = start_line_number; i <= editor.lineCount(); i++) {
			const line = editorView.state.doc.line(i);
			if (!start_reg.test(line.text)) break;
			
			const matched = this.matchLineWithExternalLink(line.text, link, altText || '', newWidth, inTable);
			matched_results.push(...matched);
			matched_lines.push(...new Array(matched.length).fill(i));
		}

		// 向上搜索
		for (let i = start_line_number - 1; i >= 1; i--) {
			const line = editorView.state.doc.line(i);
			if (!start_reg.test(line.text)) break;
			
			const matched = this.matchLineWithExternalLink(line.text, link, altText || '', newWidth, inTable);
			matched_results.push(...matched);
			matched_lines.push(...new Array(matched.length).fill(i));
		}

		if (matched_results.length === 1) {
			const target_line2 = editorView.state.doc.line(matched_lines[0]);
			if (mode === 'table') {
				const old_text = target_line2.text;
				const new_line_text = old_text.substring(0, matched_results[0].from_ch) +
					matched_results[0].new_link +
					old_text.substring(matched_results[0].to_ch);
				editorView.dispatch({
					changes: {
						from: target_line2.from,
						to: target_line2.from + old_text.length,
						insert: new_line_text
					}
				});
			} else {
				editorView.dispatch({
					changes: {
						from: target_line2.from + matched_results[0].from_ch,
						to: target_line2.from + matched_results[0].to_ch,
						insert: matched_results[0].new_link
					}
				});
			}
		} else if (matched_results.length === 0) {
			new Notice(`在 ${mode === 'table' ? '表格' : 'callout'} 中未能找到当前图像链接,请手动缩放!`);
		} else {
			new Notice(`在 ${mode === 'table' ? '表格' : 'callout'} 中找到多个相同的图像链接,请手动缩放!`);
		}
	}

	/**
	 * 匹配行中的内部链接
	 */
	private matchLineWithInternalLink(
		line_text: string,
		target_name: string,
		new_width: number,
		intable: boolean
	): LinkMatch[] {
		const regWikiLink = /!\[\[[^\[\]]*?\]\]/g;
		const regMdLink = /!\[[^\[\]]*?\]\(\s*[^\[\]\{\}']*\s*\)/g;
		const target_name_mdlink = target_name.replace(/ /g, '%20');

		if (!line_text.includes(target_name) && !line_text.includes(target_name_mdlink)) {
			return [];
		}

		const result: LinkMatch[] = [];

		// 处理 Wiki 链接
		let wiki_match: RegExpExecArray | null;
		while ((wiki_match = regWikiLink.exec(line_text)) !== null) {
			const matched_link = wiki_match[0];
			
			if (matched_link.includes(target_name)) {
				const normal_link = intable ? matched_link.replace(/\\\|/g, '|') : matched_link;
				const link_match = normal_link.match(/!\[\[(.*?)(\||\]\])/);
				const link_text = link_match ? link_match[1] : '';
				const alt_match = matched_link.match(/!\[\[.*?(\|(.*?))\]\]/);
				const alt_text = alt_match ? alt_match[1] : '';
				const alt_text_list = alt_text.split('|');
				let alt_text_wo_size = '';

				for (const alt of alt_text_list) {
					if (!/^\d+$/.test(alt) && !/^\s*$/.test(alt)) {
						alt_text_wo_size = alt_text_wo_size + '|' + alt;
					}
				}

				const new_alt_text = new_width !== 0 ? `${alt_text_wo_size}|${new_width}` : alt_text_wo_size;
				const escaped_alt_text = intable ? new_alt_text.replace(/\|/g, '\\|') : new_alt_text;
				const newWikiLink = link_match ? `![[${link_text}${escaped_alt_text}]]` : `![[${target_name}${escaped_alt_text}]]`;

				result.push({
					old_link: matched_link,
					new_link: newWikiLink,
					from_ch: wiki_match.index,
					to_ch: wiki_match.index + matched_link.length
				});
			}
		}

		// 处理 Markdown 链接
		let match: RegExpExecArray | null;
		while ((match = regMdLink.exec(line_text)) !== null) {
			const matched_link = match[0];
			if (matched_link.includes(target_name_mdlink)) {
				const alt_text_match = matched_link.match(/\[.*?\]/g);
				if (!alt_text_match) continue;

				const alt_text = alt_text_match[0].substring(1, alt_text_match[0].length - 1);
				let pure_alt = alt_text.replace(/\|\d+(\|\d+)?$/g, '');
				if (intable) {
					pure_alt = alt_text.replace(/\\\|\d+(\|\d+)?$/g, '');
				}

				const link_text = matched_link.substring(alt_text_match[0].length + 2, matched_link.length - 1);
				const newMDLink = intable ? `![${pure_alt}\\|${new_width}](${link_text})` : `![${pure_alt}|${new_width}](${link_text})`;

				if (/^\d*$/.test(alt_text)) {
					result.push({
						old_link: matched_link,
						new_link: `![${new_width}](${link_text})`,
						from_ch: match.index,
						to_ch: match.index + matched_link.length
					});
				} else {
					result.push({
						old_link: matched_link,
						new_link: newMDLink,
						from_ch: match.index,
						to_ch: match.index + matched_link.length
					});
				}
			}
		}

		return result;
	}

	/**
	 * 匹配行中的外部链接
	 */
	private matchLineWithExternalLink(
		line_text: string,
		link: string,
		alt_text: string,
		new_width: number,
		intable: boolean
	): LinkMatch[] {
		const result: LinkMatch[] = [];
		const regMdLink = /!\[[^\[\]]*?\]\(\s*[^\[\]\{\}']*\s*\)/g;

		if (!line_text.includes(link)) {
			return [];
		}

		let match: RegExpExecArray | null;
		while ((match = regMdLink.exec(line_text)) !== null) {
			const matched_link = match[0];
			if (matched_link.includes(link)) {
				const alt_text_match = matched_link.match(/\[.*?\]/g);
				if (!alt_text_match) continue;

				const alt_text2 = alt_text_match[0].substring(1, alt_text_match[0].length - 1);
				let pure_alt = alt_text2.replace(/\|\d+(\|\d+)?$/g, '');
				if (intable) {
					pure_alt = alt_text2.replace(/\\\|\d+(\|\d+)?$/g, '');
				}

				if (/^\d*$/.test(alt_text2)) {
					pure_alt = '';
				}

				const link_text = matched_link.substring(alt_text_match[0].length + 2, matched_link.length - 1);
				const newExternalLink = intable ? `![${pure_alt}\\|${new_width}](${link_text})` : `![${pure_alt}|${new_width}](${link_text})`;

				result.push({
					old_link: matched_link,
					new_link: newExternalLink,
					from_ch: match.index,
					to_ch: match.index + matched_link.length
				});
			}
		}

		return result;
	}

	/**
	 * 获取 Excalidraw 基础名称
	 */
	private getExcalidrawBaseName(target: HTMLImageElement): string {
		let target_name = target.getAttribute('filesource') || '';
		let file_base_name = target_name;

		if (file_base_name.includes('/')) {
			const temp_arr = file_base_name.split('/');
			file_base_name = temp_arr[temp_arr.length - 1];
		} else if (file_base_name.includes('\\')) {
			const temp_arr = file_base_name.split('\\');
			file_base_name = temp_arr[temp_arr.length - 1];
		}

		file_base_name = file_base_name.endsWith('.md') ? file_base_name.substring(0, file_base_name.length - 3) : file_base_name;
		return file_base_name;
	}
}
