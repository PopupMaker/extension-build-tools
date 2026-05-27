#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Build language packs for Popup Maker standalone extensions.
 *
 * 1. Regenerate POT from source
 * 2. Merge new strings into existing PO files
 * 3. Optionally run Potomatic when an API key is present
 * 4. Compile MO (PHP) and JSON (JS) files for distribution
 *
 * Usage:
 *   extension-build-i18n [options]
 *
 * Options:
 *   --translate          Run Potomatic (requires API key)
 *   --skip-translate     Skip Potomatic even if API key is set (default for release)
 *   --dry-run            Pass --dry-run to Potomatic
 *   --languages <list>   Target languages (comma-separated)
 *   --max-cost <usd>     Potomatic cost cap
 *   --verbose            Show command output
 */

const defaultTranslationLanguages = require( './default-translation-languages' );
const fs = require( 'fs' );
const path = require( 'path' );
const { execSync } = require( 'child_process' );

function parseArgs() {
	const args = process.argv.slice( 2 );
	const options = {
		translate: false,
		skipTranslate: false,
		dryRun: false,
		languages: null,
		maxCost: null,
		verbose: false,
	};

	for ( let i = 0; i < args.length; i++ ) {
		const arg = args[ i ];
		switch ( arg ) {
			case '--translate':
				options.translate = true;
				break;
			case '--skip-translate':
				options.skipTranslate = true;
				break;
			case '--dry-run':
				options.dryRun = true;
				break;
			case '--languages':
				options.languages = args[ ++i ];
				break;
			case '--max-cost':
				options.maxCost = args[ ++i ];
				break;
			case '--verbose':
				options.verbose = true;
				break;
			default:
				if ( arg.startsWith( '--' ) ) {
					throw new Error( `Unknown option: ${ arg }` );
				}
		}
	}

	return options;
}

function readJson( filePath ) {
	return JSON.parse( fs.readFileSync( filePath, 'utf8' ) );
}

function resolveMainFile( packageJson, projectRoot ) {
	if ( packageJson.extensionRelease?.mainFile ) {
		return packageJson.extensionRelease.mainFile;
	}

	const phpFiles = fs
		.readdirSync( projectRoot )
		.filter( ( file ) => file.endsWith( '.php' ) && file !== 'index.php' );

	for ( const file of phpFiles ) {
		const contents = fs.readFileSync( path.join( projectRoot, file ), 'utf8' );
		if ( contents.includes( 'Plugin Name:' ) ) {
			return file;
		}
	}

	throw new Error(
		'Could not detect main plugin file. Set extensionRelease.mainFile in package.json.'
	);
}

function resolveTextDomain( packageJson, mainFilePath ) {
	if ( packageJson.extensionRelease?.textDomain ) {
		return packageJson.extensionRelease.textDomain;
	}

	if ( packageJson.extensionRelease?.i18n?.textDomain ) {
		return packageJson.extensionRelease.i18n.textDomain;
	}

	const contents = fs.readFileSync( mainFilePath, 'utf8' );
	const match = contents.match( /\* Text Domain:\s*(\S+)/ );
	if ( match ) {
		return match[ 1 ];
	}

	return packageJson.name;
}

function hasApiKey() {
	return Boolean(
		process.env.OPENAI_API_KEY ||
			process.env.GEMINI_API_KEY ||
			process.env.ANTHROPIC_API_KEY ||
			process.env.POTOMATIC_API_KEY ||
			process.env.API_KEY
	);
}

function runCommand( command, projectRoot, verbose ) {
	if ( verbose ) {
		console.log( `Running: ${ command }` );
	}

	execSync( command, {
		cwd: projectRoot,
		stdio: verbose ? 'inherit' : 'pipe',
		encoding: 'utf8',
		env: { ...process.env },
	} );
}

function commandExists( command ) {
	try {
		execSync( `command -v ${ command }`, { stdio: 'pipe' } );
		return true;
	} catch ( error ) {
		return false;
	}
}

function resolvePotomaticRunner( packageManager ) {
	if ( commandExists( 'potomatic' ) ) {
		return 'potomatic';
	}

	if ( packageManager === 'pnpm' ) {
		return 'pnpm dlx potomatic';
	}

	return 'npx --yes potomatic';
}

function getPackageManager( packageJson, projectRoot ) {
	if (
		packageJson.packageManager &&
		packageJson.packageManager.startsWith( 'pnpm' )
	) {
		return 'pnpm';
	}

	if ( fs.existsSync( path.join( projectRoot, 'pnpm-lock.yaml' ) ) ) {
		return 'pnpm';
	}

	return 'npm';
}

function listPoFiles( languagesDir, textDomain ) {
	if ( ! fs.existsSync( languagesDir ) ) {
		return [];
	}

	return fs
		.readdirSync( languagesDir )
		.filter(
			( file ) =>
				file.startsWith( `${ textDomain }-` ) && file.endsWith( '.po' )
		);
}

function main() {
	const options = parseArgs();
	const projectRoot = process.cwd();
	const packagePath = path.join( projectRoot, 'package.json' );

	if ( ! fs.existsSync( packagePath ) ) {
		throw new Error( 'package.json not found in current directory' );
	}

	if ( ! commandExists( 'wp' ) ) {
		throw new Error(
			'wp-cli is required for i18n builds. Install wp-cli or add it to PATH.'
		);
	}

	const packageJson = readJson( packagePath );
	const mainFile = resolveMainFile( packageJson, projectRoot );
	const textDomain = resolveTextDomain(
		packageJson,
		path.join( projectRoot, mainFile )
	);
	const languagesDir = path.join( projectRoot, 'languages' );
	const potPath = path.join( languagesDir, `${ textDomain }.pot` );
	const dictionaryPath =
		packageJson.extensionRelease?.i18n?.dictionaryPath ||
		'config/dictionaries';
	const defaultLanguages =
		options.languages ||
		process.env.TARGET_LANGUAGES ||
		packageJson.extensionRelease?.i18n?.languages ||
		defaultTranslationLanguages;
	const exclude =
		packageJson.extensionRelease?.i18n?.potExclude ||
		'vendor,vendor-prefixed,node_modules,tests,dist';
	const packageManager = getPackageManager( packageJson, projectRoot );
	const shouldTranslate =
		! options.skipTranslate &&
		( options.translate ||
			process.env.EXTENSION_I18N_TRANSLATE === '1' ||
			process.env.EXTENSION_I18N_TRANSLATE === 'true' );

	console.log( `\n=== Building language packs for ${ textDomain } ===` );

	if ( ! fs.existsSync( languagesDir ) ) {
		fs.mkdirSync( languagesDir, { recursive: true } );
	}

	runCommand(
		`wp i18n make-pot . "${ potPath }" --domain="${ textDomain }" --exclude=${ exclude }`,
		projectRoot,
		options.verbose
	);
	console.log( '✅ POT generated' );

	const poFiles = listPoFiles( languagesDir, textDomain );
	if ( poFiles.length ) {
		runCommand(
			`wp i18n update-po "${ potPath }" "${ languagesDir }"`,
			projectRoot,
			options.verbose
		);
		console.log( `✅ Updated ${ poFiles.length } PO file(s) from POT` );
	}

	if ( shouldTranslate ) {
		if ( ! hasApiKey() ) {
			console.log(
				'⚠️  Translation requested but no API key found. Skipping Potomatic.'
			);
		} else {
			const potomatic = resolvePotomaticRunner( packageManager );
			const maxCost =
				options.maxCost ||
				process.env.MAX_COST ||
				packageJson.extensionRelease?.i18n?.maxCost ||
				'2.00';
			let args = `--pot-file-path "${ potPath }"`;
			args += ` --output-dir "${ languagesDir }"`;
			args += ` --po-file-prefix ${ textDomain }-`;
			args += ' --locale-format wp_locale';
			args += ` --target-languages ${ defaultLanguages }`;
			args += ` --max-cost ${ maxCost }`;
			args += ' --use-dictionary';
			args += ` --dictionary-path ${ dictionaryPath }`;

			if ( options.dryRun ) {
				args += ' --dry-run';
			}

			runCommand( `${ potomatic } ${ args }`, projectRoot, true );
			console.log( '✅ Potomatic translation complete' );
		}
	} else {
		console.log(
			'ℹ️  Skipping Potomatic (use --translate or EXTENSION_I18N_TRANSLATE=1 to enable)'
		);
	}

	const poFilesAfter = listPoFiles( languagesDir, textDomain );
	if ( poFilesAfter.length ) {
		runCommand(
			`wp i18n make-mo "${ languagesDir }"`,
			projectRoot,
			options.verbose
		);
		console.log( '✅ MO files compiled' );

		runCommand(
			`wp i18n make-json "${ languagesDir }" --no-purge`,
			projectRoot,
			options.verbose
		);
		console.log( '✅ JSON translation files compiled' );
	} else {
		console.log(
			'ℹ️  No PO files found. Ship POT only or run translate workflow first.'
		);
	}

	console.log( '✅ Language pack build complete\n' );
}

try {
	main();
} catch ( error ) {
	console.error( `❌ i18n build failed: ${ error.message }` );
	process.exit( 1 );
}
