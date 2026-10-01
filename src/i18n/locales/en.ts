/**
 * English translations
 */

export const en = {
	// Settings tabs
	"settings.tab.imageManager": "Image Manager",
	"settings.tab.imageResize": "Image Resizing",
	"settings.tab.imageViewer": "Image Viewer",
	"settings.tab.customFileTypes": "Custom File Types",

	// Settings page descriptions
	"settings.page.imageManager.desc":
		"Image list, sorting, reference display and deletion behavior",
	"settings.page.imageResize.desc":
		"Image resize by dragging in Live Preview",
	"settings.page.imageViewer.desc":
		"Quick view and built-in image lightbox behavior",
	"settings.page.customFileTypes.desc":
		"Configure preview covers for non-image files",

	// Image Manager settings
	"settings.imageManager.showFileSize": "Show file size",
	"settings.imageManager.showFileSize.desc":
		"Display file size information on image cards",
	"settings.imageManager.showModifiedTime": "Show modified time",
	"settings.imageManager.showModifiedTime.desc":
		"Display the last modified time on image cards",
	"settings.imageManager.defaultSortField": "Default sort field",
	"settings.imageManager.defaultSortField.desc":
		"Default sorting method when opening the image manager",
	"settings.imageManager.defaultSortOrder": "Default sort order",
	"settings.imageManager.defaultSortOrder.desc":
		"Default sorting order when opening the image manager",
	"settings.imageManager.excludedFolders": "Excluded folders",
	"settings.imageManager.excludedFolders.desc":
		"Exclude these folders from the image manager",
	"settings.imageManager.excludedFolders.placeholder":
		"Enter folder paths to exclude, one per line",
	"settings.imageManager.confirmDelete": "Confirm deletion",
	"settings.imageManager.confirmDelete.desc":
		"Show confirmation dialog before deleting files",
	"settings.imageManager.invertSvgInDarkMode":
		"Invert SVG images in dark mode",
	"settings.imageManager.invertSvgInDarkMode.desc":
		"Invert SVG images in dark theme to better match dark backgrounds",

	// Sort field options
	"sort.field.mtime": "Modified time",
	"sort.field.ctime": "Created time",
	"sort.field.size": "File size",
	"sort.field.name": "File name",
	"sort.field.references": "Reference count",

	// Sort order options
	"sort.order.desc": "Descending",
	"sort.order.asc": "Ascending",

	// Image Resize settings
	"settings.imageResize.dragResizeGeneral": "Resize images outside callouts",
	"settings.imageResize.dragResizeGeneral.desc":
		"Allow resizing images by dragging their edges outside callouts",
	"settings.imageResize.dragResizeCallout": "Resize images inside callouts",
	"settings.imageResize.dragResizeCallout.desc":
		"Allow resizing images by dragging their edges inside callouts",
	"settings.imageResize.resizeInterval": "Resize step",
	"settings.imageResize.resizeInterval.desc":
		"Minimum resize step, 0 means no grid alignment",
	"settings.imageResize.resizeInterval.placeholder": "0",
	"settings.imageResize.resizeInterval.error":
		"Please enter a non-negative integer",
	"settings.imageResize.edgeSize": "Edge detection area size",
	"settings.imageResize.edgeSize.desc":
		"How many pixels from the edge can trigger resizing",

	// Image Viewer settings
	"settings.imageViewer.enabled": "Enable image viewer",
	"settings.imageViewer.enabled.desc":
		"Enable Ctrl+Click to view images everywhere",
	"settings.imageViewer.disableNative": "Disable built-in click viewer",
	"settings.imageViewer.disableNative.desc":
		"Block built-in image lightbox from responding to regular clicks, does not affect right-click menu, drag resize or this plugin's quick view",

	// Custom File Types settings
	"settings.customFileTypes.empty": "No custom file types",
	"settings.customFileTypes.empty.desc":
		"Add custom file types to specify preview covers for non-image files.",
	"settings.customFileTypes.type": "Type",
	"settings.customFileTypes.fileExtension.placeholder":
		"File extension (e.g., PDF)",
	"settings.customFileTypes.coverExtension.placeholder":
		"Cover extension (e.g., JPG)",
	"settings.customFileTypes.coverFolder.placeholder":
		"Cover folder (optional)",
	"settings.customFileTypes.delete.tooltip": "Delete this type",
	"settings.customFileTypes.add": "Add file type",
	"settings.customFileTypes.add.desc":
		"Set source file extension, cover extension and optional cover folder.",
	"settings.customFileTypes.add.button": "Add",

	// Image Picker Modal
	"picker.title": "Select Image",
	"picker.folder.placeholder": "Filter by folder...",
	"picker.folder.clear": "Clear filter",
	"picker.search.placeholder": "Search images...",
	"picker.refresh": "Refresh",
	"picker.multiSelect": "Multi-select",
	"picker.cancelMultiSelect": "Cancel",
	"picker.confirmInsert": "Confirm insert ({count})",
	"picker.position": "Position",
	"picker.positionLabel": "Position:",
	"picker.position.center": "Center",
	"picker.position.alignLeft": "Align left",
	"picker.position.alignRight": "Align right",
	"picker.position.left": "Wrap left",
	"picker.position.right": "Wrap right",
	"picker.position.inline": "Inline",
	"picker.invertColor": "Dark inversion",
	"picker.invertLabel": "Invert:",
	"picker.caption": "Caption",
	"picker.captionLabel": "Caption:",
	"picker.caption.placeholder": "Enter image caption (optional)",
	"picker.noImages": "No images found",
	"picker.noMatchingImages": "No matching images",
	"picker.loading": "Loading...",
	"picker.insertSelected": "Insert {count} image(s)",
	"picker.selectImages": "Select images to insert",
	"picker.selectAtLeastOne": "Please select at least one image",
	"picker.loadFailed": "Failed to load images: {message}",
	"picker.stats.images": " images",
	"picker.stats.selected": " selected",
	"picker.sortBy": "Sort by",

	// Image Preview Modal
	"preview.loadError": "Image failed to load",
	"preview.loadError.hint":
		"The file may be corrupted, too large, or in an unsupported format",
	"preview.details": "Details",
	"preview.sourceFile": "Source file",
	"preview.coverFile": "Cover file",
	"preview.path": "Path",
	"preview.size": "Size",
	"preview.createdTime": "Created time",
	"preview.modifiedTime": "Modified time",
	"preview.type": "Type",
	"preview.coverMissing": "Cover missing",
	"preview.backlinks": "References",
	"preview.noBacklinks": "No references",

	// Rename Modal
	"rename.title": "Rename File",
	"rename.fileName": "File name",
	"rename.fileName.placeholder": "Enter file name",
	"rename.cancel": "Cancel",
	"rename.confirm": "Rename",
	"rename.renaming": "Renaming...",
	"rename.error.empty": "File name cannot be empty",

	// Delete Confirm Modal
	"delete.title": "Delete Image",
	"delete.confirmMessage": "Are you sure you want to delete file ",
	"delete.questionMark": "?",
	"delete.message": "Are you sure you want to move this file to trash?",
	"delete.message.file": "File: {file}",
	"delete.warning": "This action cannot be undone.",
	"delete.cancel": "Cancel",
	"delete.confirm": "Delete",
	"delete.deleting": "Deleting...",

	// Batch Delete Confirm Modal
	"batchDelete.title": "Batch Delete Images",
	"batchDelete.confirmPrefix": "Confirm deleting ",
	"batchDelete.imagesCount": " images",
	"batchDelete.questionMark": "?",
	"batchDelete.customFilesInfo":
		"{customCount} special images include covers, {totalFiles} files will be deleted in total.",
	"batchDelete.totalFilesInfo":
		"{totalFiles} files will be deleted in total.",
	"batchDelete.progress": "Delete Progress",
	"batchDelete.message":
		"Are you sure you want to move {count} file(s) to trash?",
	"batchDelete.warning": "This action cannot be undone.",
	"batchDelete.cancel": "Cancel",
	"batchDelete.confirm": "Delete All",
	"batchDelete.deleting": "Deleting...",

	// Folder Picker Modal
	"folderPicker.title": "Select Folder",
	"folderPicker.placeholder": "Select target folder...",
	"folderPicker.cancel": "Cancel",
	"folderPicker.confirm": "Select",

	// Image Manager View
	"manager.title": "Image Manager",
	"manager.folder.placeholder": "Filter by folder...",
	"manager.folder.clear": "Clear filter",
	"manager.search.placeholder": "Search images...",
	"manager.refresh": "Refresh",
	"manager.unreferenced": "Unreferenced",
	"manager.noImages": "No images found",
	"manager.noMatchingImages": "No matching images",
	"manager.loading": "Loading...",
	"manager.selectAll": "Select all",
	"manager.deselectAll": "Deselect all",
	"manager.batchMove": "Move selected ({count})",
	"manager.batchDelete": "Delete selected ({count})",
	"manager.deleteAllUnreferenced": "Delete all unreferenced",
	"manager.multiSelect": "Multi-select",
	"manager.cancelMultiSelect": "Cancel multi-select",
	"manager.showAll": "Show all",
	"manager.filterUnreferenced": "Filter unreferenced",
	"manager.sortBy": "Sort by",
	"manager.stats.images": " images",
	"manager.stats.filtered": "filtered",
	"manager.loadFailed": "Failed to load images: {message}",

	// Image Context Menu
	"contextMenu.position": "Image position",
	"contextMenu.position.center": "Center",
	"contextMenu.position.alignLeft": "Align left",
	"contextMenu.position.alignRight": "Align right",
	"contextMenu.position.wrapLeft": "Wrap left",
	"contextMenu.position.wrapRight": "Wrap right",
	"contextMenu.invertDark": "Dark inversion",
	"contextMenu.openSource": "Open source file",

	// Notices and messages
	"notice.imageInserted": "Image inserted",
	"notice.imagesInserted": "{count} images inserted",
	"notice.fileRenamed": "File renamed",
	"notice.fileMoved": "File moved",
	"notice.fileDeleted": "File deleted",
	"notice.filesDeleted": "{count} files deleted",
	"notice.operationFailed": "Operation failed",
	"notice.noImagesSelected": "No images selected",
	"notice.loadFailed": "Failed to load images: {message}",
	"notice.checkingReferences": "Checking references... {current}/{total}",
	"notice.referencesChecked":
		"Reference check complete: checked {count} images",
	"notice.checkReferencesFailed": "Reference check failed: {message}",
	"notice.noImagesToDelete": "No images to delete",
	"notice.noUnreferencedAfterCheck": "No unreferenced images after recheck",
	"notice.noSafeToDelete": "No images safe to delete after final check",
	"notice.moving": "Moving... {current}/{total}",
	"notice.moveSuccess": "Successfully moved {count} images",
	"notice.moveComplete": "Move complete: success {success}, failed {failed}",
	"notice.deleteSuccess": "Successfully deleted {count} images",
	"notice.deleteComplete":
		"Delete complete: success {success}, failed {failed}",

	// Common
	"common.kb": "KB",
	"common.close": "Close",
	"common.save": "Save",
	"common.cancel": "Cancel",
	"common.confirm": "Confirm",
	"common.loading": "Loading...",
	"common.error": "Error",

	// Main plugin
	"main.ribbonIcon": "Image Manager",
	"main.commandOpenManager": "Open Image Manager",
	"main.commandInsertImage": "Insert Image",

	// Components
	"component.imageNotAvailable": "Image window unavailable",
	"component.imageTitle": "Image Title",
	"component.coverMissing": "Cover Missing",
	"component.loadFailed": "Load Failed",
	"component.open": "Open",
	"component.rename": "Rename",
	"component.move": "Move",
	"component.delete": "Delete",
	"component.unreferenced": "Unreferenced",
	"component.references": "{count} references",

	// Services - Context Menu
	"contextMenu.imagePosition": "Image Position",
	"contextMenu.center": "Center",
	"contextMenu.alignLeft": "Align Left",
	"contextMenu.alignRight": "Align Right",
	"contextMenu.floatLeft": "Float Left",
	"contextMenu.floatRight": "Float Right",
	"contextMenu.inline": "Inline",
	"contextMenu.darkModeInvert": "Dark Mode Invert",
	"contextMenu.editCaption": "Edit Caption",
	"contextMenu.captionPlaceholder":
		"Enter image caption (leave empty to remove)",
	"contextMenu.openSourceFile": "Open Source File",

	// Services - Notices
	"service.cannotGetImagePath": "Cannot get image path",
	"service.useInEditMode": "Please use in edit mode",
	"service.imageNotFound": "Image link not found",
	"service.positionUpdated": "Image position: {position}",
	"service.invertCanceled": "Invert canceled",
	"service.invertEnabled": "Invert enabled",
	"service.fileNotExist": "File does not exist",
	"service.cannotFindContainer": "Cannot find image container",
	"service.linkChanged": "Image link has changed, caption not saved",
	"service.notSupportedEnvironment":
		"Current environment does not support opening with default app",
	"service.fileRenameSuccess": "File renamed successfully",
	"service.fileDeleteSuccess": "File deleted successfully",
	"service.fileAlreadyInFolder": "File already in this folder",
	"service.fileMoveSuccess": "File moved successfully",
	"service.multipleLinksFound":
		"Found multiple identical image links, please resize manually",
	"service.linkNotFoundManual":
		"Image link not found, please resize manually",
	"service.linkNotUnique":
		"Current image link is not unique, operation canceled to avoid modifying wrong link",

	// Errors - Console
	"error.batchCheckFailed": "Batch reference check failed:",
	"error.checkReferenceFailed": "Error checking references:",
	"error.rollbackFailed": "File operation rollback failed:",
	"error.cannotParseResource": "Cannot parse image resource address:",
	"error.cannotLocateFromDOM": "Cannot locate image from editor DOM:",

	// Manager View
	"managerView.hintCheckPath": "Hint: Please check folder path settings",
} as const;
