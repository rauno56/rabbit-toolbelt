import * as nodeAssert from 'node:assert/strict';

import { assertObj } from './utils.js';
import { HashSet } from './HashSet.js';
import failureCollector from './failureCollector.js';

const pushToMapOfArrays = (map, key, item) => {
	nodeAssert.ok(map instanceof Map);
	nodeAssert.equal(typeof key, 'string');
	nodeAssert.equal(typeof item, 'object');
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
		if (typeof resource.configure === 'string') {
			return key.permission(resource);
		}
		if (typeof resource.write === 'string') {
			return key.topicPermission(resource);
		}
		const err = new Error('Invalid resource');
		err.context = resource;
		throw err;
	},
	// the implementation assumes all hash functions are unique for a given input
	vhost: ({ name }) => {
		assertStr(name, 'name');
		return `${name}`;
	},
	queue: ({ vhost, name }) => {
		assertStr(vhost, 'vhost');
		assertStr(name, 'name');
		return `Q[${name} @ ${vhost}]`;
	},
	exchange: ({ vhost, name }) => {
		assertStr(vhost, 'vhost');
		assertStr(name, 'name');
		return `E[${name} @ ${vhost}]`;
	},
	binding: ({ vhost, source, destination_type, destination, routing_key, arguments: args }) => {
		assertStr(vhost, 'vhost');
		assertStr(source, 'source');
		assertStr(destination, 'destination');
		assertStr(destination_type, 'destination_type');
		return `B[${source}->${destination_type}.${destination} @ ${vhost}](${routing_key}/${key.args(args)})`;
	},
	user: ({ name }) => {
		assertStr(name, 'name');
		return `U[${name}]`;
	},
	permission: ({ vhost, user }) => {
		assertStr(vhost, 'vhost');
		assertStr(user, 'user');
		return `P[${user} @ ${vhost}]`;
	},
	topicPermission: ({ vhost, user, exchange }) => {
		assertStr(vhost, 'vhost');
		assertStr(user, 'user');
		assertStr(exchange, 'exchange');
		return `T[${user} @ ${vhost}.${exchange}]`;
	},
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
	user = null;
	resource = null;

	static fromDefinitions(definitions, throwOnFirstError) {
		const index = new Index();
		index.build(definitions, throwOnFirstError);

		return index;
	}

	constructor() {
		this.init();
	}

	init() {
		// EX/Q: vhost.name -> EX/Q
		const resourceByVhost = new Map();
		// bindings: {resource} -> binding[]
		const bindingByDestination = new Map();
		// bindings: {resource} -> binding[]
		const bindingBySource = new Map();

		const pushToResourceByVhost = (item) => {
			pushToMapOfArrays(resourceByVhost, item.vhost, item);
		};

		const bindingSet = new HashSet(key.binding, (item) => {
			assertObj(item);
			const source = maps.exchange.get({
				vhost: item.vhost,
				name: item.source,
			});
			if (source) {
				pushToMapOfArrays(bindingBySource, key.resource(source), item);
			}
			const destination = maps[item.destination_type].get({
				vhost: item.vhost,
				name: item.destination,
			});
			if (destination) {
				pushToMapOfArrays(bindingByDestination, key.resource(destination), item);
			}
		});
		bindingSet.byDestination = (resource) => {
			return bindingByDestination.get(key.resource(resource));
		};
		bindingSet.bySource = (resource) => {
			return bindingBySource.get(key.resource(resource));
		};

		const maps = {
			vhost: new HashSet(key.vhost),
			queue: new HashSet(key.queue, pushToResourceByVhost),
			exchange: new HashSet(key.exchange, pushToResourceByVhost),
			binding: bindingSet,
			user: new HashSet(key.user),
			permission: new HashSet(key.permission, pushToResourceByVhost),
			topicPermission: new HashSet(key.topicPermission, pushToResourceByVhost),
			resource: {
				get byVhost() { return resourceByVhost; },
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
			assert.ok(this.vhost.get({ name: queue.vhost }), `Missing vhost: "${queue.vhost}"`);
			assert.ok(!this.queue.get(queue), `Duplicate queue: "${queue.name}" in vhost "${queue.vhost}"`);
			this.queue.add(queue);
		}

		for (const exchange of definitions.exchanges) {
			if (!exchange.name || !exchange.vhost) {
				// will not report failure because it'd already be caught by the structural validation
				continue;
			}
			assert.ok(this.vhost.get({ name: exchange.vhost }), `Missing vhost: "${exchange.vhost}"`);
			assert.ok(!this.exchange.get(exchange), `Duplicate exchange: "${exchange.name}" in vhost "${exchange.vhost}"`);
			this.exchange.add(exchange);
		}

		for (const binding of definitions.bindings) {
			const { vhost } = binding;
			assert.ok(this.vhost.get({ name: vhost }), `Missing vhost: "${vhost}"`);
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

		for (const permission of definitions.permissions) {
			const { user, vhost } = permission;
			if (!user || !vhost) {
				// will not report failure because it'd already be caught by the structural validation
				continue;
			}
			assert.ok(!this.permission.get(permission), `Duplicate permission for user "${user}" in vhost "${vhost}"`);
			this.permission.add(permission);
		}

		for (const permission of definitions.topic_permissions) {
			const { user, vhost } = permission;
			if (!user || !vhost) {
				// will not report failure because it'd already be caught by the structural validation
				continue;
			}
			assert.ok(!this.topicPermission.get(permission), `Duplicate topic permission for user "${user}" in vhost "${vhost}.\n${JSON.stringify(permission)}\n${JSON.stringify(this.topicPermission.get(permission))}"`);
			this.topicPermission.add(permission);
		}

		return assert.collectFailures();
	}
}

export default Index;
