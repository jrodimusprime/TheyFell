#!/bin/sh
# Regression: the headless sim test, the trench-wall collision test, then the golden playthrough and the assault on the German lines in headless Chrome (TF_GPU=1 for the real GPU).
cd "$(dirname "$0")/.." || exit 1
node test/sim_test.mjs || exit 1
node test/collision_test.mjs || exit 1
node test/switch_test.mjs || exit 1
node test/mg_test.mjs || exit 1
node test/serve.mjs 8642 >/dev/null 2>&1 & srv=$!
sleep 1
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/playthrough.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|EXCEPTION|harness error|\[end\]|\[advance\]"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/flicker.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|EXCEPTION|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/bump.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|EXCEPTION|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/rifle_block.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|EXCEPTION|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/sights.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|EXCEPTION|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/climb_check.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|EXCEPTION|harness error"
node test/cdp.mjs "http://localhost:8642/index.html" test/respawn.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/pickup.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/shooters.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/melee.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/grenade.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/dugout.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/mg.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|harness error"
node test/cdp.mjs "http://localhost:8642/index.html?agent" test/assault.js "${TMPDIR:-/tmp}/theyfell-test" | grep -E "PASS|FAIL|EXCEPTION|harness error|\[end\]|\[assault\]"
kill $srv
