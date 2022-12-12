import { strict as assert } from 'assert';
import test from 'node:test';

import { assertRootStructure, assertPart, assertFromFile } from './validate.js';

test('assertFromFile', () => {
	test('empty', () => {
		assertFromFile('./fixtures/empty.json');
	});

	test('full', () => {
		assertFromFile('./fixtures/full.json');
	});

	test('full-invalid', () => {
		assert.throws(() => {
			assertFromFile('./fixtures/full-invalid.json');
		});
	});
});

test('empty object is invalid', () => {
	assert.throws(() => {
		assertRootStructure({});
	});
});

// Test one of the keys, others are mostly rinse and repeat
test('vhosts', () => {
	test('invalid', () => {
		assert.throws(() => {
			assertPart('vhosts', {});
		});
		assert.throws(() => {
			assertPart('vhosts', [{}]);
		});
		assert.throws(() => {
			assertPart('vhosts', [{
				value: '_value',
			}]);
		});
	});

	test('valid', () => {
		assertPart('vhosts', [
			{ name: '/' },
		]);
	});
});

test('invalid strings', () => {
	test('emoji', () => {
		assert.throws(() => {
			assertPart('users', [{
				name: 'user-emoji-🫶',
			}]);
		}, /unexpected char/);
	});

	test('unprintable', () => {
		assert.throws(() => {
			assertPart('users', [{
				name: 'user.​name',
			}]);
		}, /unexpected char/);
	});
});
