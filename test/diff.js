import { strict as assert } from 'assert';
import { describe, it } from 'node:test';

import { copy, readJSONSync } from '../src/utils.js';
import diff from '../src/diff.js';

const valid = readJSONSync('./fixtures/full.json');

describe('diff', () => {
	it('fn exists and takes 2 args', () => {
		assert.equal(typeof diff, 'function');
		assert.equal(diff.length, 2);
	});

	it('validates input objects to be definition files', () => {
		diff(valid, valid);
		assert.throws(() => {
			const invalid = copy(valid);
			invalid.exchanges = false;
			diff(valid, invalid);
		});
		assert.throws(() => {
			const invalid = copy(valid);
			invalid.exchanges = false;
			diff(invalid, valid);
		});
	});

	it('catches changes to vhosts', () => {
		const before = copy(valid);
		const after = copy(valid);
		before.vhosts.push({
			name: 'deleted',
		}, {
			name: 'changed description',
			description: 'before description',
		}, {
			name: 'changed tags',
			tags: ['b', 'a'],
		});
		after.vhosts.push({
			name: 'new',
		}, {
			name: 'changed description',
			description: 'after description',
		}, {
			name: 'changed tags',
			tags: ['a', 'b'],
		});
		const { added: { vhosts: added }, deleted: { vhosts: deleted }, changed: { vhosts: changed } } = diff(before, after);
		assert.equal(added.length, 1);
		assert.equal(added[0].name, 'new');
		assert.equal(deleted.length, 1);
		assert.equal(deleted[0].name, 'deleted');
		assert.equal(changed.length, 2);

		assert.equal(changed[0].before.description, 'before description');
		assert.equal(changed[0].before.name, 'changed description');
		assert.equal(changed[0].after.description, 'after description');

		assert.deepEqual(changed[1].before.tags, ['b', 'a']);
		assert.equal(changed[1].before.name, 'changed tags');
		assert.deepEqual(changed[1].after.tags, ['a', 'b']);
	});

	it('ignores API changes between 3.10 and later versions', () => {
		const before = copy(valid);
		const after = copy(valid);
		before.vhosts.push(
			{ name: 'changed1' },
			{ name: 'changed2' },
		);
		after.vhosts.push(
			{ name: 'changed1' },
			{ name: 'changed2', description: '', tags: [], metadata: { description: '', tags: [] } },
		);
		const { added: { vhosts: added }, deleted: { vhosts: deleted }, changed: { vhosts: changed } } = diff(before, after);
		assert.equal(added.length, 0);
		assert.equal(deleted.length, 0);
		assert.equal(changed.length, 0);
	});

	it('catches changes to users', () => {
		const before = copy(valid);
		const after = copy(valid);
		after.users.push({
			name: 'new',
			password_hash: 'ph',
			hashing_algorithm: 'alg',
			tags: ['admin'],
			limits: {},
		});
		before.users.push({
			name: 'deleted',
			password_hash: 'ph',
			hashing_algorithm: 'alg',
			tags: ['admin'],
			limits: {},
		});
		const changedItem = after.users[0];
		changedItem.tags = [...changedItem.tags, 'new-tag'];
		const { added: { users: added }, deleted: { users: deleted }, changed: { users: changed } } = diff(before, after);
		assert.equal(added.length, 1);
		assert.equal(added[0].name, 'new');
		assert.equal(deleted.length, 1);
		assert.equal(deleted[0].name, 'deleted');
		assert.equal(changed.length, 1);
		assert.equal(changed[0].before.name, changedItem.name);
		assert.notDeepEqual(changed[0].before.tags, changedItem.tags);
		assert.equal(changed[0].after.name, changedItem.name);
		assert.equal(changed[0].after.tags, changedItem.tags);
	});

	it('catches changes to permissions', () => {
		const before = copy(valid);
		const after = copy(valid);
		after.permissions.push({
			user: 'new',
			vhost: '/',
			configure: '.*',
			write: '.*',
			read: '.*',
		});
		before.permissions.push({
			user: 'deleted',
			vhost: '/',
			configure: '.*',
			write: '.*',
			read: '.*',
		});
		const changedItem = after.permissions[0];
		changedItem.configure = '';
		const { added: { permissions: added }, deleted: { permissions: deleted }, changed: { permissions: changed } } = diff(before, after);
		assert.equal(added.length, 1);
		assert.equal(added[0].user, 'new');
		assert.equal(deleted.length, 1);
		assert.equal(deleted[0].user, 'deleted');
		assert.equal(changed.length, 1);
		assert.equal(changed[0].before.user, changedItem.user);
		assert.equal(changed[0].before.configure, '.*');
		assert.equal(changed[0].after.user, changedItem.user);
		assert.equal(changed[0].after.configure, changedItem.configure);
	});

	it('catches changes to topic permissions', () => {
		const before = copy(valid);
		const after = copy(valid);
		after.topic_permissions.push({
			user: 'new',
			vhost: '/',
			exchange: 'defect_direct',
			write: '.*',
			read: '.*',
		});
		before.topic_permissions.push({
			user: 'deleted',
			vhost: '/',
			exchange: 'defect_direct',
			write: '.*',
			read: '.*',
		});
		const changedItem = after.topic_permissions[0];
		changedItem.write = '';
		const { added: { topic_permissions: added }, deleted: { topic_permissions: deleted }, changed: { topic_permissions: changed } } = diff(before, after);
		assert.equal(added.length, 1);
		assert.equal(added[0].user, 'new');
		assert.equal(deleted.length, 1);
		assert.equal(deleted[0].user, 'deleted');
		assert.equal(changed.length, 1);
		assert.equal(changed[0].before.user, changedItem.user);
		assert.equal(changed[0].before.write, '.*');
		assert.equal(changed[0].after.user, changedItem.user);
		assert.equal(changed[0].after.write, changedItem.write);
	});

	it('catches changes to queues', () => {
		const before = copy(valid);
		const after = copy(valid);
		after.queues.push({
			name: 'new',
			vhost: '/',
			durable: true,
			auto_delete: false,
		});
		before.queues.push({
			name: 'deleted',
			vhost: '/',
			durable: true,
			auto_delete: false,
		});
		const changedItem = after.queues[0];
		changedItem.durable = !changedItem.durable;
		const { added: { queues: added }, deleted: { queues: deleted }, changed: { queues: changed } } = diff(before, after);
		assert.equal(added.length, 1);
		assert.equal(added[0].name, 'new');
		assert.equal(deleted.length, 1);
		assert.equal(deleted[0].name, 'deleted');
		assert.equal(changed.length, 1);
		assert.equal(changed[0].before.name, changedItem.name);
		assert.equal(changed[0].before.durable, !changedItem.durable);
		assert.equal(changed[0].after.name, changedItem.name);
		assert.equal(changed[0].after.durable, changedItem.durable);
	});

	it('catches changes to exchanges', () => {
		const before = copy(valid);
		const after = copy(valid);
		after.exchanges.push({
			name: 'new',
			vhost: '/',
			type: 'topic',
			durable: true,
			auto_delete: false,
		});
		before.exchanges.push({
			name: 'deleted',
			vhost: '/',
			type: 'headers',
			durable: true,
			auto_delete: false,
		});
		const changedItem = after.exchanges[0];
		changedItem.durable = !changedItem.durable;
		const { added: { exchanges: added }, deleted: { exchanges: deleted }, changed: { exchanges: changed } } = diff(before, after);
		assert.equal(added.length, 1);
		assert.equal(added[0].name, 'new');
		assert.equal(deleted.length, 1);
		assert.equal(deleted[0].name, 'deleted');
		assert.equal(changed.length, 1);
		assert.equal(changed[0].before.name, changedItem.name);
		assert.equal(changed[0].before.durable, !changedItem.durable);
		assert.equal(changed[0].after.name, changedItem.name);
		assert.equal(changed[0].after.durable, changedItem.durable);
	});

	it('catches changes to bindings via routing key', () => {
		const before = copy(valid);
		const after = copy(valid);
		// pick first two resource to create bindings between
		const exchange = before.exchanges.find((e) => e.type === 'topic');
		const queue = before.queues.find((q) => q.vhost === exchange.vhost);
		after.bindings.push({
			vhost: exchange.vhost,
			source: exchange.name,
			destination: queue.name,
			destination_type: 'queue',
			routing_key: 'a.b',
		});
		before.bindings.push({
			vhost: exchange.vhost,
			source: exchange.name,
			destination: queue.name,
			destination_type: 'queue',
			routing_key: 'd.e',
		});
		const { added: { bindings: added }, deleted: { bindings: deleted }, changed: { bindings: changed } } = diff(before, after);
		assert.equal(added.length, 1);
		assert.equal(added[0].routing_key, 'a.b');
		assert.equal(deleted.length, 1);
		assert.equal(deleted[0].routing_key, 'd.e');
		assert.equal(changed.length, 0);
	});

	it('catches changes to bindings via args', () => {
		const before = copy(valid);
		const after = copy(valid);
		// pick first two resource to create bindings between
		const exchange = before.exchanges.find((e) => e.type === 'headers');
		const queue = before.queues.find((q) => q.vhost === exchange.vhost);
		after.bindings.push({
			vhost: exchange.vhost,
			source: exchange.name,
			destination: queue.name,
			destination_type: 'queue',
			routing_key: '',
			arguments: {
				'x-match': 'any',
				h1: 'v2',
			},
		});
		before.bindings.push({
			vhost: exchange.vhost,
			source: exchange.name,
			destination: queue.name,
			destination_type: 'queue',
			routing_key: '',
			arguments: {
				'x-match': 'any',
				h1: 'v1',
			},
		});
		const { added: { bindings: added }, deleted: { bindings: deleted }, changed: { bindings: changed } } = diff(before, after);
		assert.equal(added.length, 1);
		assert.equal(added[0].arguments.h1, 'v2');
		assert.equal(deleted.length, 1);
		assert.equal(deleted[0].arguments.h1, 'v1');
		assert.equal(changed.length, 0);
	});
});
