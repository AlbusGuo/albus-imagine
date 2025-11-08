# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-11-09

### Added
- **Custom File Type Support** - Configure custom file types with cover file associations
  - Add unlimited custom file type configurations in settings
  - Support for cover files in custom folders or alongside originals
  - Enable/disable custom types individually
  - Synchronized rename and delete operations for custom files and their covers
  
- **File Opening Modes** - Flexible control over how files are opened
  - Drag-and-drop interface to configure opening modes per file type
  - Internal opening: View files in Obsidian tabs
  - External opening: Launch files in system default applications (desktop only)
  - No unwanted tabs when opening files externally
  
- **Format Badges** - Visual file type identification
  - Color-coded badges on all files showing their extension
  - Blue badges for special file types (AGX, custom types)
  - Gray badges for standard image formats
  
- **Folder Path Management** - Improved folder selection
  - Moved folder path configuration to settings
  - Autocomplete folder selector with keyboard navigation
  - Set default folder for startup

### Changed
- **Plugin Renamed** - Changed plugin name from "Albus Figure Manager" to "Figure Manager"
- **Settings UI Improvements** - Reorganized settings for better usability
- **Reference Checking** - Now uses Obsidian's built-in metadata cache API
- **File Display Logic** - Unified display logic for AGX and custom file types

### Fixed
- **External File Opening** - Fixed AGX and custom files opening correctly in external applications
  - Previously would open in both external app and create unwanted Obsidian tab
  - Now correctly uses Electron shell API with FileSystemAdapter
- **Custom Type Recognition** - Fixed custom file types not being recognized after configuration
  - Settings now properly propagate to open manager views
  - Added automatic view refresh when settings change
- **Folder Selector Clicking** - Fixed folder autocomplete selection issues
  - Switched from click to mousedown events
  - Added proper callback handling for React state updates

### Technical
- Added `FileOpenMode` type system
- Implemented `FileOpenModeConfig` component with drag-and-drop
- Created `FolderSuggest` component for folder autocomplete
- Created `FolderInput` React wrapper
- Added `AppContext` for Obsidian App instance in React components
- Enhanced `FileOperationService` with mode configuration
- Enhanced `ImageLoaderService` with custom type filtering

## [0.1.0] - 2024-XX-XX

### Added
- Initial release
- Visual grid view for image management
- Reference checking and backlink navigation
- AGX file support with SVG previews
- Search and filter functionality
- File operations (open, rename, delete)
- Sort options (name, size, date, references)
- Unused file detection

---

[0.2.0]: https://github.com/AlbusGuo/albus-figure-manager/releases/tag/0.2.0
[0.1.0]: https://github.com/AlbusGuo/albus-figure-manager/releases/tag/0.1.0
