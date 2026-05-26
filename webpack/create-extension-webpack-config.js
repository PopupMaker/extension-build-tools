const path = require( 'path' );
const webpack = require( 'webpack' );
const CustomTemplatedPathPlugin = require( '@popup-maker/custom-templated-path-webpack-plugin' );
const PopupMakerDependencyExtractionWebpackPlugin = require( '@popup-maker/dependency-extraction-webpack-plugin' );
const MiniCssExtractPlugin = require( 'mini-css-extract-plugin' );
const RtlCssPlugin = require( 'rtlcss-webpack-plugin' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

/**
 * Convert dash-case entry names to camelCase module names.
 *
 * @param {string} entryName Entry name.
 * @return {string}
 */
function entryNameToModuleName( entryName ) {
	return entryName.replace( /-([a-z])/g, ( _, letter ) => letter.toUpperCase() );
}

/**
 * Create a webpack config for Pro-tier standalone extensions.
 *
 * @param {object} options Config options.
 * @param {string} options.slug Plugin directory slug (e.g. popup-maker-exit-intent-popups).
 * @param {string} options.libraryGlobal Window library global (e.g. popupMakerExitIntentPopups).
 * @param {Record<string, string>} options.packages Entry map: name => path relative to cwd.
 * @param {string} [options.packageScope] NPM scope for resolve aliases.
 * @param {string} [options.publicPath] Asset public path override.
 * @param {number} [options.devServerPort] Dev server port.
 * @param {Array<object>} [options.copyPatterns] CopyWebpackPlugin patterns.
 * @param {typeof PopupMakerDependencyExtractionWebpackPlugin} [options.dependencyExtractionPlugin] DEWP class override.
 * @return {import('webpack').Configuration}
 */
function createExtensionWebpackConfig( options ) {
	const {
		slug,
		libraryGlobal,
		packages,
		packageScope,
		publicPath = `/wp-content/plugins/${ slug }/dist/`,
		devServerPort,
		copyPatterns = [],
		dependencyExtractionPlugin = PopupMakerDependencyExtractionWebpackPlugin,
	} = options;

	if ( ! slug || ! libraryGlobal || ! packages || ! Object.keys( packages ).length ) {
		throw new Error(
			'createExtensionWebpackConfig requires slug, libraryGlobal, and at least one package entry.'
		);
	}

	const NODE_ENV = process.env.NODE_ENV || 'development';
	const isProduction = NODE_ENV === 'production';
	const devtoolNamespace = slug.replace( /^popup-maker-/, 'popup-maker/' );

	const entry = Object.entries( packages ).reduce( ( acc, [ packageName, packagePath ] ) => {
		acc[ packageName ] = path.resolve( process.cwd(), packagePath, 'src' );
		return acc;
	}, {} );

	const alias = {
		...defaultConfig.resolve.alias,
	};

	if ( packageScope ) {
		Object.entries( packages ).forEach( ( [ packageName, packagePath ] ) => {
			alias[ `${ packageScope }/${ packageName }` ] = path.resolve( process.cwd(), packagePath );
		} );
	}

	const plugins = [
		...defaultConfig.plugins.filter(
			( plugin ) =>
				plugin.constructor.name !== 'DependencyExtractionWebpackPlugin' &&
				plugin.constructor.name !== 'MiniCssExtractPlugin' &&
				plugin.constructor.name !== 'RtlCssPlugin'
		),
		new webpack.optimize.LimitChunkCountPlugin( { maxChunks: 1 } ),
		new MiniCssExtractPlugin( {
			filename: ( { chunk } ) => {
				if ( chunk.name && chunk.name.includes( 'style' ) ) {
					return `${ chunk.runtime }-style.css`;
				}
				return `${ chunk.runtime }.css`;
			},
		} ),
		new RtlCssPlugin( {
			filename: ( { chunk } ) => {
				if ( chunk.name && chunk.name.includes( 'style-' ) ) {
					return `${ chunk.runtime }-style-rtl.css`;
				}
				return `${ chunk.runtime }-rtl.css`;
			},
		} ),
		new CustomTemplatedPathPlugin( {
			modulename( outputPath, data ) {
				const entryName = data.chunk.name;
				if ( entryName ) {
					return entryNameToModuleName( entryName );
				}
				return outputPath;
			},
		} ),
		new dependencyExtractionPlugin( {
			combineAssets: true,
			combinedOutputFile: 'package-assets.php',
		} ),
	];

	if ( copyPatterns.length ) {
		const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
		plugins.push(
			new CopyWebpackPlugin( {
				patterns: copyPatterns,
			} )
		);
	}

	const config = {
		...defaultConfig,
		entry,
		externals: {
			jquery: 'jQuery',
			...defaultConfig.externals,
		},
		output: {
			path: path.resolve( process.cwd(), 'dist' ),
			publicPath,
			devtoolNamespace,
			devtoolModuleFilenameTemplate: 'webpack://[namespace]/[resource-path]?[loaders]',
			library: {
				name: [ libraryGlobal, '[modulename]' ],
				type: 'window',
			},
			uniqueName: `__${ libraryGlobal }_webpackJsonp`,
			clean: false,
		},
		resolve: {
			extensions: [ '.json', '.js', '.jsx', '.ts', '.tsx', '.scss', '.css' ],
			alias,
			modules: [ 'node_modules', path.resolve( process.cwd() ) ],
		},
		plugins,
		cache: {
			type: 'filesystem',
			cacheDirectory: path.resolve( process.cwd(), '.webpack-cache' ),
			buildDependencies: {
				config: [ __filename ],
				packages: [ path.resolve( process.cwd(), 'package.json' ) ],
			},
			maxAge: isProduction ? 1000 * 60 * 60 * 24 * 7 : 1000 * 60 * 60 * 24,
			compression: 'gzip',
			name: `${ slug }-packages-${ NODE_ENV }`,
			version: require( path.resolve( process.cwd(), 'package.json' ) ).version,
		},
		optimization: {
			...defaultConfig.optimization,
			minimize: NODE_ENV !== 'development',
			usedExports: true,
			sideEffects: false,
			concatenateModules: isProduction,
		},
	};

	if ( devServerPort ) {
		config.devServer = {
			...( defaultConfig.devServer || {} ),
			allowedHosts: 'all',
			port: devServerPort,
			proxy: undefined,
		};
	}

	return config;
}

module.exports = {
	createExtensionWebpackConfig,
	entryNameToModuleName,
};
