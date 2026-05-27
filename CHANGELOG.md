# Changelog

## 1.2.1 - 2026-05-27

### Added
- `extension-sync-repo-secrets` CLI — sync `.env.secrets` to GitHub Actions secrets and variables (`pnpm run secrets:sync`).

## 1.2.0 - 2026-05-27

### Added
- `extension-build-i18n` CLI — regenerate POT, merge PO files, optionally run Potomatic, compile MO + JSON langpacks.
- `extension-build-release` now builds language packs before zipping (use `--skip-i18n` to opt out).
- Shared default translation locale list (15 languages) in `scripts/default-translation-languages.js`.

## 1.1.0 - 2026-05-27

### Added
- `extension-prepare-release` CLI for extension version bumps and changelog updates.
- `extension-extract-changelog` CLI for release note extraction.

### Fixed
- `extension-build-release` detects pnpm projects and runs the correct package manager during asset builds.

## 1.0.0 - 2026-05-26

- Initial release.
- `createExtensionWebpackConfig()` webpack preset for standalone extensions.
- `extension-build-release` CLI for versioned zip builds.
