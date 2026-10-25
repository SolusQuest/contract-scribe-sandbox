#!/usr/bin/env bash
# Exact paid13 caller: claim without provider secret, then one bound launch.
set -euo pipefail
umask 077
paid_mode="${1:-}"
test "$paid_mode" = claim || test "$paid_mode" = launch
if [[ "$paid_mode" = claim ]]; then test -z "${CONTRACTSCRIBE_PROVIDER_API_KEY:-}${CONTRACTSCRIBE_GITHUB_TOKEN:-}"; fi
paid_dir="$(cd "$(dirname "$0")" && pwd)"
: "${GITHUB_REPOSITORY:?}" "${GITHUB_RUN_ATTEMPT:?}" "${GITHUB_WORKFLOW_SHA:?}" "${GITHUB_SHA:?}" "${GITHUB_RUN_ID:?}"
: "${A5_APPROVED_WORKFLOW_SHA:?}" "${A5_TARGET_SHA:?}" "${A5_SLOT:?}" "${GH_TOKEN:?}" "${RUNNER_TEMP:?}"
: "${A5_TARGET_ROOT:?}" "${A5_CLI:?}" "${A5_CAMPAIGN:?}" "${A5_CONSUMER:?}" "${A5_PRODUCT_SHA:?}"
test "$GITHUB_REPOSITORY" = SolusQuest/contract-scribe-sandbox
test "$GITHUB_RUN_ATTEMPT" = 1
test "$GITHUB_EVENT_NAME" = workflow_dispatch
test "$GITHUB_WORKFLOW_SHA" = "$A5_APPROVED_WORKFLOW_SHA"
test "$GITHUB_SHA" = "$GITHUB_WORKFLOW_SHA"
test "$(git -C "$paid_dir/.." rev-parse HEAD)" = "$GITHUB_WORKFLOW_SHA"
test -z "$(git -C "$paid_dir/.." status --porcelain)"
test "$(gh api repos/SolusQuest/contract-scribe-sandbox --jq .id)" = 1361354906
test "$A5_PRODUCT_SHA" = 823698c1fe90352cd06da13f8de1e60ccf30e38e
test "$A5_TARGET_SHA" = 0ea0b71381ad78b8fe1f371441fe546171671ce1
test "$A5_SLOT" = 13
test "$(git -C "$A5_TARGET_ROOT" rev-parse HEAD)" = "$A5_TARGET_SHA"
test -z "$(git -C "$A5_TARGET_ROOT" status --porcelain --untracked-files=no)"
node "$paid_dir/select-profile.mjs" verify "$A5_SLOT" "$A5_CONSUMER"
python3 "$paid_dir/audit-preflight.py" verify-receipt
paid_receipt="$RUNNER_TEMP/a5-paid-claim-receipt.json"
if [[ "$paid_mode" = claim ]]; then
  # No provider/publication credential is available in this pre-secret step.
  test ! -e "$paid_receipt"
  node "$paid_dir/campaign-binding.mjs" "$A5_CAMPAIGN"
  # Exactly one atomic POST. Any denied/ambiguous response stops, never replays.
  gh api --method POST repos/SolusQuest/contract-scribe-sandbox/git/refs -f "ref=refs/tags/m7-a5-budget-20261022-slot-$A5_SLOT" -f "sha=$GITHUB_SHA" >/dev/null
  test "$(gh api "repos/SolusQuest/contract-scribe-sandbox/git/ref/tags/m7-a5-budget-20261022-slot-$A5_SLOT" --jq .object.sha)" = "$GITHUB_SHA"
  node --input-type=module - "$paid_receipt" <<'JS'
import fs from 'node:fs';
import crypto from 'node:crypto';
const e=process.env,h=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(!/^[1-9][0-9]*$/.test(e.GITHUB_RUN_ID)||e.A5_SLOT!=='13'||e.GITHUB_RUN_ATTEMPT!=='1')throw Error('Paid claim context rejected.');
const value={runId:e.GITHUB_RUN_ID,attempt:e.GITHUB_RUN_ATTEMPT,slot:e.A5_SLOT,control:e.GITHUB_SHA,source:e.A5_PRODUCT_SHA,target:e.A5_TARGET_SHA,campaignSha256:h(e.A5_CAMPAIGN),consumerSha256:h(e.A5_CONSUMER),auditReceiptSha256:h(e.RUNNER_TEMP+'/a5-audit-preflight.json')};
fs.writeFileSync(process.argv[2],JSON.stringify(value)+'\n',{flag:'wx',mode:0o600});fs.chmodSync(process.argv[2],0o400);
JS
  exit 0
fi
# Only the later secret-bearing step can enter here, after the claim step succeeded.
: "${CONTRACTSCRIBE_PROVIDER_API_KEY:?}" "${CONTRACTSCRIBE_GITHUB_TOKEN:?}"
node --input-type=module - "$paid_receipt" <<'JS'
import fs from 'node:fs';
import crypto from 'node:crypto';
const e=process.env,file=process.argv[2],s=fs.lstatSync(file),h=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(!s.isFile()||s.isSymbolicLink()||s.uid!==process.getuid()||(s.mode&0o777)!==0o400||s.size>4096)throw Error('Paid claim receipt rejected.');
const expected={runId:e.GITHUB_RUN_ID,attempt:e.GITHUB_RUN_ATTEMPT,slot:e.A5_SLOT,control:e.GITHUB_SHA,source:e.A5_PRODUCT_SHA,target:e.A5_TARGET_SHA,campaignSha256:h(e.A5_CAMPAIGN),consumerSha256:h(e.A5_CONSUMER),auditReceiptSha256:h(e.RUNNER_TEMP+'/a5-audit-preflight.json')};
if(JSON.stringify(JSON.parse(fs.readFileSync(file)))!==JSON.stringify(expected))throw Error('Paid claim receipt binding rejected.');
JS
node "$paid_dir/campaign-binding.mjs" "$A5_CAMPAIGN" "$GITHUB_SHA"
# Create-once local fence: the split launch entry cannot execute a second outer CLI.
node --input-type=module - "$RUNNER_TEMP/a5-paid-launch-started.json" <<'JS'
import fs from 'node:fs';
fs.writeFileSync(process.argv[2],JSON.stringify({runId:process.env.GITHUB_RUN_ID,control:process.env.GITHUB_SHA,slot:process.env.A5_SLOT})+'\n',{flag:'wx',mode:0o400});
JS
# Existing real production CLI, fixed reviewed provider profile, original output boundaries.
# Never set -x or log credentials / provider requests / responses / reasoning.
set +e
dotnet "$A5_CLI" github-proposal --repository-root "$A5_TARGET_ROOT" --input App/App.csproj --policy policy.json --campaign "$A5_CAMPAIGN" --configuration "$A5_CONSUMER" >"$RUNNER_TEMP/a5-result.json" 2>"$RUNNER_TEMP/a5-stderr.txt"
paid_result=$?
set -e
printf '%s' "$paid_result" >"$RUNNER_TEMP/a5-exit-code.txt"
