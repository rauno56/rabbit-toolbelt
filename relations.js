import assert from 'node:assert/strict';

const assertStr = (str) => assert.equal(typeof str, 'string', `Expected to be string: ${str}`);
const assertObj = (obj) => assert.equal(obj && typeof obj, 'object', `Expected to be object: ${obj}`);

const assertRelations = (definitions) => {
	assert.ok(definitions && typeof definitions, 'object');

	const db = {
		queue: new Map(),
		exchange: new Map(),
		vhost: new Map(),
		binding: new Map(),
		bindingByDestination: new Map(),
	};

	const maps = {
		vhost: {
			get(name) { return db.vhost.get(name); },
			set(name, item) { return db.vhost.set(name, item); },
		},
		queue: {
			get(name, vhost) { assertStr(name); assertStr(vhost); return db.queue.get([name, vhost].join(' @ ')); },
			set(name, vhost, item) { return db.queue.set([name, vhost].join(' @ '), item); },
		},
		exchange: {
			get(name, vhost) { assertStr(name); assertStr(vhost); return db.exchange.get([name, vhost].join(' @ ')); },
			set(name, vhost, item) { return db.exchange.set([name, vhost].join(' @ '), item); },
		},
		binding: {
			get(from, to, args) { assertObj(from); assertObj(to); return db.binding.get(from)?.get(to)?.get(args) ?? undefined; },
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
				let byDestination = db.bindingByDestination.get(to);
				if (!byDestination) {
					db.bindingByDestination.set(to, [item]);
				} else {
					byDestination.push(item);
				}
				return toMap.set(args, item);
			},
		},
	};

	for (const vhost of definitions.vhosts) {
		assert.ok(!maps.vhost.get(vhost.name), `Duplicate vhost: "${vhost.name}"`);
		maps.vhost.set(vhost.name, vhost);
	}

	for (const queue of definitions.queues) {
		assert.ok(!maps.queue.get(queue.name, queue.vhost), `Duplicate queue: "${queue.name}" in vhost "${queue.vhost}"`);
		maps.queue.set(queue.name, queue.vhost, queue);
	}

	for (const exchange of definitions.exchanges) {
		assert.ok(!maps.exchange.get(exchange.name, exchange.vhost), `Duplicate exchange: "${exchange.name}" in vhost "${exchange.vhost}"`);
		maps.exchange.set(exchange.name, exchange.vhost, exchange);
	}

	for (const binding of definitions.bindings) {
		const { vhost } = binding;
		const from = maps.exchange.get(binding.source, vhost);
		assert.ok(from, `Missing source exchange for binding: "${binding.source}" in vhost "${vhost}"`);

		const to = maps[binding.destination_type].get(binding.destination, vhost);
		assert.ok(to, `Missing destination ${binding.destination_type} for binding: "${binding.destination}" in vhost "${vhost}"`);

		let args = undefined;
		if (from.type === 'headers') {
			// TODO: TEST THIS
			assert.equal(binding.routing_key, '', `Routing key is ignored for header exchanges, but set for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
			args = binding.arguments;
		} else if (from.type === 'topic') {
			// TODO: TEST THIS
			assert.equal(binding.arguments['x-match'], undefined, `Match arguments are ignored for topic exchanges, but set for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
			args = binding.binding.routing_key;
		} else if (from.type === 'direct') {
			// TODO: TEST THIS
			assert.equal(binding.arguments['x-match'], undefined, `Match arguments are ignored for direct exchanges, but set for binding from ${binding.source} to ${binding.destination_type} "${binding.destination}" in vhost "${vhost}"`);
			args = binding.binding.routing_key;
		} else {
			assert.fail(`Unexpected binding type: ${from.type}`);
		}
		// JSON.stringify is not a good index here and easily tricked, but good enough for now
		// TODO: replace for a spable serializer in the future
		assert.ok(!maps.binding.get(from, to, args), `Duplicate binding from "${binding.source}" to ${binding.destination_type} "${binding.destination}" in vhost "${binding.vhost}"`);
		maps.binding.set(from, to, args, binding);
	}
};

export default assertRelations;
