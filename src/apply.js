import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import HashSet from './HashSet.js';

import { key } from './Index.js';

const mapValues = (obj, fn) => {
	return Object.fromEntries(
		Object.entries(obj)
			.map(([key, value]) => [key, fn(value)])
	);
};
const swapChangeDirection = ({ before, after }) => ({ before: after, after: before });

export const revert = ({ added, changed, deleted }) => {
	return {
		added: deleted,
		changed: mapValues(changed, (list) => list.map(swapChangeDirection)),
		deleted: added,
	};
};

export const apply = (diff, definitions, options = {}) => {
	if (options.revert) {
		return apply(revert(diff), definitions, { ...options, revert: false });
	}
	assert.ok(typeof diff === 'object' && diff);
	assert.ok(typeof definitions === 'object' && definitions);

	if (diff.deleted) {
		for (const [type, list] of Object.entries(diff.deleted)) {
			const hash = key[type];
			assert.equal(typeof hash, 'function', `Unknown type: ${type}`);
			const keys = new Set(list.map((item) => hash(item)));
			const removedKeys = new Set();
			definitions[type] = definitions[type].filter((item) => {
				const key = hash(item);
				if (keys.delete(key)) {
					removedKeys.add(key);
					return false;
				}
				return !removedKeys.has(key);
			});

			if (keys.size) {
				console.warn(`Warning: ${type} marked to be deleted, but not found:`);
				list.filter((item) => keys.has(hash(item))).forEach((item) => console.warn(' -', inspect(item, { breakLength: Infinity })));
			}
		}
	}

	if (diff.changed) {
		for (const [type, list] of Object.entries(diff.changed)) {
			const hash = key[type];
			assert.equal(typeof hash, 'function', `Unknown type: ${type}`);
			const keys = new HashSet(hash, list.map(({ after }) => after));
			for (const idx in definitions[type]) {
				const changeTo = keys.get(definitions[type][idx]);
				if (changeTo) {
					definitions[type][idx] = changeTo;
				}
			}
		}
	}

	if (diff.added) {
		for (const [type, list] of Object.entries(diff.added)) {
			const hash = key[type];
			assert.equal(typeof hash, 'function', `Unknown type: ${type}`);
			const definitionIndex = new HashSet(hash, definitions[type]);
			definitions[type].push(...list.filter((item) => !definitionIndex.has(item)));
		}
	}

	return definitions;
};

export default apply;
