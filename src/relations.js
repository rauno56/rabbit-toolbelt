import * as nodeAssert from 'node:assert/strict';

import Index from './Index.js';
import failureCollector from './failureCollector.js';

const formatResource = (resource) => {
	if (resource.type) {
		return `exchange "${resource.name}"`;
	}
	return `queue "${resource.name}"`;
};

const assertRelations = (definitions, throwOnFirstError = true) => {
	nodeAssert.ok(definitions && typeof definitions, 'object');

	const assert = failureCollector(throwOnFirstError);
	const index = new Index();
	const failures = index.build(definitions, throwOnFirstError);

	// test whether vhost is used anywhere
	for (const vhost of definitions.vhosts) {
		if (!index.db.resourceByVhost.get(vhost.name)) {
			if (vhost.name) {
				console.warn(`Unused vhost: "${vhost.name}"`);
			}
		}
	}

	// test whether queue is used anywhere: ? -> Q
	for (const queue of definitions.queues) {
		if (!index.db.bindingByDestination.get(queue)) {
			if (queue.name && queue.vhost) {
				console.warn(`Unbound queue: "${queue.name}" in vhost "${queue.vhost}"`);
			}
		}
	}

	// test whether exchange is used anywhere: EX -> ? or ? -> EX
	for (const exchange of definitions.exchanges) {
		if (!index.db.binding.get(exchange) && !index.db.bindingByDestination.get(exchange)) {
			if (exchange.name && exchange.vhost) {
				console.warn(`Unbound exchange: "${exchange.name}" in vhost "${exchange.vhost}"`);
			}
		}
	}

	for (const [vhost, res] of index.db.resourceByVhost.entries()) {
		assert.ok(index.maps.vhost.get(vhost), `Missing vhost "${vhost}" used by ${formatResource(res[0])}`);
	}
	// TODO: fail if anything references a missing vhost

	return failures;
};

export const validateRelations = (def) => assertRelations(def, false);

export default assertRelations;
