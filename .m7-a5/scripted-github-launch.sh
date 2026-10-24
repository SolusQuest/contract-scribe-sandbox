#!/usr/bin/env bash
# ONE local scripted provider + ONE real production CLI. No external model.
set -euo pipefail
umask 077
scripted_dir="$(cd "$(dirname "$0")" && pwd)"
: "${RUNNER_TEMP:?}" "${A5_CLI:?}" "${A5_TARGET_ROOT:?}"
test -z "${CONTRACTSCRIBE_PROVIDER_API_KEY:-}"
test -z "${DOTNET_STARTUP_HOOKS:-}"
test -z "${CONTRACTSCRIBE_TEST_GITHUB_ENDPOINT:-}"
test -z "${CONTRACTSCRIBE_TEST_GITHUB_FAULT:-}"
test "$A5_PRODUCT_SHA" = ed083fab0748a2ae7c6c662c7fa2c806119144d6
test "$A5_TARGET_SHA" = 0ea0b71381ad78b8fe1f371441fe546171671ce1
if [[ "${1:-}" = audit ]]; then
  test -z "${GH_TOKEN:-}${GITHUB_TOKEN:-}${CONTRACTSCRIBE_GITHUB_TOKEN:-}"
  node "$scripted_dir/scripted-github-gate.mjs" prepare-campaign
  # Exact old helper bytes, adjacent to the new purpose's private campaign.
  python3 "$RUNNER_TEMP/a5-scripted-audit/audit-preflight.py" preflight
  exit 0
fi
test "${1:-}" = launch
: "${GH_TOKEN:?}" "${CONTRACTSCRIBE_GITHUB_TOKEN:?}"
python3 "$RUNNER_TEMP/a5-scripted-audit/audit-preflight.py" verify-receipt
node "$scripted_dir/scripted-github-gate.mjs" preflight
scripted_pid=''
cleanup() {
  if [[ -n "$scripted_pid" ]]; then
    # Child PID is captured from this shell's own start, never discovered by name.
    kill -TERM "$scripted_pid" 2>/dev/null || true
    wait "$scripted_pid" || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Start AFTER real Audit, before claim. No credential, hook or network client in child env.
env -i PATH="$PATH" PYTHONDONTWRITEBYTECODE=1 python3 "$scripted_dir/scripted-provider.py" \
  --ready "$RUNNER_TEMP/a5-scripted-ready.json" --stats "$RUNNER_TEMP/a5-scripted-stats.json" \
  --first-response-hold-ms 61000 >"$RUNNER_TEMP/a5-scripted-server-out.txt" 2>"$RUNNER_TEMP/a5-scripted-server-err.txt" &
scripted_pid=$!
export A5_SCRIPTED_OWNED_PID="$scripted_pid"
for ((scripted_wait=0;scripted_wait<100;scripted_wait++)); do
  if [[ -f "$RUNNER_TEMP/a5-scripted-ready.json" ]]; then break; fi
  kill -0 "$scripted_pid"
  sleep 0.05
done
test -f "$RUNNER_TEMP/a5-scripted-ready.json"
node "$scripted_dir/scripted-github-gate.mjs" prepare-consumer
node "$scripted_dir/scripted-github-gate.mjs" verify-prepared
# Unique no-model purpose claim, NOT a paid slot or budget journal entry.
# Single POST; ambiguous/denied result stops without replay or deletion.
node "$scripted_dir/scripted-github-gate.mjs" claim
# Runtime handles normal HTTPS GitHub authority, tool/nonce/evidence validation,
# M2/re-Audit/patch/PR/lease cleanup. Provider transport is ordinary null-credential HTTP.
set +e
dotnet "$A5_CLI" github-proposal --repository-root "$A5_TARGET_ROOT" --input App/App.csproj \
  --policy policy.json --campaign "$RUNNER_TEMP/a5-scripted-audit/campaign.json" \
  --configuration "$RUNNER_TEMP/a5-scripted-consumer.json" \
  >"$RUNNER_TEMP/a5-result.json" 2>"$RUNNER_TEMP/a5-stderr.txt"
scripted_result=$?
set -e
printf '%s' "$scripted_result" >"$RUNNER_TEMP/a5-exit-code.txt"
cleanup
scripted_pid=''
node --input-type=module - "$RUNNER_TEMP/a5-scripted-stats.json" <<'JS'
import fs from 'node:fs';
const value=JSON.parse(fs.readFileSync(process.argv[2]));
if(!['requests','responses','rejected','firstResponseHoldMilliseconds','externalModelRequests'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0)
 ||value.externalModelRequests!==0||value.firstResponseHoldMilliseconds!==61000)process.exit(1);
console.log(JSON.stringify({syntheticSDKRequests:value.requests,syntheticResponses:value.responses,rejected:value.rejected,firstResponseHoldMilliseconds:61000,externalModelRequests:0,artificialUsageIsNotProviderBilling:true}));
JS
# Wrapper exits successfully only to permit the unchanged closed-file collector.
# The final workflow step restores the exact actual CLI status.
