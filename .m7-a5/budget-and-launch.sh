#!/usr/bin/env bash
# PREPARED ONLY; reviewed caller supplies exact tuple, fixed slot and paths.
set -euo pipefail
umask 077
: "${GITHUB_REPOSITORY:?}" "${GITHUB_RUN_ATTEMPT:?}" "${GITHUB_WORKFLOW_SHA:?}"
: "${A5_APPROVED_WORKFLOW_SHA:?}" "${A5_TARGET_SHA:?}" "${A5_SLOT:?}" "${GH_TOKEN:?}"
: "${A5_TARGET_ROOT:?}" "${A5_CLI:?}" "${A5_CAMPAIGN:?}" "${A5_CONSUMER:?}"
test "$GITHUB_REPOSITORY" = SolusQuest/contract-scribe-sandbox
test "$GITHUB_RUN_ATTEMPT" = 1
test "$GITHUB_EVENT_NAME" = workflow_dispatch
test "$(gh api repos/SolusQuest/contract-scribe-sandbox --jq .id)" = 1361354906
if [[ "$A5_SLOT" != z* ]]; then : "${CONTRACTSCRIBE_PROVIDER_API_KEY:?}"; else test -z "${CONTRACTSCRIBE_PROVIDER_API_KEY:-}"; fi
test "$GITHUB_WORKFLOW_SHA" = "$A5_APPROVED_WORKFLOW_SHA"
[[ "$A5_TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
test "$A5_SLOT" = 07
test "$(git -C "$A5_TARGET_ROOT" rev-parse HEAD)" = "$A5_TARGET_SHA"
test "$(gh api repos/SolusQuest/contract-scribe-sandbox/git/ref/heads/m7-a5-observation-20261022-g --jq .object.sha)" = "$A5_TARGET_SHA"
node "$(dirname "$0")/campaign-binding.mjs" "$A5_CAMPAIGN"
node "$(dirname "$0")/select-profile.mjs" verify "$A5_SLOT" "$A5_CONSUMER"
if [[ "$A5_SLOT" != z* ]]; then python3 "$(dirname "$0")/audit-preflight.py" verify-receipt; fi
# Atomic single-use slot claim. Any denied/ambiguous POST stops; no retry,
# overwrite or deletion. A consumed slot stays consumed after failure.
gh api --method POST repos/SolusQuest/contract-scribe-sandbox/git/refs -f "ref=refs/tags/m7-a5-budget-20261022-slot-$A5_SLOT" -f "sha=$GITHUB_SHA" >/dev/null
test "$(gh api "repos/SolusQuest/contract-scribe-sandbox/git/ref/tags/m7-a5-budget-20261022-slot-$A5_SLOT" --jq .object.sha)" = "$GITHUB_SHA"
# Provider key is available only in paid slots, after restore/build.
# Zero-call probes have maximumProviderRequests=0 and an empty provider credential.
# Never set -x. Wrapper must preserve the nonzero CLI result for sealed evidence.
set +e
dotnet "$A5_CLI" github-proposal --repository-root "$A5_TARGET_ROOT" --input App/App.csproj --policy policy.json --campaign "$A5_CAMPAIGN" --configuration "$A5_CONSUMER" >"$RUNNER_TEMP/a5-result.json" 2>"$RUNNER_TEMP/a5-stderr.txt"
result=$?
set -e
printf '%s' "$result" >"$RUNNER_TEMP/a5-exit-code.txt"
