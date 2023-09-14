import diff from './diff.js';
import { key } from './Index.js';
import RabbitClient from './RabbitClient.js';

const T = {
	exchange: 'e',
	queue: 'q',
};
const C = {
	added: {
		vhosts: (r) => ['PUT', `/api/vhosts/${encodeURIComponent(r.name)}`],
		queues: (r) => ['PUT', `/api/queues/${encodeURIComponent(r.vhost)}/${encodeURIComponent(r.name)}`],
		exchanges: (r) => ['PUT', `/api/exchanges/${encodeURIComponent(r.vhost)}/${encodeURIComponent(r.name)}`],
		bindings: (r) => ['POST', `/api/bindings/${encodeURIComponent(r.vhost)}/e/${encodeURIComponent(r.source)}/${T[r.destination_type]}/${r.destination}`],
	},
	deleted: {
		vhosts: (r) => ['DELETE', `/api/vhosts/${encodeURIComponent(r.name)}`],
		queues: (r) => ['DELETE', `/api/queues/${encodeURIComponent(r.vhost)}/${encodeURIComponent(r.name)}`],
		exchanges: (r) => ['DELETE', `/api/exchanges/${encodeURIComponent(r.vhost)}/${encodeURIComponent(r.name)}`],
		bindings: (r) => ['DELETE', `/api/bindings/${encodeURIComponent(r.vhost)}/e/${encodeURIComponent(r.source)}/${T[r.destination_type]}/${encodeURIComponent(r.destination)}/${encodeURIComponent(r.properties_key || '~')}`],
	},
};

const deployResources = async (client, changes, operation, type) => {
	const entries = changes[operation][type];
	if (entries.length) {
		const result = await Promise.allSettled(
			entries
				.map((resource) => {
					const [method, url] = C[operation][type](resource);
					if (method && url) {
						return client.request(method, url, resource);
					}

					throw new Error(`Invalid operation "${operation}" on type "${type}"`);
				})
		);

		const succeeded = result.filter(({ status }) => status === 'fulfilled');
		const failed = result.filter(({ status }) => status !== 'fulfilled');
		const failedNotice = result.length !== succeeded.length && `, ${result.length - succeeded.length} failed` || '';

		console.error(`${operation} ${succeeded.length} ${type}` + failedNotice);

		if (failed.length) {
			throw failed[0].reason;
		}
	}
};

const indexPropertiesKeyMap = (bindings) => {
	return new Map(bindings.map((item) => {
		return [key.binding(item), item.properties_key];
	}));
};

const diffServer = async (client, definitions) => {
	const [
		bindings,
		current,
	] = await Promise.all([
		client.requestBindings(),
		client.requestDefinitions(),
	]);
	const propertiesKeyMap = indexPropertiesKeyMap(bindings);
	const changes = diff(current, definitions);

	for (const b of changes['deleted']['bindings']) {
		const bKey = key.binding(b);
		const properties_key = propertiesKeyMap.get(bKey);
		if (properties_key) {
			b.properties_key = properties_key;
		} else {
			console.warn('Cannot find properties_key for binding', b);
		}
	}

	return changes;
};

const deploy = async (serverBaseUrl, definitions) => {
	const client = new RabbitClient(serverBaseUrl);
	const changes = await diffServer(client, definitions);

	await deployResources(client, changes, 'added', 'vhosts');
	await deployResources(client, changes, 'added', 'exchanges');
	await deployResources(client, changes, 'added', 'queues');
	await deployResources(client, changes, 'added', 'bindings');

	await deployResources(client, changes, 'deleted', 'bindings');
	await deployResources(client, changes, 'deleted', 'queues');
	await deployResources(client, changes, 'deleted', 'exchanges');
	await deployResources(client, changes, 'deleted', 'vhosts');
};

export default deploy;
