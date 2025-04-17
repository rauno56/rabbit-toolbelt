import assert from 'node:assert/strict';
import { isDeepStrictEqual, inspect } from 'node:util';

import Index from './Index.js';
import HashSet from './HashSet.js';

const isVhostEqual = (a, b) => {
	if (!!a !== !!b) {
		return false;
	}
	if (a.name !== b.name) {
		return false;
	}
	if (!isDeepStrictEqual(a.tags || [], b.tags || [])) {
		return false;
	}
	if ((a.description || '') !== (b.description || '')) {
		return false;
	}
	if ((a.default_queue_type || 'undefined') !== (b.default_queue_type || 'undefined')) {
		return false;
	}
	return true;
};

const diffMapsConsuming = (before, after, isEqual = isDeepStrictEqual) => {
	const added = [];
	const deleted = [];
	const changed = [];
	const unaffected = [];

	assert.ok(before instanceof HashSet, `Invalid before state: ${inspect(before)}`);
	assert.ok(after instanceof HashSet, `Invalid after state: ${inspect(after)}`);

	for (const afterItem of after.values()) {
		const beforeItem = before.get(afterItem);
		after.delete(afterItem);
		before.delete(afterItem);
		if (beforeItem === undefined) {
			added.push(afterItem);
		} else if (!isEqual(beforeItem, afterItem)) {
			changed.push({ before: beforeItem, after: afterItem });
		} else {
			unaffected.push(afterItem);
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
		unaffected,
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

	const beforeVersion = before.getVersion();
	const afterVersion = after.getVersion();
	if (beforeVersion !== afterVersion) {
		console.warn(`Version in before(${beforeVersion}) different from after(${afterVersion}).`);
	}

	const added = makeChangeMap();
	const deleted = makeChangeMap();
	const changed = makeChangeMap();
	const unaffected = makeChangeMap();

	const collectDiff = (key, beforeMap, afterMap, isEqual = isDeepStrictEqual) => {
		const changes = diffMapsConsuming(beforeMap, afterMap, isEqual);
		added[key].push(...changes.added);
		deleted[key].push(...changes.deleted);
		changed[key].push(...changes.changed);
		unaffected[key].push(...changes.unaffected);
	};

	collectDiff('vhosts', before.vhosts, after.vhosts, isVhostEqual);
	collectDiff('queues', before.queues, after.queues);
	collectDiff('exchanges', before.exchanges, after.exchanges);
	collectDiff('bindings', before.bindings, after.bindings);
	// bindings will be deleted implicitly when exchanges or queues are changed(deleted and recreated)
	const implicitlyAffectedBindings = unaffected.bindings.filter(({ vhost, source, destination, destination_type }) => {
		// at least source is always a EX so have to iterate over those anyway
		for (const { before: ex } of changed.exchanges) {
			if (ex.vhost === vhost) {
				if (ex.name === source || (destination_type === 'exchange' && ex.name === destination)) {
					return true;
				}
			}
		}
		// short circuit if destination is not a queue
		if (destination_type !== 'queue') {
			return false;
		}
		for (const { before: q } of changed.queues) {
			if (q.vhost === vhost) {
				if (q.name === destination && destination_type === 'queue') {
					return true;
				}
			}

		}
		return false;
	});
	collectDiff('users', before.users, after.users);
	collectDiff('permissions', before.permissions, after.permissions);
	collectDiff('topic_permissions', before.topic_permissions, after.topic_permissions);

	return {
		added,
		deleted,
		changed,
		implicitlyAffected: {
			bindings: implicitlyAffectedBindings,
		},
	};
};

export default diff;
