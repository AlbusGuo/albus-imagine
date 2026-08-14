/**
 * 引用缓存管理
 */

import { ReferenceCheckResult } from "../types/image-manager.types";

export class ReferenceCache {
	private cache: Map<string, ReferenceCheckResult> = new Map();

	/**
	 * 获取缓存
	 */
	get(key: string): ReferenceCheckResult | undefined {
		return this.cache.get(key);
	}

	/**
	 * 设置缓存
	 */
	set(key: string, value: ReferenceCheckResult): void {
		this.cache.set(key, value);
	}

	/**
	 * 检查是否存在
	 */
	has(key: string): boolean {
		return this.cache.has(key);
	}

	/**
	 * 清空缓存
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * 更新缓存键 (用于文件重命名)
	 */
	updateKey(oldKey: string, newKey: string): void {
		const value = this.cache.get(oldKey);
		if (value) {
			this.cache.delete(oldKey);
			this.cache.set(newKey, value);
		}
	}

	delete(key: string): void {
		this.cache.delete(key);
	}
}
