# Changelog

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
