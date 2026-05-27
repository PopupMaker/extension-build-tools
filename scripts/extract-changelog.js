#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Extract changelog content for a specific version from CHANGELOG.md
 *
 * Usage:
 *   node scripts/extract-changelog.js [version|--latest|--unreleased]
 */

const fs = require( 'fs' );
const path = require( 'path' );

const args = process.argv.slice( 2 );
const targetVersion = args[ 0 ];

if ( ! targetVersion ) {
	console.error(
		'❌ Usage: extract-changelog.js [version|--latest|--unreleased]'
	);
	process.exit( 1 );
}

const changelogPath = path.join( process.cwd(), 'CHANGELOG.md' );

if ( ! fs.existsSync( changelogPath ) ) {
	console.error( '❌ CHANGELOG.md not found in current directory' );
	process.exit( 1 );
}

const changelogContent = fs.readFileSync( changelogPath, 'utf8' );

function extractVersionContent( content, version ) {
	const headingPattern = new RegExp(
		`^## (?:v)?${ version }(?:\\s*-\\s*[0-9]{4}-[0-9]{2}-[0-9]{2})?\\s*$`
	);
	const blocks = content.split( /\n(?=## )/ );

	for ( const block of blocks ) {
		const lines = block.split( '\n' );
		if ( ! headingPattern.test( lines[ 0 ] ) ) {
			continue;
		}

		return lines.slice( 1 ).join( '\n' ).trim();
	}

	return null;
}

function extractUnreleasedContent( content ) {
	const unreleasedPattern = /^## Unreleased\s*([\s\S]*?)(?=\n## |\n$)/m;
	const match = content.match( unreleasedPattern );

	if ( ! match || ! match[ 1 ].trim() ) {
		return null;
	}

	return match[ 1 ].trim();
}

function extractLatestVersion( content ) {
	const versionPattern =
		/^## (?:v)?(\d+\.\d+\.\d+)(?:\s*-\s*[0-9]{4}-[0-9]{2}-[0-9]{2})?\s*\n([\s\S]*?)(?=\n## [^#])/m;
	const matches = content.match( versionPattern );

	if ( ! matches ) {
		return null;
	}

	return {
		version: matches[ 1 ],
		content: matches[ 2 ].trim(),
	};
}

function formatForGitHubRelease( content, version ) {
	if ( ! content ) {
		return `## ${ version }\n\nNo changelog content available.`;
	}

	return content.replace( /^\s*[-*]\s+/gm, '- ' ).trim();
}

try {
	let extractedContent = '';
	let versionNumber = '';

	if ( targetVersion === '--unreleased' ) {
		extractedContent = extractUnreleasedContent( changelogContent );
		versionNumber = 'Unreleased';

		if ( ! extractedContent ) {
			console.error( '❌ No unreleased changes found in CHANGELOG.md' );
			process.exit( 1 );
		}
	} else if ( targetVersion === '--latest' ) {
		const latest = extractLatestVersion( changelogContent );

		if ( ! latest ) {
			console.error( '❌ No released versions found in CHANGELOG.md' );
			process.exit( 1 );
		}

		extractedContent = latest.content;
		versionNumber = latest.version;
	} else {
		extractedContent = extractVersionContent(
			changelogContent,
			targetVersion.replace( /^v/, '' )
		);
		versionNumber = targetVersion.replace( /^v/, '' );

		if ( ! extractedContent ) {
			console.error(
				`❌ Version ${ versionNumber } not found in CHANGELOG.md`
			);
			process.exit( 1 );
		}
	}

	console.log( formatForGitHubRelease( extractedContent, versionNumber ) );
} catch ( error ) {
	console.error( '❌ Error processing changelog:', error.message );
	process.exit( 1 );
}
