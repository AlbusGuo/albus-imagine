![Imagine](https://socialify.git.ci/AlbusGuo/albus-imagine/image?description=1&font=Raleway&forks=1&issues=1&name=1&owner=1&pattern=Circuit+Board&pulls=1&stargazers=1&theme=Light)

[![Release](https://img.shields.io/github/v/release/AlbusGuo/albus-imagine)](https://github.com/AlbusGuo/albus-imagine/releases)
[![Downloads](https://img.shields.io/github/downloads/AlbusGuo/albus-imagine/total)](https://github.com/AlbusGuo/albus-imagine/releases)

# Imagine

Imagine is an all-in-one image workflow plugin for [Obsidian](https://obsidian.md/). It brings image browsing, reference analysis, insertion, layout, caption editing, resizing, previewing, and batch file operations into one local desktop plugin.

[English](README.md) | [Chinese](README.zh-CN.md)

## Highlights

- Browse vault images in a responsive, virtualized image manager.
- Search by file name and filter by vault folder or reference status.
- Sort by modified time, created time, file size, file name, or reference count.
- Detect links and embeds through Obsidian's metadata cache, including frontmatter links.
- Rename, move, open, preview, and trash image files without leaving Obsidian.
- Move or trash multiple selected files, or safely recheck and trash unreferenced images.
- Insert individual images or generate a responsive Grid Callout from multiple selections.
- Apply centered, aligned, wrapped, or inline layouts through Wiki link parameters.
- Add dark-theme inversion and editable captions to image embeds.
- Resize images by dragging their lower-right edge in Live Preview.
- Open a full-window image viewer with zoom and pan controls.
- Manage non-image source files through associated cover images.
- Work across Obsidian pop-out windows.

## Requirements and privacy

- Obsidian 1.12.1 or later.
- Desktop platforms only: Windows, macOS, and Linux.
- Imagine works locally. It does not upload vault data, collect telemetry, or require an external service.

## Installation

### Community plugins

Once Imagine is available in the Obsidian community plugin directory:

1. Open **Settings → Community plugins**.
2. Select **Browse** and search for `Imagine`.
3. Install the plugin and enable it.

### BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. In the BRAT settings, select **Add beta plugin**.
3. Enter `https://github.com/AlbusGuo/albus-imagine`.
4. Enable **Imagine** under **Settings → Community plugins**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [release](https://github.com/AlbusGuo/albus-imagine/releases).
2. Create `<vault>/.obsidian/plugins/albus-imagine/`.
3. Place the three files in that folder.
4. Restart Obsidian and enable **Imagine** under **Settings → Community plugins**.

## Quick start

1. Open the image manager from the ribbon icon or the command palette.
2. Open the image picker from the command palette to insert an image at the current editor selection.
3. In Live Preview, right-click an embedded Wiki link image to change its position, inversion, caption, or open its source file.
4. Move the pointer near an image's lower-right corner and drag to resize it.
5. Hold `Ctrl` and select an image to open Imagine's full-window viewer.

## Image manager

The image manager opens as a regular workspace tab and keeps its state when Obsidian restores the workspace.

### Browse and filter

- Filter by vault folder with path suggestions.
- Search by file name.
- Switch between all images and unreferenced images.
- Sort in ascending or descending order by modified time, created time, size, name, or reference count.
- Exclude configured folders from the catalog.
- Refresh the current results manually when needed.

The grid is virtualized and image media is loaded only for visible cards, keeping large collections responsive.

### Reference analysis

Imagine uses Obsidian's public metadata cache and resolved link graph. It recognizes regular links, embeds, reference links, frontmatter links, and other references included in Obsidian's resolved counts. Reference results are cached and invalidated when Markdown metadata changes.

Select a card to open its preview and inspect every available referring note. Selecting a reference opens the note and navigates to the recorded location when one is available.

### File operations

Each card provides actions to:

- Open the file.
- Rename the file.
- Move the file to another vault folder.
- Move the file to the system trash through Obsidian's file manager.

Multi-select mode supports batch move and batch trash. The unreferenced-image action performs fresh reference checks before the confirmation step and again before deletion, reducing the risk of removing a newly referenced file.

### Preview

The preview modal includes:

- Wheel zoom, pointer drag, and double-click reset.
- File path, size, created time, and modified time.
- A list of referring notes.
- Separate source and cover details for custom file types.

## Image picker and insertion

The image picker reuses the same catalog, folder filtering, search, sorting, virtualized grid, and lazy media loading as the manager.

Before inserting one image, you can choose:

- Position: center, align left, align right, wrap left, wrap right, or inline.
- Dark-theme inversion.
- An optional caption.

Selecting one card inserts a Wiki embed at the active editor selection. Multi-select mode inserts plain image embeds inside a `[!grid]` callout:

```markdown
> [!grid]
> ![[photo-1.jpg]]
> ![[photo-2.jpg]]
> ![[photo-3.jpg]]
```

## Image layout syntax

Imagine stores layout parameters in Wiki links and renders them consistently in Reading View and Live Preview.

| Parameter | Result |
| --- | --- |
| `center` | Centered block image |
| `align-left` | Left-aligned block image without text wrapping |
| `align-right` | Right-aligned block image without text wrapping |
| `left` | Left-floating image with text wrapping |
| `right` | Right-floating image with text wrapping |
| `inline` | Inline image |
| `dark` | Invert the image in a dark theme |

### Without a caption

Parameters follow the file path as pipe-separated fields:

```markdown
![[diagram.svg|center]]
![[diagram.svg|dark|align-right]]
![[photo.jpg|left|480]]
```

### With a caption

Layout and inversion parameters use URL fragments, while the first pipe field contains the caption. An optional size field remains supported:

```markdown
![[architecture.png#center|System architecture]]
![[flowchart.svg#align-right#dark|Processing flow|640]]
```

The caption is displayed below the image. Its editor is positioned over the rendered caption, remains transparent in every interaction state, wraps long text automatically, and saves with `Enter` or when focus leaves the field. Press `Escape` to cancel editing.

## Image context menu

Right-click a Wiki link image in Live Preview to add these actions to Obsidian's native image section:

- **Image position**: center, align left, align right, wrap left, or wrap right.
- **Dark inversion**: toggle the `dark` parameter.
- **Edit caption**: edit the rendered caption in place.
- **Open source file**: open the image or the source file represented by a custom cover.

Obsidian's own menu continues to provide standard file, link, and deletion actions.

## Drag resizing

Drag resizing is available for images in Live Preview:

1. Move the pointer into the configurable detection area near the lower-right edge.
2. Drag horizontally to adjust the width while preserving the aspect ratio.
3. Release the pointer to store the final width in the Markdown link.

Imagine writes the change through the CodeMirror transaction system, so normal editor undo and redo remain available. Callout and non-callout images can be enabled independently. The minimum width is 50 pixels, and an optional step value can snap the final width to a chosen interval.

Drag resizing does not run in Reading View, Canvas, plugin modals, or the image picker.

## Full-window image viewer

When the viewer is enabled, hold `Ctrl` and select an image to open it. The viewer supports:

- Wheel zoom around the pointer position.
- Pointer drag to pan.
- Double-click to reset the image.
- Selecting the background or pressing `Escape` to close.
- A checkerboard background for images with transparency.

An optional setting disables Obsidian's built-in single-click image viewer while preserving normal image selection, context menus, resizing, and Imagine's `Ctrl`-click viewer.

## Custom file types

Imagine can represent a non-image source file with a related cover image. Each custom type defines:

- The source file extension, such as `pdf`, `psd`, `ai`, or `blend`.
- The cover image extension, such as `png` or `jpg`.
- An optional cover folder. When empty, the cover is expected next to the source file.

For example, `Designs/model.blend` can use `Covers/model.png` as its visible card. Rename, move, and trash operations keep the source and cover together. A missing cover is shown explicitly instead of silently hiding the source file.

## Supported image formats

Imagine recognizes these image extensions by default:

`png`, `jpg`, `jpeg`, `gif`, `bmp`, `webp`, `svg`, `ico`, `tif`, `tiff`, `avif`, `heic`, and `heif`.

Additional source formats can be added through the custom file type settings.

## Settings reference

Obsidian 1.13 and later expose Imagine's settings as searchable native pages. Obsidian 1.12 uses the compatible tabbed fallback.

### Image manager

| Setting | Default | Purpose |
| --- | --- | --- |
| Show file size | On | Display file size on image cards |
| Show modified time | On | Display the last modified date on image cards |
| Default sort field | Modified time | Choose the initial manager sort field |
| Default sort order | Descending | Choose the initial manager sort direction |
| Excluded folders | Empty | Omit one vault folder path per line |
| Confirm deletion | On | Ask for confirmation before trashing files |
| Invert SVG images in dark mode | On | Control the plugin's dark-theme SVG inversion behavior and picker default |

### Image resizing

| Setting | Default | Purpose |
| --- | --- | --- |
| Resize images outside callouts | On | Enable drag resizing outside callouts |
| Resize images inside callouts | On | Enable drag resizing inside callouts |
| Resize step | `0` | Snap to a pixel interval; `0` disables snapping |
| Edge detection area | `20` | Set the activation area from 5 to 150 pixels |

### Image viewer

| Setting | Default | Purpose |
| --- | --- | --- |
| Enable image viewer | On | Enable Imagine's `Ctrl`-click viewer |
| Disable built-in click viewer | Off | Block Obsidian's ordinary single-click image viewer |

### Custom file types

Add, edit, or remove source extension, cover extension, and cover folder mappings.

## Limitations

- The plugin is desktop-only.
- Drag resizing and the custom image context menu require Live Preview.
- Context-menu link editing currently supports Wiki link image embeds, not standard Markdown image syntax.
- The custom viewer uses `Ctrl` on all desktop platforms.

## Credits

The image viewer was inspired by [Image Toolkit](https://github.com/sissilab/obsidian-image-toolkit), and drag resizing was inspired by [AttachFlow](https://github.com/Yaozhuwa/AttachFlow). Thank you to their authors and the Obsidian community.

## License

Imagine is released under the [GNU Affero General Public License v3.0](LICENSE).
