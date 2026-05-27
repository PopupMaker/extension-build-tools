## Publishing

Published to npm as `@popup-maker/extension-build-tools`.

- **GitHub:** https://github.com/PopupMaker/extension-build-tools
- **npm:** https://www.npmjs.com/package/@popup-maker/extension-build-tools

### Prerequisites

- npm login with access to the `@popup-maker` scope

### Publish

```bash
cd packages/extension-build-tools
npm publish --access public
```

Or from the site root:

```bash
./custom-tools/publish-extension-packages.sh --npm-only
```

### Consumption

```json
{
  "devDependencies": {
    "@popup-maker/extension-build-tools": "^1.1.0"
  }
}
```

Peer dependencies (`@wordpress/scripts`, `webpack`) are installed by the extension.
