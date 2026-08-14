export {};

declare global {
	interface Window {
		createDiv: typeof createDiv;
		createEl: typeof createEl;
	}
}
