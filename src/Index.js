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
		if (typeof resource.vhost === 'string' && typeof resource.durable === 'boolean') {
			return key.queue(resource);
		}
		if (typeof resource.name === 'string' && Object.keys(resource).length === 1) {
			return key.vhost(resource);
		}
		if (typeof resource.password_hash === 'string') {
			return key.user(resource);
		}
		const err = new Error('Invalid resource');
		err.context = resource;
		throw err;
	},
	vhost: ({ name }) => `${name}`,
	queue: ({ vhost, name }) => `Q[${name} @ ${vhost}]`,
	exchange: ({ vhost, name }) => `E[${name} @ ${vhost}]`,
	binding: ({ vhost, source, destination_type, destination, routing_key, arguments: args }) => `B[${source}->${destination_type}.${destination} @ ${vhost}](${routing_key}/${key.args(args)})`,
	user: ({ name }) => `${name}`,
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
			// vhosts: vhost.name -> vhost
			vhost: new Map(),
			// queues: vhost.name -> Q
			queue: new Map(),
			// exchanges: vhost.name -> EX
			exchange: new Map(),
			// EX/Q: vhost.name -> EX/Q
			resourceByVhost: new Map(),
			// bindings: source -> destination -> args
			binding: new Map(),
			// bindings: {resource} -> binding[]
			bindingByDestination: new Map(),
			// bindings: {resource} -> binding[]
			bindingBySource: new Map(),
			user: new Map(),
		};

		const maps = {
			vhost: {
				get size() { return db.vhost.size; },
				all() { return [...db.vhost.values()]; },
				getByHash(key) { return db.vhost.get(key); },
				get(item) { return db.vhost.get(key.vhost(item)); },
				delete(item) { return db.vhost.delete(key.vhost(item)); },
				add(item) { return db.vhost.set(key.vhost(item), item); },
			},
			queue: {
				get size() { return db.queue.size; },
				all() { return [...db.queue.values()]; },
				getByHash(key) { return db.queue.get(key); },
				get(item) {
					assertStr(item.name, 'name');
					assertStr(item.vhost, 'vhost');
					return db.queue.get(key.queue(item));
				},
				delete(item) { return db.queue.delete(key.queue(item)); },
				add(item) {
					pushToMapOfArrays(db.resourceByVhost, item.vhost, item);
					return db.queue.set(key.queue(item), item);
				},
			},
			exchange: {
				get size() { return db.exchange.size; },
				all() { return [...db.exchange.values()]; },
				getByHash(key) { return db.exchange.get(key); },
				get(item) {
					return db.exchange.get(key.exchange(item));
				},
				delete(item) { return db.exchange.delete(key.exchange(item)); },
				add(item) {
					pushToMapOfArrays(db.resourceByVhost, item.vhost, item);
					return db.exchange.set(key.exchange(item), item);
				},
			},
			binding: {
				get size() { return db.binding.size; },
				all() { return [...db.binding.values()]; },
				getByHash(key) { return db.binding.get(key); },
				get(item) {
					return db.binding.get(key.binding(item));
				},
				delete(item) { return db.binding.delete(key.binding(item)); },
				add(binding) {
					assertObj(binding);
					const source = maps.exchange.get({
						vhost: binding.vhost,
						name: binding.source,
					});
					if (source) {
						pushToMapOfArrays(db.bindingBySource, key.resource(source), binding);
					}
					const destination = maps[binding.destination_type].get({
						vhost: binding.vhost,
						name: binding.destination,
					});
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
			user: {
				get size() { return db.user.size; },
				all() { return [...db.user.values()]; },
				getByHash(key) { return db.user.get(key); },
				get(item) { return db.user.get(key.user(item)); },
				delete(item) { return db.user.delete(key.user(item)); },
				add(item) { return db.user.set(key.user(item), item); },
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
			assert.ok(!this.vhost.get(vhost), `Duplicate vhost: "${vhost.name}"`);
			this.vhost.add(vhost);
		}

		for (const queue of definitions.queues) {
			if (!queue.name || !queue.vhost) {
				// will not report failure because it'd already be caught by the structural validation
				continue;
			}
			assert.ok(this.vhost.getByHash(queue.vhost), `Missing vhost: "${queue.vhost}"`);
			assert.ok(!this.queue.get(queue), `Duplicate queue: "${queue.name}" in vhost "${queue.vhost}"`);
			this.queue.add(queue);
		}

		for (const exchange of definitions.exchanges) {
			if (!exchange.name || !exchange.vhost) {
				// will not report failure because it'd already be caught by the structural validation
				continue;
			}
			assert.ok(this.vhost.getByHash(exchange.vhost), `Missing vhost: "${exchange.vhost}"`);
			assert.ok(!this.exchange.get(exchange), `Duplicate exchange: "${exchange.name}" in vhost "${exchange.vhost}"`);
			this.exchange.add(exchange);
		}

		for (const binding of definitions.bindings) {
			const { vhost } = binding;
			assert.ok(this.vhost.getByHash(vhost), `Missing vhost: "${vhost}"`);
			const from = this.exchange.get({ vhost, name: binding.source });
			assert.ok(from, `Missing source exchange for binding: "${binding.source}" in vhost "${vhost}"`);

			const to = this[binding.destination_type].get({ vhost, name: binding.destination });
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
			this.binding.add(binding);
		}

		for (const user of definitions.users) {
			const { name } = user;
			if (!name) {
				// will not report failure because it'd already be caught by the structural validation
				continue;
			}
			assert.ok(!this.user.get(user), `Duplicate user: "${name}"`);
			this.user.add(user);
		}

		return assert.collectFailures();
	}
}

export default Index;
