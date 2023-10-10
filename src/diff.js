import assert from 'assert/strict';
import { isDeepStrictEqual, inspect } from 'util';

import Index from './Index.js';
import HashSet from './HashSet.js';

const diffMapsConsuming = (before, after) => {
	const added = [];
	const deleted = [];
	const changed = [];

	assert.ok(before instanceof HashSet, `Invalid before state: ${inspect(before)}`);
	assert.ok(after instanceof HashSet, `Invalid after state: ${inspect(after)}`);

	for (const afterItem of after.values()) {
		const beforeItem = before.get(afterItem);
		after.delete(afterItem);
		before.delete(afterItem);
		if (beforeItem === undefined) {
			added.push(afterItem);
		} else if (!isDeepStrictEqual(beforeItem, afterItem)) {
			changed.push({ before: beforeItem, after: afterItem });
		}
	}
	for (const beforeItem of before.values()) {
		before.delete(beforeItem);
		deleted.push(beforeItem);
	}

	return {
		added,
		deleted,
		changed,
	};
};

const makeChangeMap = () => {
	return {
		vhosts: [],
		queues: [],
		exchanges: [],
		bindings: [],
		users: [],
		permissions: [],
		topicPermissions: [],
	};
};

const diff = (beforeDef, afterDef) => {
	const before = Index.fromDefinitions(beforeDef, false);
	const after = Index.fromDefinitions(afterDef, false);

	const added = makeChangeMap();
	const deleted = makeChangeMap();
	const changed = makeChangeMap();

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
	collectDiff('permissions', before.permission, after.permission);
	collectDiff('topicPermissions', before.topicPermission, after.topicPermission);

	return {
		added,
		deleted,
		changed,
	};
};

export default diff;
