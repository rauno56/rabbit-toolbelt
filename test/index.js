import { strict as assert } from 'assert';
import { describe, it } from 'node:test';

import { copy, readJSONSync } from '../src/utils.js';
import Index from '../src/Index.js';

const valid = readJSONSync('./fixtures/full.json');

describe('index', () => {
	it('is able to compile an equivalent to the original definitions object', () => {
		const index = Index.fromDefinitions(copy(valid));

		assert.deepEqual(
			// copying to get rid of added symbols
			copy(index.toDefinitions()),
			valid
		);
	});

	describe('merge', () => {
		it('merges resources from definitions file', () => {
			const SOURCE1 = 'SOURCE1';
			const SOURCE2 = 'SOURCE2';
			const index = Index.fromDefinitions(
				copy(valid), undefined, undefined, SOURCE1
			);
			const sizeBefore = index.vhosts.size;
			index.merge({
				vhosts: [{ name: 'newvhost' }],
			}, undefined, undefined, SOURCE2);

			assert.equal(index.vhosts.size, sizeBefore + 1);
		});

		it('errors with source paths if duplicate entries', () => {
			const SOURCE1 = 'SOURCE1';
			const SOURCE2 = 'SOURCE2';
			const index = Index.fromDefinitions(
				copy(valid), undefined, undefined, SOURCE1
			);

			assert.throws(() => {
				index.merge({
					vhosts: copy([...index.vhosts.values()]),
				}, true, undefined, SOURCE2);
			}, /SOURCE1.*SOURCE2/);
		});

		it('merges all unknown fields', () => {
			const SOURCE1 = 'SOURCE1';
			const SOURCE2 = 'SOURCE2';
			const VALUE = 'value';
			const index = Index.fromDefinitions(
				copy(valid), undefined, undefined, SOURCE1
			);

			index.merge({
				unmanaged: VALUE,
			}, true, undefined, SOURCE2);

			assert.equal(index.toDefinitions().unmanaged, VALUE);
		});

		it('errors if unmanaged key is already set', () => {
			const SOURCE1 = 'SOURCE1';
			const SOURCE2 = 'SOURCE2';
			const index = Index.fromDefinitions(
				copy(valid), undefined, undefined, SOURCE1
			);

			assert.throws(() => {
				index.merge({
					rabbit_version: 'otherversion',
				}, true, undefined, SOURCE2);
			}, /rabbit_version/);
		});

		it('merges unmanaged arrays', () => {
			const SOURCE1 = 'SOURCE1';
			const SOURCE2 = 'SOURCE2';
			const index = Index.fromDefinitions(
				copy(valid), undefined, undefined, SOURCE1
			);

			index.merge({
				parameters: [],
			}, true, undefined, SOURCE2);
		});
	});
});
