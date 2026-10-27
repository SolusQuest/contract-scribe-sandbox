#!/usr/bin/env bash
# First lifecycle continuation candidate: ZERO-provider preflight gates only.
# No funding slot is allocated; claim/paid launch entrypoints are unavailable.
set -euo pipefail
umask 077
test "${1:-}" = gate
test -z "${CONTRACTSCRIBE_PROVIDER_API_KEY:-}${A5_FUNDING_SLOT:-}"
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
test "$A5_TARGET_SHA" = 0ea0b71381ad78b8fe1f371441fe546171671ce1
test "$(git -C "$A5_TARGET_ROOT" rev-parse HEAD)" = "$A5_TARGET_SHA"
test -z "$(git -C "$A5_TARGET_ROOT" status --porcelain --untracked-files=no)"
node "$lifecycle_dir/select-profile.mjs" verify "$A5_PHASE" "$A5_CONSUMER"
node "$lifecycle_dir/campaign-binding.mjs" "$A5_CAMPAIGN"
# Create-once local fence; no remote claim, financial journal or API POST.
node --input-type=module - "$RUNNER_TEMP/a5-lifecycle-launch-started.json" <<'JS'
import fs from 'node:fs';
const e=process.env;
if(!/^[1-9][0-9]*$/.test(e.GITHUB_RUN_ID)||e.GITHUB_RUN_ATTEMPT!=='1')throw Error('Original invocation context rejected.');
fs.writeFileSync(process.argv[2],JSON.stringify({runId:e.GITHUB_RUN_ID,control:e.GITHUB_SHA,phase:e.A5_PHASE,fundingInvocation:null})+'\n',{flag:'wx',mode:0o400});
JS
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then printf 'started=true\n' >>"$GITHUB_OUTPUT"; fi
# Exact ordinary automatic product entrypoint. No hook/proxy/endpoint exemption.
# Original actual exit is retained even when the expected closed gate returns4.
set +e
dotnet "$A5_CLI" github-proposal --repository-root "$A5_TARGET_ROOT" --input App/App.csproj --policy policy.json --campaign "$A5_CAMPAIGN" --configuration "$A5_CONSUMER" >"$RUNNER_TEMP/a5-result.json" 2>"$RUNNER_TEMP/a5-stderr.txt"
lifecycle_result=$?
set -e
printf '%s' "$lifecycle_result" >"$RUNNER_TEMP/a5-exit-code.txt"
# The fourth closed file explicitly records NO caller Audit, never a fake Audit.
node --input-type=module - "$RUNNER_TEMP/a5-audit-preflight.json" <<'JS'
import fs from 'node:fs';
const e=process.env;
fs.writeFileSync(process.argv[2],JSON.stringify({case:'lifecycle-preflight-gate',realAuditCompleted:false,callerAuditInvoked:false,productAuditAbsenceValidated:false,phase:e.A5_PHASE,campaignLineage:'campaign.m7.a5.20261022.flash.20',targetRef:'refs/heads/m7-a5-observation-20261022-w',targetSha:e.A5_TARGET_SHA,sourceRevision:e.A5_PRODUCT_SHA,reason:'No caller Audit is executed for these early lifecycle gates; product result and unchanged coordination must validate the preflight path.'})+'\n',{flag:'wx',mode:0o600});
JS
node "$lifecycle_dir/campaign-binding.mjs" check-zero "$RUNNER_TEMP/a5-result.json" "$RUNNER_TEMP/a5-exit-code.txt"
node "$lifecycle_dir/campaign-binding.mjs" "$A5_CAMPAIGN"
node --input-type=module - "$RUNNER_TEMP/a5-audit-preflight.json" <<'JS'
import fs from 'node:fs';
const file=process.argv[2],record=JSON.parse(fs.readFileSync(file));
record.productAuditAbsenceValidated=true;
record.validation='Expected source preflight terminal with zero new provider/tool work and unchanged exact coordination/PR state.';
fs.writeFileSync(file,JSON.stringify(record)+'\n',{mode:0o600});
JS
