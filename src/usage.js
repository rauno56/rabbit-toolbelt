import { inspect } from 'util';
import * as nodeAssert from 'node:assert/strict';

import C from './config.js';
import Index from './Index.js';
import failureCollector from './failureCollector.js';

const formatPercentage = (ratio) => {
	return `${(100 * ratio).toFixed(1)}%`;
};

const assertUsage = (definitions, usageStats, throwOnFirstError = false) => {
	nodeAssert.ok(definitions && typeof definitions, 'object');
	nodeAssert.ok(Array.isArray(usageStats), `Expected array as usage stats. Got: ${inspect(usageStats)}`);

	const assert = failureCollector(throwOnFirstError);
	// collect failures but ignore issues for compiling usage failures
	const index = Index.fromDefinitions(definitions, false);

	// Check resources that are used, but missing from definitions
	// Likely to be temporary resources.
	for (const u of usageStats) {
		const vhost = u.vhost;
		if (u.exchange) {
			if (!index.exchange.get({ vhost, name: u.exchange })) {
				console.warn(`Warning: Used but missing exchange "${u.exchange}"" in "${vhost}"`);
			}
			if (!index.queue.get({ vhost, name: u.queue })) {
				console.warn(`Warning: Used but missing queue "${u.queue}"" in "${vhost}"`);
			}
		} else if (u.queue) {
			if (!index.queue.get({ vhost, name: u.queue })) {
				console.warn(`Warning: Used but missing queue "${u.queue}"" in "${vhost}"`);
			}
		} else {
			throw new Error('Unexpected usage record type');
		}
	}

	const exchangeSizeBefore = index.exchange.size;
	const queueSizeBefore = index.queue.size;
	const vhostSizeBefore = index.vhost.size;

	for (const u of usageStats) {
		const vhost = u.vhost;
		index.vhost.delete({ name: vhost });
		if (u.exchange) {
			index.exchange.delete({ vhost, name: u.exchange });
			index.queue.delete({ vhost, name: u.queue });
		} else if (u.queue) {
			index.queue.delete({ vhost, name: u.queue });
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
		assert.ok(vhostRatio < C.unusedFailureThreshold.vhost, `High ratio of unused vhosts: ${formatPercentage(vhostRatio)}`);
	}

	const exchangeUnused = index.exchange.all();
	if (exchangeSizeBefore && exchangeUnused.length) {
		for (const i of exchangeUnused) {
			console.warn(`Warning: Empirically unused exchange "${i.name}" in "${i.vhost}"`);
		}
		const exchangeRatio = exchangeUnused.length / exchangeSizeBefore;
		assert.ok(exchangeRatio < C.unusedFailureThreshold.exchange, `High ratio of unused exchanges: ${formatPercentage(exchangeRatio)}`);
	}

	const queueUnused = index.queue.all();
	if (queueSizeBefore && queueUnused.length) {
		for (const i of queueUnused) {
			console.warn(`Warning: Empirically unused queue "${i.name}" in "${i.vhost}"`);
		}
		const queueRatio = queueUnused.length / queueSizeBefore;
		assert.ok(queueRatio < C.unusedFailureThreshold.queue, `High ratio of unused queues: ${formatPercentage(queueRatio)}`);
	}

	return assert.collectFailures();
};

export const validateUsage = (def, stats) => assertUsage(def, stats);

export default assertUsage;
