import { inspect } from 'util';
import * as nodeAssert from 'node:assert/strict';

import Index from './Index.js';
import failureCollector from './failureCollector.js';

const formatPercentage = (ratio) => {
	return `${(100 * ratio).toFixed(1)}%`;
};

const assertUsage = (definitions, usageStats, throwOnFirstError = false) => {
	nodeAssert.ok(definitions && typeof definitions, 'object');
	nodeAssert.ok(Array.isArray(usageStats), `Expected array as usage stats. Got: ${inspect(usageStats)}`);

	const assert = failureCollector(throwOnFirstError);
	const index = new Index();
	// collect failures but ignore issues for compiling usage failures
	index.build(definitions, false);

	// Check resources that are used, but missing from definitions
	// Likely to be temporary resources.
	for (const u of usageStats) {
		const vhost = u.vhost;
		if (u.exchange) {
			if (!index.exchange.get(u.exchange, vhost)) {
				console.warn(`Warning: Used but missing exchange "${u.exchange}"" in "${vhost}"`);
			}
			if (!index.queue.get(u.queue, vhost)) {
				console.warn(`Warning: Used but missing queue "${u.queue}"" in "${vhost}"`);
			}
		} else if (u.queue) {
			if (!index.queue.get(u.queue, vhost)) {
				console.warn(`Warning: Used but missing queue "${u.queue}"" in "${vhost}"`);
			}
		} else {
			throw new Error('Unexpected usage record type');
		}
	}

	const exchangeSizeBefore = index.exchange.count();
	const queueSizeBefore = index.queue.count();
	const vhostSizeBefore = index.vhost.count();

	for (const u of usageStats) {
		const vhost = u.vhost;
		index.vhost.delete(vhost);
		if (u.exchange) {
			index.exchange.delete(u.exchange, vhost);
			index.queue.delete(u.queue, vhost);
		} else if (u.queue) {
			index.queue.delete(u.queue, vhost);
		} else {
			throw new Error('Unexpected usage record type');
		}
	}

	const vhostUnused = index.vhost.all();
	if (vhostSizeBefore > 1 && vhostUnused.length) {
		for (const i of vhostUnused) {
			console.warn(`Warning: Empirically unused vhost "${i.name}"`);
		}
		const vhostRatio = vhostUnused.length / vhostSizeBefore;
		assert.ok(vhostRatio < 0.3, `High ratio of unused vhosts: ${formatPercentage(vhostRatio)}`);
	}

	const exchangeUnused = index.exchange.all();
	if (exchangeSizeBefore && exchangeUnused.length) {
		for (const i of exchangeUnused) {
			console.warn(`Warning: Empirically unused exchange "${i.name}" in "${i.vhost}"`);
		}
		const exchangeRatio = exchangeUnused.length / exchangeSizeBefore;
		assert.ok(exchangeRatio < 0.3, `High ratio of unused exchanges: ${formatPercentage(exchangeRatio)}`);
	}

	const queueUnused = index.queue.all();
	if (queueSizeBefore && queueUnused.length) {
		for (const i of queueUnused) {
			console.warn(`Warning: Empirically unused queue "${i.name}" in "${i.vhost}"`);
		}
		const queueRatio = queueUnused.length / queueSizeBefore;
		assert.ok(queueRatio < 0.3, `High ratio of unused queues: ${formatPercentage(queueRatio)}`);
	}

	return assert.collectFailures();
};

export const validateUsage = (def, stats) => assertUsage(def, stats);

export default assertUsage;
