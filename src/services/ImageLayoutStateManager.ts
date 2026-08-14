import { Component } from "obsidian";

const EMBED_SELECTOR = ".image-embed";
const WRAP_SELECTOR = ".image-embed.afm-wrap-left, .image-embed.afm-wrap-right";
const LAYOUT_CLASSES = [
	"afm-align-left",
	"afm-align-right",
	"afm-wrap-left",
	"afm-wrap-right",
] as const;

interface DocumentState {
	observer: MutationObserver;
	pendingRoots: Set<Element>;
	changedRoots: Set<Element>;
	frameId: number | null;
}

/**
 * Mirrors image layout parameters onto container classes.
 *
 * Obsidian stores parameters without a caption on the child image's `alt`
 * attribute, while captioned embeds expose them on the container `src`.
 * Container state classes let CSS handle both forms without `:has()`.
 */
export class ImageLayoutStateManager extends Component {
	private readonly documents = new Map<Document, DocumentState>();

	registerDocument(doc: Document): void {
		if (this.documents.has(doc)) return;

		const MutationObserverClass = doc.defaultView?.MutationObserver ?? MutationObserver;
		const state: DocumentState = {
			observer: new MutationObserverClass((mutations) => {
				for (const mutation of mutations) {
					if (mutation.target.nodeType === 1) {
						state.changedRoots.add(mutation.target as Element);
					}
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === 1) state.pendingRoots.add(node as Element);
					});
				}
				this.schedule(doc, state);
			}),
			pendingRoots: new Set<Element>(),
			changedRoots: new Set<Element>(),
			frameId: null,
		};

		this.documents.set(doc, state);
		state.observer.observe(doc.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["alt", "src"],
		});
		doc.querySelectorAll<HTMLElement>(EMBED_SELECTOR).forEach((embed) => {
			this.updateEmbed(embed);
		});
		doc.querySelectorAll<HTMLElement>(".markdown-source-view.mod-cm6 .cm-line").forEach((line) => {
			this.updateLine(line);
		});
		doc.querySelectorAll<HTMLElement>(".markdown-source-view.mod-cm6 .cm-content").forEach((content) => {
			this.updateContent(content);
		});
	}

	unregisterDocument(doc: Document): void {
		const state = this.documents.get(doc);
		if (!state) return;
		state.observer.disconnect();
		if (state.frameId !== null) doc.defaultView?.cancelAnimationFrame(state.frameId);
		this.documents.delete(doc);
	}

	private schedule(doc: Document, state: DocumentState): void {
		if (state.frameId !== null) return;
		state.frameId = doc.defaultView?.requestAnimationFrame(() => {
			state.frameId = null;
			this.flush(state);
		}) ?? null;
		if (state.frameId === null) this.flush(state);
	}

	private flush(state: DocumentState): void {
		const roots = Array.from(state.pendingRoots);
		const changedRoots = Array.from(state.changedRoots);
		state.pendingRoots.clear();
		state.changedRoots.clear();
		const embeds = new Set<HTMLElement>();
		const lines = new Set<HTMLElement>();
		const contents = new Set<HTMLElement>();

		for (const root of roots) {
			this.collect(root, embeds, lines, contents);
		}
		for (const root of changedRoots) {
			this.collectContext(root, embeds, lines, contents);
		}
		for (const embed of embeds) {
			this.updateEmbed(embed);
			const line = embed.closest<HTMLElement>(".cm-line");
			if (line) lines.add(line);
			const content = embed.closest<HTMLElement>(".cm-content");
			if (content) contents.add(content);
		}
		for (const line of lines) this.updateLine(line);
		for (const content of contents) this.updateContent(content);
	}

	private collect(
		root: Element,
		embeds: Set<HTMLElement>,
		lines: Set<HTMLElement>,
		contents: Set<HTMLElement>,
	): void {
		if (root.matches(EMBED_SELECTOR)) embeds.add(root as HTMLElement);
		root.querySelectorAll<HTMLElement>(EMBED_SELECTOR).forEach((embed) => embeds.add(embed));
		this.collectContext(root, embeds, lines, contents);
	}

	private collectContext(
		root: Element,
		embeds: Set<HTMLElement>,
		lines: Set<HTMLElement>,
		contents: Set<HTMLElement>,
	): void {
		const closestEmbed = root.closest<HTMLElement>(EMBED_SELECTOR);
		if (closestEmbed) embeds.add(closestEmbed);
		const closestLine = root.closest<HTMLElement>(".cm-line");
		if (closestLine) lines.add(closestLine);
		const closestContent = root.closest<HTMLElement>(".cm-content");
		if (closestContent) contents.add(closestContent);
		if (root.matches(".cm-line")) lines.add(root as HTMLElement);
		if (root.matches(".cm-content")) contents.add(root as HTMLElement);
	}

	private updateEmbed(embed: HTMLElement): void {
		const src = embed.getAttribute("src") ?? "";
		const altTokens = new Set(
			(embed.querySelector<HTMLImageElement>("img")?.alt ?? "")
				.split("|")
				.map((token) => token.trim())
				.filter(Boolean),
		);
		const hasParameter = (parameter: string): boolean => (
			src.includes(`#${parameter}`) || altTokens.has(parameter)
		);

		for (const className of LAYOUT_CLASSES) embed.removeClass(className);
		if (hasParameter("align-left")) embed.addClass("afm-align-left");
		if (hasParameter("align-right")) embed.addClass("afm-align-right");
		if (hasParameter("left")) embed.addClass("afm-wrap-left");
		if (hasParameter("right")) embed.addClass("afm-wrap-right");
	}

	private updateLine(line: HTMLElement): void {
		const directElements = Array.from(line.children);
		const hasWrappedImage = directElements.some((element) => element.matches(WRAP_SELECTOR));
		const hasOtherElement = directElements.some((element) => (
			!element.matches(".image-embed") && element.tagName !== "BR"
		));
		line.toggleClass("afm-wrap-image-only", hasWrappedImage && !hasOtherElement);
	}

	private updateContent(content: HTMLElement): void {
		content.toggleClass("afm-has-wrapped-image", content.querySelector(WRAP_SELECTOR) !== null);
	}

	onunload(): void {
		for (const doc of Array.from(this.documents.keys())) this.unregisterDocument(doc);
	}
}
