#!/usr/bin/env bash
# Actual H1 next candidate: ONE genuine fresh Audit12, credentials absent from CLI.
# No funding slot is allocated; claim/paid launch entrypoints are unavailable.
set -euo pipefail
umask 077
test "${1:-}" = audit
test -z "${CONTRACTSCRIBE_PROVIDER_API_KEY:-}${A5_FUNDING_SLOT:-}${A5_SLOT:-}"
test -z "${DOTNET_STARTUP_HOOKS:-}${CONTRACTSCRIBE_TEST_GITHUB_ENDPOINT:-}${CONTRACTSCRIBE_TEST_GITHUB_FAULT:-}"
lifecycle_dir="$(cd "$(dirname "$0")" && pwd)"
: "${GITHUB_REPOSITORY:?}" "${GITHUB_RUN_ATTEMPT:?}" "${GITHUB_WORKFLOW_SHA:?}" "${GITHUB_SHA:?}" "${GITHUB_RUN_ID:?}"
: "${A5_APPROVED_WORKFLOW_SHA:?}" "${A5_TARGET_SHA:?}" "${A5_PHASE:?}" "${GH_TOKEN:?}" "${RUNNER_TEMP:?}"
: "${A5_TARGET_ROOT:?}" "${A5_CLI:?}" "${A5_CAMPAIGN:?}" "${A5_CONSUMER:?}" "${A5_PRODUCT_SHA:?}" "${CONTRACTSCRIBE_GITHUB_TOKEN:?}"
test "$GITHUB_REPOSITORY" = SolusQuest/contract-scribe-sandbox
test "$GITHUB_RUN_ATTEMPT" = 1
test "$GITHUB_EVENT_NAME" = workflow_dispatch
test "$GITHUB_WORKFLOW_SHA" = "$A5_APPROVED_WORKFLOW_SHA"
test "$GITHUB_SHA" = "$GITHUB_WORKFLOW_SHA"
test "$(git -C "$lifecycle_dir/.." rev-parse HEAD)" = "$GITHUB_WORKFLOW_SHA"
test -z "$(git -C "$lifecycle_dir/.." status --porcelain)"
test "$(gh api repos/SolusQuest/contract-scribe-sandbox --jq .id)" = 1361354906
test "$A5_PRODUCT_SHA" = 4ca77d69cbaf2d3cb18c49352a43f4449c9da991
test "$A5_TARGET_SHA" = 391d1761734dcdd168906477a9862c8b13505ea7
test "$(git -C "$A5_TARGET_ROOT" rev-parse HEAD)" = "$A5_TARGET_SHA"
test -z "$(git -C "$A5_TARGET_ROOT" status --porcelain --untracked-files=no)"
node "$lifecycle_dir/select-profile.mjs" verify "$A5_PHASE" "$A5_CONSUMER"
node "$lifecycle_dir/campaign-binding.mjs" "$A5_CAMPAIGN"
# Create-once local fence; no remote claim, financial journal or API POST.
node --input-type=module - "$RUNNER_TEMP/a5-fresh-audit-started.json" <<'JS'
import fs from 'node:fs';
const e=process.env;
if(!/^[1-9][0-9]*$/.test(e.GITHUB_RUN_ID)||e.GITHUB_RUN_ATTEMPT!=='1')throw Error('Original invocation context rejected.');
fs.writeFileSync(process.argv[2],JSON.stringify({runId:e.GITHUB_RUN_ID,control:e.GITHUB_SHA,phase:e.A5_PHASE,fundingInvocation:null})+'\n',{flag:'wx',mode:0o400});
JS
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then printf 'started=true\n' >>"$GITHUB_OUTPUT"; fi
# No model, GitHub or provider credentials enter the ordinary source Audit CLI.
# This future zero operation does not acquire a campaign Writer/claim or financial hold.
set +e
env -u GH_TOKEN -u GITHUB_TOKEN -u CONTRACTSCRIBE_GITHUB_TOKEN -u CONTRACTSCRIBE_PROVIDER_API_KEY python3 "$lifecycle_dir/audit-preflight.py" preflight
lifecycle_result=$?
set -e
# Helper preserves actual underlying Audit CLI1 in the authenticated real receipt;
# wrapper0 only means complete committed canonical1+12+0 verified, not Audit CLI0.
test "$lifecycle_result" = 0
env -u GH_TOKEN -u GITHUB_TOKEN -u CONTRACTSCRIBE_GITHUB_TOKEN -u CONTRACTSCRIBE_PROVIDER_API_KEY python3 "$lifecycle_dir/audit-preflight.py" verify-receipt
node "$lifecycle_dir/campaign-binding.mjs" "$A5_CAMPAIGN"
