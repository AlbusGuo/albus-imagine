import { ButtonComponent } from "obsidian";

interface CompatibleDestructiveButton {
	setDestructive?: () => ButtonComponent;
	setWarning?: () => ButtonComponent;
}

export function setDestructiveButton(button: ButtonComponent): ButtonComponent {
	const compatibleButton = button as unknown as CompatibleDestructiveButton;
	if (compatibleButton.setDestructive) return compatibleButton.setDestructive();
	if (compatibleButton.setWarning) return compatibleButton.setWarning();
	return button;
}

export function refreshSettingTab(settingTab: object, fallback: () => void): void {
	const update = Reflect.get(settingTab, "update") as unknown;
	if (typeof update === "function") {
		(update as (this: object) => void).call(settingTab);
		return;
	}
	fallback();
}
