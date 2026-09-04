#!/bin/bash
# Dev: run the sprint's regression wall sequentially, summarizing.
# Starts the static servers the suites expect (8792 for the ether
# suites, 8788 for the nested companion-memory run) from THIS tree,
# and stops them on exit.
set -u
cd "$(dirname "$0")/../.."
export NODE_PATH=/opt/node22/lib/node_modules
OUT="${1:-/tmp/wall}"
mkdir -p "$OUT"
node tools/bring-it-alive/test/serve.js 8792 >/dev/null 2>&1 &
S1=$!
node tools/bring-it-alive/test/serve.js 8788 >/dev/null 2>&1 &
S2=$!
trap 'kill $S1 $S2 2>/dev/null' EXIT
sleep 1
echo "8792 serves build: $(curl -s http://127.0.0.1:8792/version.txt)"
echo "8788 serves build: $(curl -s http://127.0.0.1:8788/version.txt)"
run() {
  name=$1; shift
  echo "=== $name ==="
  "$@" > "$OUT/$name.log" 2>&1
  code=$?
  grep -E 'passed, [0-9]+ failed|PASSED|FAILED|ALL GREEN' "$OUT/$name.log" | tail -1 | sed 's/^/    /'
  echo "    exit $code"
}
run ether-ripple      node tools/ether-ripple-test/run-ether-ripple-tests.js
run ether-life        node tools/ether-life-test/run-ether-life-tests.js
run ether-walkthrough node tools/ether-life-test/walkthrough.js
run touch-walkthrough env EXPLORE_S=60 node tools/ether-ripple-test/touch-walkthrough.js
run ether-experience  node tools/ether-experience-test/run-ether-experience-tests.js
run ether-encounter   node tools/ether-encounter-test/run-ether-encounter-tests.js
run ether-share       node tools/ether-share-test/run-ether-share-tests.js
run social-ether-id   node tools/social-ether-identity-test/run-social-ether-identity-tests.js
run companion-canon   node tools/companion-canon-test/run-companion-canon-tests.js
run companion-context node tools/companion-context-test/run-companion-context-tests.js
run companion-gap     node tools/companion-gap-test/run-companion-gap-tests.js
echo DONE
