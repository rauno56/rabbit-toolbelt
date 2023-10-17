import RabbitClient from './RabbitClient.js';
import { diffServer } from './deploy.utils.js';

// automatically url-encode template string variables
const url = (strs, ...values) => {
	const escapedValues = values.map(encodeURIComponent);
	return escapedValues.map((val, idx) => strs[idx] + val).join('') + strs[strs.length - 1];
};

const T = {
	exchange: 'e',
	queue: 'q',
};
const C = {
	added: {
		vhosts: (r) => ['PUT', url`/api/vhosts/${r.name}`],
		users: (r) => ['PUT', url`/api/users/${r.name}`],
		queues: (r) => ['PUT', url`/api/queues/${r.vhost}/${r.name}`],
		exchanges: (r) => ['PUT', url`/api/exchanges/${r.vhost}/${r.name}`],
		bindings: (r) => ['POST', url`/api/bindings/${r.vhost}/e/${r.source}/${T[r.destination_type]}/${r.destination}`],
		permissions: (r) => ['PUT', url`/api/permissions/${r.vhost}/${r.user}`],
		topic_permissions: (r) => ['PUT', url`/api/topic-permissions/${r.vhost}/${r.user}`],
	},
	deleted: {
		vhosts: (r) => ['DELETE', url`/api/vhosts/${r.name}`],
		users: (r) => ['DELETE', url`/api/users/${r.name}`],
		queues: (r) => ['DELETE', url`/api/queues/${r.vhost}/${r.name}`],
		exchanges: (r) => ['DELETE', url`/api/exchanges/${r.vhost}/${r.name}`],
		bindings: (r) => ['DELETE', url`/api/bindings/${r.vhost}/e/${r.source}/${T[r.destination_type]}/${r.destination}/${r.properties_key || '~'}`],
		permissions: (r) => ['DELETE', url`/api/permissions/${r.vhost}/${r.user}`],
		topic_permissions: (r) => ['DELETE', url`/api/topic-permissions/${r.vhost}/${r.user}`],
	},
	changed: {
		users: (r) => ['PUT', url`/api/users/${r.name}`],
		permissions: (r) => ['PUT', url`/api/permissions/${r.vhost}/${r.user}`],
		topic_permissions: (r) => ['PUT', url`/api/topic-permissions/${r.vhost}/${r.user}`],
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

		if (operation === 'changed' && operationOverride) {
			console.error(`${operationOverride}(for changing) ${succeeded.length} ${type}` + failedNotice);
		} else {
			console.error(`${operation} ${succeeded.length} ${type}` + failedNotice);
		}

		if (failed.length) {
			throw failed[0].reason;
		}
	}
};

const deploy = async (serverBaseUrl, definitions, { dryRun = false, noDeletions = false, recreateChanged = false }) => {
	if (dryRun) {
		console.warn('Warning: Dry run is enabled. No changes will be applied.');
	}
	const client = new RabbitClient(serverBaseUrl, { dryRun });
	const changes = await diffServer(client, definitions);

	const mutableResources = ['users', 'permissions', 'topic_permissions'];
	const changedResourceCount = Object.entries(changes.changed)
		.reduce((acc, [type, list]) => acc + (mutableResources.includes(type) ? 0 : list.length), 0);

	const hasAddedPermissionsForVhosts = changes.added.vhosts.every(({ name }) => {
		return !changes.added.permissions.find(({ vhost }) => vhost === name);
	});

	if (changes.added.vhosts.length && hasAddedPermissionsForVhosts) {
		console.warn('There are added vhosts that lack permissions to later update those vhosts. Make sure there there are added permissions for every added vhost.');
	}

	if (noDeletions && recreateChanged) {
		throw new Error('Option conflict: --no-deletions and --recreate-changed both enabled.');
	}
	if (changedResourceCount && !recreateChanged) {
		console.warn(`Ignoring ${changedResourceCount} changed resources, which need to be deleted and recreated. Provide --recreate-changed option to deploy changed resources.`);
	}

	await deployResources(client, changes, 'changed', 'users');
	await deployResources(client, changes, 'changed', 'permissions');
	await deployResources(client, changes, 'changed', 'topic_permissions');

	if (recreateChanged) {
		// Delete changed resources
		await deployResources(client, changes, 'changed', 'vhosts', 'deleted');
		await deployResources(client, changes, 'changed', 'exchanges', 'deleted');
		await deployResources(client, changes, 'changed', 'queues', 'deleted');
		await deployResources(client, changes, 'changed', 'bindings', 'deleted');
	}

	await deployResources(client, changes, 'added', 'vhosts');
	await deployResources(client, changes, 'added', 'exchanges');
	await deployResources(client, changes, 'added', 'queues');
	await deployResources(client, changes, 'added', 'bindings');
	await deployResources(client, changes, 'added', 'users');
	await deployResources(client, changes, 'added', 'permissions');
	await deployResources(client, changes, 'added', 'topic_permissions');

	if (recreateChanged) {
		// Recreate changed resources
		await deployResources(client, changes, 'changed', 'vhosts', 'added');
		await deployResources(client, changes, 'changed', 'exchanges', 'added');
		await deployResources(client, changes, 'changed', 'queues', 'added');
		await deployResources(client, changes, 'changed', 'bindings', 'added');
	}

	const deletedResourceCount = Object.entries(changes.deleted)
		.reduce((acc, [/* type */, list]) => acc + list.length, 0);
	if (!noDeletions) {
		await deployResources(client, changes, 'deleted', 'bindings');
		await deployResources(client, changes, 'deleted', 'queues');
		await deployResources(client, changes, 'deleted', 'exchanges');
		await deployResources(client, changes, 'deleted', 'vhosts');
		await deployResources(client, changes, 'deleted', 'users');
		await deployResources(client, changes, 'deleted', 'permissions');
		await deployResources(client, changes, 'deleted', 'topic_permissions');
	} else {
		if (deletedResourceCount) {
			console.warn(`Ignored ${deletedResourceCount} deleted resource(s). Remove --no-deletions to remove deleted resources from server.`);
		}
	}
};

export default deploy;
