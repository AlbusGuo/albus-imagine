import { App, getIconIds, setIcon, SuggestModal } from "obsidian";

interface IconSuggestion {
	value: string;
	searchText: string;
}

export class ViewIconSuggestModal extends SuggestModal<IconSuggestion> {
	private readonly icons = getIconIds().map((value) => ({ value, searchText: value.toLowerCase() }));
	private selected = false;

	constructor(app: App, private readonly onChoose: (icon: string | null) => void) {
		super(app);
		this.setPlaceholder("搜索图标名称...");
	}

	getSuggestions(query: string): IconSuggestion[] {
		const keywords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
		return keywords.length === 0
			? this.icons
			: this.icons.filter((icon) => keywords.every((keyword) => icon.searchText.includes(keyword)));
	}

	renderSuggestion(icon: IconSuggestion, element: HTMLElement): void {
		element.addClass("mod-complex");
		element.createDiv({ text: icon.value });
		const preview = element.createDiv();
		setIcon(preview, icon.value);
		if (!preview.querySelector("svg")) setIcon(preview, "circle-help");
	}

	onChooseSuggestion(icon: IconSuggestion): void {
		this.selected = true;
		this.onChoose(icon.value);
	}

	onClose(): void {
		if (!this.selected) this.onChoose(null);
	}
}
