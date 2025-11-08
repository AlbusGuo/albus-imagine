import { getLanguage } from "obsidian";

import {
	BaseMessage,
	SupportedLocales,
	TranslationKeys,
	TranslationParams,
} from "./types";

export class I18n {
	private static instance: I18n;
	protected currentLocale: string = "en";
	protected translations: Record<string, BaseMessage> = SupportedLocales;
	protected flatTranslations: Record<string, Record<string, string>> = {};

	private constructor() {
		const lang = getLanguage();

		this.currentLocale = this.translations[lang] ? lang : "en";
		this.flattenTranslations();
	}

	public static getInstance(): I18n {
		if (!I18n.instance) {
			I18n.instance = new I18n();
		}
		return I18n.instance;
	}

	private flattenTranslations() {
		for (const [locale, messages] of Object.entries(this.translations)) {
			this.flatTranslations[locale] = this.flattenObject(messages);
		}
	}

	private flattenObject(obj: any, prefix = ""): Record<string, string> {
		return Object.keys(obj).reduce(
			(acc: Record<string, string>, k: string) => {
				const pre = prefix.length ? prefix + "." : "";
				if (typeof obj[k] === "object") {
					Object.assign(acc, this.flattenObject(obj[k], pre + k));
				} else {
					acc[pre + k] = obj[k];
				}
				return acc;
			},
			{}
		);
	}

	public t(key: TranslationKeys, params?: TranslationParams): string {
		const translation = this.flatTranslations[this.currentLocale][key];
		if (!translation) {
			console.warn(`Translation key not found: ${key}`);
			return key;
		}

		if (!params) {
			return translation;
		}

		// 只处理命名变量参数
		return translation.replace(/\{\{([^}]+)\}\}/g, (match, name) => {
			return params[name] !== undefined ? String(params[name]) : match;
		});
	}

	public setLocale(locale: string): void {
		if (this.translations[locale]) {
			this.currentLocale = locale;
			window.localStorage.setItem("language", locale);
		} else {
			console.warn(`Locale not found: ${locale}, falling back to 'en'`);
			this.currentLocale = "en";
			window.localStorage.setItem("language", "en");
		}
	}

	public getLocale(): string {
		return this.currentLocale;
	}

	public hasTranslation(key: TranslationKeys): boolean {
		return !!this.flatTranslations[this.currentLocale][key];
	}
}

// 导出默认实例
export const i18n = I18n.getInstance();

// 导出便捷的翻译函数
export const t = (key: TranslationKeys, params?: TranslationParams): string => {
	return i18n.t(key, params);
};
