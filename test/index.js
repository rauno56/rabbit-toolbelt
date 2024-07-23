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
			}, new RegExp('SOURCE1.*SOURCE2'));

		});
	});
});
