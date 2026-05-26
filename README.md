# @popup-maker/extension-build-tools

Shared build tooling for Popup Maker **standalone extensions** (Pro-tier core addons).

## Webpack preset

```js
// webpack.config.js
const { createExtensionWebpackConfig } = require( '@popup-maker/extension-build-tools/webpack' );

module.exports = createExtensionWebpackConfig( {
	slug: 'popup-maker-exit-intent-popups',
	libraryGlobal: 'popupMakerExitIntentPopups',
	packageScope: '@popup-maker-exit-intent-popups',
	packages: {
		frontend: 'packages/frontend',
	},
	devServerPort: 8890,
} );
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `slug` | Yes | Plugin folder name under `wp-content/plugins/`. |
| `libraryGlobal` | Yes | Window global root (e.g. `popupMakerExitIntentPopups`). |
| `packages` | Yes | Webpack entries: `{ entryName: 'packages/…' }`. |
| `packageScope` | No | NPM scope for resolve aliases. |
| `publicPath` | No | Defaults to `/wp-content/plugins/{slug}/dist/`. |
| `devServerPort` | No | Enables devServer when set. |
| `copyPatterns` | No | CopyWebpackPlugin patterns. |
| `dependencyExtractionPlugin` | No | Override DEWP class (default: core plugin). |

## Release CLI

```json
{
  "scripts": {
    "release": "extension-build-release"
  }
}
```

Runs composer production install, webpack build, copies `package.json` `files` whitelist, and creates a versioned zip.
