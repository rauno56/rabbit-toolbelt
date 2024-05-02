import { strict as assert } from 'assert';
import { describe, it } from 'node:test';

import { readJSONSync } from '../src/utils.js';
import { apply as _apply, revert as _revert } from '../src/apply.js';
import _compileDiff from '../src/diff.js';

import { inspect } from 'node:util';

inspect.defaultOptions.depth++;

const copy = (obj) => {
	return JSON.parse(JSON.stringify(obj));
};

// make sure we never change used objects to avoid having to debug our tests
const apply = (diff, definitions) => _apply(copy(diff), copy(definitions));
const revert = (diff) => _revert(copy(diff));
const compileDiff = (before, after) => _compileDiff(copy(before), copy(after));

const valid = readJSONSync('./fixtures/full.json');
const getValid = () => copy(valid);

const changedDefinitions = getValid();
changedDefinitions.exchanges.shift();
changedDefinitions.users[0].password_hash = 'new_hash';
changedDefinitions.queues.push({
	name: 'new-queue',
	vhost: '/',
	durable: true,
	auto_delete: false,
	arguments: { 'x-queue-type': 'quorum' },
});

describe('apply', () => {
	it('fn exists and takes 2 args', () => {
		assert.equal(typeof apply, 'function');
		assert.equal(apply.length, 2);
	});

	it('does nothing if diff is empty', () => {
		assert.deepEqual(apply({}, valid), valid);

		assert.throws(() => apply(undefined, valid));
		assert.throws(() => apply(null, valid));
		assert.throws(() => apply(false, valid));
		assert.throws(() => apply('{}', valid));
	});

	it('throws if unknown type', () => {
		assert.throws(() => apply({ deleted: { invalid: [] } }, valid), /invalid/);
	});

	it('deletes deleted', () => {
		const input = getValid();
		const toDelete = input.queues[0];
		const toDelete2 = copy(input.queues[0]);
		toDelete2.name = toDelete.name + '-404';
		const result = apply({
			deleted: {
				queues: [toDelete, toDelete2],
			},
		}, input);

		assert.equal(result.queues.length, input.queues.length - 1);
		assert.notDeepEqual(toDelete, result.queues[0]);
	});

	it('deletes all deleted', () => {
		const input = getValid();
		const toDelete = input.queues[0];

		input.queues.push(input.queues[0]);

		const result = apply({
			deleted: {
				queues: [toDelete],
			},
		}, input);

		assert.equal(result.queues.length, input.queues.length - 2);
		assert.notDeepEqual(toDelete, result.queues[0]);
	});

	it('changes changed', () => {
		const input = getValid();
		const toChange = {
			before: copy(input.queues[0]),
			after: copy(input.queues[0]),
		};

		toChange.after.durable = !toChange.after.durable;

		const result = apply({
			changed: {
				queues: [toChange],
			},
		}, input);

		assert.equal(result.queues.length, input.queues.length);
		assert.notDeepEqual(input.queues[0], result.queues[0]);
	});

	it('adds added', () => {
		const input = getValid();
		const existing = copy(input.queues[0]);
		const toAdd = copy(input.queues[0]);
		toAdd.name = toAdd.name + '-added';
		const result = apply({
			added: {
				queues: [existing, toAdd],
			},
		}, input);

		assert.equal(result.queues.length, input.queues.length + 1);
		assert.deepEqual(toAdd, result.queues.at(-1));
	});

	it('is idempotent', () => {
		const input = getValid();

		const toAdd = copy(input.queues[0]);
		toAdd.name = toAdd.name + '-added';

		const toChange = {
			before: copy(input.queues[0]),
			after: copy(input.queues[0]),
		};
		toChange.after.durable = !toChange.after.durable;

		const toDelete = input.queues[1];

		const diff = {
			added: { queues: [toDelete] },
			deleted: { queues: [toAdd] },
			changed: { queues: [toChange] },
		};

		const result = apply(diff, input);
		const result2 = apply(diff, result);

		assert.notDeepEqual(result, input);
		assert.deepEqual(result, result2);
	});

	it('passes sanity check with diff', () => {
		const diff = compileDiff(valid, changedDefinitions);

		assert.ok(diff.added.queues.length);
		assert.ok(diff.deleted.exchanges.length);
		assert.ok(diff.changed.users.length);

		const result = apply(diff, valid);

		assert.deepEqual(
			compileDiff(result, changedDefinitions),
			compileDiff(result, result)
		);
	});

	it('has a revert option', () => {
		const diff = revert(compileDiff(valid, changedDefinitions));

		assert.ok(diff.deleted.queues.length);
		assert.ok(diff.added.exchanges.length);
		assert.ok(diff.changed.users.length);

		const result = apply(diff, changedDefinitions);

		assert.deepEqual(
			compileDiff(result, valid),
			compileDiff(result, result)
		);
	});
});
