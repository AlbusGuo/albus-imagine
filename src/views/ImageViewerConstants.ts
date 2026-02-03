/**
 * 图片查看器相关常量
 */

export const IMAGE_VIEWER_CLASS = {
	CONTAINER: 'afm-img-viewer-container',
	IMG_CONTAINER: 'afm-img-container',
	IMG_VIEW: 'afm-img-view',
};

/**
 * 图片选择器
 */
export const VIEW_IMG_SELECTOR = {
	EDITOR_AREAS: `.workspace-leaf-content[data-type='markdown'] img,.workspace-leaf-content[data-type='image'] img`,
	EDITOR_AREAS_NO_LINK: `.workspace-leaf-content[data-type='markdown'] img:not(a img),.workspace-leaf-content[data-type='image'] img:not(a img)`,
	CPB: `.community-modal-details img`,
	CPB_NO_LINK: `.community-modal-details img:not(a img)`,
	OTHER: `.modal-content img`,
	OTHER_NO_LINK: `.modal-content img:not(a img)`,
};
