import * as nodeAssert from 'node:assert/strict';
import Failure from './Failure.js';
import { SOURCE_SYM } from './Index.js';

const compileSourceComment = (pItem, item) => {
	if (pItem[SOURCE_SYM] && item[SOURCE_SYM]) {
		return ` (previously defined in ${pItem[SOURCE_SYM]}, now in ${item[SOURCE_SYM]})`;
	}
	return '';
};

export default (throwOnFirstError = true) => {
	const failures = new Map();
	const assert = {
		collectFailures: () => {
			return [...failures.values()];
		},
	};
	const defineAssert = (method) => {
		if (throwOnFirstError) {
			return assert[method] = nodeAssert[method];
		}
		return assert[method] = (...args) => {
			try {
				nodeAssert[method](...args);
				return true;
			} catch (err) {
				// deduplicating all the "duplicate X" failures
				const failure = new Failure({ message: err.message, stack: err.stack });
				failures.set(failure.message, failure);
				return false;
			}
		};
	};

	defineAssert('ok');
	defineAssert('fail');
	defineAssert('equal');

	assert.unique = {
		users: (index, item) => {
			const { name } = item;
			const pItem = index.users.get(item);
			if (!pItem) { return; }
			throw new Error(
				`Duplicate user: "${name}"${compileSourceComment(pItem, item)}`
			);
		},
		vhosts: (index, item) => {
			const pItem = index.vhosts.get(item);
			if (!pItem) { return; }
			throw new Error(
				`Duplicate vhost: "${item.name}"${compileSourceComment(pItem, item)}`
			);
		},
		permissions: (index, item) => {
			const { user, vhost } = item;
			const pItem = index.permissions.get(item);
			if (!pItem) { return; }
			throw new Error(
				`Duplicate permission for user "${user}" in vhost "${vhost}"${compileSourceComment(pItem, item)}`
			);
		},
		topic_permissions: (index, item) => {
			const { user, vhost } = item;
			const pItem = index.topic_permissions.get(item);
			if (!pItem) { return; }
			throw new Error(
				`Duplicate topic permission for user "${user}" in vhost "${vhost}${compileSourceComment(pItem, item)}.\n${JSON.stringify(item)}\n${JSON.stringify(pItem)}"`
			);
		},
		parameters: (index, item) => {
			const pItem = index.parameters.get(item);
			if (!pItem) { return; }
			throw new Error(
				`Duplicate parameter for ${item.name} of component ${item.component} in vhost ${item.vhost}${compileSourceComment(pItem, item)}`
			);
		},
		global_parameters: (index, item) => {
			const pItem = index.global_parameters.get(item);
			if (!pItem) { return; }
			throw new Error(
				`Duplicate global parameter for ${item.name}${compileSourceComment(pItem, item)}`
			);
		},
		policies: (index, item) => {
			const pItem = index.policies.get(item);
			if (!pItem) { return; }
			throw new Error(
				`Duplicate policy ${item.name} for vhost ${item.vhost}${compileSourceComment(pItem, item)}`
			);
		},
		queues: (index, item) => {
			const pItem = index.queues.get(item);
			if (!pItem) { return; }
			throw new Error(
				`Duplicate queue: "${item.name}" in vhost "${item.vhost}"${compileSourceComment(pItem, item)}`
			);
		},
		exchanges: (index, item) => {
			const pItem = index.exchanges.get(item);
			if (!pItem) { return; }
			throw new Error(
				`Duplicate exchange: "${item.name}" in vhost "${item.vhost}"${compileSourceComment(pItem, item)}`
			);
		},
		bindings: (index, item) => {
			const pItem = index.bindings.get(item);
			if (!pItem) { return; }
			throw new Error(
				`Duplicate binding from "${item.source}" to ${item.destination_type} "${item.destination}" in vhost "${item.vhost}"${compileSourceComment(pItem, item)}`
			);
		},
	};

	return assert;
};
