import * as nodeAssert from 'node:assert/strict';

import failureCollector from './failureCollector.js';

const assertStr = (str, key) => nodeAssert.equal(typeof str, 'string', `Expected ${key ? ('"' + key + '" ') : ''}to be string: ${str}`);
const assertObj = (obj) => nodeAssert.equal(obj && typeof obj, 'object', `Expected to be object: ${obj}`);

const pushToMapOfArrays = (map, key, item) => {
	let array = map.get(key);
	if (!array) {
		map.set(key, [item]);
	} else {
		array.push(item);
	}
};

// A quick index to be able to quickly see which resources we've seen without the need to iterate through all
// of them every time.
class Index {
	constructor() {
		const db = {
			// queues: vhost.name -> Q
			queue: new Map(),
			// exchanges: vhost.name -> EX
			exchange: new Map(),
			// vhosts: vhost.name -> vhost
			vhost: new Map(),
			// EX/Q: vhost.name -> EX/Q
			resourceByVhost: new Map(),
			// bindings: source -> destination -> args
			binding: new Map(),
			// bindings: destination -> [source]
			bindingByDestination: new Map(),
		};

		const maps = {
			vhost: {
				get(name) { return db.vhost.get(name); },
				has(name) { return db.vhost.has(name); },
				delete(name) { return db.vhost.delete(name); },
				set(name, item) { return db.vhost.set(name, item); },
			},
			queue: {
				get(name, vhost) { assertStr(name, 'name'); assertStr(vhost, 'vhost'); return db.queue.get([name, vhost].join(' @ ')); },
				has(name, vhost) { assertStr(name, 'name'); assertStr(vhost, 'vhost'); return db.queue.has([name, vhost].join(' @ ')); },
				delete(name, vhost) { assertStr(name, 'name'); assertStr(vhost, 'vhost'); return db.queue.delete([name, vhost].join(' @ ')); },
				set(name, vhost, item) {
					pushToMapOfArrays(db.resourceByVhost, vhost, item);
					return db.queue.set([name, vhost].join(' @ '), item);
				},
			},
			exchange: {
				get(name, vhost) { assertStr(name, 'name'); assertStr(vhost, 'vhost'); return db.exchange.get([name, vhost].join(' @ ')); },
				has(name, vhost) { assertStr(name, 'name'); assertStr(vhost, 'vhost'); return db.exchange.has([name, vhost].join(' @ ')); },
				delete(name, vhost) { assertStr(name, 'name'); assertStr(vhost, 'vhost'); return db.exchange.delete([name, vhost].join(' @ ')); },
				set(name, vhost, item) {
					pushToMapOfArrays(db.resourceByVhost, vhost, item);
					return db.exchange.set([name, vhost].join(' @ '), item);
				},
			},
			binding: {
				get(from, to, args) { assertObj(from); assertObj(to); return db.binding.get(from)?.get(to)?.get(args) ?? false; },
				has(from, to, args) { assertObj(from); assertObj(to); return db.binding.get(from)?.get(to)?.get(args) ?? false; },
				delete(from, to, args) { assertObj(from); assertObj(to); return db.binding.get(from)?.get(to)?.delete(args); },
				set(from, to, args, item) {
					assertObj(from);
					assertObj(to);
					assertObj(item);
					let fromMap = db.binding.get(from);
					if (!fromMap) {
						fromMap = new Map();
						db.binding.set(from, fromMap);
					}
					let toMap = fromMap.get(to);
					if (!toMap) {
						toMap = new Map();
						fromMap.set(to, toMap);
					}
					pushToMapOfArrays(db.bindingByDestination, to, item);
					return toMap.set(args, item);
				},
			},
		};

		this.maps = maps;
		this.db = db;
	}

	build(definitions, throwOnFirstError = true) {
		nodeAssert.ok(definitions && typeof definitions, 'object');

		const assert = failureCollector(throwOnFirstError);

		for (const vhost of definitions.vhosts) {
			if (!vhost.name) {
				// will not report failure because it's probably already caught
				continue;
			}
			assert.ok(!this.maps.vhost.get(vhost.name), `Duplicate vhost: "${vhost.name}"`);
			this.maps.vhost.set(vhost.name, vhost);
		}

		for (const queue of definitions.queues) {
			if (!queue.name || !queue.vhost) {
				// will not report failure because it's probably already caught
				continue;
			}
			assert.ok(!this.maps.queue.get(queue.name, queue.vhost), `Duplicate queue: "${queue.name}" in vhost "${queue.vhost}"`);
			this.maps.queue.set(queue.name, queue.vhost, queue);
		}

		for (const exchange of definitions.exchanges) {
			if (!exchange.name || !exchange.vhost) {
				// will not report failure because it's probably already caught
				continue;
			}
			assert.ok(!this.maps.exchange.get(exchange.name, exchange.vhost), `Duplicate exchange: "${exchange.name}" in vhost "${exchange.vhost}"`);
			this.maps.exchange.set(exchange.name, exchange.vhost, exchange);
		}

		for (const binding of definitions.bindings) {
			const { vhost } = binding;
			const from = this.maps.exchange.get(binding.source, vhost);
			assert.ok(from, `Missing source exchange for binding: "${binding.source}" in vhost "${vhost}"`);

			const to = this.maps[binding.destination_type].get(binding.destination, vhost);
			assert.ok(to, `Missing destination ${binding.destination_type} for binding: "${binding.destination}" in vhost "${vhost}"`);

			if (from) {
				let args = undefined;
				if (from.type === 'headers') {
					// TODO: TEST THIS
					assert.ok(!binding.routing_key, `Routing key is ignored for header exchanges, but set("${binding.routing_key}") for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
					args = binding.arguments;
				} else if (from.type === 'topic') {
					// TODO: TEST THIS
					assert.equal(binding.arguments['x-match'], undefined, `Match arguments are ignored for topic exchanges, but set for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
					args = binding.routing_key;
				} else if (from.type === 'direct') {
					// TODO: TEST THIS
					assert.equal(binding.arguments['x-match'], undefined, `Match arguments are ignored for direct exchanges, but set for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
					args = binding.routing_key;
				} else {
					assert.fail(`Unexpected binding type: ${from.type}`);
				}

				if (to) {
					assert.ok(!this.maps.binding.get(from, to, args), `Duplicate binding from "${binding.source}" to ${binding.destination_type} "${binding.destination}" in vhost "${binding.vhost}"`);
					this.maps.binding.set(from, to, args, binding);
				}
			}
		}

		return assert.collectFailures();
	}
}

export default Index;
