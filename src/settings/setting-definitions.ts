import { Setting, SettingDefinitionRender, SettingGroup } from "obsidian";

type SettingRenderer = (setting: Setting) => void;

export function createSettingDefinition(
	name: string,
	desc: string,
	render: SettingRenderer,
): SettingDefinitionRender {
	return { name, desc, render };
}

export function renderSettingDefinitions(
	group: SettingGroup,
	definitions: SettingDefinitionRender[],
): void {
	for (const definition of definitions) {
		group.addSetting((setting) => {
			setting.setName(definition.name);
			if (definition.desc) setting.setDesc(definition.desc);
			definition.render(setting, group);
		});
	}
}
