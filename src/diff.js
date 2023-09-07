import { inspect, isDeepStrictEqual } from 'util';

import { assertRootStructure } from './structure.js';
import Index, { key } from './Index.js';

inspect.defaultOptions.depth++;

const diffMapsConsuming = (before, after) => {
	const added = [];
	const deleted = [];
	const changed = [];

	for (const afterItem of after.all()) {
		const beforeItem = before.getByKey(key.resource(afterItem));
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
	assertRootStructure(beforeDef);
	assertRootStructure(afterDef);

	const before = Index.fromDefinitions(beforeDef);
	const after = Index.fromDefinitions(afterDef);

	const added = { vhosts: [], queues: [], exchanges: [], bindings: [] };
	const deleted = { vhosts: [], queues: [], exchanges: [], bindings: [] };
	const changed = { vhosts: [], queues: [], exchanges: [], bindings: [] };

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

	return {
		added,
		deleted,
		changed,
	};
};

export default diff;