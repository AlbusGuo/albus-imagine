import { Component } from "obsidian";

interface ImageCaptionEditorOptions {
	imageEl: HTMLImageElement;
	embedEl: HTMLElement;
	value: string;
	placeholder: string;
	onSubmit: (value: string) => void;
	onClose: () => void;
}

/**
 * Edits a rendered image caption outside CodeMirror's replaceable decoration
 * tree. The original embed only reserves the draft caption's vertical space.
 */
export class ImageCaptionEditor extends Component {
	private readonly ownerDocument: Document;
	private readonly ownerWindow: Window;
	private readonly overlayEl: HTMLElement;
	private readonly inputEl: HTMLTextAreaElement;
	private readonly resizeObserver: ResizeObserver;
	private positionFrame: number | null = null;
	private focusFrame: number | null = null;
	private finished = false;

	constructor(private readonly options: ImageCaptionEditorOptions) {
		super();
		this.ownerDocument = options.embedEl.ownerDocument;
		const ownerWindow = this.ownerDocument.defaultView;
		if (!ownerWindow) throw new Error("图片所在窗口不可用");
		this.ownerWindow = ownerWindow;

		this.overlayEl = this.ownerDocument.createElement("div");
		this.overlayEl.addClass("afm-caption-editor-overlay");
		this.inputEl = this.ownerDocument.createElement("textarea");
		this.inputEl.addClass("afm-caption-input");
		this.inputEl.rows = 1;
		this.inputEl.placeholder = options.placeholder;
		this.inputEl.ariaLabel = "图片标题";
		this.inputEl.spellcheck = false;
		this.inputEl.value = options.value;
		this.overlayEl.appendChild(this.inputEl);
		this.resizeObserver = new ownerWindow.ResizeObserver(() => this.schedulePosition());
	}

	open(): void {
		this.load();
	}

	onload(): void {
		this.options.embedEl.addClass("afm-editing-caption");
		this.ownerDocument.body.appendChild(this.overlayEl);
		this.registerDomEvent(this.inputEl, "input", this.handleInput);
		this.registerDomEvent(this.inputEl, "keydown", this.handleKeydown);
		this.registerDomEvent(this.inputEl, "blur", this.handleBlur);
		this.registerDomEvent(this.inputEl, "mousedown", this.stopPropagation);
		this.registerDomEvent(this.inputEl, "click", this.stopPropagation);
		this.registerDomEvent(this.ownerDocument, "scroll", this.handleViewportChange, true);
		this.registerDomEvent(this.ownerWindow, "resize", this.handleViewportChange);
		this.resizeObserver.observe(this.options.imageEl);
		this.updateGeometry();
		this.scheduleFocus();
	}

	close(save: boolean): void {
		if (this.finished) return;
		this.finished = true;
		const value = this.inputEl.value.replace(/[\r\n]+/g, " ").trim();
		this.unload();
		try {
			if (save) this.options.onSubmit(value);
		} finally {
			this.options.onClose();
		}
	}

	private readonly handleInput = (): void => {
		this.updateInputHeight();
		this.schedulePosition();
	};

	private readonly handleKeydown = (event: KeyboardEvent): void => {
		// The portal lives outside CodeMirror, but keyboard events still reach the
		// workspace hotkey scope through document. Keep all typing inside the field.
		event.stopPropagation();
		if (event.isComposing) return;
		if (event.key === "Enter") {
			event.preventDefault();
			this.close(true);
		} else if (event.key === "Escape") {
			event.preventDefault();
			this.close(false);
		}
	};

	private readonly handleBlur = (): void => this.close(true);
	private readonly stopPropagation = (event: Event): void => event.stopPropagation();
	private readonly handleViewportChange = (): void => this.schedulePosition();

	private scheduleFocus(): void {
		// Menu teardown restores editor focus after its click callback. Waiting for
		// two paint frames ensures that restoration finishes before we claim focus.
		this.focusFrame = this.ownerWindow.requestAnimationFrame(() => {
			this.focusFrame = this.ownerWindow.requestAnimationFrame(() => {
				this.focusFrame = null;
				if (this.finished) return;
				this.inputEl.focus({ preventScroll: true });
				const caret = this.inputEl.value.length;
				this.inputEl.setSelectionRange(caret, caret);
			});
		});
	}

	private schedulePosition(): void {
		if (this.finished || this.positionFrame !== null) return;
		this.positionFrame = this.ownerWindow.requestAnimationFrame(() => {
			this.positionFrame = null;
			if (!this.options.imageEl.isConnected || !this.options.embedEl.isConnected) {
				this.close(true);
				return;
			}
			this.updateGeometry();
		});
	}

	private updateGeometry(): void {
		this.updateInputHeight();
		const imageRect = this.options.imageEl.getBoundingClientRect();
		const embedStyle = this.ownerWindow.getComputedStyle(this.options.embedEl);
		const viewportPadding = 8;
		const width = Math.max(1, Math.min(imageRect.width, this.ownerWindow.innerWidth - viewportPadding * 2));
		const left = Math.min(
			Math.max(viewportPadding, imageRect.left),
			Math.max(viewportPadding, this.ownerWindow.innerWidth - width - viewportPadding),
		);
		this.overlayEl.setCssProps({
			"--afm-caption-editor-left": `${left}px`,
			"--afm-caption-editor-top": `${imageRect.bottom}px`,
			"--afm-caption-editor-width": `${width}px`,
			"--afm-caption-font-family": embedStyle.fontFamily,
			"--afm-caption-font-style": embedStyle.fontStyle,
			"--afm-caption-font-weight": embedStyle.fontWeight,
			"--afm-caption-letter-spacing": embedStyle.letterSpacing,
		});
		const inputStyle = this.ownerWindow.getComputedStyle(this.inputEl);
		const reservedHeight =
			this.inputEl.offsetHeight
			+ Number.parseFloat(inputStyle.marginTop)
			+ Number.parseFloat(inputStyle.marginBottom);
		this.options.embedEl.setCssProps({
			"--afm-caption-editor-space": `${reservedHeight}px`,
		});
	}

	private updateInputHeight(): void {
		this.inputEl.setCssProps({ "--afm-caption-height": "auto" });
		this.inputEl.setCssProps({
			"--afm-caption-height": `${Math.max(24, this.inputEl.scrollHeight)}px`,
		});
	}

	onunload(): void {
		if (this.focusFrame !== null) {
			this.ownerWindow.cancelAnimationFrame(this.focusFrame);
			this.focusFrame = null;
		}
		if (this.positionFrame !== null) {
			this.ownerWindow.cancelAnimationFrame(this.positionFrame);
			this.positionFrame = null;
		}
		this.resizeObserver.disconnect();
		this.options.embedEl.removeClass("afm-editing-caption");
		this.options.embedEl.style.removeProperty("--afm-caption-editor-space");
		this.overlayEl.remove();
	}
}
