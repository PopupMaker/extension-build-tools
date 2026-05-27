#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Run Potomatic with Popup Maker extension defaults.
 *
 * Reads text domain, languages, and dictionary path from package.json.
 * Forwards extra CLI args (e.g. --dry-run, --max-strings-per-job 10).
 *
 * Usage:
 *   extension-run-potomatic [--dry-run] [--max-cost 2.00] ...
 *
 * Override languages: TARGET_LANGUAGES=fr_FR,es_ES extension-run-potomatic
 */

const fs = require( 'fs' );
const path = require( 'path' );
const { execSync } = require( 'child_process' );
const defaultTranslationLanguages = require( './default-translation-languages' );

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

function main() {
	const projectRoot = process.cwd();
	const packagePath = path.join( projectRoot, 'package.json' );

	if ( ! fs.existsSync( packagePath ) ) {
		throw new Error( 'package.json not found in current directory' );
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
	const languages =
		process.env.TARGET_LANGUAGES ||
		packageJson.extensionRelease?.i18n?.languages ||
		defaultTranslationLanguages;
	const packageManager = getPackageManager( packageJson, projectRoot );
	const forwardedArgs = process.argv.slice( 2 ).join( ' ' );

	if ( ! fs.existsSync( potPath ) ) {
		throw new Error(
			`POT file not found: ${ potPath }. Run pnpm run i18n:pot first.`
		);
	}

	const potomatic =
		packageManager === 'pnpm' ? 'pnpm dlx potomatic' : 'npx potomatic';
	const args = [
		`--target-languages ${ languages }`,
		`--pot-file-path "${ potPath }"`,
		`--output-dir "${ languagesDir }"`,
		`--po-file-prefix ${ textDomain }-`,
		'--locale-format wp_locale',
		'--use-dictionary',
		`--dictionary-path ${ dictionaryPath }`,
		forwardedArgs,
	]
		.filter( Boolean )
		.join( ' ' );

	const command = `${ potomatic } ${ args }`;
	console.log( `Running Potomatic for ${ textDomain } (${ languages.split( ',' ).length } languages)` );
	execSync( command, {
		cwd: projectRoot,
		stdio: 'inherit',
		env: { ...process.env },
	} );
}

try {
	main();
} catch ( error ) {
	console.error( `❌ Potomatic failed: ${ error.message }` );
	process.exit( 1 );
}
