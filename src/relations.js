import * as nodeAssert from 'node:assert/strict';

import Index, { detectResourceType } from './Index.js';
import failureCollector from './failureCollector.js';

export const singular = {
	vhosts: 'vhost',
	queues: 'queue',
	exchanges: 'exchange',
	bindings: 'binding',
	users: 'user',
	permissions: 'permission',
	topic_permissions: 'topic permission',
	args: 'args',
};

const formatResource = (resource) => {
	const type = detectResourceType(resource);
	if (type === 'topic_permissions') {
		return `topic permission for "${resource.user}"`;
	}
	if (type === 'permissions') {
		return `permission for "${resource.user}"`;
	}
	if (type === 'bindings') {
		return `binding from "${resource.source}" to ${resource.destination_type} "${resource.destination}"`;
	}
	return `${singular[type]} "${resource.name}"`;
};

const assertRelations = (definitions, throwOnFirstError = true) => {
	nodeAssert.ok(definitions && typeof definitions, 'object');

	const assert = failureCollector(throwOnFirstError);
	const index = new Index();
	const indexingFailures = index.build(definitions, throwOnFirstError);

	// test whether vhost is used anywhere
	for (const vhost of definitions.vhosts) {
		if (!index.resource.byVhost.get(vhost.name)) {
			if (vhost.name) {
				console.warn(`Warning: Unused vhost "${vhost.name}"`);
			}
		}
	}

	// test whether queue is used anywhere: ? -> Q
	for (const queue of definitions.queues) {
		if (!index.binding.byDestination(queue)) {
			if (queue.name && queue.vhost) {
				console.warn(`Warning: Unbound queue "${queue.name}" in vhost "${queue.vhost}"`);
			}
		}
	}

	// test whether exchange is used anywhere: EX -> ? or ? -> EX
	for (const exchange of definitions.exchanges) {
		if (!index.binding.bySource(exchange) && !index.binding.byDestination(exchange)) {
			if (exchange.name && exchange.vhost) {
				console.warn(`Warning: Unbound exchange "${exchange.name}" in vhost "${exchange.vhost}"`);
			}
		}
	}

	// TODO: test this
	// test if used vhosts exist
	for (const [vhost, res] of index.resource.byVhost.entries()) {
		assert.ok(index.vhost.get({ name: vhost }), `Missing vhost "${vhost}" used by ${formatResource(res[0])}${res.length > 1 ? ` and ${res.length - 1} other(s)` : ''}`);
	}

	// TODO: test this
	for (const [/* key */, permission] of index.topicPermission) {
		const { vhost, exchange: exchangeName, user } = permission;
		if (exchangeName !== '') {
			assert.ok(index.exchange.get({ vhost, name: exchangeName }), `Missing exchange "${exchangeName}" in vhost "${vhost}" used by topic permission for "${user}"`);
		}
		assert.ok(index.user.get({ name: user }), `Missing user "${user}" used by topic permission for exchange "${exchangeName}"`);
	}

	// TODO: test this
	for (const [/* key */, permission] of index.permission) {
		const { vhost, user } = permission;
		assert.ok(index.user.get({ name: user }), `Missing user "${user}" that has permissions set for vhost "${vhost}"`);
	}

	return [...indexingFailures, ...assert.collectFailures()];
};

export const validateRelations = (def) => assertRelations(def, false);

export default assertRelations;
