import assert from 'assert/strict';
import { describe, it } from 'node:test';

import { HashSet } from '../src/HashSet.js';

const I = (a, b) => ({ a, b });

describe('HashSet', () => {
	it('constructor requires key function', () => {
		assert.throws(() => {
			new HashSet();
		});

		new HashSet(() => '');
	});

	it('api', () => {
		const set = new HashSet(({ a, b }) => `${a + b}`);

		assert.equal(set.size, 0);
		set.add(I(1, 2));
		assert.equal(set.size, 1);
		assert.deepEqual(set.getByHash('3'), I(1, 2));

		// add second item that will hash, last one should win
		set.add(I(3, 0));
		assert.equal(set.size, 1);
		assert.deepEqual(set.getByHash('3'), I(3, 0));
		assert.deepEqual(set.get(I(3, 0)), I(3, 0));
		assert.deepEqual(set.get(I(1, 2)), I(3, 0));

		set.add(I(1, 1));
		assert.equal(set.size, 2);
		assert.equal(set.has(I(1, 2)), true);
		assert.equal(set.has(I(1, 1)), true);

		set.delete(I(1, 1));
		assert.equal(set.size, 1);
		assert.equal(set.has(I(1, 1)), false);

		set.deleteByHash('3');
		assert.equal(set.size, 0);
		assert.equal(set.has(I(1, 1)), false);
	});
});
