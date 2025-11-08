English | [中文](https://github.com/RavenHogWarts/obsidian-plugin-starter/blob/master/README-zh.md)

# Obsidian Sample Plugin
This is a sample plugin for Obsidian (https://obsidian.md).

This project uses Typescript to provide type checking and documentation.
The repo depends on the latest plugin API (obsidian.d.ts) in Typescript Definition format, which contains TSDoc comments describing what it does.

[![GitHub stars](https://img.shields.io/github/stars/RavenHogWarts/obsidian-plugin-starter?style=flat&label=Stars)](https://github.com/RavenHogWarts/obsidian-plugin-starter/stargazers)
[![Total Downloads](https://img.shields.io/github/downloads/RavenHogWarts/obsidian-plugin-starter/total?style=flat&label=Total%20Downloads)](https://github.com/RavenHogWarts/obsidian-plugin-starter/releases)
[![Latest Downloads](https://img.shields.io/github/downloads/RavenHogWarts/obsidian-plugin-starter/latest/total?style=flat&label=Latest%20Downloads)](https://github.com/RavenHogWarts/obsidian-plugin-starter/releases/latest)
[![GitHub License](https://img.shields.io/github/license/RavenHogWarts/obsidian-plugin-starter?style=flat&label=License)](https://github.com/RavenHogWarts/obsidian-plugin-starter/blob/master/LICENSE)
[![GitHub Issues](https://img.shields.io/github/issues/RavenHogWarts/obsidian-plugin-starter?style=flat&label=Issues)](https://github.com/RavenHogWarts/obsidian-plugin-starter/issues)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/RavenHogWarts/obsidian-plugin-starter?style=flat&label=Last%20Commit)](https://github.com/RavenHogWarts/obsidian-plugin-starter/commits/master)

## Installation
### Community plugin market installation

[Click to install](obsidian://show-plugin?id=obsidian-plugin-starter), or:

1. Open Obsidian and go to `Settings > Community Plugins`.
2. Search for "Obsidian Plugin Starter".
3. Click "Install".

### Manual Installation

1. Download the latest release
2. Copy `main.js`, `styles.css`, and `manifest.json` to your vault's plugins folder: `<vault>/.obsidian/plugins/obsidian-plugin-starter/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### BRAT (Recommended for Beta Users)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Click "Add Beta plugin" in BRAT settings
3. Enter `RavenHogWarts/obsidian-plugin-starter`
4. Enable the plugin

## Development

- Clone this repo
- Make sure your NodeJS is at least v16 (`node --version`)
- `npm i` or `yarn` to install dependencies
- `npm run dev` to start compilation in watch mode
- `npm run build` to build the plugin
- `npm run build:local` to build the plugin and copy it to your vault's plugins folder(need create a .env file in the project root and add the line: VAULT_PATH=/path/to/your/vault)
- `npm run version` to bump the version number and update the manifest.json, version.json, package.json
- `npm run release` to build the plugin and bump the version number

## Support

If you encounter any issues or have suggestions:
- [Open an issue](https://github.com/RavenHogWarts/obsidian-plugin-starter/issues) on GitHub
- [Join the discussion](https://github.com/RavenHogWarts/obsidian-plugin-starter/discussions) for questions and ideas

If you find this plugin helpful, you can support the development through:
- WeChat/Alipay: [QR Code](https://s2.loli.net/2024/05/06/lWBj3ObszUXSV2f.png)

## License

This project is licensed under the xxx LICENSE - see the [LICENSE](LICENSE) file for details.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=RavenHogWarts/obsidian-plugin-starter&type=Timeline)](https://www.star-history.com/#RavenHogWarts/obsidian-plugin-starter&Timeline)

# Files to Modify

When developing or customizing the plugin, the following files may need to be modified:

- [config.yml](./.github/ISSUE_TEMPLATE/config.yml)
- [release.yml](./.github/workflows/release.yml)
- [manifest.json](./manifest.json)
- [manifest-beta.json](./manifest-beta.json)
- [package.json](./package.json)
- [CONTRIBUTING.md](./CONTRIBUTING.md)