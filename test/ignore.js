import { strict as assert } from 'assert';
import { describe, it } from 'node:test';

import Index, { isIgnored } from '../src/Index.js';

const I = {
	vhost: 'ignored-vhost',
	user: 'ignored-user',
	exchange: 'ignored-exchange',
	queue: 'ignored-queue',
};

const NI = {
	vhost: 'not-ignored-vhost',
	user: 'not-ignored-user',
	exchange: 'not-ignored-exchange',
	queue: 'not-ignored-queue',
};

describe('ignore', () => {
	it('fn exists', () => {
		assert.equal(typeof Index.fromIgnoreList, 'function');
		assert.equal(Index.fromIgnoreList.length, 1);
	});

	it('ignores base resources', () => {
		const index = Index.fromIgnoreList([
			`/vhosts/${I.vhost}`,
			`/users/${I.user}`,
			`/exchanges/${NI.vhost}/${I.exchange}`,
			`/queues/${NI.vhost}/${I.queue}`,
		]);

		assert.ok(isIgnored.vhosts(index, { name: I.vhost }));
		assert.ok(isIgnored.users(index, { name: I.user }));
		assert.ok(isIgnored.exchanges(index, { vhost: NI.vhost, name: I.exchange }));
		assert.ok(isIgnored.queues(index, { vhost: NI.vhost, name: I.queue }));

		assert.ok(!isIgnored.vhosts(index, { name: NI.vhost }));
		assert.ok(!isIgnored.users(index, { name: NI.user }));
		assert.ok(!isIgnored.exchanges(index, { vhost: NI.vhost, name: NI.exchange }));
		assert.ok(!isIgnored.queues(index, { vhost: NI.vhost, name: NI.queue }));
	});

	it('ignores resources related to a vhost', () => {
		const index = Index.fromIgnoreList([
			`/vhosts/${I.vhost}`,
		]);

		assert.ok(isIgnored.vhosts(index, { name: I.vhost }));
		assert.ok(isIgnored.exchanges(index, { vhost: I.vhost, name: NI.exchange }));
		assert.ok(isIgnored.queues(index, { vhost: I.vhost, name: NI.queue }));
		assert.ok(isIgnored.bindings(index, { vhost: I.vhost, source: NI.exchange, destination_type: 'queue', destination: NI.queue }));
		assert.ok(isIgnored.permissions(index, { vhost: I.vhost, user: NI.user }));
		assert.ok(isIgnored.topic_permissions(index, { vhost: I.vhost, exchange: NI.exchange, user: NI.user }));

		assert.ok(!isIgnored.vhosts(index, { name: NI.vhost }));
		assert.ok(!isIgnored.exchanges(index, { vhost: NI.vhost, name: NI.exchange }));
		assert.ok(!isIgnored.queues(index, { vhost: NI.vhost, name: NI.queue }));
		assert.ok(!isIgnored.bindings(index, { vhost: NI.vhost, source: NI.exchange, destination_type: 'queue', destination: NI.queue }));
		assert.ok(!isIgnored.permissions(index, { vhost: NI.vhost, user: NI.user }));
		assert.ok(!isIgnored.topic_permissions(index, { vhost: NI.vhost, exchange: NI.exchange, user: NI.user }));
	});

	it('ignores resources related to an user', () => {
		const index = Index.fromIgnoreList([
			`/users/${I.user}`,
		]);

		assert.ok(isIgnored.permissions(index, { vhost: NI.vhost, user: I.user }));
		assert.ok(isIgnored.topic_permissions(index, { vhost: NI.vhost, exchange: NI.exchange, user: I.user }));

		assert.ok(!isIgnored.vhosts(index, { name: NI.vhost }));
		assert.ok(!isIgnored.exchanges(index, { vhost: NI.vhost, name: NI.exchange }));
		assert.ok(!isIgnored.queues(index, { vhost: NI.vhost, name: NI.queue }));
		assert.ok(!isIgnored.bindings(index, { vhost: NI.vhost, source: NI.exchange, destination_type: 'queue', destination: NI.queue }));
		assert.ok(!isIgnored.permissions(index, { vhost: NI.vhost, user: NI.user }));
		assert.ok(!isIgnored.topic_permissions(index, { vhost: NI.vhost, exchange: NI.exchange, user: NI.user }));
	});

	it('ignores resources related to an exchange', () => {
		const index = Index.fromIgnoreList([
			`/exchanges/${NI.vhost}/${I.exchange}`,
		]);

		assert.ok(isIgnored.exchanges(index, { vhost: NI.vhost, name: I.exchange }));
		assert.ok(isIgnored.bindings(index, { vhost: NI.vhost, source: I.exchange, destination_type: 'queue', destination: NI.queue }));
		assert.ok(isIgnored.topic_permissions(index, { vhost: NI.vhost, exchange: I.exchange, user: NI.user }));

		assert.ok(!isIgnored.vhosts(index, { name: NI.vhost }));
		assert.ok(!isIgnored.exchanges(index, { vhost: NI.vhost, name: NI.exchange }));
		assert.ok(!isIgnored.queues(index, { vhost: NI.vhost, name: NI.queue }));
		assert.ok(!isIgnored.bindings(index, { vhost: NI.vhost, source: NI.exchange, destination_type: 'queue', destination: NI.queue }));
		assert.ok(!isIgnored.permissions(index, { vhost: NI.vhost, user: NI.user }));
		assert.ok(!isIgnored.topic_permissions(index, { vhost: NI.vhost, exchange: NI.exchange, user: NI.user }));
	});
});
