#!/usr/bin/env bash
#
# Sync .env.secrets to GitHub Actions secrets and variables.
#
# Usage:
#   ./bin/setup-repo-secrets.sh [owner/repo]
#   GITHUB_REPO=PopupMaker/other-plugin ./bin/setup-repo-secrets.sh
#
# .env.secrets format (plugin root):
#   # --- Secrets ... ---
#   MY_SECRET="value"
#   JSON_SECRET="@/path/to/file.json"
#
#   # --- Variables ... ---
#   MY_VAR="480197"

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PLUGIN_ROOT}/.env.secrets"
REPO="${GITHUB_REPO:-${1:-}}"

if ! command -v gh >/dev/null 2>&1; then
	echo "❌ GitHub CLI (gh) is required. Install: https://cli.github.com/"
	exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
	echo "❌ gh is not authenticated. Run: gh auth login"
	exit 1
fi

if [ -z "$REPO" ]; then
	REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)"
fi

if [ -z "$REPO" ]; then
	echo "Usage: $0 [owner/repo]"
	echo "  or:  GITHUB_REPO=owner/repo $0"
	exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
	echo "❌ Missing ${ENV_FILE}"
	echo "   Create .env.secrets in the plugin root with Secrets and Variables sections."
	exit 1
fi

# Map .env.secrets keys to workflow secret names when they differ.
secret_alias() {
	case "$1" in
		SLACK_WEBHOOK) echo "SLACK_WEBHOOK_URL" ;;
		*) echo "" ;;
	esac
}

strip_quotes() {
	local val="$1"
	val="${val#"${val%%[![:space:]]*}"}"
	val="${val%"${val##*[![:space:]]}"}"

	if [[ "$val" == \"*\" && "$val" == *\" ]]; then
		val="${val:1:${#val}-2}"
	elif [[ "$val" == \'*\' && "$val" == *\' ]]; then
		val="${val:1:${#val}-2}"
	fi

	printf '%s' "$val"
}

set_secret() {
	local key="$1"
	local val="$2"

	if [ -z "$val" ]; then
		echo "  ⏭️  Secret: ${key} (empty, skipped)"
		return
	fi

	if [[ "$val" == @* ]]; then
		local filepath="${val:1}"
		if [ ! -f "$filepath" ]; then
			echo "  ❌ Secret: ${key} (file not found: ${filepath})"
			return
		fi

		if [[ "$filepath" == *.json ]]; then
			base64 < "$filepath" | gh secret set "$key" --repo "$REPO"
		else
			gh secret set "$key" --repo "$REPO" < "$filepath"
		fi
	else
		printf '%s' "$val" | gh secret set "$key" --repo "$REPO"
	fi

	echo "  ✅ Secret: ${key}"

	local alias
	alias="$(secret_alias "$key")"
	if [ -n "$alias" ] && [ "$alias" != "$key" ]; then
		if [[ "$val" == @* ]]; then
			local filepath="${val:1}"
			if [[ "$filepath" == *.json ]]; then
				base64 < "$filepath" | gh secret set "$alias" --repo "$REPO"
			else
				gh secret set "$alias" --repo "$REPO" < "$filepath"
			fi
		else
			printf '%s' "$val" | gh secret set "$alias" --repo "$REPO"
		fi
		echo "  ✅ Secret: ${alias} (alias of ${key})"
	fi
}

set_variable() {
	local key="$1"
	local val="$2"

	if [ -z "$val" ]; then
		echo "  ⏭️  Variable: ${key} (empty, skipped)"
		return
	fi

	gh variable set "$key" --repo "$REPO" --body "$val"
	echo "  ✅ Variable: ${key}"
}

MODE=""
secret_count=0
variable_count=0
skipped_count=0

echo "🔧 Syncing ${ENV_FILE} → ${REPO}"
echo ""

while IFS= read -r line || [ -n "$line" ]; do
	line="${line#"${line%%[![:space:]]*}"}"

	if [[ "$line" =~ ^#[[:space:]]*---[[:space:]]*Secrets ]]; then
		MODE="secret"
		continue
	fi

	if [[ "$line" =~ ^#[[:space:]]*---[[:space:]]*Variables ]]; then
		MODE="variable"
		continue
	fi

	if [ -z "$line" ] || [[ "$line" == \#* ]]; then
		continue
	fi

	if [[ ! "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
		echo "  ⚠️  Skipping unrecognized line: ${line}"
		skipped_count=$(( skipped_count + 1 ))
		continue
	fi

	key="${BASH_REMATCH[1]}"
	val="$(strip_quotes "${BASH_REMATCH[2]}")"

	if [ -z "$MODE" ]; then
		echo "  ⚠️  Skipping ${key} (add a Secrets or Variables section header first)"
		skipped_count=$(( skipped_count + 1 ))
		continue
	fi

	if [ "$MODE" = "secret" ]; then
		if [ -z "${secrets_started:-}" ]; then
			echo "Secrets:"
			secrets_started=1
		fi
		set_secret "$key" "$val"
		secret_count=$(( secret_count + 1 ))
	else
		if [ -z "${variables_started:-}" ]; then
			echo ""
			echo "Variables:"
			variables_started=1
		fi
		set_variable "$key" "$val"
		variable_count=$(( variable_count + 1 ))
	fi
done < "$ENV_FILE"

echo ""
echo "✅ Done (${secret_count} secrets, ${variable_count} variables, ${skipped_count} skipped)"
echo "   Secrets:   https://github.com/${REPO}/settings/secrets/actions"
echo "   Variables: https://github.com/${REPO}/settings/variables/actions"
