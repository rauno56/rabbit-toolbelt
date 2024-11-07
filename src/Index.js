import * as nodeAssert from 'node:assert/strict';

import { assertObj, assertStr } from './utils.js';
import { HashSet } from './HashSet.js';
import failureCollector from './failureCollector.js';

export const SOURCE_SYM = Symbol.for('SOURCE_PATH');
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

export const destinationTypeToIndex = {
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
	users: ({ name }) => {
		assertStr(name, 'name');
		return `U[${name}]`;
	},
	// the implementation assumes all hash functions are unique for a given input
	vhosts: ({ name }) => {
		assertStr(name, 'name');
		return `${name}`;
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
	parameters: ({ vhost, component, name }) => {
		assertStr(vhost, 'vhost');
		assertStr(component, 'component');
		assertStr(name, 'name');
		return `PAR[${name} @ ${component} @ ${vhost}]`;
	},
	global_parameters: ({ name }) => {
		assertStr(name, 'name');
		return `GPAR[${name}]`;
	},
	policies: ({ vhost, name }) => {
		assertStr(vhost, 'vhost');
		assertStr(name, 'name');
		return `PO[${name} @ ${vhost}]`;
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
	resource: (resource) => {
		return key[detectResourceType(resource)](resource);
	},
	args: (args) => {
		return Object.entries(args ?? {}).sort(([a], [b]) => a < b ? -1 : 1).map((p) => p.join('=')).join();
	},
};

export const isIgnored = {
	users: (index, item) => {
		return index.users.has(item);
	},
	vhosts: (index, item) => {
		return index.vhosts.has(item);
	},
	permissions: (index, item) => {
		return index.vhosts.has({ name: item.vhost }) || index.users.has({ name: item.user });
	},
	topic_permissions: (index, item) => {
		return index.vhosts.has({ name: item.vhost }) || index.users.has({ name: item.user }) || index.exchanges.has({ vhost: item.vhost, name: item.exchange });
	},
	parameters: (index, item) => {
		return index.vhosts.has({ name: item.vhost });
	},
	global_parameters: (/*index, item*/) => {
		return false;
	},
	policies: (index, item) => {
		return index.vhosts.has({ name: item.vhost });
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
};

// A quick index to be able to quickly see which resources we've seen without the need to iterate through all
// of them every time.
class Index {
	meta = {};
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
			.forEach(([/* part before the first / */, type, ...rargs]) => {
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

	static fromDefinitions(definitions, throwOnFirstError, ignoreIndex, sourcePath) {
		const index = new Index();
		index.build(definitions, throwOnFirstError, ignoreIndex, sourcePath);

		return index;
	}

	constructor() {
		this.init();
	}

	init() {
		this.meta = {};

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
			users: new HashSet(key.users),
			vhosts: new HashSet(key.vhosts),
			permissions: new HashSet(key.permissions, pushToResourceByVhost),
			topic_permissions: new HashSet(key.topic_permissions, pushToResourceByVhost),
			parameters: new HashSet(key.parameters), /* not deployed */
			global_parameters: new HashSet(key.global_parameters), /* not deployed */
			policies: new HashSet(key.policies), /* not deployed */
			queues: new HashSet(key.queues, pushToResourceByVhost),
			exchanges: new HashSet(key.exchanges, pushToResourceByVhost),
			bindings: bindingSet,
			resources: {
				get byVhost() { return resourceByVhost; },
			},
		};

		for (const [ns, api] of Object.entries(maps)) {
			this[ns] = api;
		}
	}

	build(definitions, throwOnFirstError, ignoreIndex, sourcePath) {
		this.init();

		return this.merge(definitions, throwOnFirstError, ignoreIndex, sourcePath);
	}

	getVersion() {
		const altFields = [
			'rabbitmq_version',
			'product_version',
		];
		let version = this.meta.rabbit_version;
		for (const field of altFields) {
			const val = this.meta[field];
			if (val) {
				if (!version) {
					version = val;
				} else if (version !== val) {
					console.warn(`Multiple different declared versions: ${version}, ${val}(${field})`);
				}
			}
		}
		return version;
	}

	merge(definitions, throwOnFirstError = true, ignoreIndex = null, sourcePath = null) {
		nodeAssert.ok(definitions && typeof definitions, 'object');
		nodeAssert.equal(definitions instanceof Index, false, '`merge` accepts definitions, not built Index');
		const {
			users,
			vhosts,
			permissions,
			topic_permissions,
			parameters, // not deployed
			global_parameters, // not deployed
			policies, // not deployed
			queues,
			exchanges,
			bindings,
			...meta
		} = definitions;

		const assert = failureCollector(throwOnFirstError);

		for (const [key, value] of Object.entries(meta)) {
			assert.ok(!this.meta[key], `Duplicate value for key ${key}`);
			this.meta[key] = value;
		}

		const indexedResources = {
			users,
			vhosts,
			permissions,
			topic_permissions,
			parameters,
			global_parameters,
			policies,
			queues,
			exchanges,
			bindings,
		};

		for (const res of Object.keys(indexedResources)) {
			if (typeof definitions[res] !== 'undefined') {
				for (const item of definitions[res]) {
					try { this[res].hash(item); } catch (err) { console.error('failed to index', item, err.message); continue; }
					if (ignoreIndex && isIgnored[res](ignoreIndex, item)) { continue; }
					item[SOURCE_SYM] = sourcePath;
					assert.unique[res](this, item);
					this[res].add(item);
				}
			}
		}

		return assert.collectFailures();
	}

	toDefinitions() {
		return {
			...this.meta,
			users: [...this.users.values()],
			vhosts: [...this.vhosts.values()],
			permissions: [...this.permissions.values()],
			topic_permissions: [...this.topic_permissions.values()],
			parameters: [...this.parameters.values()],
			global_parameters: [...this.global_parameters.values()],
			policies: [...this.policies.values()],
			queues: [...this.queues.values()],
			exchanges: [...this.exchanges.values()],
			bindings: [...this.bindings.values()],
		};
	}
}

export default Index;
