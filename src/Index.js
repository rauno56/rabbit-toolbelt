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

export const key = {
	resource: (resource) => {
		if (typeof resource.destination_type === 'string') {
			return key.binding(resource);
		}
		if (typeof resource.type === 'string') {
			return key.exchange(resource);
		}
		if (typeof resource.vhost === 'string') {
			return key.queue(resource);
		}
		if (typeof resource.name === 'string') {
			return key.vhost(resource);
		}
		const err = new Error('Invalid resource');
		err.context = resource;
		throw err;
	},
	vhost: ({ name }) => `${name}`,
	queue: ({ name, vhost }) => `Q[${name} @ ${vhost}]`,
	exchange: ({ name, vhost }) => `E[${name} @ ${vhost}]`,
	binding: ({ vhost, source, destination_type, destination, routing_key, arguments: args }) => `B[${source}->${destination_type}.${destination} @ ${vhost}](${routing_key}/${key.args(args)})`,
	args: (args) => {
		return Object.entries(args ?? {}).sort(([a], [b]) => a < b ? -1 : 1).map((p) => p.join('=')).join();
	},
};

// A quick index to be able to quickly see which resources we've seen without the need to iterate through all
// of them every time.
class Index {
	vhost = null;
	queue = null;
	exchange = null;
	binding = null;

	static fromDefinitions(definitions, throwOnFirstError) {
		const index = new Index();
		index.build(definitions, throwOnFirstError);

		return index;
	}

	constructor() {
		this.init();
	}

	init() {
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
			// bindings: {resource} -> binding[]
			bindingByDestination: new Map(),
			// bindings: {resource} -> binding[]
			bindingBySource: new Map(),
		};

		const maps = {
			vhost: {
				count() { return db.vhost.size; },
				all() { return [...db.vhost.values()]; },
				getByKey(key) { return db.vhost.get(key); },
				get(name) { return db.vhost.get(name); },
				delete(name) { return db.vhost.delete(name); },
				remove(item) { return db.vhost.delete(key.vhost(item)); },
				set(name, item) { return db.vhost.set(name, item); },
			},
			queue: {
				count() { return db.queue.size; },
				all() { return [...db.queue.values()]; },
				getByKey(key) { return db.queue.get(key); },
				get(name, vhost) {
					assertStr(name, 'name');
					assertStr(vhost, 'vhost');
					return db.queue.get(key.queue({ name, vhost }));
				},
				delete(name, vhost) {
					assertStr(name, 'name');
					assertStr(vhost, 'vhost');
					return db.queue.delete(key.queue({ name, vhost }));
				},
				remove(item) { return db.queue.delete(key.queue(item)); },
				set(name, vhost, item) {
					pushToMapOfArrays(db.resourceByVhost, vhost, item);
					return db.queue.set(key.queue({ name, vhost }), item);
				},
			},
			exchange: {
				count() { return db.exchange.size; },
				all() { return [...db.exchange.values()]; },
				getByKey(key) { return db.exchange.get(key); },
				get(name, vhost) {
					assertStr(name, 'name');
					assertStr(vhost, 'vhost');
					return db.exchange.get(key.exchange({ name, vhost }));
				},
				delete(name, vhost) {
					assertStr(name, 'name');
					assertStr(vhost, 'vhost');
					return db.exchange.delete(key.exchange({ name, vhost }));
				},
				remove(item) { return db.exchange.delete(key.exchange(item)); },
				set(name, vhost, item) {
					pushToMapOfArrays(db.resourceByVhost, vhost, item);
					return db.exchange.set(key.exchange({ name, vhost }), item);
				},
			},
			binding: {
				count() { return db.binding.size; },
				all() { return [...db.binding.values()]; },
				getByKey(key) { return db.binding.get(key); },
				get(binding) {
					return db.binding.get(key.binding(binding));
				},
				delete(binding) { return db.binding.delete(key.binding(binding)); },
				remove(item) { return db.binding.delete(key.binding(item)); },
				set(binding) {
					assertObj(binding);
					const source = maps.exchange.get(binding.source, binding.vhost);
					if (source) {
						pushToMapOfArrays(db.bindingBySource, key.resource(source), binding);
					}
					const destination = maps[binding.destination_type].get(binding.destination, binding.vhost);
					if (destination) {
						pushToMapOfArrays(db.bindingByDestination, key.resource(destination), binding);
					}
					return db.binding.set(key.binding(binding), binding);
				},
				byDestination(resource) {
					return db.bindingByDestination.get(key.resource(resource));
				},
				bySource(resource) {
					return db.bindingBySource.get(key.resource(resource));
				},
			},
			resource: {
				get byVhost() { return db.resourceByVhost; },
			},
		};

		for (const [ns, api] of Object.entries(maps)) {
			this[ns] = api;
		}
	}

	build(definitions, throwOnFirstError = true) {
		nodeAssert.ok(definitions && typeof definitions, 'object');
		this.init();

		const assert = failureCollector(throwOnFirstError);

		for (const vhost of definitions.vhosts) {
			if (!vhost.name) {
				// will not report failure because it'd already be caught by the structural validation
				continue;
			}
			assert.ok(!this.vhost.get(vhost.name), `Duplicate vhost: "${vhost.name}"`);
			this.vhost.set(vhost.name, vhost);
		}

		for (const queue of definitions.queues) {
			if (!queue.name || !queue.vhost) {
				// will not report failure because it'd already be caught by the structural validation
				continue;
			}
			assert.ok(this.vhost.get(queue.vhost), `Missing vhost: "${queue.vhost}"`);
			assert.ok(!this.queue.get(queue.name, queue.vhost), `Duplicate queue: "${queue.name}" in vhost "${queue.vhost}"`);
			this.queue.set(queue.name, queue.vhost, queue);
		}

		for (const exchange of definitions.exchanges) {
			if (!exchange.name || !exchange.vhost) {
				// will not report failure because it'd already be caught by the structural validation
				continue;
			}
			assert.ok(this.vhost.get(exchange.vhost), `Missing vhost: "${exchange.vhost}"`);
			assert.ok(!this.exchange.get(exchange.name, exchange.vhost), `Duplicate exchange: "${exchange.name}" in vhost "${exchange.vhost}"`);
			this.exchange.set(exchange.name, exchange.vhost, exchange);
		}

		for (const binding of definitions.bindings) {
			const { vhost } = binding;
			assert.ok(this.vhost.get(vhost), `Missing vhost: "${vhost}"`);
			const from = this.exchange.get(binding.source, vhost);
			assert.ok(from, `Missing source exchange for binding: "${binding.source}" in vhost "${vhost}"`);

			const to = this[binding.destination_type].get(binding.destination, vhost);
			assert.ok(to, `Missing destination ${binding.destination_type} for binding: "${binding.destination}" in vhost "${vhost}"`);

			if (from) {
				if (from.type === 'headers') {
					// TODO: TEST THIS
					assert.ok(!binding.routing_key, `Routing key is ignored for header exchanges, but set("${binding.routing_key}") for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
				} else if (from.type === 'topic') {
					// TODO: TEST THIS
					assert.equal(binding.arguments?.['x-match'], undefined, `Match arguments are ignored for topic exchanges, but set for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
				} else if (from.type === 'direct') {
					// TODO: TEST THIS
					assert.equal(binding.arguments?.['x-match'], undefined, `Match arguments are ignored for direct exchanges, but set for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
				} else {
					assert.fail(`Unexpected binding type: ${from.type}`);
				}
			}

			assert.ok(!this.binding.get(binding), `Duplicate binding from "${binding.source}" to ${binding.destination_type} "${binding.destination}" in vhost "${binding.vhost}"`);
			this.binding.set(binding);
		}

		return assert.collectFailures();
	}
}

export default Index;
