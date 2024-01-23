import * as nodeAssert from 'node:assert/strict';

import { assertObj, assertStr } from './utils.js';
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

const destinationTypeToIndex = {
	queue: 'queues',
	exchange: 'exchanges',
};

export const detectResourceType = (resource) => {
	if (typeof resource.destination_type === 'string') {
		return 'bindings';
	}
	if (typeof resource.type === 'string') {
		return 'exchanges';
	}
	if (typeof resource.vhost === 'string' && typeof resource.durable === 'boolean') {
		return 'queues';
	}
	if (typeof resource.name === 'string' && Object.keys(resource).length === 1) {
		return 'vhosts';
	}
	if (typeof resource.password_hash === 'string') {
		return 'users';
	}
	if (typeof resource.configure === 'string') {
		return 'permissions';
	}
	if (typeof resource.write === 'string') {
		return 'topic_permissions';
	}
	const err = new Error(`Unknown resource: ${JSON.stringify(resource)}`);
	err.context = resource;
	throw err;
};

export const key = {
	resource: (resource) => {
		return key[detectResourceType(resource)](resource);
	},
	// the implementation assumes all hash functions are unique for a given input
	vhosts: ({ name }) => {
		assertStr(name, 'name');
		return `${name}`;
	},
	queues: ({ vhost, name }) => {
		assertStr(vhost, 'vhost');
		assertStr(name, 'name');
		return `Q[${name} @ ${vhost}]`;
	},
	exchanges: ({ vhost, name }) => {
		assertStr(vhost, 'vhost');
		assertStr(name, 'name');
		return `E[${name} @ ${vhost}]`;
	},
	bindings: ({ vhost, source, destination_type, destination, routing_key, arguments: args }) => {
		assertStr(vhost, 'vhost');
		assertStr(source, 'source');
		assertStr(destination, 'destination');
		assertStr(destination_type, 'destination_type');
		return `B[${source}->${destination_type}.${destination} @ ${vhost}](${routing_key}/${key.args(args)})`;
	},
	users: ({ name }) => {
		assertStr(name, 'name');
		return `U[${name}]`;
	},
	permissions: ({ vhost, user }) => {
		assertStr(vhost, 'vhost');
		assertStr(user, 'user');
		return `P[${user} @ ${vhost}]`;
	},
	topic_permissions: ({ vhost, user, exchange }) => {
		assertStr(vhost, 'vhost');
		assertStr(user, 'user');
		assertStr(exchange, 'exchange');
		return `TP[${user} @ ${vhost}.${exchange}]`;
	},
	args: (args) => {
		return Object.entries(args ?? {}).sort(([a], [b]) => a < b ? -1 : 1).map((p) => p.join('=')).join();
	},
};

export const isIgnored = {
	vhosts: (index, item) => {
		return index.vhosts.has(item);
	},
	queues: (index, item) => {
		return index.vhosts.has({ name: item.vhost }) || index.queues.has(item);
	},
	exchanges: (index, item) => {
		return index.vhosts.has({ name: item.vhost }) || index.exchanges.has(item);
	},
	bindings: (index, item) => {
		const { vhost } = item;
		return index.vhosts.has({ name: item.vhost }) || index[destinationTypeToIndex[item.destination_type]].has({ vhost, name: item.destination }) || index.exchanges.has({ vhost, name: item.source });
	},
	users: (index, item) => {
		return index.users.has(item);
	},
	permissions: (index, item) => {
		return index.vhosts.has({ name: item.vhost }) || index.users.has({ name: item.user });
	},
	topic_permissions: (index, item) => {
		return index.vhosts.has({ name: item.vhost }) || index.users.has({ name: item.user }) || index.exchanges.has({ vhost: item.vhost, name: item.exchange });
	},
};

// A quick index to be able to quickly see which resources we've seen without the need to iterate through all
// of them every time.
class Index {
	vhosts = null;
	queues = null;
	exchanges = null;
	bindings = null;
	users = null;
	permissions = null;
	topic_permissions = null;
	resources = null;

	static fromIgnoreList(ignoreList) {
		const index = new Index();
		/*
			Using API-based paths:
			/vhosts/{vhost}
			/queues/{vhost}/{queue.name}
			/exchanges/{vhost}/{exchange.name}
			/users/{user.name}
		*/
		ignoreList
			.map((row) => {
				return row.split('/');
			})
			.forEach(([/* part before the first / */ , type, ...rargs]) => {
				const args = rargs.map(decodeURIComponent);
				if (type === 'vhosts' || type === 'users') {
					return index[type].add({ name: args[0] });
				}
				if (type === 'queues' || type === 'exchanges') {
					return index[type].add({ vhost: args[0], name: args[1] });
				}
				throw new Error(`Invalid type: "${type}"`);
			});

		return index;
	}

	static fromDefinitions(definitions, throwOnFirstError, ignoreIndex) {
		const index = new Index();
		index.build(definitions, throwOnFirstError, ignoreIndex);

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

		const bindingSet = new HashSet(key.bindings, (item) => {
			assertObj(item);

			pushToMapOfArrays(resourceByVhost, item.vhost, item);

			const source = maps.exchanges.get({
				vhost: item.vhost,
				name: item.source,
			});
			if (source) {
				pushToMapOfArrays(bindingBySource, key.resource(source), item);
			}
			const destination = maps[destinationTypeToIndex[item.destination_type]].get({
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
			vhosts: new HashSet(key.vhosts),
			queues: new HashSet(key.queues, pushToResourceByVhost),
			exchanges: new HashSet(key.exchanges, pushToResourceByVhost),
			bindings: bindingSet,
			users: new HashSet(key.users),
			permissions: new HashSet(key.permissions, pushToResourceByVhost),
			topic_permissions: new HashSet(key.topic_permissions, pushToResourceByVhost),
			resources: {
				get byVhost() { return resourceByVhost; },
			},
		};

		for (const [ns, api] of Object.entries(maps)) {
			this[ns] = api;
		}
	}

	build(definitions, throwOnFirstError = true, ignoreIndex = null) {
		nodeAssert.ok(definitions && typeof definitions, 'object');
		this.init();

		const assert = failureCollector(throwOnFirstError);

		for (const vhost of definitions.vhosts) {
			// will not report failure because it'd already be caught by the structural validation
			try { this.vhosts.hash(vhost); } catch { continue; }
			if (ignoreIndex && isIgnored.vhosts(ignoreIndex, vhost)) { continue; }
			assert.ok(!this.vhosts.get(vhost), `Duplicate vhost: "${vhost.name}"`);
			this.vhosts.add(vhost);
		}

		for (const queue of definitions.queues) {
			try { this.queues.hash(queue); } catch { continue; }
			if (ignoreIndex && isIgnored.queues(ignoreIndex, queue)) { continue; }
			assert.ok(!this.queues.get(queue), `Duplicate queue: "${queue.name}" in vhost "${queue.vhost}"`);
			this.queues.add(queue);
		}

		for (const exchange of definitions.exchanges) {
			try { this.exchanges.hash(exchange); } catch { continue; }
			if (ignoreIndex && isIgnored.exchanges(ignoreIndex, exchange)) { continue; }
			assert.ok(!this.exchanges.get(exchange), `Duplicate exchange: "${exchange.name}" in vhost "${exchange.vhost}"`);
			this.exchanges.add(exchange);
		}

		for (const binding of definitions.bindings) {
			try { this.bindings.hash(binding); } catch { continue; }
			const { vhost } = binding;
			if (ignoreIndex && isIgnored.bindings(ignoreIndex, binding)) { continue; }
			const from = this.exchanges.get({ vhost, name: binding.source });
			assert.ok(from, `Missing source exchange for binding: "${binding.source}" in vhost "${vhost}"`);

			const to = this[destinationTypeToIndex[binding.destination_type]].get({ vhost, name: binding.destination });
			assert.ok(to, `Missing destination ${binding.destination_type} for binding: "${binding.destination}" in vhost "${vhost}"`);

			if (from) {
				if (from.type === 'headers') {
					// TODO: TEST THIS
					assert.ok(!binding.routing_key, `Routing key is ignored for header exchanges, but set("${binding.routing_key}") for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
				} else if (from.type === 'topic') {
					// TODO: TEST THIS
					assert.equal(binding.arguments?.['x-match'], undefined, `Match arguments are ignored for ${from.type} exchanges, but set for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
				} else if (from.type === 'direct') {
					// TODO: TEST THIS
					assert.equal(binding.arguments?.['x-match'], undefined, `Match arguments are ignored for ${from.type} exchanges, but set for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
				} else if (from.type === 'fanout') {
					// TODO: TEST THIS
					assert.equal(binding.arguments?.['x-match'], undefined, `Match arguments are ignored for ${from.type} exchanges, but set for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
					assert.ok(!binding.routing_key, `Routing key is ignored for ${from.type} exchanges, but set("${binding.routing_key}") for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
				} else {
					assert.fail(`Unexpected binding type: ${from.type}`);
				}
			}

			assert.ok(!this.bindings.get(binding), `Duplicate binding from "${binding.source}" to ${binding.destination_type} "${binding.destination}" in vhost "${binding.vhost}"`);
			this.bindings.add(binding);
		}

		for (const user of definitions.users) {
			try { this.users.hash(user); } catch { continue; }
			if (ignoreIndex && isIgnored.users(ignoreIndex, user)) { continue; }
			const { name } = user;
			assert.ok(!this.users.get(user), `Duplicate user: "${name}"`);
			this.users.add(user);
		}

		for (const permission of definitions.permissions) {
			try { this.permissions.hash(permission); } catch { continue; }
			if (ignoreIndex && isIgnored.permissions(ignoreIndex, permission)) { continue; }
			const { user, vhost } = permission;
			assert.ok(!this.permissions.get(permission), `Duplicate permission for user "${user}" in vhost "${vhost}"`);
			this.permissions.add(permission);
		}

		for (const permission of definitions.topic_permissions) {
			try { this.topic_permissions.hash(permission); } catch { continue; }
			if (ignoreIndex && isIgnored.topic_permissions(ignoreIndex, permission)) { continue; }
			const { user, vhost } = permission;
			assert.ok(!this.topic_permissions.get(permission), `Duplicate topic permission for user "${user}" in vhost "${vhost}.\n${JSON.stringify(permission)}\n${JSON.stringify(this.topic_permissions.get(permission))}"`);
			this.topic_permissions.add(permission);
		}

		return assert.collectFailures();
	}
}

export default Index;
