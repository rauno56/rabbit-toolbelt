import { readFile } from 'node:fs/promises';
import { json } from 'node:stream/consumers';

import {
	pathResolve,
} from './utils.js';
import RabbitClient from './RabbitClient.js';

export const resolveDefinitions = async (input) => {
	if (input === '-') {
		return json(process.stdin);
	}
	const location = pathResolve(input);
	if (location instanceof URL) {
		const client = new RabbitClient(location);
		return client.requestDefinitions();
	}
	return JSON.parse(await readFile(location, { encoding: 'utf8' }));
};

export default resolveDefinitions;
