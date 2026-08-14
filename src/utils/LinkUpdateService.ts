import { App, Editor, MarkdownView, Notice } from "obsidian";
import { parseImageLink, updateImageLinkSize } from "./imageLink";

interface LinkMatch {
	replacement: string;
	from: number;
	to: number;
}

type CodeMirrorEditor = Editor & {
	cm?: {
		state: { doc: { lineAt: (position: number) => { number: number; }; }; };
	};
};

/** Updates image sizes through Obsidian's Editor API after resolving one DOM position. */
export class LinkUpdateService {
	constructor(private readonly app: App) { }

	updateImageLinkWithNewSize(img: HTMLImageElement, documentPosition: number, newWidth: number): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;
		const targetLine = this.getTargetLine(view.editor, documentPosition);
		if (targetLine === null) return;
		const inTable = img.closest("table") !== null;
		const inCallout = img.closest(".callout") !== null;
		const imageSource = img.classList.contains("excalidraw-embedded-img")
			? this.getExcalidrawBaseName(img)
			: (img.closest(".internal-embed")?.getAttribute("src") ?? img.getAttribute("src"));
		if (!imageSource) return;

		const lineNumbers = this.getCandidateLines(view.editor, targetLine, inTable, inCallout);
		const candidates: Array<{ line: number; match: LinkMatch; }> = [];
		for (const line of lineNumbers) {
			const text = view.editor.getLine(line);
			candidates.push(...this.findMatches(text, imageSource, String(newWidth), inTable, view)
				.map((match) => ({ line, match })));
		}
		if (candidates.length !== 1) {
			if (candidates.length > 1) new Notice("找到多个相同图片链接, 请手动调整大小");
			else if (inTable || inCallout) new Notice("未找到当前图片链接, 请手动调整大小");
			return;
		}

		const candidate = candidates[0];
		view.editor.replaceRange(
			candidate.match.replacement,
			{ line: candidate.line, ch: candidate.match.from },
			{ line: candidate.line, ch: candidate.match.to },
		);
	}

	private getTargetLine(editor: Editor, documentPosition: number): number | null {
		const cm = (editor as CodeMirrorEditor).cm;
		if (!cm) return null;
		return cm.state.doc.lineAt(documentPosition).number - 1;
	}

	private getCandidateLines(editor: Editor, targetLine: number, inTable: boolean, inCallout: boolean): number[] {
		if (!inTable && !inCallout) return [targetLine];
		const belongsToBlock = inTable ? /^\s*\|/ : /^\s*>/;
		let start = targetLine;
		let end = targetLine;
		while (start > 0 && belongsToBlock.test(editor.getLine(start - 1))) start--;
		while (end + 1 < editor.lineCount() && belongsToBlock.test(editor.getLine(end + 1))) end++;
		return Array.from({ length: end - start + 1 }, (_, index) => start + index);
	}

	private findMatches(
		line: string,
		imageSource: string,
		width: string,
		inTable: boolean,
		view: MarkdownView,
	): LinkMatch[] {
		const matches = [
			...this.findWikiMatches(line, imageSource, width, inTable, view),
			...this.findMarkdownMatches(line, imageSource, width, inTable),
		];
		return matches.sort((a, b) => a.from - b.from);
	}

	private findWikiMatches(
		line: string,
		imageSource: string,
		width: string,
		inTable: boolean,
		view: MarkdownView,
	): LinkMatch[] {
		const result: LinkMatch[] = [];
		const expression = /!\[\[[^[\]]*?\]\]/g;
		const sourcePath = view.file?.path ?? "";
		const requested = this.app.metadataCache.getFirstLinkpathDest(imageSource.split("#")[0], sourcePath)?.path;
		for (let match = expression.exec(line); match; match = expression.exec(line)) {
			const normalized = inTable ? match[0].replace(/\\\|/g, "|") : match[0];
			const parsed = parseImageLink(normalized);
			if (!parsed) continue;
			const resolved = this.app.metadataCache.getFirstLinkpathDest(parsed.file, sourcePath)?.path;
			if (requested ? resolved !== requested : !imageSource.includes(parsed.file)) continue;
			const updated = updateImageLinkSize(normalized, width);
			result.push({
				replacement: inTable ? updated.replace(/\|/g, "\\|") : updated,
				from: match.index,
				to: match.index + match[0].length,
			});
		}
		return result;
	}

	private findMarkdownMatches(line: string, imageSource: string, width: string, inTable: boolean): LinkMatch[] {
		const result: LinkMatch[] = [];
		const expression = /!\[([^\]]*)\]\(([^)]+)\)/g;
		for (let match = expression.exec(line); match; match = expression.exec(line)) {
			const destination = match[2].trim();
			if (!imageSource.includes(destination) && !destination.includes(imageSource.replace(/ /g, "%20"))) continue;
			const alt = match[1].replace(/\\?\|\d+(?:\\?\|\d+)?$/, "");
			const separator = inTable ? "\\|" : "|";
			result.push({
				replacement: `![${alt}${separator}${width}](${destination})`,
				from: match.index,
				to: match.index + match[0].length,
			});
		}
		return result;
	}

	private getExcalidrawBaseName(target: HTMLImageElement): string {
		const source = target.getAttribute("filesource") ?? "";
		const fileName = source.split(/[\\/]/).pop() ?? source;
		return fileName.endsWith(".md") ? fileName.slice(0, -3) : fileName;
	}
}
