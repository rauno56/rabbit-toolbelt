import { strict as assert } from 'assert';
import { describe, it } from 'node:test';

import { readJSONSync } from '../src/utils.js';
import { assertRootStructure, assertPart, assertFromFile, validateAll } from '../src/validate.js';

describe('assertFromFile', () => {
	it('empty', () => {
		assertFromFile('./fixtures/empty.json');
	});

	it('full', () => {
		assertFromFile('./fixtures/full.json');
	});

	it('full-invalid', () => {
		assert.throws(() => {
			assertFromFile('./fixtures/full-invalid.json');
		});
	});
});

describe('empty object is invalid', () => {
	assert.throws(() => {
		assertRootStructure({});
	});
});

// Test one of the keys, others are mostly rinse and repeat
describe('vhosts', () => {
	it('invalid', () => {
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

	it('valid', () => {
		assertPart('vhosts', [
			{ name: '/' },
		]);
	});
});

describe('invalid strings', () => {
	it('emoji', () => {
		assert.throws(() => {
			assertPart('users', [{
				name: 'user-emoji-🫶',
			}]);
		}, /unexpected char/);
	});

	it('unprintable', () => {
		assert.throws(() => {
			assertPart('users', [{
				name: 'user.​name',
			}]);
		}, /unexpected char/);
	});
});

describe('validateAll', () => {
	it('reports structural errors if hash functions throw', () => {
		const valid = readJSONSync('./fixtures/full.json');
		valid.topic_permissions.push(valid.permissions[0]);
		const failures = validateAll(valid);
		assert.equal(failures.length, 2);
	});
});
