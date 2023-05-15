import { inspect } from 'util';
import * as nodeAssert from 'node:assert/strict';

import Index from './Index.js';
import failureCollector from './failureCollector.js';

const formatPercentage = (ratio) => {
	return `${(100 * ratio).toFixed(1)}%`;
};

const assertUsage = (definitions, usageStats) => {
	nodeAssert.ok(definitions && typeof definitions, 'object');
	nodeAssert.ok(Array.isArray(usageStats), `Expected array as usage stats. Got: ${inspect(usageStats)}`);

	const assert = failureCollector(false);
	const index = new Index();
	// collect failures but ignore issues for compiling usage failures
	index.build(definitions, true);

	// Check resources that are used, but missing from definitions
	// Likely to be temporary resources.
	for (const u of usageStats) {
		const vhost = u.vhost;
		if (u.exchange) {
			if (!index.maps.exchange.has(u.exchange, vhost)) {
				console.warn(`Warning: Used but missing exchange "${u.exchange}"" in "${vhost}"`);
			}
			if (!index.maps.queue.has(u.queue, vhost)) {
				console.warn(`Warning: Used but missing queue "${u.queue}"" in "${vhost}"`);
			}
		} else if (u.queue) {
			if (!index.maps.queue.has(u.queue, vhost)) {
				console.warn(`Warning: Used but missing queue "${u.queue}"" in "${vhost}"`);
			}
		} else {
			throw new Error('Unexpected usage record type');
		}
	}

	const exchangeSizeBefore = index.db.exchange.size;
	const queueSizeBefore = index.db.queue.size;
	const vhostSizeBefore = index.db.vhost.size;

	for (const u of usageStats) {
		const vhost = u.vhost;
		index.maps.vhost.delete(vhost);
		if (u.exchange) {
			index.maps.exchange.delete(u.exchange, vhost);
			index.maps.queue.delete(u.queue, vhost);
		} else if (u.queue) {
			index.maps.queue.delete(u.queue, vhost);
		} else {
			throw new Error('Unexpected usage record type');
		}
	}

	const vhostUnused = [...index.db.vhost.values()];
	if (vhostSizeBefore > 1 && vhostUnused.length) {
		for (const i of vhostUnused) {
			assert.fail(`Empirically unused vhost: ${i.name}`);
		}
		const vhostRatio = vhostUnused.length / vhostSizeBefore;
		assert.ok(vhostRatio < 0.3, `High ratio of unused vhost resources: ${formatPercentage(vhostRatio)}`);
	}

	const exchangeUnused = [...index.db.exchange.values()];
	if (exchangeSizeBefore && exchangeUnused.length) {
		for (const i of exchangeUnused) {
			assert.fail(`Empirically unused exchange: "${i.name}" in "${i.vhost}"`);
		}
		const exchangeRatio = exchangeUnused.length / exchangeSizeBefore;
		assert.ok(exchangeRatio < 0.3, `High ratio of unused exchange resources: ${formatPercentage(exchangeRatio)}`);
	}

	const queueUnused = [...index.db.queue.values()];
	if (queueSizeBefore && queueUnused.length) {
		for (const i of queueUnused) {
			assert.fail(`Empirically unused queue: "${i.name}" in "${i.vhost}"`);
		}
		const queueRatio = queueUnused.length / queueSizeBefore;
		assert.ok(queueRatio < 0.3, `High ratio of unused queue resources: ${formatPercentage(queueRatio)}`);
	}

	return assert.collectFailures();
};

export const validateUsage = (def, stats) => assertUsage(def, stats);

export default assertUsage;
