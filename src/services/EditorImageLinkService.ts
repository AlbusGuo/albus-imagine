import { App, Editor, Notice, TFile } from "obsidian";

interface EditorImageMatch {
	lineNumber: number;
	fullMatch: string;
	startCh: number;
	endCh: number;
}

interface EditorWithCodeMirror extends Editor {
	cm?: {
		posAtDOM?: (node: Node) => number;
		state?: { doc?: { lineAt: (position: number) => { number: number; }; }; };
	};
}

/** Resolves rendered images back to their exact editor link. */
export class EditorImageLinkService {
	constructor(private readonly app: App) { }

	resolveImagePath(image: HTMLImageElement): string | null {
		const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
		const embedSource = image.closest(".internal-embed")
			?.getAttribute("src")
			?.split("#")[0]
			?.trim();
		if (embedSource) {
			const resolved = this.app.metadataCache.getFirstLinkpathDest(embedSource, sourcePath);
			if (resolved) return resolved.path;
		}

		const source = image.getAttribute("src");
		if (!source) return null;
		const directFile = this.app.vault.getFileByPath(source.split(/[?#]/)[0]);
		if (directFile) return directFile.path;
		if (!source.startsWith("app://")) return null;

		try {
			const decodedPath = decodeURIComponent(new URL(source).pathname).replace(/^\//, "");
			const pathParts = decodedPath.split("/");
			const vaultRelativePath = pathParts.length > 1 ? pathParts.slice(1).join("/") : decodedPath;
			return this.app.vault.getFileByPath(vaultRelativePath)?.path
				?? this.app.vault.getFileByPath(decodedPath)?.path
				?? null;
		} catch (error) {
			console.warn("无法解析图片资源地址:", error);
			return null;
		}
	}

	findSingleMatch(
		editor: Editor,
		imagePath: string,
		image?: HTMLImageElement,
	): EditorImageMatch | null {
		const matches = this.findMatches(editor, imagePath);
		if (matches.length === 0) return null;
		if (matches.length === 1) return matches[0];

		const editorView = (editor as EditorWithCodeMirror).cm;
		if (image && editorView?.posAtDOM && editorView.state?.doc) {
			try {
				const targetLine = editorView.state.doc.lineAt(editorView.posAtDOM(image)).number - 1;
				const exactMatches = matches.filter((match) => match.lineNumber === targetLine);
				if (exactMatches.length === 1) return exactMatches[0];
				const closest = matches.reduce((best, candidate) =>
					Math.abs(candidate.lineNumber - targetLine) < Math.abs(best.lineNumber - targetLine)
						? candidate
						: best,
				);
				if (Math.abs(closest.lineNumber - targetLine) <= 5) return closest;
			} catch (error) {
				console.warn("无法从编辑器 DOM 定位图片:", error);
			}
		}

		new Notice("当前图片链接不唯一, 已取消操作以避免修改错误链接");
		return null;
	}

	replace(editor: Editor, match: EditorImageMatch, replacement: string): void {
		editor.replaceRange(
			replacement,
			{ line: match.lineNumber, ch: match.startCh },
			{ line: match.lineNumber, ch: match.endCh },
		);
	}

	private findMatches(editor: Editor, imagePath: string): EditorImageMatch[] {
		const matches: EditorImageMatch[] = [];
		const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
		for (let lineNumber = 0; lineNumber < editor.lineCount(); lineNumber += 1) {
			const line = editor.getLine(lineNumber);
			if (!line.includes("![[")) continue;
			const wikiImage = /!\[\[([^\]|]+)(?:\|[^\]]+?)?\]\]/g;
			let match: RegExpExecArray | null;
			while ((match = wikiImage.exec(line)) !== null) {
				const linkPath = match[1].trim().split("#")[0];
				const resolved = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
				if (resolved instanceof TFile && resolved.path === imagePath) {
					matches.push({
						lineNumber,
						fullMatch: match[0],
						startCh: match.index,
						endCh: match.index + match[0].length,
					});
				}
			}
		}
		return matches;
	}
}
