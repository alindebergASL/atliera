#!/usr/bin/env bash
# classify-pr.sh — wires the governance classifier to the ACTUAL PR diff.
# Pure: reads git state and files; writes only its report to stdout.
#
# Usage (CI): scripts/classify-pr.sh <base-ref>
#
# Contract:
# - Change set comes from `git diff --name-status -z <base>...HEAD`, so paths
#   with spaces/newlines are safe and deletions are distinguishable (a deleted
#   supersession record cannot satisfy an inclusion check).
# - The effect declaration is the committed root `change-risk.json` at the PR
#   head, REQUIRED. It is priced Tier 0 by the map so amending it never
#   escalates the change that carries it.
# - The base branch's tier map is extracted for mechanical de-escalation
#   detection. An owner acknowledgement may be supplied at
#   `docs/decisions/deescalation-ack.json`.
# - Deleted lines in tests/safety/ are surfaced as guard-weakening review flags.
#
# THIS CHECK IS CLASSIFICATION ONLY. It computes and reports the tier and
# refuses frozen-artifact mutation; it does NOT enforce the ceremony that tier
# requires. Ceremony evidence is enforced by scripts/verify-ceremony.ts, wired
# as a separate required check. Do not read a green result here as "the tier's
# requirements were met".
#
# Exit codes are propagated verbatim from the classifier:
#   0 ok · 2 frozen violation · 3 declaration/ack invalid · 4 unauthorized
#   de-escalation · 5 invalid tier map or unsafe registry entry
set -euo pipefail

BASE_REF="${1:?usage: classify-pr.sh <base-ref>}"
MAP="docs/strategy/governance-tiers.json"
DECL="change-risk.json"
ACK="docs/decisions/deescalation-ack.json"

STATUS_TMP="$(mktemp)"
BASE_MAP_TMP="$(mktemp)"
cleanup() { rm -f "${STATUS_TMP}" "${BASE_MAP_TMP}"; }
trap cleanup EXIT

git diff --name-status -z "${BASE_REF}...HEAD" > "${STATUS_TMP}"
if [ ! -s "${STATUS_TMP}" ]; then
  echo '{"prTier":0,"files":[],"violations":[],"deescalations":[]}'
  exit 0
fi

args=(--map "${MAP}" --name-status "${STATUS_TMP}" --require-declaration)

if [ -f "${DECL}" ]; then
  args+=(--declaration "${DECL}")
fi

if git cat-file -e "${BASE_REF}:${MAP}" 2>/dev/null; then
  git show "${BASE_REF}:${MAP}" > "${BASE_MAP_TMP}"
  args+=(--base-map "${BASE_MAP_TMP}")
fi

if [ -f "${ACK}" ]; then
  args+=(--deescalation-ack "${ACK}")
fi

# Guard-weakening review flag: deletions in safety tests get named attention.
git diff --numstat -z "${BASE_REF}...HEAD" -- 'tests/safety/*' 2>/dev/null \
  | tr '\0' '\n' \
  | awk 'NF==3 && $2+0 > 0 { printf "guard-review-flag: %s deletes %s line(s) in a safety test — reviewer must confirm or refute the guardWeakening declaration\n", $3, $2 }' >&2 || true

# Explicit exit propagation: no pipeline, no xargs, "--" terminates options.
set +e
node --experimental-strip-types scripts/classify-change-risk.ts "${args[@]}" --
rc=$?
set -e
exit "${rc}"
