#!/usr/bin/env sh

assert_succeeds () {
	(node cli.js $@) || exit 1
	echo
}

assert_fails () {
	! (node cli.js $@) && echo "Expected failure: OK" || exit 1
	echo
}

assert_succeeds fixtures/empty.json
assert_succeeds fixtures/empty.json fixtures/usage.empty.json
assert_succeeds fixtures/full.json
assert_succeeds fixtures/full.json fixtures/usage.full.json

assert_fails fixtures/full.json fixtures/usage.empty.json
assert_fails fixtures/full-invalid.json
assert_fails fixtures/full-invalid-relations.json
