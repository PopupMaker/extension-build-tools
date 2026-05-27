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

Runs composer production install, webpack build, **language pack compilation** (POT → PO merge → MO + JSON), copies `package.json` `files` whitelist, and creates a versioned zip.

Ensure `languages/**/*` is in the `files` array so PO/MO/JSON ship in the zip.

## i18n (Potomatic + langpacks)

### Release automation (default)

`extension-build-release` calls `extension-build-i18n --skip-translate` before zipping:

1. Regenerate `.pot` from PHP + package source
2. Merge new strings into committed `.po` files (`wp i18n update-po`)
3. Compile `.mo` (PHP) and `.json` (JS) files

Potomatic is **not** run during release by default — release packages whatever translations are already in `languages/`.

`prepare-release` also refreshes langpacks (without translate) so POT/MO/JSON land in the release commit.

### Ongoing translation (develop branch)

1. **`config/dictionaries/dictionary.json`** — brand terms Potomatic should not translate.
2. **`.github/workflows/translate.yml`** — Potomatic on `develop` + manual dispatch; commits updated `.po`/`.json` files.

**Default languages (15):** `es_ES,pt_BR,fr_FR,de_DE,ja,ru_RU,it_IT,nl_NL,pl_PL,tr_TR,id_ID,zh_CN,ar,sv_SE,ko_KR`

**Repo secrets:** `OPENAI_API_KEY` (or Gemini/Anthropic). Optional vars: `DEFAULT_TRANSLATION_LANGUAGES`, `DEFAULT_TRANSLATION_MAX_COST`.

Override per extension in `package.json`:

```json
{
  "extensionRelease": {
    "i18n": {
      "languages": "es_ES,pt_BR,fr_FR,de_DE,ja,ru_RU,it_IT,nl_NL,pl_PL,tr_TR,id_ID,zh_CN,ar,sv_SE,ko_KR"
    }
  }
}
```

### Local commands

```json
{
  "scripts": {
    "i18n:build": "extension-build-i18n --skip-translate",
    "i18n:pot": "wp i18n make-pot . languages/{text-domain}.pot --domain={text-domain} --exclude=vendor,vendor-prefixed,node_modules,tests,dist",
    "i18n:update": "wp i18n update-po languages/{text-domain}.pot languages/",
    "i18n:mo": "wp i18n make-mo languages/",
    "i18n:json": "wp i18n make-json languages/ --no-purge",
    "i18n:translate:dry-run": "extension-run-potomatic --dry-run --max-strings-per-job 10",
    "i18n:translate": "extension-run-potomatic"
  }
}
```

**Quick local test:** `./custom-tools/test-extension-i18n.sh wp-content/plugins/popup-maker-exit-intent-popups--modernize-v2 fr_FR`

**Force Potomatic during a release build:** `EXTENSION_I18N_TRANSLATE=1 pnpm run release`

**Skip langpack step:** `pnpm run release -- --skip-i18n`
