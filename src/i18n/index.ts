/**
 * Internationalization (i18n) system
 * Provides translation functionality with language detection
 */

import { moment } from 'obsidian';
import { en } from './locales/en';
import { zhCN } from './locales/zh-CN';

export type TranslationKey = keyof typeof en;

interface Translations {
	[key: string]: string;
}

const translations: Record<string, Translations> = {
	'en': en,
	'zh-CN': zhCN,
	'zh-cn': zhCN,
	'zh': zhCN,
};

let currentLocale = 'en';

/**
 * Initialize i18n system with detected locale
 */
export function initI18n(): void {
	// Get Obsidian's locale setting
	const obsidianLocale = moment.locale();
	
	// Try to find matching translation
	if (translations[obsidianLocale]) {
		currentLocale = obsidianLocale;
	} else if (translations[obsidianLocale.toLowerCase()]) {
		currentLocale = obsidianLocale.toLowerCase();
	} else if (obsidianLocale.startsWith('zh')) {
		// Default Chinese variants to zh-CN
		currentLocale = 'zh-CN';
	} else {
		// Default to English
		currentLocale = 'en';
	}
}

/**
 * Get current locale
 */
export function getCurrentLocale(): string {
	return currentLocale;
}

/**
 * Translate a key to the current locale
 * @param key Translation key
 * @param fallback Optional fallback text if translation not found
 */
export function t(key: TranslationKey, fallback?: string): string {
	const localeTranslations = translations[currentLocale] || translations['en'];
	const translation = localeTranslations[key];
	
	if (translation) {
		return translation;
	}
	
	// Try English fallback
	if (currentLocale !== 'en' && translations['en'][key]) {
		return translations['en'][key];
	}
	
	// Return fallback or key
	return fallback || key;
}
