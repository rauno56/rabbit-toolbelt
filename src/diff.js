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
		topic_permissions: [],
	};
};

const diff = (beforeDef, afterDef, ignoreList = null) => {
	const ignoreIndex = Array.isArray(ignoreList) && ignoreList.length ? Index.fromIgnoreList(ignoreList) : null;
	const before = Index.fromDefinitions(beforeDef, false, ignoreIndex);
	const after = Index.fromDefinitions(afterDef, false, ignoreIndex);

	const added = makeChangeMap();
	const deleted = makeChangeMap();
	const changed = makeChangeMap();

	const collectDiff = (key, beforeMap, afterMap) => {
		const changes = diffMapsConsuming(beforeMap, afterMap);
		added[key].push(...changes.added);
		deleted[key].push(...changes.deleted);
		changed[key].push(...changes.changed);
	};

	collectDiff('vhosts', before.vhosts, after.vhosts);
	collectDiff('queues', before.queues, after.queues);
	collectDiff('exchanges', before.exchanges, after.exchanges);
	collectDiff('bindings', before.bindings, after.bindings);
	collectDiff('users', before.users, after.users);
	collectDiff('permissions', before.permissions, after.permissions);
	collectDiff('topic_permissions', before.topic_permissions, after.topic_permissions);

	return {
		added,
		deleted,
		changed,
	};
};

export default diff;
