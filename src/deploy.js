import RabbitClient from './RabbitClient.js';
import { diffServer } from './deploy.utils.js';

const T = {
	exchange: 'e',
	queue: 'q',
};
const C = {
	added: {
		vhosts: (r) => ['PUT', `/api/vhosts/${encodeURIComponent(r.name)}`],
		users: (r) => ['PUT', `/api/users/${encodeURIComponent(r.name)}`],
		queues: (r) => ['PUT', `/api/queues/${encodeURIComponent(r.vhost)}/${encodeURIComponent(r.name)}`],
		exchanges: (r) => ['PUT', `/api/exchanges/${encodeURIComponent(r.vhost)}/${encodeURIComponent(r.name)}`],
		bindings: (r) => ['POST', `/api/bindings/${encodeURIComponent(r.vhost)}/e/${encodeURIComponent(r.source)}/${T[r.destination_type]}/${r.destination}`],
	},
	deleted: {
		vhosts: (r) => ['DELETE', `/api/vhosts/${encodeURIComponent(r.name)}`],
		users: (r) => ['DELETE', `/api/users/${encodeURIComponent(r.name)}`],
		queues: (r) => ['DELETE', `/api/queues/${encodeURIComponent(r.vhost)}/${encodeURIComponent(r.name)}`],
		exchanges: (r) => ['DELETE', `/api/exchanges/${encodeURIComponent(r.vhost)}/${encodeURIComponent(r.name)}`],
		bindings: (r) => ['DELETE', `/api/bindings/${encodeURIComponent(r.vhost)}/e/${encodeURIComponent(r.source)}/${T[r.destination_type]}/${encodeURIComponent(r.destination)}/${encodeURIComponent(r.properties_key || '~')}`],
	},
};

const deployResources = async (client, changes, operation, type, operationOverride = null) => {
	const entries = changes[operation][type];
	if (entries.length) {
		const result = await Promise.allSettled(
			entries
				.map((resource) => {
					const op = operationOverride ?? operation;
					if (typeof C[op][type] === 'function') {
						const resourceArg = resource.after || resource;
						const [method, url] = C[op][type](resourceArg);
						return client.request(method, url, resourceArg);
					}

					throw new Error(`Invalid operation "${op}" on type "${type}"`);
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

const deploy = async (serverBaseUrl, definitions, { noDeletions = false, recreateChanged = false }) => {
	const client = new RabbitClient(serverBaseUrl);
	const changes = await diffServer(client, definitions);

	const changedResourceCount = (
		changes.changed.vhosts.length
		+ changes.changed.exchanges.length
		+ changes.changed.queues.length
		+ changes.changed.bindings.length
		+ changes.changed.users.length
	);
	if (noDeletions && recreateChanged) {
		throw new Error('Option conflict: --no-deletions and --recreate-changed both enabled.');
	}
	if (changedResourceCount && !recreateChanged) {
		console.warn(`Ignoring ${changedResourceCount} changed resources, which need to be deleted and recreated. Provide --recreate-changed option to deploy changed resources.`);
	}

	if (recreateChanged) {
		// Delete changed resources
		await deployResources(client, changes, 'changed', 'vhosts', 'deleted');
		await deployResources(client, changes, 'changed', 'exchanges', 'deleted');
		await deployResources(client, changes, 'changed', 'queues', 'deleted');
		await deployResources(client, changes, 'changed', 'bindings', 'deleted');
		await deployResources(client, changes, 'changed', 'users', 'deleted');
	}

	await deployResources(client, changes, 'added', 'vhosts');
	await deployResources(client, changes, 'added', 'exchanges');
	await deployResources(client, changes, 'added', 'queues');
	await deployResources(client, changes, 'added', 'bindings');
	await deployResources(client, changes, 'added', 'users');

	if (recreateChanged) {
		// Recreate changed resources
		await deployResources(client, changes, 'changed', 'vhosts', 'added');
		await deployResources(client, changes, 'changed', 'exchanges', 'added');
		await deployResources(client, changes, 'changed', 'queues', 'added');
		await deployResources(client, changes, 'changed', 'bindings', 'added');
		await deployResources(client, changes, 'changed', 'users', 'added');
	}

	const deletedResourceCount = (
		changes.deleted.vhosts.length
		+ changes.deleted.exchanges.length
		+ changes.deleted.queues.length
		+ changes.deleted.bindings.length
		+ changes.deleted.users.length
	);
	if (!noDeletions) {
		await deployResources(client, changes, 'deleted', 'bindings');
		await deployResources(client, changes, 'deleted', 'queues');
		await deployResources(client, changes, 'deleted', 'exchanges');
		await deployResources(client, changes, 'deleted', 'vhosts');
		await deployResources(client, changes, 'deleted', 'users');
	} else {
		if (deletedResourceCount) {
			console.warn(`Ignored ${deletedResourceCount} deleted resource(s). Remove --no-deletions to remove deleted resources from server.`);
		}
	}
};

export default deploy;
