#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Slim release prep for Popup Maker standalone extensions.
 *
 * Updates package.json, composer.json, plugin header, and CHANGELOG.md.
 *
 * Usage:
 *   node bin/prepare-release.js [version] [--patch|--minor|--major] [--dry-run] [--auto]
 */

const fs = require( 'fs' );
const path = require( 'path' );
const { execSync } = require( 'child_process' );

const args = process.argv.slice( 2 );
const flags = new Set( args.filter( ( arg ) => arg.startsWith( '--' ) ) );
const positional = args.filter( ( arg ) => ! arg.startsWith( '--' ) );

const dryRun = flags.has( '--dry-run' );
const autoMode = flags.has( '--auto' );

function readJson( filePath ) {
	return JSON.parse( fs.readFileSync( filePath, 'utf8' ) );
}

function writeJson( filePath, data ) {
	const content = JSON.stringify( data, null, '\t' ) + '\n';
	if ( dryRun ) {
		console.log( `[dry-run] Would update ${ filePath }` );
		return;
	}
	fs.writeFileSync( filePath, content );
}

function run( command ) {
	if ( dryRun ) {
		console.log( `[dry-run] ${ command }` );
		return '';
	}
	return execSync( command, { encoding: 'utf8', stdio: 'inherit' } );
}

function getCurrentVersion( packageJson ) {
	return packageJson.version;
}

function bumpVersion( current, type ) {
	const [ major, minor, patch ] = current.split( '.' ).map( Number );

	switch ( type ) {
		case 'major':
			return `${ major + 1 }.0.0`;
		case 'minor':
			return `${ major }.${ minor + 1 }.0`;
		default:
			return `${ major }.${ minor }.${ patch + 1 }`;
	}
}

function resolveTargetVersion( current ) {
	if ( positional[ 0 ] ) {
		return positional[ 0 ].replace( /^v/, '' );
	}
	if ( flags.has( '--major' ) ) {
		return bumpVersion( current, 'major' );
	}
	if ( flags.has( '--minor' ) ) {
		return bumpVersion( current, 'minor' );
	}
	return bumpVersion( current, 'patch' );
}

function updatePluginHeader( mainFile, version ) {
	let contents = fs.readFileSync( mainFile, 'utf8' );
	const updated = contents.replace(
		/(\* Version:\s*)[\d.]+/,
		`$1${ version }`
	);

	if ( updated === contents ) {
		throw new Error( `Could not update Version header in ${ mainFile }` );
	}

	if ( dryRun ) {
		console.log( `[dry-run] Would update plugin header in ${ mainFile }` );
		return;
	}

	fs.writeFileSync( mainFile, updated );
}

function updateConfigVersion( mainFile, version ) {
	let contents = fs.readFileSync( mainFile, 'utf8' );
	const updated = contents.replace(
		/('version'\s*=>\s*')[\d.]+(')/,
		`$1${ version }$2`
	);

	if ( updated !== contents ) {
		if ( dryRun ) {
			console.log(
				`[dry-run] Would update config version in ${ mainFile }`
			);
			return;
		}
		fs.writeFileSync( mainFile, updated );
	}
}

function updateChangelog( version ) {
	const changelogPath = path.join( process.cwd(), 'CHANGELOG.md' );
	const content = fs.readFileSync( changelogPath, 'utf8' );
	const unreleasedMatch = content.match(
		/^## Unreleased\s*([\s\S]*?)(?=\n## |\n$)/m
	);

	if ( ! unreleasedMatch || ! unreleasedMatch[ 1 ].trim() ) {
		throw new Error( 'No Unreleased section found in CHANGELOG.md' );
	}

	const date = new Date().toISOString().slice( 0, 10 );
	const unreleasedBody = unreleasedMatch[ 1 ].trim();
	const releasedSection = `## v${ version } - ${ date }\n\n${ unreleasedBody }\n\n`;
	const updated = content.replace(
		/^## Unreleased\s*[\s\S]*?(?=\n## |\n$)/m,
		`## Unreleased\n\n${ releasedSection }`
	);

	if ( dryRun ) {
		console.log( `[dry-run] Would release CHANGELOG.md as v${ version }` );
		return;
	}

	fs.writeFileSync( changelogPath, updated );
}

function resolveMainFile( packageJson ) {
	if ( packageJson.extensionRelease?.mainFile ) {
		return packageJson.extensionRelease.mainFile;
	}

	const phpFiles = fs
		.readdirSync( process.cwd() )
		.filter( ( file ) => file.endsWith( '.php' ) && file !== 'index.php' );

	for ( const file of phpFiles ) {
		const contents = fs.readFileSync( file, 'utf8' );
		if ( contents.includes( 'Plugin Name:' ) ) {
			return file;
		}
	}

	throw new Error(
		'Could not detect main plugin file. Set extensionRelease.mainFile in package.json.'
	);
}

function main() {
	const packagePath = path.join( process.cwd(), 'package.json' );
	const composerPath = path.join( process.cwd(), 'composer.json' );

	if ( ! fs.existsSync( packagePath ) ) {
		throw new Error( 'package.json not found in current directory' );
	}

	const packageJson = readJson( packagePath );
	const currentVersion = getCurrentVersion( packageJson );
	const targetVersion = resolveTargetVersion( currentVersion );
	const mainFile = resolveMainFile( packageJson );

	console.log(
		`Preparing release: ${ packageJson.name } ${ currentVersion } → ${ targetVersion }`
	);

	packageJson.version = targetVersion;
	writeJson( packagePath, packageJson );

	if ( fs.existsSync( composerPath ) ) {
		const composerJson = readJson( composerPath );
		composerJson.version = targetVersion;
		writeJson( composerPath, composerJson );
	}

	updatePluginHeader( mainFile, targetVersion );
	updateConfigVersion( mainFile, targetVersion );
	updateChangelog( targetVersion );

	if ( ! dryRun ) {
		run( 'pnpm install' );
		run( 'composer update --lock' );
		run( 'pnpm run build:production' );
		run( 'pnpm exec extension-build-i18n -- --skip-translate' );
	}

	if ( autoMode && ! dryRun ) {
		run(
			`git add package.json composer.json CHANGELOG.md ${ mainFile } pnpm-lock.yaml languages/`
		);
		run(
			`git commit -m "chore: release v${ targetVersion }"`
		);
		run( `git tag -a v${ targetVersion } -m "Release v${ targetVersion }"` );
	}

	console.log( `✅ Ready to release v${ targetVersion }` );
	if ( ! autoMode ) {
		console.log(
			'Next: review changes, commit, tag, and push the tag to trigger release workflow.'
		);
	}
}

try {
	main();
} catch ( error ) {
	console.error( `❌ ${ error.message }` );
	process.exit( 1 );
}
