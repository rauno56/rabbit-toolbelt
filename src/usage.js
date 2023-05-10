import { inspect } from 'util';
import * as nodeAssert from 'node:assert/strict';

import Index from './Index.js';

const formatPercentage = (count, total) => {
	return `${(100 * count / total).toFixed(1)}%`;
};

const assertUsage = (definitions, usageStats) => {
	nodeAssert.ok(definitions && typeof definitions, 'object');
	nodeAssert.ok(Array.isArray(usageStats), `Expected array as usage stats. Got: ${inspect(usageStats)}`);

	const index = new Index();
	// collect failures but ignore issues for compiling usage failures
	index.build(definitions, true);
	const failures = [];

	for (const u of usageStats) {
		const vhost = u.vhost;
		if (u.exchange) {
			if (!index.maps.exchange.has(u.exchange, vhost)) {
				console.error('used but missing', 'E', vhost, u.exchange);
			}
			if (!index.maps.queue.has(u.queue, vhost)) {
				console.error('used but missing', 'Q', vhost, u.queue);
			}
		} else if (u.queue) {
			if (!index.maps.queue.has(u.queue, vhost)) {
				console.error('used but missing', 'Q', vhost, u.queue);
			}
		} else {
			console.log('rest', u);
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
			console.log('rest', u);
		}
	}

	console.log('# vhosts');
	for (const i of index.db.vhost.values()) {
		console.log('empirically unused', 'V', i.name);
	}
	console.log('Unused ratio', formatPercentage([...index.db.vhost.values()].length, vhostSizeBefore));

	console.log('# Exchanges');
	for (const i of index.db.exchange.values()) {
		console.log('empirically unused', 'E', i.vhost, i.name);
	}
	console.log('Unused ratio', formatPercentage([...index.db.exchange.values()].length, exchangeSizeBefore));

	console.log('# Queues');
	for (const i of index.db.queue.values()) {
		console.log('empirically unused', 'Q', i.vhost, i.name);
	}
	console.log('Unused ratio', formatPercentage([...index.db.queue.values()].length, queueSizeBefore));

	return failures;
};

export const validateUsage = (def, stats) => assertUsage(def, stats);

export default assertUsage;
