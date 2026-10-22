#!/usr/bin/env bash
# PREPARED ONLY. Use after approved recipient installation; contains no key.
set -euo pipefail
umask 077
: "${RUNNER_TEMP:?}" "${A5_RECIPIENT_PUBLIC_KEY:?}"
test -s "$A5_RECIPIENT_PUBLIC_KEY"
# Only the closed CLI envelope and closed diagnostic, never a provider transcript.
test "$(wc -c < "$RUNNER_TEMP/a5-result.json")" -le 1048576
test "$(wc -c < "$RUNNER_TEMP/a5-stderr.txt")" -le 65536
files=(a5-result.json a5-stderr.txt a5-exit-code.txt)
if [ -f "$RUNNER_TEMP/a5-audit-preflight.json" ]; then
  test "$(wc -c < "$RUNNER_TEMP/a5-audit-preflight.json")" -le 65536
  files+=(a5-audit-preflight.json)
fi
COPYFILE_DISABLE=1 tar -C "$RUNNER_TEMP" -cf "$RUNNER_TEMP/a5-private.tar" "${files[@]}"
node "$(dirname "$0")/private-envelope.mjs" seal "$RUNNER_TEMP/a5-private.tar" "$A5_RECIPIENT_PUBLIC_KEY" "$RUNNER_TEMP/a5-private.jwe"
rm -f "$RUNNER_TEMP/a5-private.tar" "$RUNNER_TEMP/a5-result.json" "$RUNNER_TEMP/a5-stderr.txt" "$RUNNER_TEMP/a5-audit-preflight.json"
