/**
 * Default target languages for Potomatic / extension i18n workflows.
 *
 * 15 high-traffic WordPress locales. Override via:
 * - package.json extensionRelease.i18n.languages
 * - TARGET_LANGUAGES env var
 * - GitHub repo/org var DEFAULT_TRANSLATION_LANGUAGES
 */
module.exports =
	'es_ES,pt_BR,fr_FR,de_DE,ja,ru_RU,it_IT,nl_NL,pl_PL,tr_TR,id_ID,zh_CN,ar,sv_SE,ko_KR';
