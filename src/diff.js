import assert from 'assert/strict';
import { isDeepStrictEqual, inspect } from 'util';

import Index, { key } from './Index.js';

const diffMapsConsuming = (before, after) => {
	const added = [];
	const deleted = [];
	const changed = [];

	assert.equal(typeof before?.all, 'function', `Invalid before state: ${inspect(before)}`);
	assert.equal(typeof after?.all, 'function', `Invalid after state: ${inspect(after)}`);

	for (const afterItem of after.all()) {
		const beforeItem = before.getByHash(key.resource(afterItem));
		after.remove(afterItem);
		before.remove(afterItem);
		if (beforeItem === undefined) {
			added.push(afterItem);
		} else if (!isDeepStrictEqual(beforeItem, afterItem)) {
			changed.push({ before: beforeItem, after: afterItem });
		}
	}
	for (const beforeItem of before.all()) {
		before.remove(beforeItem);
		deleted.push(beforeItem);
	}

	return {
		added,
		deleted,
		changed,
	};
};

const diff = (beforeDef, afterDef) => {
	const before = Index.fromDefinitions(beforeDef, false);
	const after = Index.fromDefinitions(afterDef, false);

	const added = { vhosts: [], queues: [], exchanges: [], bindings: [], users: [] };
	const deleted = { vhosts: [], queues: [], exchanges: [], bindings: [], users: [] };
	const changed = { vhosts: [], queues: [], exchanges: [], bindings: [], users: [] };

	const collectDiff = (key, beforeMap, afterMap) => {
		const changes = diffMapsConsuming(beforeMap, afterMap);
		added[key].push(...changes.added);
		deleted[key].push(...changes.deleted);
		changed[key].push(...changes.changed);
	};

	collectDiff('vhosts', before.vhost, after.vhost);
	collectDiff('queues', before.queue, after.queue);
	collectDiff('exchanges', before.exchange, after.exchange);
	collectDiff('bindings', before.binding, after.binding);
	collectDiff('users', before.user, after.user);

	return {
		added,
		deleted,
		changed,
	};
};

export default diff;
